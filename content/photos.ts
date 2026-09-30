/**
 * Photo registry. scripts/images.mjs processes exactly the files listed here
 * (from assets-source/slike/{web,rezerva}) — keep `file` paths in sync.
 *
 * Alt texts are descriptive and never contain names.
 * publication → per-image rights decision; flags can only restrict an approved image.
 * campGroup → hidden entirely while FLAGS.CAMP_GROUP_PHOTOS is false.
 */

export type PhotoId =
  | "01" | "02" | "03" | "04" | "05" | "06" | "08" | "09" | "10" | "11" | "12"
  | "14" | "15" | "16" | "17";

export interface Photo {
  id: PhotoId;
  /** Output slug (also the basename in assets-source). */
  slug: string;
  /** Source path relative to the repo root. */
  file: string;
  /** Contact-sheet frame label. */
  frame: `KR-${string}`;
  alt: string;
  hasMinors: boolean;
  /** A separate decision for each frame. Flags never override pending/excluded. */
  publication: "approved" | "pending" | "excluded";
  campGroup?: boolean;
  /**
   * Photo 08: one face is strongly pixelated. Never un-blur it, never crop so
   * that the pixelation looks accidental → always rendered uncropped (contain).
   */
  noCrop?: boolean;
}

export const PHOTOS: Record<PhotoId, Photo> = {
  "01": {
    id: "01",
    slug: "01-uspeh-medalje-ekipa",
    file: "assets-source/slike/web/01-uspeh-medalje-ekipa.jpg",
    frame: "KR-01",
    alt: "Šest takmičarki u klupskim trikoima sa medaljama oko vrata i trenerica koja čuči ispred njih u sportskoj hali",
    hasMinors: true,
    publication: "approved",
  },
  "02": {
    id: "02",
    slug: "02-zajednica-kamp-grupa",
    file: "assets-source/slike/web/02-zajednica-kamp-grupa.jpg",
    frame: "KR-02",
    alt: "Velika grupa devojčica u majicama gimnastičkog kampa sa sertifikatima u rukama, u gimnastičkoj sali",
    hasMinors: true,
    campGroup: true,
    publication: "approved",
  },
  "03": {
    id: "03",
    slug: "03-hala-ceo-klub-baner",
    file: "assets-source/slike/web/03-hala-ceo-klub-baner.jpg",
    frame: "KR-03",
    alt: "Članice kluba u trikoima i trenerkama stoje u redu ispod plavog klupskog banera „Gimnastički klub Kraguj“",
    hasMinors: true,
    publication: "approved",
  },
  "04": {
    id: "04",
    slug: "04-trening-airtrack-skok",
    file: "assets-source/slike/web/04-trening-airtrack-skok.jpg",
    frame: "KR-04",
    alt: "Gimnastičarka u skoku sa raširenim rukama na naduvanoj stazi tokom treninga, u pozadini klupski baner",
    hasMinors: true,
    publication: "approved",
  },
  "05": {
    id: "05",
    slug: "05-treneri-zajedno",
    file: "assets-source/slike/web/05-treneri-zajedno.jpg",
    frame: "KR-05",
    alt: "Dve trenerice u plavim klupskim jaknama zagrljene u sportskoj hali na takmičenju",
    hasMinors: true,
    publication: "approved",
  },
  "06": {
    id: "06",
    slug: "06-trener-portret-mladja",
    file: "assets-source/slike/web/06-trener-portret-mladja.jpg",
    frame: "KR-06",
    alt: "Portret trenerice u plavoj klupskoj jakni sa belim potezima na rukavima",
    hasMinors: false,
    publication: "approved",
  },
  "08": {
    id: "08",
    slug: "08-aerobik-tim-selfie",
    file: "assets-source/slike/web/08-aerobik-tim-selfie.jpg",
    frame: "KR-08",
    alt: "Takmičarke aerobne gimnastike u crnim trikoima i trenerica prave zajednički selfi",
    hasMinors: true,
    noCrop: true,
    publication: "approved",
  },
  "09": {
    id: "09",
    slug: "09-kamp-hala-sertifikati",
    file: "assets-source/slike/web/09-kamp-hala-sertifikati.jpg",
    frame: "KR-09",
    alt: "Devojčice i trenerice u majicama gimnastičkog kampa sede na klupi u sali i drže sertifikate",
    hasMinors: true,
    campGroup: true,
    publication: "approved",
  },
  "10": {
    id: "10",
    slug: "10-kamp-selfie-park",
    file: "assets-source/slike/web/10-kamp-selfie-park.jpg",
    frame: "KR-10",
    alt: "Trenerica pravi selfi sa grupom nasmejanih devojčica na stazi u parku",
    hasMinors: true,
    publication: "approved",
  },
  "11": {
    id: "11",
    slug: "11-kamp-penjanje",
    file: "assets-source/slike/web/11-kamp-penjanje.jpg",
    frame: "KR-11",
    alt: "Dve devojčice sa kacigama i pojasevima za penjanje u avanturističkom parku",
    hasMinors: true,
    publication: "approved",
  },
  "12": {
    id: "12",
    slug: "12-greda-mural-poze",
    file: "assets-source/slike/web/12-greda-mural-poze.jpg",
    frame: "KR-12",
    alt: "Gimnastičarke poziraju na gredi ispred šarenog geometrijskog murala",
    hasMinors: true,
    publication: "approved",
  },
  "14": {
    id: "14",
    slug: "14-greda-mural-sa-trenerom",
    file: "assets-source/slike/rezerva/14-greda-mural-sa-trenerom.jpg",
    frame: "KR-14",
    alt: "Gimnastičarke stoje na gredi ispred šarenog murala, a trenerica ispred njih",
    hasMinors: true,
    publication: "approved",
  },
  "15": {
    id: "15",
    slug: "15-razboj-trening-mutna",
    file: "assets-source/slike/rezerva/15-razboj-trening-mutna.jpg",
    frame: "KR-15",
    alt: "Gimnastičarka u uporu na dvovisinskom razboju tokom treninga",
    hasMinors: true,
    publication: "approved",
  },
  "16": {
    id: "16",
    slug: "16-kamp-rucak",
    file: "assets-source/slike/rezerva/16-kamp-rucak.jpg",
    frame: "KR-16",
    alt: "Zajednički ručak na kampu za dugim stolom pod tendom",
    hasMinors: true,
    publication: "approved",
  },
  "17": {
    id: "17",
    slug: "17-torta-rodjendan-kluba-2019",
    file: "assets-source/slike/rezerva/17-torta-rodjendan-kluba-2019.jpg",
    frame: "KR-17",
    alt: "Rođendanska torta sa ružama i natpisom „Srećan rođendan Kraguj“",
    hasMinors: false,
    publication: "approved",
  },
};

export const photo = (id: PhotoId): Photo => PHOTOS[id];

/** The only publication gate used by markup, image generation and export pruning. */
export function mayPublishPhoto(
  p: Photo,
  flags: { MINOR_PHOTOS: boolean; CAMP_GROUP_PHOTOS: boolean },
): boolean {
  return p.publication === "approved" &&
    (!p.hasMinors || (flags.MINOR_PHOTOS && (!p.campGroup || flags.CAMP_GROUP_PHOTOS)));
}
