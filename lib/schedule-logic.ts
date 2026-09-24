/**
 * Schedule logic (§5 S4, §6 time rules). Pure functions, no runtime import of
 * content/* — this module is shared by Server Components, the schedule client
 * island ("Sledeći trening" chip) and the unit tests, so it must stay tiny.
 *
 * "Sledeći trening" rule (decision): the chip shows the next training START
 * strictly after "now" (Europe/Belgrade wall clock). A training that is already
 * in progress does not count — at 18:30 on Monday the Po/Sr/Pe 18:00 group shows
 * "u sredu u 18:00". Only fixed slots are ever named; when a slot WITHOUT a fixed
 * time ("08:30–10:30 ili 16:00–18:00") could come before the next fixed slot,
 * no chip is shown, because naming the later fixed slot would be wrong.
 */
import type { DayCode, ScheduleBlock, ScheduleGroup } from "@/content/schedule";
import { clockToMinutes, type BelgradeNow } from "./time";

export type IsoDay = BelgradeNow["isoWeekday"];

/** Calendar facts, not content: day code → ISO weekday (1 = Monday). */
export const ISO_BY_DAY: Readonly<Record<DayCode, IsoDay>> = { po: 1, ut: 2, sr: 3, ce: 4, pe: 5, su: 6, ne: 7 };

/** One possible training start on one weekday. */
export interface Slot {
  iso: IsoDay;
  /** "HH:MM" */
  start: string;
  /** Minutes since local midnight. */
  startMin: number;
  /** false = one of several alternatives ("08:30–10:30 ili 16:00–18:00"). */
  fixed: boolean;
}

export interface NextTraining {
  /** Days from today: 0 = today, 1 = tomorrow … 7 = same weekday next week. */
  offset: number;
  iso: IsoDay;
  start: string;
}

/**
 * Every start of a group as a flat slot list. `isFixed` is injected (pass
 * `isFixed` from content/schedule) so this module never imports content at runtime.
 */
export function groupSlots(group: ScheduleGroup, isFixed: (block: ScheduleBlock) => boolean): Slot[] {
  return group.blocks.flatMap((block) => {
    const fixed = isFixed(block);
    return block.days.flatMap((day) =>
      block.times.map((t) => ({ iso: ISO_BY_DAY[day], start: t.start, startMin: clockToMinutes(t.start), fixed })),
    );
  });
}

/** Next fixed training start after `now`, or null (no fixed slot, or a variable slot comes first). */
export function nextTraining(slots: readonly Slot[], now: BelgradeNow): NextTraining | null {
  if (!slots.some((s) => s.fixed)) return null;
  for (let offset = 0; offset <= 7; offset++) {
    const iso = (((now.isoWeekday - 1 + offset) % 7) + 1) as IsoDay;
    let best: Slot | undefined;
    for (const s of slots) {
      if (s.iso !== iso) continue;
      if (offset === 0 && s.startMin <= now.minutes) continue;
      // Earliest start wins; on a tie the variable slot wins (we cannot name its time).
      if (!best || s.startMin < best.startMin || (s.startMin === best.startMin && !s.fixed)) best = s;
    }
    if (best) return best.fixed ? { offset, iso, start: best.start } : null;
  }
  return null;
}

/**
 * "danas u 18:00" / "sutra u 18:00" / "u ponedeljak u 18:00".
 * `accusatives` = DAYS[].accusative in ISO order (ponedeljak … nedelju).
 */
export function formatNextTraining(next: NextTraining, accusatives: readonly string[]): string {
  if (next.offset === 0) return `danas u ${next.start}`;
  if (next.offset === 1) return `sutra u ${next.start}`;
  return `u ${accusatives[next.iso - 1] ?? ""} u ${next.start}`;
}

/** One row of the "Po danu" view. */
export interface DaySession {
  group: ScheduleGroup;
  block: ScheduleBlock;
}

/** Trainings on one weekday, earliest first (ties keep the given group order). */
export function daySessions(groups: readonly ScheduleGroup[], day: DayCode): DaySession[] {
  const rows: DaySession[] = [];
  for (const group of groups) {
    for (const block of group.blocks) {
      if (block.days.includes(day)) rows.push({ group, block });
    }
  }
  const first = (r: DaySession) => clockToMinutes(r.block.times[0]?.start ?? "00:00");
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => first(a.r) - first(b.r) || a.i - b.i)
    .map(({ r }) => r);
}

/** "YYYY-MM-DD" + n days (pure calendar arithmetic, no time zone involved). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Local (Europe/Belgrade) date of the first day on/after `today` that is one
 * of `days` — the DTSTART date of a weekly recurring block.
 */
export function firstOccurrenceYmd(days: readonly DayCode[], today: BelgradeNow): string {
  for (let offset = 0; offset < 7; offset++) {
    const iso = ((today.isoWeekday - 1 + offset) % 7) + 1;
    if (days.some((d) => ISO_BY_DAY[d] === iso)) return addDaysYmd(today.ymd, offset);
  }
  return today.ymd;
}
