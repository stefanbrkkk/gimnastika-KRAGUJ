/**
 * §7 "Image test": no generated image carries EXIF (or XMP/IPTC), and photo 08's
 * pixelated face stays pixelated in every generated 08 file.
 *
 * The EXIF detector (qa/lib/exif.mjs) parses the containers (JPEG APP1, PNG eXIf,
 * WebP EXIF/VP8X, AVIF/HEIF iinf 'Exif' items) and is cross-checked with sharp.
 * The mosaic metric (qa/lib/pixelation.mjs) is explained in that file; the same
 * helpers run on out/img in qa/content.mjs.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import manifest from "@/content/images.generated.json";
import { PHOTOS } from "@/content/photos";
import { IMAGE_EXT, inspectMetadata } from "../qa/lib/exif.mjs";
import { THRESHOLDS, checkPhoto08, greyscale, isPixelated, mosaicMetrics, PHOTO08_MOSAIC } from "../qa/lib/pixelation.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const IMG = join(ROOT, "public/img");
const images = readdirSync(IMG).filter((f) => IMAGE_EXT.test(f));
const MANIFEST = manifest as Record<string, { width: number; height: number; widths: number[] }>;

describe("EXIF detector (self-test on in-memory images that DO carry metadata)", () => {
  const exif = { IFD0: { Copyright: "qa", Make: "QA-Camera" } };
  const base = () => sharp({ create: { width: 32, height: 24, channels: 3, background: "#306098" } }).withExif(exif);

  it.each([
    ["jpeg", () => base().jpeg().toBuffer()],
    ["png", () => base().png().toBuffer()],
    ["webp", () => base().webp().toBuffer()],
    ["avif", () => base().avif().toBuffer()],
  ] as const)("finds EXIF in %s", async (_format, make) => {
    const report = inspectMetadata(await make());
    expect(report.exif.length).toBeGreaterThan(0);
  });

  it.each([
    ["jpeg", () => sharp({ create: { width: 32, height: 24, channels: 3, background: "#fff" } }).jpeg().toBuffer()],
    ["webp", () => sharp({ create: { width: 32, height: 24, channels: 3, background: "#fff" } }).webp().toBuffer()],
    ["avif", () => sharp({ create: { width: 32, height: 24, channels: 3, background: "#fff" } }).avif().toBuffer()],
  ] as const)("reports a clean %s as clean", async (_format, make) => {
    expect(inspectMetadata(await make()).exif).toEqual([]);
  });
});

describe("no EXIF/XMP/IPTC in public/img", () => {
  it("finds the generated photos (AVIF + WebP for every photo)", () => {
    const expected = Object.values(MANIFEST).reduce((n, m) => n + m.widths.length * 2, 0);
    expect(images.filter((f) => /\.(avif|webp)$/.test(f)).length).toBe(expected);
  });

  it.each(images)("%s", async (file) => {
    const buf = readFileSync(join(IMG, file));
    const report = inspectMetadata(buf);
    expect(report.exif, `EXIF in ${file}`).toEqual([]);
    expect(report.xmp, `XMP in ${file}`).toEqual([]);
    expect(report.iptc, `IPTC in ${file}`).toEqual([]);
    const meta = await sharp(buf).metadata();
    expect(meta.exif, `sharp sees EXIF in ${file}`).toBeUndefined();
    expect(meta.xmp, `sharp sees XMP in ${file}`).toBeUndefined();
  });

  it("scripts/images.mjs never asks sharp to keep metadata", () => {
    const code = readFileSync(join(ROOT, "scripts/images.mjs"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\.(withMetadata|keepMetadata|keepExif|withExif|withExifMerge|keepXmp|withXmp)\s*\(/);
  });
});

describe("photo 08: the pixelated face stays pixelated", () => {
  const slug = PHOTOS["08"].slug;
  const outputs = images.filter((f) => f.startsWith(`${slug}-`));

  it("is always rendered uncropped (noCrop, D-14)", () => {
    expect(PHOTOS["08"].noCrop).toBe(true);
  });

  it("has an AVIF and a WebP for every generated width", () => {
    const widths = MANIFEST[slug]?.widths ?? [];
    // Rights-safe default builds do not emit the pending child photo. The source
    // mosaic is still checked below, but no derived public file may exist.
    if (widths.length === 0) {
      expect(outputs).toEqual([]);
      return;
    }
    expect(outputs.sort()).toEqual(widths.flatMap((w) => [`${slug}-${w}.avif`, `${slug}-${w}.webp`]).sort());
  });

  it("the hard-coded mosaic box matches the source (and a real face nearby does not look pixelated)", async () => {
    const result = await checkPhoto08(join(ROOT, PHOTO08_MOSAIC.source));
    expect(result.width).toBe(2000);
    expect(result.pixelated, JSON.stringify(result.mosaic)).toBe(true);
    expect(result.controlLooksNatural, JSON.stringify(result.control)).toBe(true);
  });

  it.each(outputs)("%s", async (file) => {
    const { mosaic, control } = await checkPhoto08(join(IMG, file));
    expect(mosaic.medianStd, "flat blocks").toBeLessThanOrEqual(THRESHOLDS.maxMedianStd);
    expect(mosaic.ratio, "edges on the block grid").toBeGreaterThanOrEqual(THRESHOLDS.minRatio);
    expect(mosaic.spread, "not a blank patch").toBeGreaterThanOrEqual(THRESHOLDS.minSpread);
    expect(isPixelated(control), `control face ${JSON.stringify(control)}`).toBe(false);
  });

  it("the metric notices when the mosaic is smoothed away", async () => {
    const small = outputs.find((f) => f.endsWith("-480.webp"));
    if (!small) {
      expect(outputs).toEqual([]);
      return;
    }
    const blurred = await sharp(join(IMG, small as string)).blur(2.5).toBuffer();
    expect(isPixelated(mosaicMetrics(await greyscale(blurred)))).toBe(false);
  });
});
