import type { CSSProperties, ReactNode } from "react";
import manifest from "@/content/images.generated.json";
import { PHOTOS, mayPublishPhoto, type Photo, type PhotoId } from "@/content/photos";
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
  if (!meta && mayPublishPhoto(photo, FLAGS)) throw new Error(`Photo ${id} (${photo.slug}) missing from images.generated.json — run npm run images`);
  // Generic paper proportions for a hidden frame; no image-derived thumbnail or
  // metadata for this frame is bundled in the public build.
  return { photo, meta: meta ?? { width: 1200, height: 900, widths: [], blur: "" } };
};

/** Whether a photo may appear at all (camp-group photos are hidden unless flagged on). */
export const isPhotoVisible = (id: PhotoId): boolean => PHOTOS[id].publication !== "excluded" && !(PHOTOS[id].campGroup && !FLAGS.CAMP_GROUP_PHOTOS);

/** Whether a photo renders as the navy placeholder (not publishable under the current gates). */
export const isPhotoPlaceholder = (id: PhotoId): boolean => !mayPublishPhoto(PHOTOS[id], FLAGS);

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
 * Pending-photo illustration: the brand leap as a single ghost exposure on the
 * navy's contact sheet, over a short mat line. Deliberate print language (the
 * program plates), not a mascot and not a photo promise — release candidates
 * must read finished while frames await consent, so no "Fotografija uskoro"
 * text is rendered. Supersedes plan-figure-system §5.12 for pending slots only;
 * the KR frame code (frame foot) stays as the discreet archive tag.
 */
function PendingFigure() {
  return (
    <>
      <svg className="photo-placeholder__figure" viewBox="0 0 230 150" aria-hidden="true" focusable="false">
        <use href="#leap" width="230" height="150" />
      </svg>
      <span className="photo-placeholder__mat" aria-hidden="true" />
    </>
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
    <div className="photo photo-placeholder" style={boxStyle} data-photo-id={photo.id} data-placeholder="" aria-hidden="true">
      <PendingFigure />
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
