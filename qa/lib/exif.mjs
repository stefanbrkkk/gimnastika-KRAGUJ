// Container-level metadata inspection (no dependencies): finds EXIF / XMP / IPTC
// / ICC in JPEG, PNG, WebP, AVIF/HEIF (ISO-BMFF) and GIF files.
// Used by qa/content.mjs (out/) and tests/images.test.ts (public/img).

const ascii = (buf, start, len) => buf.toString("latin1", start, start + len);
const EXIF_HEADER = Buffer.from("Exif\0\0", "latin1");

function jpeg(buf, r) {
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // EOI / start of scan: no more metadata segments
    const len = buf.readUInt16BE(i + 2);
    const seg = buf.subarray(i + 4, i + 2 + len);
    if (marker === 0xe1 && seg.subarray(0, 6).equals(EXIF_HEADER)) r.exif.push(`APP1 Exif (${len} B)`);
    if (marker === 0xe1 && ascii(seg, 0, 29) === "http://ns.adobe.com/xap/1.0/\0") r.xmp.push("APP1 XMP");
    if (marker === 0xed && ascii(seg, 0, 13) === "Photoshop 3.0") r.iptc.push("APP13 IPTC");
    if (marker === 0xe2 && ascii(seg, 0, 11) === "ICC_PROFILE") r.icc.push("APP2 ICC");
    i += 2 + len;
  }
}

function png(buf, r) {
  let i = 8;
  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = ascii(buf, i + 4, 4);
    const body = buf.subarray(i + 8, i + 8 + len);
    if (type === "eXIf") r.exif.push(`eXIf (${len} B)`);
    if (type === "iCCP") r.icc.push("iCCP");
    if (type === "tEXt" || type === "zTXt" || type === "iTXt") {
      const keyword = ascii(body, 0, Math.max(0, body.indexOf(0)));
      if (keyword === "XML:com.adobe.xmp") r.xmp.push(`${type} XMP`);
      if (/^Raw profile type (exif|APP1)$/i.test(keyword)) r.exif.push(`${type} ${keyword}`);
      if (/^Raw profile type iptc$/i.test(keyword)) r.iptc.push(`${type} ${keyword}`);
    }
    if (type === "IEND") break;
    i += 12 + len;
  }
}

function webp(buf, r) {
  let i = 12;
  while (i + 8 <= buf.length) {
    const type = ascii(buf, i, 4);
    const len = buf.readUInt32LE(i + 4);
    if (type === "VP8X") {
      const flags = buf[i + 8];
      if (flags & 0x08) r.exif.push("VP8X EXIF flag");
      if (flags & 0x04) r.xmp.push("VP8X XMP flag");
    }
    if (type === "EXIF") r.exif.push(`EXIF chunk (${len} B)`);
    if (type === "XMP ") r.xmp.push("XMP chunk");
    if (type === "ICCP") r.icc.push("ICCP chunk");
    i += 8 + len + (len % 2);
  }
}

function* boxes(buf, start, end) {
  let i = start;
  while (i + 8 <= end) {
    let size = buf.readUInt32BE(i);
    const type = ascii(buf, i + 4, 4);
    let header = 8;
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(i + 8));
      header = 16;
    } else if (size === 0) size = end - i;
    if (size < header || i + size > end) return;
    yield { type, start: i + header, end: i + size };
    i += size;
  }
}

function isobmff(buf, r) {
  for (const box of boxes(buf, 0, buf.length)) {
    if (box.type === "Exif") r.exif.push("top-level Exif box");
    if (box.type !== "meta") continue;
    for (const child of boxes(buf, box.start + 4, box.end)) {
      if (child.type !== "iinf") continue;
      const version = buf[child.start];
      const first = child.start + 4 + (version === 0 ? 2 : 4);
      for (const infe of boxes(buf, first, child.end)) {
        if (infe.type !== "infe") continue;
        const v = buf[infe.start];
        if (v < 2) continue;
        const typeAt = infe.start + 4 + (v === 2 ? 2 : 4) + 2;
        const itemType = ascii(buf, typeAt, 4);
        if (itemType === "Exif") r.exif.push("iinf item 'Exif'");
        if (itemType === "mime") {
          const rest = ascii(buf, typeAt + 4, infe.end - typeAt - 4);
          if (rest.includes("application/rdf+xml")) r.xmp.push("iinf item mime XMP");
        }
      }
    }
  }
}

/**
 * Returns { format, exif: string[], xmp: string[], iptc: string[], icc: string[] }.
 * `exif` is non-empty when EXIF is present (container record or "Exif\0\0" header).
 */
export function inspectMetadata(buf) {
  const r = { format: "unknown", exif: [], xmp: [], iptc: [], icc: [] };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    r.format = "jpeg";
    jpeg(buf, r);
  } else if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    r.format = "png";
    png(buf, r);
  } else if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 4) === "WEBP") {
    r.format = "webp";
    webp(buf, r);
  } else if (ascii(buf, 4, 4) === "ftyp") {
    r.format = ascii(buf, 8, 4).trim();
    isobmff(buf, r);
  } else if (ascii(buf, 0, 3) === "GIF") {
    r.format = "gif";
    if (buf.includes(Buffer.from("XMP DataXMP", "latin1"))) r.xmp.push("GIF XMP application extension");
  }
  if (r.exif.length === 0 && buf.includes(EXIF_HEADER)) r.exif.push('"Exif\\0\\0" header found in file bytes');
  return r;
}

export const IMAGE_EXT = /\.(jpe?g|png|webp|avif|heic|heif|gif)$/i;
