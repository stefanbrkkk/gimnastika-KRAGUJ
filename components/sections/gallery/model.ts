/**
 * Gallery (§5 S9) — pure, framework-free helpers shared by the server-rendered
 * grid, the small client island and the lazily loaded lightbox.
 */
import type { GalleryCategory } from "@/content/gallery";
import type { PhotoId } from "@/content/photos";

/* --------------------------------------------------------------------------
   Mechanical UI strings (not in the master prompt; listed in newCopy).
   -------------------------------------------------------------------------- */
export { GALLERY_UI } from "@/content/gallery";

/** Serbian plural of „fotografija“: 1 fotografija · 2–4 fotografije · 5+ fotografija (11–14 → fotografija). */
export function photoWord(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14)) return "fotografije";
  return "fotografija";
}

/** aria-live status after a filter change, e.g. „Takmičenja — 3 fotografije“. */
export const filterStatus = (label: string, n: number): string => `${label} — ${n} ${photoWord(n)}`;

/** Lightbox counter for screen readers, e.g. „Fotografija 3 od 11“. */
export const counterLabel = (i: number, n: number): string => `Fotografija ${i} od ${n}`;

export type ChipKey = "all" | GalleryCategory;

export interface GalleryChip {
  key: ChipKey;
  label: string;
  /** Photos (incl. placeholders) the chip shows. */
  count: number;
}

/** Everything the lightbox needs to render one photo (no manifest import in the lazy chunk). */
export interface LightboxPhoto {
  id: PhotoId;
  slug: string;
  frame: string;
  alt: string;
  width: number;
  height: number;
  widths: readonly number[];
}

/** Largest CSS width a photo may render at: native px / 2 (DPR 2 never upscales). */
export const nativeHalf = (p: Pick<LightboxPhoto, "width">): number => Math.floor(p.width / 2);

export const srcSet = (p: Pick<LightboxPhoto, "slug" | "widths">, ext: "avif" | "webp"): string =>
  p.widths.map((w) => `/img/${p.slug}-${w}.${ext} ${w}w`).join(", ");

/** The largest generated file (the no-JS link target: the browser shows the image itself). */
export const largestSrc = (p: Pick<LightboxPhoto, "slug" | "widths">): string =>
  `/img/${p.slug}-${p.widths[p.widths.length - 1] ?? 960}.webp`;

/**
 * Lightbox `sizes`: the photo fills the viewport width but never exceeds
 * native/2 CSS px (the CSS clamps it to the same cap).
 */
export const lightboxSizes = (p: Pick<LightboxPhoto, "width">): string => {
  const cap = nativeHalf(p);
  return `(min-width: ${cap}px) ${cap}px, 100vw`;
};

/**
 * Grid `sizes` for the CSS-columns masonry (2 columns <640, 3 columns ≥640,
 * container 1320px, margins 20/32/48, gutters 12/16/24, frame padding 6px).
 */
export const GRID_SIZES =
  "(min-width: 1440px) 412px, (min-width: 1024px) calc(33.3vw - 60px), (min-width: 640px) calc(33.3vw - 44px), calc(50vw - 38px)";

export const flipId = (id: PhotoId): string => `gl-${id}`;
