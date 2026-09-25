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
  formatBlock,
  formatDays,
  formatTimes,
  groupById,
  type DayCode,
  type ProgramId,
  type ScheduleBlock,
  type ScheduleGroup,
} from "@/content/schedule";

/* --------------------------------------------------------------------------
   Mechanical UI strings (not in the master prompt; listed in newCopy).
   -------------------------------------------------------------------------- */
export const PROGRAMS_UI = {
  filtersLabel: "Prikažite programe",
  openLabel: (title: string) => `Više o programu „${title}“`,
  scheduleLabel: "Raspored",
  prev: "Prethodni program",
  next: "Sledeći program",
} as const;

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
      days: new Set(group.blocks.flatMap((b) => b.days)),
    };
  });
}

/* --------------------------------------------------------------------------
   Age chips. Mapping follows the §5 quiz rules (3–7 → mlađa početna; 8+ →
   starija početna or the competitive groups) and the card age lines. Aerobic
   gymnastics has no age claim, so it appears only under „Sve“ and the status
   line then repeats the quiz hint about it. „Sve“ + the ✓ pressed state are the
   filter vocabulary shared with S4 (program pills) and S9 (gallery chips).
   -------------------------------------------------------------------------- */
export type ChipKey = "svi" | "3-8" | "8+" | "takmicarke";

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
  const shown = matchingIds(chip, visible);
  const text = `Prikazano: ${shown.length} od ${visible.length} programa.`;
  const aerobicHidden = visible.includes("aerobik") && !shown.includes("aerobik");
  return aerobicHidden ? `${text} ${QUIZ.aerobicHint}` : text;
}
