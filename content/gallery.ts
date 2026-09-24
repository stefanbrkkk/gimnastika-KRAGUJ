/**
 * Gallery (§5 S9). Chips: Takmičenja · Treninzi · Kampovi.
 */
import type { PhotoId } from "./photos";

export type GalleryCategory = "takmicenja" | "treninzi" | "kampovi";

export const GALLERY_CATEGORIES: readonly { id: GalleryCategory; label: string }[] = [
  { id: "takmicenja", label: "Takmičenja" },
  { id: "treninzi", label: "Treninzi" },
  { id: "kampovi", label: "Kampovi" },
];

export interface GalleryItem {
  photoId: PhotoId;
  category: GalleryCategory;
}

export const GALLERY: readonly GalleryItem[] = [
  { photoId: "01", category: "takmicenja" },
  { photoId: "05", category: "takmicenja" },
  { photoId: "08", category: "takmicenja" },
  { photoId: "03", category: "treninzi" },
  { photoId: "04", category: "treninzi" },
  { photoId: "12", category: "treninzi" },
  { photoId: "14", category: "treninzi" },
  { photoId: "15", category: "treninzi" },
  { photoId: "10", category: "kampovi" },
  { photoId: "11", category: "kampovi" },
  { photoId: "16", category: "kampovi" },
  // Only when FLAGS.CAMP_GROUP_PHOTOS:
  { photoId: "02", category: "kampovi" },
  { photoId: "09", category: "kampovi" },
];

export const GALLERY_COPY = { heading: "Galerija" } as const;
