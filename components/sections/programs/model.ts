/**
 * Programs section (§5 S3) — pure, framework-free helpers shared by the
 * server-rendered cards, the client island and the lazily loaded detail sheet.
 * Unit-tested in tests/programs.test.ts.
 */
import type { CSSProperties } from "react";
import { QUIZ } from "@/content/copy";
import type { Program } from "@/content/programs";
import {
  dayByCode,
  DAYS,
  formatBlock,
  formatDays,
  formatTimes,
  groupById,
  isFixed,
  SCHEDULE,
  type DayCode,
  type ProgramId,
  type ScheduleBlock,
  type ScheduleGroup,
} from "@/content/schedule";
import { daySessions, groupSlots, type Slot } from "@/lib/schedule-logic";

/* --------------------------------------------------------------------------
   Mechanical UI strings (not in the master prompt; listed in newCopy).
   -------------------------------------------------------------------------- */
export const PROGRAMS_UI = {
  filtersLabel: "Prikažite programe",
  openLabel: (title: string) => `Više o programu „${title}“`,
  scheduleLabel: "Raspored",
  prev: "Prethodni program",
  next: "Sledeći program",
  /** Stamp on the card the quiz recommended (QP-10): „Preporuka · 9 god.“ */
  recommended: "Preporuka",
  /** Age unit on that stamp — the quiz strip's „9 god.“. */
  ageUnit: "god.",
} as const;

/**
 * Competitor-bib numeral on the program plate (QP-06): a typographic rendering of the
 * card's own age line or title („3–8 godina“ → „3–8“, „od 8 godina“ → „8+“, „… C program“
 * → „C“, „… A i B program“ → „A·B“). Decorative (aria-hidden), never a new fact; aerobic
 * gymnastics has no age claim, so it has no bib.
 */
export const PROGRAM_BIB: Readonly<Record<ProgramId, string | null>> = {
  mladja: "3–8",
  starija: "8+",
  "c-program": "C",
  "ab-program": "A·B",
  aerobik: null,
  trampolina: null,
};

/** Days on which any group of the program trains (the card's single week row, QP-07). */
export function programDays(program: Program): ReadonlySet<DayCode> {
  return new Set(program.groups.flatMap(({ id }) => groupById(id).blocks.flatMap((b) => b.days)));
}

/** Program color as CSS custom properties: --pc (swatch) and --pc-ink (line/ink on it). */
export const programStyle = (program: Program): CSSProperties =>
  ({
    "--pc": program.color,
    "--pc-ink": program.colorIsDark ? "var(--color-ice-50)" : "var(--color-navy-900)",
  }) as CSSProperties;

/**
 * Keeps a spaced dash with the word before it ("Takmičarke — C program" never
 * breaks as "Takmičarke / — C program"). Typography only; the text is unchanged
 * apart from the no-break space.
 */
export const glueDash = (text: string): string => text.replace(/ ([—–]) /g, "\u00A0$1 ");

/* --------------------------------------------------------------------------
   Schedule lines. Text is exactly formatBlock() — split only so the days can be
   a label and each alternative slot ("… ili …") can wrap as a whole.
   -------------------------------------------------------------------------- */
export interface BlockParts {
  /** "Po, Sr, Pe" (visible) */
  days: string;
  /** "ponedeljak, sreda, petak" (screen readers) */
  daysFull: string;
  /** ["08:30–10:30", "16:00–18:00"] — rendered joined by " ili " */
  times: string[];
  /** formatBlock(block): "Po, Sr, Pe 08:30–10:30 ili 16:00–18:00" */
  text: string;
}

export const TIME_JOINER = " ili ";

export function blockParts(block: ScheduleBlock, showShiftNote?: boolean): BlockParts {
  return {
    days: formatDays(block.days),
    daysFull: block.days.map((d) => dayByCode(d).full).join(", "),
    times: formatTimes(block, showShiftNote).split(TIME_JOINER),
    text: formatBlock(block, showShiftNote),
  };
}

export interface ProgramScheduleGroup {
  /** Sub-label inside a program ("Starije" / "Mlađe"), if any. */
  label?: string;
  group: ScheduleGroup;
  blocks: BlockParts[];
  /** Days on which this group trains at all. */
  days: ReadonlySet<DayCode>;
}

export function programSchedule(program: Program, showShiftNote?: boolean): ProgramScheduleGroup[] {
  return program.groups.map(({ id, label }) => {
    const group = groupById(id);
    return {
      label,
      group,
      blocks: group.blocks.map((b) => blockParts(b, showShiftNote)),
      days: new Set(group.blocks.map((b) => b.days).flat()),
    };
  });
}

/* --------------------------------------------------------------------------
   Merged day overview ("Po danu", compact). Server-rendered text; the island
   only marks today and fills the next-training line (client clock).
   -------------------------------------------------------------------------- */

/** One training in the day strip: text + which group (swatch + name). */
export interface DayStripSession {
  /** "Po, Sr, Pe 18:00–19:00" — exactly formatBlock(). */
  text: string;
  /** "18:00–19:00" (or "08:30–10:30 ili 16:00–18:00") — the times alone. */
  times: string;
  groupId: string;
  groupName: string;
  programId: string;
  color: string;
}

export interface DayStripRow {
  day: DayCode;
  sessions: DayStripSession[];
}

/** Week rows, Monday first (SCHEDULE order, ties keep group order). */
export function dayStripRows(programs: readonly Program[]): DayStripRow[] {
  const colorOf = new Map<string, { programId: string; color: string }>();
  for (const p of programs)
    for (const { id } of p.groups) {
      const g = groupById(id);
      colorOf.set(g.id, { programId: p.id, color: p.color });
    }
  return DAYS.map((d) => ({
    day: d.code,
    sessions: daySessions(SCHEDULE, d.code).map(({ group, block }) => ({
      text: formatBlock(block),
      times: formatTimes(block),
      groupId: group.id,
      groupName: group.name,
      programId: colorOf.get(group.id)?.programId ?? "",
      color: colorOf.get(group.id)?.color ?? "",
    })),
  }));
}

/** Numeric slot table for the client's next-training line (no copy, only numbers). */
export function programSlotTable(programs: readonly Program[]): Slot[][] {
  return programs.map((p) => p.groups.flatMap(({ id }) => groupSlots(groupById(id), isFixed)));
}

/* --------------------------------------------------------------------------
   Age chips. Mapping follows the §5 quiz rules (3–7 → mlađa početna; 8+ →
   starija početna or the competitive groups) and the card age lines. Aerobic
   gymnastics has no age claim, so it appears only under „Sve“ and the status
   line then repeats the quiz hint about it. „Sve“ + the ✓ pressed state are the
   filter vocabulary shared with S4 (program pills) and S9 (gallery chips).
   -------------------------------------------------------------------------- */
export type ChipKey = "svi" | "3-8" | "8+" | "takmicarke" | "aerobik";

export interface ProgramChip {
  key: ChipKey;
  label: string;
  /** null = every visible program. */
  ids: readonly ProgramId[] | null;
}

export const PROGRAM_CHIPS: readonly ProgramChip[] = [
  { key: "svi", label: "Sve", ids: null },
  { key: "3-8", label: "3–8 godina", ids: ["mladja"] },
  { key: "8+", label: "Od 8 godina", ids: ["starija", "c-program", "ab-program"] },
  { key: "takmicarke", label: "Takmičarke", ids: ["c-program", "ab-program"] },
  { key: "aerobik", label: "Aerobik", ids: ["aerobik"] },
];

export function chipByKey(key: ChipKey): ProgramChip {
  const chip = PROGRAM_CHIPS.find((c) => c.key === key);
  if (!chip) throw new Error(`Unknown chip ${key}`);
  return chip;
}

/** Visible program ids that a chip keeps, in card order. */
export function matchingIds(chip: ProgramChip, visible: readonly ProgramId[]): ProgramId[] {
  return chip.ids === null ? [...visible] : visible.filter((id) => chip.ids!.includes(id));
}

/** Chips that keep at least one visible program (a chip must never produce an empty row). */
export function usableChips(visible: readonly ProgramId[]): ProgramChip[] {
  return PROGRAM_CHIPS.filter((c) => matchingIds(c, visible).length > 0);
}

/**
 * Status line for the aria-live region. Empty for „Sve“ (nothing is
 * hidden). Otherwise: "Prikazano: 1 od 5 programa." + the aerobic hint when the
 * filter hid aerobic gymnastics.
 */
export function filterStatus(chip: ProgramChip, visible: readonly ProgramId[]): string {
  if (chip.ids === null) return "";
  const text = `Prikazano: ${matchingIds(chip, visible).length} od ${visible.length} programa.`;
  const hint = filterHint(chip, visible);
  return hint ? `${text} ${hint}` : text;
}

/**
 * The aerobic hint alone („Pitajte trenericu i za aerobnu gimnastiku.“) when the chip hides
 * aerobic gymnastics, else "". Phones show it under the row, where the status line (sr-only
 * there) would have said it.
 */
export function filterHint(chip: ProgramChip, visible: readonly ProgramId[]): string {
  const shown = matchingIds(chip, visible);
  return visible.includes("aerobik") && !shown.includes("aerobik") ? QUIZ.aerobicHint : "";
}
