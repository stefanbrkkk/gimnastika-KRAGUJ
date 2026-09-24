/**
 * "O nama" timeline (§5 S5). Each item links its source when it has one.
 */
import { SOURCES } from "./site";

export interface TimelineItem {
  year: number;
  title: string;
  text?: string;
  /** Source links (the first is the primary one). */
  sources?: readonly string[];
  /** Only rendered when the named flag is true. */
  flag?: "SHOW_EQUIPMENT_2026";
}

export const TIMELINE: readonly TimelineItem[] = [
  { year: 2007, title: "Počeci kluba", sources: [SOURCES.glasSumadije] },
  // TODO(klub): confirm the 2017 wording — see DECISIONS.md. No marker in the UI.
  {
    year: 2017,
    title: "Gimnastičko sportsko udruženje „Kraguj“",
    text: "Od 2017. radimo kao GSU „Kraguj“.",
  },
  {
    year: 2022,
    title: "Prvo mesto ekipno u I kolu B programa, Kostolac",
    sources: [SOURCES.bulletin2022],
  },
  {
    year: 2023,
    title: "Medalje na finalu Prvenstva Srbije u B programu, Beograd",
    sources: [SOURCES.bulletin2023],
  },
  {
    year: 2024,
    title: "Nastup na Prvenstvu Srbije u apsolutnoj kategoriji, Kostolac",
    sources: [SOURCES.bulletin2024],
  },
  {
    year: 2024,
    title: "Grad Kragujevac pomogao nabavku sportske opreme",
    sources: [SOURCES.glasSumadije],
  },
  {
    year: 2025,
    title: "Aerobna gimnastika na Prvenstvu Srbije, Ruma",
    sources: [SOURCES.bulletin2025Aer],
  },
  {
    year: 2026,
    title: "42 registrovane takmičarke u sportskoj i 12 u aerobnoj gimnastici",
    sources: [SOURCES.registered2026Zsg, SOURCES.registered2026Aer],
  },
  {
    year: 2026,
    title: "Novi dvovisinski razboj uz podršku Grada",
    flag: "SHOW_EQUIPMENT_2026",
  },
];

/** Photo 17 (club birthday cake) may appear between 2007 and 2022 — no date claim in the caption. */
export const TIMELINE_PHOTO = { photoId: "17", afterYear: 2017, caption: "Rođendanska torta kluba" } as const;
