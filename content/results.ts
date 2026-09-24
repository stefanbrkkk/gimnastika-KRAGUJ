/**
 * "Uspesi" (§5 S7). Only ✅ facts from docs/dosije.md.
 * NO medal counts and NO apparatus names for 2023 until the club confirms them.
 */
import { GSS, SOURCES } from "./site";

export interface ResultItem {
  text: string;
  /** Display date/place line, e.g. "Beograd, 2. 12. 2023." */
  date: string;
  sourceUrl: string;
  kind: "medalja" | "nastup";
}

export const RESULTS: readonly ResultItem[] = [
  {
    kind: "medalja",
    text: "Zlato, srebro i bronza na finalu Prvenstva Srbije u B programu",
    date: "Beograd, 2. 12. 2023.",
    sourceUrl: SOURCES.bulletin2023,
  },
  {
    kind: "medalja",
    text: "1. mesto ekipno — I kolo B programa",
    date: "Kostolac, 29. 5. 2022.",
    sourceUrl: SOURCES.bulletin2022,
  },
  {
    kind: "nastup",
    text: "Prvenstvo Srbije u apsolutnoj kategoriji",
    date: "Kostolac, 2024.",
    sourceUrl: SOURCES.bulletin2024,
  },
  {
    kind: "nastup",
    text: "Prvenstvo Srbije u aerobnoj gimnastici",
    date: "Ruma, 13. 12. 2025.",
    sourceUrl: SOURCES.bulletin2025Aer,
  },
  {
    kind: "nastup",
    text: "Međuklupsko promotivno takmičenje u aerobnoj i kreativnoj gimnastici",
    date: "Negotin, 15. 5. 2026.",
    sourceUrl: SOURCES.negotin2026,
  },
];

export interface StatTile {
  /** Doto numeral (digits only). */
  value: string;
  /** Optional word before the numeral, set in Mona Sans: "oko". */
  prefix?: string;
  label: string;
  sourceUrl: string;
}

export const STATS: readonly StatTile[] = [
  { value: "2007", label: "početak rada", sourceUrl: SOURCES.glasSumadije },
  {
    value: "42",
    label: "registrovane takmičarke u sportskoj gimnastici (GSS, 2026)",
    sourceUrl: SOURCES.registered2026Zsg,
  },
  {
    value: "12",
    label: "registrovanih takmičarki u aerobnoj gimnastici (GSS, 2026)",
    sourceUrl: SOURCES.registered2026Aer,
  },
  { value: "120", prefix: "oko", label: "članova (2024)", sourceUrl: SOURCES.glasSumadije },
];

export const TRUST_ROW = [
  { text: "Član Gimnastičkog saveza Srbije", href: GSS.clubPage },
  { text: "Uz podršku Grada Kragujevca (2024)", href: SOURCES.glasSumadije },
] as const;

export const RESULTS_COPY = {
  heading: "Uspesi",
  medalsHeading: "Medalje",
  appearancesHeading: "Nastupi",
  sourceLabel: "izvor",
  photoCaption: "Naše takmičarke sa medaljama",
} as const;
