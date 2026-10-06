// Generates responsive photos for <Picture>: AVIF + WebP at 480/960/1600
// (never above native width), a tiny inline blur placeholder, and the static
// grain tile. Reads ONLY assets-source/slike/{web,rezerva} — the list of files
// comes from content/photos.ts. Metadata is never kept (sharp strips it by
// default; withMetadata/keepExif are intentionally never called).
// Run: npm run images
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import sharp from "sharp";
import { PHOTOS, mayPublishPhoto } from "../content/photos.ts";
import { FLAGS } from "../content/site.ts";

const OUT_DIR = "public/img";
const MANIFEST = "content/images.generated.json";
const WIDTHS = [480, 960, 1600];
const ALLOWED = /^assets-source\/slike\/(web|rezerva)\/[\w-]+\.jpg$/;

const entries = Object.values(PHOTOS).filter((p) => mayPublishPhoto(p, FLAGS));
if (entries.length === 0) throw new Error("No photos found in content/photos.ts");

// Very light cool grade, identical for every photo (contact-sheet consistency).
// Design review v2 (AC-10): still light, now visible — reds trimmed, shadows lifted toward blue,
// −10 % saturation, so orange halls, green parks and the rainbow mural sit in one cool family.
const grade = (img) => img.modulate({ saturation: 0.9 }).linear([0.97, 1.0, 1.04], [-2, 0, 6]);

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const manifest = {};
for (const { slug, file } of entries) {
  if (!ALLOWED.test(file)) throw new Error(`Refusing to read ${file}: only assets-source/slike/{web,rezerva}/*.jpg`);
  const input = await readFile(file);
  const meta = await sharp(input).metadata();
  const native = meta.width;
  const widths = WIDTHS.filter((w) => w <= native);
  // Preserve full detail in small Instagram sources and screenshots.
  if (native < 960 && !widths.includes(native)) widths.push(native);
  if (widths.length === 0) widths.push(native);

  for (const w of widths) {
    const base = grade(sharp(input).rotate().resize({ width: w, withoutEnlargement: true }));
    await base.clone().avif({ quality: 52, effort: 5 }).toFile(`${OUT_DIR}/${slug}-${w}.avif`);
    await base.clone().webp({ quality: 76, effort: 5 }).toFile(`${OUT_DIR}/${slug}-${w}.webp`);
  }
  const blur = await grade(sharp(input).rotate().resize({ width: 16 })).webp({ quality: 40 }).toBuffer();
  manifest[slug] = {
    width: native,
    height: meta.height,
    widths,
    blur: `data:image/webp;base64,${blur.toString("base64")}`,
  };
  console.log(`${slug}: ${native}×${meta.height} → ${widths.join("/")}`);
}

// Static grain tile (deterministic LCG noise, ~neutral grey for overlay blending).
const SIZE = 128;
const noise = Buffer.alloc(SIZE * SIZE);
let seed = 0x6b7261;
for (let i = 0; i < noise.length; i++) {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  noise[i] = 128 + ((seed >>> 24) - 128) * 0.9;
}
// 4-level palette: at 3.5 % overlay opacity the quantisation is invisible, and the tile drops from ~24 KB to a few KB.
await sharp(noise, { raw: { width: SIZE, height: SIZE, channels: 1 } })
  .png({ compressionLevel: 9, palette: true, colors: 4, dither: 0 })
  .toFile(`${OUT_DIR}/grain.png`);

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\n${entries.length} photos → ${OUT_DIR}, manifest → ${MANIFEST}`);
