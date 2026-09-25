import type { CSSProperties } from "react";
import { isPhotoPlaceholder, isPhotoVisible, photoEntry, Picture } from "@/components/ui/Picture";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GALLERY, GALLERY_CATEGORIES, GALLERY_COPY } from "@/content/gallery";
import { typesetSr } from "@/lib/typeset";
import { GalleryBrowser } from "./GalleryBrowser";
import { flipId, GALLERY_UI, GRID_SIZES, inSheetOrder, largestSrc, publicSheet, type GalleryChip, type LightboxPhoto } from "./model";

const HINT_ID = "galerija-hint";

/**
 * S9 „Galerija“ (§5 S9, §4 Gallery) — a darkroom: white prints on navy-950.
 * The sheet is a contact sheet of justified strips (equal photo height per
 * strip, flush ends; gallery.css), each print a white paper mount with its
 * KR-xx label. Server-rendered and complete without JS — every photo is visible
 * and links to its largest file. With JS, the first prints in view swing in
 * from their pegs (the lazy lightbox chunk arms it), the chips filter the sheet
 * (Flip) and a tap opens the lightbox (lazy chunk). Placeholder tiles
 * (MINOR_PHOTOS=false) are never openable, and the public variant shows only
 * one of them (publicSheet in model.ts).
 */
export function Gallery() {
  // Sheet order leads with the sport (model.ts SHEET_ORDER); the lightbox follows it.
  const items = inSheetOrder(GALLERY.filter((item) => isPhotoVisible(item.photoId)));
  // MINOR_PHOTOS=false: the real photos + one „Fotografija uskoro“ note, never a wall of placeholders.
  const { shown, real } = publicSheet(items, (item) => isPhotoPlaceholder(item.photoId));
  const labelOf = new Map(GALLERY_CATEGORIES.map((c) => [c.id, c.label] as const));

  // Chips count real photos; a filter row needs at least two categories to choose from.
  const categoryChips: GalleryChip[] = GALLERY_CATEGORIES.map((c) => ({
    key: c.id,
    label: c.label,
    count: real.filter((item) => item.category === c.id).length,
  })).filter((c) => c.count > 0);
  const chips: GalleryChip[] =
    categoryChips.length < 2 ? [] : [{ key: "all", label: GALLERY_UI.all, count: real.length }, ...categoryChips];

  const photos: LightboxPhoto[] = real.map((item) => {
    const { photo, meta } = photoEntry(item.photoId);
    return {
      id: photo.id,
      slug: photo.slug,
      frame: photo.frame,
      alt: photo.alt,
      category: typesetSr(labelOf.get(item.category) ?? ""),
      caption: typesetSr(photo.alt),
      width: meta.width,
      height: meta.height,
      widths: meta.widths,
    };
  });
  const photoById = new Map(photos.map((p) => [p.id, p] as const));

  return (
    <Section id="galerija" theme="darker" edge="up" labelledBy="galerija-title" className="gallery">
      <div className="container-site">
        <GalleryBrowser
          heading={<SectionHeading id="galerija-title" title={typesetSr(GALLERY_COPY.heading)} align="right" />}
          chips={chips}
          photos={photos}
        >
          <ul className="gl-grid" id="galerija-lista" role="list" data-gallery-grid="">
            {shown.map((item) => {
              const category = labelOf.get(item.category) ?? "";
              const photo = photoById.get(item.photoId);
              const { meta } = photoEntry(item.photoId);
              // A white paper mount (light theme tokens: KR label in slate, zoom mark in royal) on the
              // darkroom sheet; the link around it keeps the section's lavender focus ring.
              const print = (
                <div className="gl-mount" data-theme="light">
                  <Picture
                    id={item.photoId}
                    frame
                    caption={typesetSr(category)}
                    sizes={GRID_SIZES}
                    className="gl-print"
                    dataAttrs={{ "data-flip-id": flipId(item.photoId) }}
                  />
                  {photo ? (
                    <span className="gl-zoom" aria-hidden="true">
                      <svg className="ui-icon" viewBox="0 0 20 20" focusable="false">
                        <path d="M12 3.5h4.5V8M8 16.5H3.5V12M16.5 3.5 11.5 8.5M3.5 16.5l5-5" />
                      </svg>
                    </span>
                  ) : null}
                </div>
              );
              return (
                // A placeholder (public variant) is the sheet's „more to come“ note: it shows under
                // „Sve“ only (no data-category), so each category chip's count matches its prints.
                // --ar: the print's aspect ratio drives its share of the strip (gallery.css).
                <li
                  key={item.photoId}
                  className="gl-item"
                  data-category={photo ? item.category : undefined}
                  data-photo={item.photoId}
                  style={{ "--ar": (meta.width / meta.height).toFixed(4) } as CSSProperties}
                >
                  {photo ? (
                    // aria-label: Chrome computes no name from content through the <figure> (empty link name).
                    <a
                      className="gl-open"
                      href={largestSrc(photo)}
                      data-gallery-open={item.photoId}
                      aria-label={photo.alt}
                      aria-describedby={HINT_ID}
                    >
                      {print}
                    </a>
                  ) : (
                    print
                  )}
                </li>
              );
            })}
          </ul>
        </GalleryBrowser>
        <p id={HINT_ID} hidden>
          {GALLERY_UI.openHint}
        </p>
      </div>
    </Section>
  );
}
