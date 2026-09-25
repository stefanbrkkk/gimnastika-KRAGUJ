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
  /** Real photos the chip shows (a MINOR_PHOTOS=false placeholder is not counted). */
  count: number;
}

/** Everything the lightbox needs to render one photo (no manifest import in the lazy chunk). */
export interface LightboxPhoto {
  id: PhotoId;
  slug: string;
  frame: string;
  alt: string;
  /** Category label for the print foot („▸ KR-15 · Treninzi“). */
  category: string;
  /** The alt text typeset for display: the lightbox shows it as the print's caption. */
  caption: string;
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
 * Grid `sizes` for the justified contact-sheet strips (gallery.css: rows of
 * equal photo height, flush ends). The widest print per layout: phones — the
 * lead print spans the row (100vw − 20·2 margins − 12 frame); tablets — the
 * 4:3 print in the two-frame feature strip; ≥1024 — the 4:3 print in the
 * three-frame feature strip (≈494px at the 1320px container).
 */
export const GRID_SIZES =
  "(min-width: 1440px) 500px, (min-width: 1024px) calc(40vw - 72px), (min-width: 640px) calc(57vw - 60px), calc(100vw - 52px)";

export const flipId = (id: PhotoId): string => `gl-${id}`;

/**
 * Contact-sheet order (presentation only — the category mapping stays in
 * content/gallery.ts). The sheet opens on the sport: KR-04 (the only photo of a
 * gymnast in flight, the logo's own split leap) leads, then result → sport
 * (01 · 15), and the camp lunch (16) closes the sheet as the „after“ shot.
 * gallery.css turns this order into equal-height strips — ≥1024: 04·01·15 |
 * 05·12·08·03 | 10·11·14·16; tablets: 04·01 | 15·05·12 | 08·03·10 | 11·14·16;
 * phones: 04 | 01·15 | 05·12 | 08·03 | 10·11 | 14·16. The near-identical mural
 * frames 12/14 are never side by side, filtered („Treninzi“ 04·15·12 | 03·14)
 * or not. Photos not listed (02/09 with CAMP_GROUP_PHOTOS) follow in content order.
 */
export const SHEET_ORDER: readonly PhotoId[] = ["04", "01", "15", "05", "12", "08", "03", "10", "11", "14", "16"];

export function inSheetOrder<T extends { photoId: PhotoId }>(items: readonly T[]): T[] {
  const rank = (item: T, i: number) => {
    const at = SHEET_ORDER.indexOf(item.photoId);
    return at < 0 ? SHEET_ORDER.length + i : at;
  };
  return items
    .map((item, i) => ({ item, r: rank(item, i) }))
    .sort((a, b) => a.r - b.r)
    .map(({ item }) => item);
}

/**
 * The public variant (MINOR_PHOTOS=false) turns most prints into the same navy
 * „Fotografija uskoro“ placeholder. Rather than a wall of identical tiles (cf.
 * D-S8-9 for the camp postcards), the sheet shows the real photos plus ONE
 * placeholder as the „more to come“ note, and the chips count real photos only.
 * With MINOR_PHOTOS=true nothing is a placeholder: `shown` and `real` equal `items`.
 */
export function publicSheet<T>(items: readonly T[], isPlaceholder: (item: T) => boolean): { shown: T[]; real: T[] } {
  const real = items.filter((item) => !isPlaceholder(item));
  const note = items.filter(isPlaceholder).slice(0, 1);
  return { shown: [...real, ...note], real };
}
