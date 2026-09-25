/**
 * Schedule logic (§5 S4, §6 time rules). Pure functions, no runtime import of
 * content/* — this module is shared by Server Components, the schedule client
 * island ("Sledeći trening" chip) and the unit tests, so it must stay tiny.
 *
 * "Sledeći trening" rule (decision): the chip shows the next training START
 * strictly after "now" (Europe/Belgrade wall clock). A training that is already
 * in progress does not count — at 18:30 on Monday the Po/Sr/Pe 18:00 group shows
 * "u sredu u 18:00". The card chip names fixed slots only; when a slot WITHOUT a
 * fixed time ("08:30–10:30 ili 16:00–18:00") could come before the next fixed slot,
 * no chip is shown, because naming the later fixed slot would be wrong. The section
 * scoreboard (earliestNext) also names „ili“ slots, always with every option.
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
  /** Index of the block in its group: the options of one „ili“ slot share it. */
  block: number;
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
  return group.blocks.flatMap((block, index) => {
    const fixed = isFixed(block);
    return block.days.flatMap((day) =>
      block.times.map((t) => ({ iso: ISO_BY_DAY[day], start: t.start, startMin: clockToMinutes(t.start), fixed, block: index })),
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
 * The day part of the chip forms: "danas" / "sutra" / "u ponedeljak" (the scoreboard
 * shows it beside the start time). `accusatives` = DAYS[].accusative in ISO order.
 */
export function formatNextDay(next: NextTraining, accusatives: readonly string[]): string {
  if (next.offset === 0) return "danas";
  if (next.offset === 1) return "sutra";
  return `u ${accusatives[next.iso - 1] ?? ""}`;
}

/**
 * "danas u 18:00" / "sutra u 18:00" / "u ponedeljak u 18:00".
 * `accusatives` = DAYS[].accusative in ISO order (ponedeljak … nedelju).
 */
export function formatNextTraining(next: NextTraining, accusatives: readonly string[]): string {
  return `${formatNextDay(next, accusatives)} u ${next.start}`;
}

/** A training as the scoreboard names it: a fixed start, or an „ili“ slot with all its options. */
export interface BoardNext extends NextTraining {
  /** The later options of an „ili“ slot ("16:00"), in order; empty = a fixed start. `start` is the first option. */
  alt: readonly string[];
  /** Today only: `start` (the first option) has begun; a later option is still ahead. */
  started: boolean;
}

/**
 * A group's next training for the scoreboard: every slot (fixed or „ili“) with a start
 * strictly after `now`. An „ili“ slot counts while any of its options is still ahead and
 * sorts by the first such option; `at` = minutes from today's midnight.
 */
function nextSession(slots: readonly Slot[], now: BelgradeNow): { at: number; next: BoardNext } | null {
  for (let offset = 0; offset <= 7; offset++) {
    const iso = (((now.isoWeekday - 1 + offset) % 7) + 1) as IsoDay;
    const blocks = new Map<number, Slot[]>();
    for (const s of slots) if (s.iso === iso) blocks.set(s.block, [...(blocks.get(s.block) ?? []), s]);
    let best: { at: number; next: BoardNext } | null = null;
    for (const options of blocks.values()) {
      options.sort((a, b) => a.startMin - b.startMin);
      const ahead = options.find((s) => offset > 0 || s.startMin > now.minutes);
      const first = options[0];
      if (!ahead || !first) continue;
      const at = offset * 1440 + ahead.startMin;
      if (!best || at < best.at) {
        best = { at, next: { offset, iso, start: first.start, alt: options.slice(1).map((s) => s.start), started: ahead !== first } };
      }
    }
    if (best) return best;
  }
  return null;
}

/** Same training slot: the same day, the same first start and the same „ili“ options. */
const sameSlot = (a: BoardNext, b: BoardNext): boolean =>
  a.offset === b.offset && a.start === b.start && a.alt.join() === b.alt.join();

/**
 * The „Sledeći trening“ scoreboard: the earliest next training among several groups. An
 * „ili“ slot is named with all its options („08:30 ili 16:00“), so nothing is guessed; it
 * counts while one of them is still ahead. `index` is the first such group in the given
 * (program) order; `tied` lists every group that trains in that very slot (`index` first),
 * so the board can name them all. null only when no group has any slot.
 */
export function earliestNext(
  slotLists: readonly (readonly Slot[])[],
  now: BelgradeNow,
): { index: number; next: BoardNext; tied: number[] } | null {
  let best: { index: number; next: BoardNext; tied: number[] } | null = null;
  let bestAt = Number.POSITIVE_INFINITY;
  slotLists.forEach((slots, index) => {
    const found = nextSession(slots, now);
    if (!found) return;
    if (found.at < bestAt) {
      best = { index, next: found.next, tied: [index] };
      bestAt = found.at;
    } else if (best && found.at === bestAt && sameSlot(found.next, best.next)) {
      best.tied.push(index);
    }
  });
  return best;
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
 * of `days` — the DTSTART date of a weekly recurring block. With `startClock`,
 * today counts only while that start is still ahead (a training that has
 * already started today is skipped → next week's day).
 */
export function firstOccurrenceYmd(days: readonly DayCode[], today: BelgradeNow, startClock?: string): string {
  const startMin = startClock === undefined ? Number.POSITIVE_INFINITY : clockToMinutes(startClock);
  for (let offset = 0; offset <= 7; offset++) {
    const iso = ((today.isoWeekday - 1 + offset) % 7) + 1;
    if (offset === 0 && startMin <= today.minutes) continue;
    if (days.some((d) => ISO_BY_DAY[d] === iso)) return addDaysYmd(today.ymd, offset);
  }
  return today.ymd;
}

/** "2026-09-28" + "18:00" → "20260928T180000" (local wall-clock time, no Z). */
export const localStamp = (ymd: string, clock: string): string => `${ymd.replaceAll("-", "")}T${clock.replace(":", "")}00`;

/**
 * Google Calendar `dates` value ("20260928T180000/20260928T190000", local times in
 * ctz) of a weekly block's first occurrence. The static HTML carries the build-date
 * value (no-JS fallback); the schedule island recomputes it after mount with
 * `strict` = true, so a link never opens on a past date or an already started training.
 */
export function occurrenceDates(days: readonly DayCode[], start: string, end: string, today: BelgradeNow, strict = false): string {
  const ymd = firstOccurrenceYmd(days, today, strict ? start : undefined);
  // A block never crosses midnight in this schedule; guard anyway.
  const endYmd = end > start ? ymd : addDaysYmd(ymd, 1);
  return `${localStamp(ymd, start)}/${localStamp(endYmd, end)}`;
}

/** Replaces the `dates=` parameter of a Google Calendar template URL. */
export const withGcalDates = (href: string, dates: string): string => href.replace(/([?&]dates=)[^&]*/, `$1${dates}`);
