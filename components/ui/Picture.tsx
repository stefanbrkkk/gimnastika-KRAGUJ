import type { CSSProperties, ReactNode } from "react";
import manifest from "@/content/images.generated.json";
import { PHOTO_PLACEHOLDER } from "@/content/copy";
import { PHOTOS, type Photo, type PhotoId } from "@/content/photos";
import { FLAGS } from "@/content/site";

interface ManifestEntry {
  width: number;
  height: number;
  widths: number[];
  blur: string;
}

const MANIFEST = manifest as Record<string, ManifestEntry>;

export const photoEntry = (id: PhotoId): { photo: Photo; meta: ManifestEntry } => {
  const photo = PHOTOS[id];
  const meta = MANIFEST[photo.slug];
  if (!meta) throw new Error(`Photo ${id} (${photo.slug}) missing from images.generated.json — run npm run images`);
  return { photo, meta };
};

/** Whether a photo may appear at all (camp-group photos are hidden unless flagged on). */
export const isPhotoVisible = (id: PhotoId): boolean => !(PHOTOS[id].campGroup && !FLAGS.CAMP_GROUP_PHOTOS);

/** Whether a photo renders as the navy placeholder (minor + MINOR_PHOTOS=false). */
export const isPhotoPlaceholder = (id: PhotoId): boolean => PHOTOS[id].hasMinors && !FLAGS.MINOR_PHOTOS;

/**
 * Largest CSS width at which a photo may render: native px / 2 (so DPR 2 never
 * upscales), reduced further when a cover-crop to a taller box would enlarge it.
 */
export function maxCssWidth(meta: Pick<ManifestEntry, "width" | "height">, boxAspect?: number): number {
  const imgAspect = meta.width / meta.height;
  const crop = boxAspect && boxAspect < imgAspect ? boxAspect / imgAspect : 1;
  return Math.floor((meta.width / 2) * crop);
}

interface PictureProps {
  id: PhotoId;
  /** Real `sizes` for this layout slot, e.g. "(min-width: 1024px) 520px, 90vw". */
  sizes: string;
  /** Box aspect ratio (w/h). Defaults to the photo's own ratio (no crop). Ignored for noCrop photos. */
  aspect?: number;
  /** Wrap in a contact-sheet frame with the "KR-xx" label. */
  frame?: boolean;
  caption?: ReactNode;
  className?: string;
  /** object-position for cover crops, e.g. "50% 30%". */
  position?: string;
  /** Override the registry alt (still: descriptive, never names). */
  alt?: string;
  /** Eager-load (only for above-the-fold photos; the hero uses none). */
  eager?: boolean;
  /** Extra attributes for interactive wrappers (e.g. gallery Flip ids). */
  dataAttrs?: Record<`data-${string}`, string>;
}

/**
 * The placeholder's glyph: a lens aperture in the .ui-icon stroke family (24px grid, 1.5
 * stroke, round caps, currentColor). No figure: a photo slot is UI chrome (plan-figure-system
 * §5.12, R5) — the frame code and the caption say the rest.
 */
function ApertureIcon() {
  return (
    <svg
      className="ui-icon photo-placeholder__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.93 12 11.05 20.45M13.96 15.4H4.21M10.04 15.4 5.16 6.95M8.07 12l4.88-8.45M10.04 8.6h9.75M13.96 8.6l4.88 8.45" />
    </svg>
  );
}

/**
 * <picture> with AVIF + WebP srcsets from scripts/images.mjs, intrinsic size,
 * inline blur placeholder, grain overlay and the native/2 width cap.
 * Renders the navy "Fotografija uskoro" placeholder for minors when MINOR_PHOTOS=false.
 */
export function Picture({ id, sizes, aspect, frame, caption, className, position, alt, eager, dataAttrs }: PictureProps) {
  if (!isPhotoVisible(id)) return null;
  const { photo, meta } = photoEntry(id);
  const boxAspect = photo.noCrop ? meta.width / meta.height : (aspect ?? meta.width / meta.height);
  const maxWidth = maxCssWidth(meta, boxAspect);
  const placeholder = isPhotoPlaceholder(id);

  const boxStyle: CSSProperties = {
    aspectRatio: String(boxAspect),
    maxWidth: `${maxWidth}px`,
    ...(placeholder ? {} : { backgroundImage: `url(${meta.blur})` }),
  };

  const media = placeholder ? (
    <div className="photo photo-placeholder" style={boxStyle} role="img" aria-label={PHOTO_PLACEHOLDER} data-photo-id={photo.id} data-placeholder="">
      <ApertureIcon />
      <span className="photo-placeholder__text label-caps">{PHOTO_PLACEHOLDER}</span>
    </div>
  ) : (
    <div className="photo" style={boxStyle} data-photo-id={photo.id} {...(photo.noCrop ? { "data-nocrop": "" } : {})} {...dataAttrs}>
      <picture>
        <source type="image/avif" srcSet={meta.widths.map((w) => `/img/${photo.slug}-${w}.avif ${w}w`).join(", ")} sizes={sizes} />
        <source type="image/webp" srcSet={meta.widths.map((w) => `/img/${photo.slug}-${w}.webp ${w}w`).join(", ")} sizes={sizes} />
        <img
          src={`/img/${photo.slug}-${meta.widths.includes(960) ? 960 : meta.widths[meta.widths.length - 1]}.webp`}
          width={meta.width}
          height={meta.height}
          alt={alt ?? photo.alt}
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          data-native-width={meta.width}
          style={position ? { objectPosition: position } : undefined}
        />
      </picture>
    </div>
  );

  if (!frame && !caption) return <div className={className}>{media}</div>;

  return (
    <figure className={["frame", className].filter(Boolean).join(" ")} style={{ maxWidth: `${maxWidth + 12}px` }}>
      {media}
      <div className="frame-foot">
        <span className="frame-label" aria-hidden="true">
          {photo.frame}
        </span>
        {caption ? <figcaption className="frame-caption">{caption}</figcaption> : null}
      </div>
    </figure>
  );
}
