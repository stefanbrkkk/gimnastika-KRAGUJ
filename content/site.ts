/**
 * Site-wide configuration: assumption flags (§0), contacts, SEO.
 *
 * Every flag has a default here. For one-off builds a flag can be overridden
 * with an env var of the same name prefixed by NEXT_PUBLIC_ (e.g.
 * NEXT_PUBLIC_MINOR_PHOTOS=false npm run build). The club edits the defaults.
 */

const bool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === "") return fallback;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  // Fail closed and loudly: a typo ("True", "yes") must break the build, never
  // silently flip a consent or channel flag. See docs/photo-consent.md.
  throw new Error(`Invalid boolean env value ${JSON.stringify(value)} (expected "true"/"1"/"false"/"0")`);
};

export const FLAGS = {
  /** Confirmed by the club on 28 September 2026. */
  FREE_TRIAL: bool(process.env.NEXT_PUBLIC_FREE_TRIAL, true),
  /** Append " · po školskoj smeni" to the "08:30–10:30 ili 16:00–18:00" slots. */
  SHOW_SHIFT_NOTE: bool(process.env.NEXT_PUBLIC_SHOW_SHIFT_NOTE, true),
  /** Trampolina is only in the Instagram bio — not confirmed by the club. */
  SHOW_TRAMPOLINE: bool(process.env.NEXT_PUBLIC_SHOW_TRAMPOLINE, false),
  /** Membership fee not provided. */
  SHOW_FEES: bool(process.env.NEXT_PUBLIC_SHOW_FEES, false),
  /** Viber is used by the club; the number for direct chat still needs confirmation. */
  SHOW_VIBER: bool(process.env.NEXT_PUBLIC_SHOW_VIBER, true),
  /** The Facebook page is only confirmed via the search index. */
  SHOW_FACEBOOK: bool(process.env.NEXT_PUBLIC_SHOW_FACEBOOK, false),
  /** New uneven bars (2026) are sourced only from an Instagram post. */
  SHOW_EQUIPMENT_2026: bool(process.env.NEXT_PUBLIC_SHOW_EQUIPMENT_2026, false),
  /**
 * Global gate for photos showing children. The per-image publication decision in
 * content/photos.ts is authoritative; flags can only restrict an image further.
 * Missing or malformed values fail closed. noindex is NOT consent.
   */
  MINOR_PHOTOS: bool(process.env.NEXT_PUBLIC_MINOR_PHOTOS, false),
  /** An extra gate for individually cleared camp images; 02 and 09 are excluded regardless. */
  CAMP_GROUP_PHOTOS: bool(process.env.NEXT_PUBLIC_CAMP_GROUP_PHOTOS, false),
  /** Controls only <meta name="robots">, robots.txt and sitemap. */
  INDEXABLE: bool(process.env.NEXT_PUBLIC_INDEXABLE, false),
} as const;

/** Canonical origin. The domain is not bought yet. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://gimnastikakraguj.rs").replace(/\/$/, "");

export const CREDIT_NAME = "Stefan Brkljačić";
export const CREDIT_URL = "";

export const CLUB = {
  legalName: "Gimnastičko sportsko udruženje „Kraguj“",
  shortName: "GSU „Kraguj“",
  brandName: "Gimnastički klub Kraguj",
  instagramName: "Sportska Gimnastika Kraguj",
  city: "Kragujevac",
  since: 2007,
} as const;

export interface Phone {
  /** As printed: "060 028 7631" */
  display: string;
  /** E.164: "+381600287631" */
  e164: string;
}

export const PHONES: readonly Phone[] = [
  { display: "060 028 7631", e164: "+381600287631" },
  { display: "061 422 4386", e164: "+381614224386" },
];

/** Primary public call/SMS number. The Viber endpoint is separate and unconfirmed. */
export const PRIMARY_PHONE: Phone = { display: "060 028 7631", e164: "+381600287631" };

const viberTarget = process.env.NEXT_PUBLIC_VIBER_PHONE_E164 || "";
if (viberTarget && !/^\+[1-9]\d{7,14}$/.test(viberTarget)) throw new Error("Invalid Viber endpoint: expected E.164");
/** Set only after the club confirms which public number receives Viber chats. */
export const VIBER_PHONE_E164: string | null = viberTarget || null;

export const EMAIL = "sladjanakovacevickg@gmail.com";

export const SOCIAL = {
  instagram: "https://www.instagram.com/gimnasticki_klub_kraguj/",
  instagramHandle: "@gimnasticki_klub_kraguj",
  facebook: "https://www.facebook.com/sportskagimnastika.kraguj/",
} as const;

export const VENUE = {
  name: "Trgovinsko-ugostiteljska škola „Toza Dragović“",
  /** Local nickname — never used as the official name. */
  nickname: "„ŠUP“",
  street: "Save Kovačevića 25",
  postalCode: "34000",
  city: "Kragujevac",
  country: "RS",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Trgovinsko-ugostiteljska+%C5%A1kola+Toza+Dragovi%C4%87%2C+Save+Kova%C4%8Devi%C4%87a+25%2C+Kragujevac",
} as const;

export const GSS = {
  name: "Gimnastički savez Srbije",
  url: "https://www.gssrb.rs",
  clubPage: "https://www.gssrb.rs/kragujevac/",
} as const;

/** Source URLs (every one of them also appears in docs/dosije.md). */
export const SOURCES = {
  glasSumadije: "https://www.glassumadije.rs/grad-podrzava-gimnasticki-klub-kraguj-u-nabavci-sportske-opreme/",
  bulletin2022: "https://www.gssrb.rs/wp-content/uploads/2022/05/Bilten-I-kolo-B-Program-ZSG-GSS-2022.pdf",
  bulletin2023: "https://www.gssrb.rs/wp-content/uploads/2024/02/BILTEN-PRVENSTVO-SRBIJE-B-PROGRAM-FINALE-naslov.pdf",
  bulletin2024: "https://www.gssrb.rs/wp-content/uploads/2024/12/BILTEN-PRVENSTVO-SRBIJE-U-APSOLUTNOJ-KATEGORIJI-2024.-ZSG.pdf",
  bulletin2025Aer: "https://www.gssrb.rs/wp-content/uploads/2025/12/Bilten-AER-SRB-2025.pdf",
  negotin2026: "https://www.gssrb.rs/meduklupsko-promotivno-takmicenje-negotin-2026/",
  registered2026Zsg: "https://www.gssrb.rs/wp-content/uploads/2026/06/ZSG-Registrovane-takmicarke-I-rok-2026-azurirano-22.06.2026-1.pdf",
  registered2026Aer: "https://www.gssrb.rs/wp-content/uploads/2026/06/AER-Registrovane-takmicarke-I-rok-2026-azurirano-22.6.2026.-.pdf",
  gssClub: "https://www.gssrb.rs/kragujevac/",
  /** GSS list of registered coaches (ŽSG), September 2026 — both coaches' licences. */
  coachLicences: "https://www.gssrb.rs/wp-content/uploads/2026/09/ЖСГ-Ажирирани-списак-регистрованих-тренера-септембар-2026.pdf",
  /** GSS list of licensed judges 2026 — Slađana Kovačević. */
  judgeLicences: "https://www.gssrb.rs/wp-content/uploads/2026/09/Licencirane-sutkinje-2026.pdf",
} as const;

export const SEO = {
  title: "Gimnastički klub Kraguj — sportska gimnastika za decu u Kragujevcu",
  description:
    "Sportska gimnastika za decu od 3. godine i aerobna gimnastika u Kragujevcu. Licencirane trenerice, član Gimnastičkog saveza Srbije, upis tokom cele godine. Zakažite probni trening.",
  locale: "sr_RS",
} as const;

/** Header / anchor navigation (order as in §5 HEADER). */
export const NAV = [
  { href: "#programi", label: "Programi" },
  { href: "#treneri", label: "Trenerice" },
  { href: "#uspesi", label: "Uspesi" },
  { href: "#kamp", label: "Kamp" },
  { href: "#kontakt", label: "Kontakt" },
] as const;

export const CTA = {
  trial: "Zakažite probni trening",
  trialForGroup: "Zakažite probni trening za ovu grupu",
  call: "Pozovite",
  sms: "SMS",
  schedule: "Raspored",
  viewSchedule: "Pogledajte raspored",
} as const;
