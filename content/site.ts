/**
 * Site-wide configuration: assumption flags (§0), contacts, SEO.
 *
 * Every flag has a default here. For one-off builds a flag can be overridden
 * with an env var of the same name prefixed by NEXT_PUBLIC_ (e.g.
 * NEXT_PUBLIC_MINOR_PHOTOS=false npm run build). The club edits the defaults.
 */

const bool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined || value === "" ? fallback : value === "true" || value === "1";

export const FLAGS = {
  /** The club never said the trial is free: copy says „probni trening“, never „besplatan“. */
  FREE_TRIAL: bool(process.env.NEXT_PUBLIC_FREE_TRIAL, false),
  /** Append " · po školskoj smeni" to the "08:30–10:30 ili 16:00–18:00" slots. */
  SHOW_SHIFT_NOTE: bool(process.env.NEXT_PUBLIC_SHOW_SHIFT_NOTE, false),
  /** Trampolina is only in the Instagram bio — not confirmed by the club. */
  SHOW_TRAMPOLINE: bool(process.env.NEXT_PUBLIC_SHOW_TRAMPOLINE, false),
  /** Membership fee not provided. */
  SHOW_FEES: bool(process.env.NEXT_PUBLIC_SHOW_FEES, false),
  /** Viber not confirmed. When false, messaging uses SMS. */
  SHOW_VIBER: bool(process.env.NEXT_PUBLIC_SHOW_VIBER, false),
  /** The Facebook page is only confirmed via the search index. */
  SHOW_FACEBOOK: bool(process.env.NEXT_PUBLIC_SHOW_FACEBOOK, false),
  /** New uneven bars (2026) are sourced only from an Instagram post. */
  SHOW_EQUIPMENT_2026: bool(process.env.NEXT_PUBLIC_SHOW_EQUIPMENT_2026, false),
  /**
   * Photos showing children render normally when true. When false, every photo
   * with a minor renders as a navy contact-sheet placeholder.
   * A PUBLIC URL (including *.pages.dev) is allowed only with MINOR_PHOTOS=false
   * OR after the club confirms parental consent. noindex is NOT consent.
   */
  MINOR_PHOTOS: bool(process.env.NEXT_PUBLIC_MINOR_PHOTOS, true),
  /** Photos 02 and 09 (camp groups, ~40 girls, possibly other clubs). */
  CAMP_GROUP_PHOTOS: bool(process.env.NEXT_PUBLIC_CAMP_GROUP_PHOTOS, false),
  /** Controls only <meta name="robots">, robots.txt and sitemap. */
  INDEXABLE: bool(process.env.NEXT_PUBLIC_INDEXABLE, false),
} as const;

/** After this date (Europe/Belgrade), the 2027 camp-registration sentence is hidden. */
export const CAMP_NOTE_UNTIL = "2027-06-30";

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

/** Primary number: used for SMS, the hero call CTA, Viber and fallbacks. */
export const PRIMARY_PHONE: Phone = { display: "060 028 7631", e164: "+381600287631" };

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
  { href: "#raspored", label: "Raspored" },
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
