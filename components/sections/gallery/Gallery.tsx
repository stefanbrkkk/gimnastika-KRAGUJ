import { isPhotoPlaceholder, isPhotoVisible, photoEntry, Picture } from "@/components/ui/Picture";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GALLERY, GALLERY_CATEGORIES, GALLERY_COPY } from "@/content/gallery";
import { GalleryBrowser } from "./GalleryBrowser";
import { flipId, GALLERY_UI, GRID_SIZES, largestSrc, type GalleryChip, type LightboxPhoto } from "./model";

const HINT_ID = "galerija-hint";

/**
 * S9 „Galerija“ (§5 S9, §4 Gallery). A contact sheet: CSS-columns masonry of
 * framed prints with KR-xx labels. Server-rendered and complete without JS —
 * every photo is visible and links to its largest file. With JS, the chips
 * filter the sheet (Flip) and a tap opens the lightbox (lazy chunk).
 * Placeholder tiles (MINOR_PHOTOS=false) are never openable.
 */
export function Gallery() {
  const items = GALLERY.filter((item) => isPhotoVisible(item.photoId));
  const labelOf = new Map(GALLERY_CATEGORIES.map((c) => [c.id, c.label] as const));

  const chips: GalleryChip[] = [
    { key: "all", label: GALLERY_UI.all, count: items.length },
    ...GALLERY_CATEGORIES.map((c) => ({
      key: c.id,
      label: c.label,
      count: items.filter((item) => item.category === c.id).length,
    })).filter((c) => c.count > 0),
  ];

  const photos: LightboxPhoto[] = items
    .filter((item) => !isPhotoPlaceholder(item.photoId))
    .map((item) => {
      const { photo, meta } = photoEntry(item.photoId);
      return {
        id: photo.id,
        slug: photo.slug,
        frame: photo.frame,
        alt: photo.alt,
        width: meta.width,
        height: meta.height,
        widths: meta.widths,
      };
    });
  const photoById = new Map(photos.map((p) => [p.id, p] as const));

  return (
    <Section id="galerija" theme="ice" labelledBy="galerija-title" className="gallery">
      <div className="container-site">
        <GalleryBrowser
          heading={<SectionHeading id="galerija-title" title={GALLERY_COPY.heading} align="right" />}
          chips={chips}
          photos={photos}
        >
          <ul className="gl-grid" id="galerija-lista" role="list" data-gallery-grid="">
            {items.map((item) => {
              const category = labelOf.get(item.category) ?? "";
              const photo = photoById.get(item.photoId);
              const print = (
                <Picture
                  id={item.photoId}
                  frame
                  caption={category}
                  sizes={GRID_SIZES}
                  className="gl-print"
                  dataAttrs={{ "data-flip-id": flipId(item.photoId) }}
                />
              );
              return (
                <li key={item.photoId} className="gl-item" data-category={item.category} data-photo={item.photoId}>
                  {photo ? (
                    <a className="gl-open" href={largestSrc(photo)} data-gallery-open={item.photoId} aria-describedby={HINT_ID}>
                      {print}
                      <span className="gl-zoom" aria-hidden="true">
                        <svg viewBox="0 0 20 20" focusable="false">
                          <path d="M12 3.5h4.5V8M8 16.5H3.5V12M16.5 3.5 11.5 8.5M3.5 16.5l5-5" />
                        </svg>
                      </span>
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
