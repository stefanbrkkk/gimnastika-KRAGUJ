/**
 * Weekly training schedule (§5 S4). Source: club e-mail of 24. 9. 2026 (docs/dosije.md §2).
 * The club edits this file; tests/schedule.test.ts compares it against a hard-coded copy.
 */
import { FLAGS } from "./site";

export type DayCode = "po" | "ut" | "sr" | "ce" | "pe" | "su" | "ne";

export interface Day {
  code: DayCode;
  /** Two-letter label shown in UI: Po Ut Sr Če Pe Su Ne */
  short: string;
  /** Full name, nominative (sr-only labels, day strip). */
  full: string;
  /** Accusative after "u" — "u ponedeljak", "u sredu"… */
  accusative: string;
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  iso: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** iCalendar BYDAY code. */
  ical: "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
}

export const DAYS: readonly Day[] = [
  { code: "po", short: "Po", full: "ponedeljak", accusative: "ponedeljak", iso: 1, ical: "MO" },
  { code: "ut", short: "Ut", full: "utorak", accusative: "utorak", iso: 2, ical: "TU" },
  { code: "sr", short: "Sr", full: "sreda", accusative: "sredu", iso: 3, ical: "WE" },
  { code: "ce", short: "Če", full: "četvrtak", accusative: "četvrtak", iso: 4, ical: "TH" },
  { code: "pe", short: "Pe", full: "petak", accusative: "petak", iso: 5, ical: "FR" },
  { code: "su", short: "Su", full: "subota", accusative: "subotu", iso: 6, ical: "SA" },
  { code: "ne", short: "Ne", full: "nedelja", accusative: "nedelju", iso: 7, ical: "SU" },
];

export const dayByCode = (code: DayCode): Day => {
  const day = DAYS.find((d) => d.code === code);
  if (!day) throw new Error(`Unknown day ${code}`);
  return day;
};

/** "HH:MM", 24h, Europe/Belgrade wall-clock time. */
export type Clock = `${number}${number}:${number}${number}`;

export interface TimeRange {
  start: Clock;
  end: Clock;
}

export interface ScheduleBlock {
  days: readonly DayCode[];
  /**
   * One entry = a fixed slot. Two entries = "08:30–10:30 ili 16:00–18:00"
   * (depends on the school shift — not a fixed slot: excluded from
   * "Sledeći trening" and from calendar exports).
   */
  times: readonly TimeRange[];
}

export type ProgramId = "mladja" | "starija" | "c-program" | "ab-program" | "aerobik" | "trampolina";

export interface ScheduleGroup {
  id: "ab" | "c-starije" | "c-mladje" | "mladja" | "starija" | "aerobik";
  programId: ProgramId;
  /** Full group name as in the §5 S4 data table. */
  name: string;
  blocks: readonly ScheduleBlock[];
}

const MORNING_OR_AFTERNOON: readonly TimeRange[] = [
  { start: "08:30", end: "10:30" },
  { start: "16:00", end: "18:00" },
];

export const SCHEDULE: readonly ScheduleGroup[] = [
  {
    id: "ab",
    programId: "ab-program",
    name: "Takmičarke — A i B program",
    blocks: [
      { days: ["po", "sr", "pe"], times: MORNING_OR_AFTERNOON },
      { days: ["ut", "ce"], times: [{ start: "17:30", end: "19:30" }] },
    ],
  },
  {
    id: "c-starije",
    programId: "c-program",
    name: "Takmičarke — C program, starije",
    blocks: [{ days: ["po", "sr", "pe"], times: MORNING_OR_AFTERNOON }],
  },
  {
    id: "c-mladje",
    programId: "c-program",
    name: "Takmičarke — C program, mlađe",
    blocks: [
      { days: ["ut", "ce"], times: [{ start: "19:30", end: "21:30" }] },
      { days: ["pe"], times: MORNING_OR_AFTERNOON },
    ],
  },
  {
    id: "mladja",
    programId: "mladja",
    name: "Mlađa početna grupa (3–8 god.)",
    blocks: [{ days: ["po", "sr", "pe"], times: [{ start: "18:00", end: "19:00" }] }],
  },
  {
    id: "starija",
    programId: "starija",
    name: "Starija početna grupa (8+ god.)",
    blocks: [{ days: ["po", "sr", "pe"], times: [{ start: "19:00", end: "20:00" }] }],
  },
  {
    id: "aerobik",
    programId: "aerobik",
    name: "Aerobna gimnastika",
    blocks: [{ days: ["po", "sr", "pe"], times: [{ start: "20:00", end: "21:30" }] }],
  },
];

export const groupById = (id: ScheduleGroup["id"]): ScheduleGroup => {
  const group = SCHEDULE.find((g) => g.id === id);
  if (!group) throw new Error(`Unknown schedule group ${id}`);
  return group;
};

export const isFixed = (block: ScheduleBlock): boolean => block.times.length === 1;

export const SHIFT_NOTE = " · po školskoj smeni";

/** "08:30–10:30 ili 16:00–18:00" (+ shift note when SHOW_SHIFT_NOTE). En dash, no spaces. */
export function formatTimes(block: ScheduleBlock, showShiftNote: boolean = FLAGS.SHOW_SHIFT_NOTE): string {
  const text = block.times.map((t) => `${t.start}–${t.end}`).join(" ili ");
  return !isFixed(block) && showShiftNote ? text + SHIFT_NOTE : text;
}

/** "Po, Sr, Pe" */
export const formatDays = (days: readonly DayCode[]): string => days.map((d) => dayByCode(d).short).join(", ");

/** "Po, Sr, Pe 08:30–10:30 ili 16:00–18:00" */
export const formatBlock = (block: ScheduleBlock, showShiftNote?: boolean): string =>
  `${formatDays(block.days)} ${formatTimes(block, showShiftNote)}`;

/** "Po, Sr, Pe 08:30–10:30 ili 16:00–18:00; Ut, Če 17:30–19:30" */
export const formatGroup = (group: ScheduleGroup, showShiftNote?: boolean): string =>
  group.blocks.map((b) => formatBlock(b, showShiftNote)).join("; ");

/** Days (in week order) on which a group trains at all. */
export const activeDays = (group: ScheduleGroup): Set<DayCode> => new Set(group.blocks.flatMap((b) => b.days));

/**
 * Schedule UI strings. "Po grupi", "Po danu", "Sledeći trening", "Dodajte u kalendar (.ics)",
 * "Google Kalendar" and "Otvorite u mapama" are master-prompt copy (§5 S4); the rest are
 * mechanical UI strings (aria labels, states).
 */
export const SCHEDULE_UI = {
  viewsLabel: "Prikaz rasporeda",
  byGroup: "Po grupi",
  byDay: "Po danu",
  filterLabel: "Program",
  all: "Sve",
  next: "Sledeći trening",
  ics: "Dodajte u kalendar (.ics)",
  gcal: "Google Kalendar",
  newTab: "(otvara se u novom prozoru)",
  weekLabel: "Dani treninga",
  dayOn: "trening",
  dayOff: "bez treninga",
  dayStripLabel: "Dan u nedelji",
  today: "danas",
  filteredEmpty: "Izabrani program nema trening ovog dana.",
  /** Shown on cards that mix fixed and "ili" slots: the calendar holds only the fixed ones. */
  fixedOnly: (slots: string) => `U kalendar se dodaju samo termini sa stalnim vremenom: ${slots}.`,
  addressLabel: "Adresa",
  nicknamePrefix: "u gradu poznata kao",
  maps: "Otvorite u mapama",
  /** Card of a group without a fixed slot (C program, starije): why it has no calendar links. */
  noFixed: "Termini ove grupe nemaju stalno vreme, pa se ne dodaju u kalendar.",
  /** Polite status after a filter / day change („Po grupi“). */
  statusGroups: (shown: number, total: number) => `Prikazano: ${shown} od ${total} grupa.`,
  /** Polite status after a filter / day change („Po danu“); `day` = DAYS[].accusative. */
  statusDay: (shown: number, total: number, day: string) => `Prikazano: ${shown} od ${total} treninga u ${day}.`,
} as const;

export const SCHEDULE_LOCATION = {
  heading: "Raspored treninga",
  sub: "Sala Trgovinsko-ugostiteljske škole „Toza Dragović“ (u gradu poznata kao „ŠUP“), Save Kovačevića 25",
  weekendEmpty: "Vikendom nema redovnih treninga. Vidimo se u ponedeljak!",
} as const;
