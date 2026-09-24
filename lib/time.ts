/**
 * Europe/Belgrade wall-clock helpers. All time logic uses Europe/Belgrade and
 * runs after mount only (static HTML never depends on "now").
 */
export const TIME_ZONE = "Europe/Belgrade";

export interface BelgradeNow {
  /** 1 = Monday … 7 = Sunday */
  isoWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** Minutes since local midnight. */
  minutes: number;
  /** "YYYY-MM-DD" local date. */
  ymd: string;
}

const WEEKDAYS: Record<string, BelgradeNow["isoWeekday"]> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function belgradeNow(date: Date = new Date()): BelgradeNow {
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekday = WEEKDAYS[parts.weekday ?? ""];
  if (!weekday) throw new Error(`Unexpected weekday ${parts.weekday}`);
  return {
    isoWeekday: weekday,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** "18:30" → 1110 */
export const clockToMinutes = (clock: string): number => {
  const [h, m] = clock.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
