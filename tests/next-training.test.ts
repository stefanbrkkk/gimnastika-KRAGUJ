/**
 * §7: "„Sledeći trening“ is correct for mocked Europe/Belgrade dates, including
 * Friday evening → „u ponedeljak“." The system clock is mocked (vi.setSystemTime)
 * with UTC instants; belgradeNow() converts them to Europe/Belgrade wall time,
 * so the DST cases prove the conversion is not a fixed +01:00 offset.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DAYS, isFixed, SCHEDULE, type ScheduleGroup } from "@/content/schedule";
import { earliestNext, formatNextDay, formatNextTraining, groupSlots, nextTraining, type Slot } from "@/lib/schedule-logic";
import { belgradeNow } from "@/lib/time";

const ACC = DAYS.map((d) => d.accusative);
const group = (id: ScheduleGroup["id"]) => SCHEDULE.find((g) => g.id === id)!;

/** Chip text for a group at the mocked "now", or null when no chip is shown. */
function chip(id: ScheduleGroup["id"]): string | null {
  const next = nextTraining(groupSlots(group(id), isFixed), belgradeNow());
  return next ? formatNextTraining(next, ACC) : null;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const at = (iso: string) => vi.setSystemTime(new Date(iso));

describe("Sledeći trening — Mlađa početna grupa (Po, Sr, Pe 18:00)", () => {
  it("Friday evening → „u ponedeljak u 18:00“", () => {
    at("2026-09-25T19:30:00+02:00"); // Fri 19:30 CEST
    expect(chip("mladja")).toBe("u ponedeljak u 18:00");
  });

  it("Friday late night (23:59) → still Monday", () => {
    at("2026-09-25T23:59:00+02:00");
    expect(chip("mladja")).toBe("u ponedeljak u 18:00");
  });

  it("Saturday → „u ponedeljak“ (not „sutra“)", () => {
    at("2026-09-26T10:00:00+02:00");
    expect(chip("mladja")).toBe("u ponedeljak u 18:00");
  });

  it("Sunday → „sutra u 18:00“", () => {
    at("2026-09-27T12:00:00+02:00");
    expect(chip("mladja")).toBe("sutra u 18:00");
  });

  it("Monday before the slot → „danas u 18:00“", () => {
    at("2026-09-28T09:00:00+02:00");
    expect(chip("mladja")).toBe("danas u 18:00");
    at("2026-09-28T17:59:00+02:00");
    expect(chip("mladja")).toBe("danas u 18:00");
  });

  it("a training in progress does not count: Monday 18:00 and 18:30 → „u sredu“", () => {
    at("2026-09-28T18:00:00+02:00");
    expect(chip("mladja")).toBe("u sredu u 18:00");
    at("2026-09-28T18:30:00+02:00");
    expect(chip("mladja")).toBe("u sredu u 18:00");
  });

  it("Tuesday evening → „sutra u 18:00“; Thursday → „sutra“ (Friday)", () => {
    at("2026-09-29T21:00:00+02:00");
    expect(chip("mladja")).toBe("sutra u 18:00");
    at("2026-10-01T08:00:00+02:00");
    expect(chip("mladja")).toBe("sutra u 18:00");
  });

  it("Wednesday after the slot → „u petak u 18:00“ (two days ahead)", () => {
    at("2026-09-30T20:00:00+02:00");
    expect(chip("mladja")).toBe("u petak u 18:00");
  });
});

describe("other groups and forms", () => {
  it("Aerobik Friday 19:59 → „danas u 20:00“; Friday 20:01 → „u ponedeljak u 20:00“", () => {
    at("2026-09-25T19:59:00+02:00");
    expect(chip("aerobik")).toBe("danas u 20:00");
    at("2026-09-25T20:01:00+02:00");
    expect(chip("aerobik")).toBe("u ponedeljak u 20:00");
  });

  it("C mlađe (Ut, Če 19:30): Monday evening → „sutra u 19:30“; Wednesday morning → „sutra u 19:30“", () => {
    at("2026-09-28T20:00:00+02:00");
    expect(chip("c-mladje")).toBe("sutra u 19:30");
    at("2026-09-30T08:00:00+02:00");
    expect(chip("c-mladje")).toBe("sutra u 19:30");
  });

  it("uses the accusative forms „u utorak“, „u sredu“, „u četvrtak“", () => {
    at("2026-09-27T12:00:00+02:00"); // Sunday → C mlađe trains Tuesday
    expect(chip("c-mladje")).toBe("u utorak u 19:30");
    at("2026-09-29T20:00:00+02:00"); // Tuesday after 19:30 → Thursday
    expect(chip("c-mladje")).toBe("u četvrtak u 19:30");
    at("2026-09-28T19:00:00+02:00"); // Monday after 18:00 → Wednesday
    expect(chip("mladja")).toBe("u sredu u 18:00");
  });

  it("A i B: fixed Ut/Če 17:30 is shown only when no „ili“ training comes first", () => {
    at("2026-09-28T17:00:00+02:00"); // Mon 17:00: the 16:00 option has started → next START is Tue 17:30
    expect(chip("ab")).toBe("sutra u 17:30");
    at("2026-09-29T12:00:00+02:00"); // Tue noon
    expect(chip("ab")).toBe("danas u 17:30");
    at("2026-09-28T07:00:00+02:00"); // Mon 07:00: 08:30 or 16:00 today — time unknown → no chip
    expect(chip("ab")).toBeNull();
    at("2026-09-26T12:00:00+02:00"); // Saturday: next is Monday („ili“) → no chip
    expect(chip("ab")).toBeNull();
  });

  it("a group without a fixed slot never shows a chip", () => {
    for (const iso of ["2026-09-28T07:00:00+02:00", "2026-09-29T12:00:00+02:00", "2026-09-27T12:00:00+02:00"]) {
      at(iso);
      expect(chip("c-starije")).toBeNull();
    }
  });
});

describe("DST edges (Europe/Belgrade)", () => {
  it("spring forward: Sun 29 Mar 2026 01:30 CET and 03:30 CEST are both Sunday → „sutra“", () => {
    at("2026-03-29T00:30:00Z"); // 01:30 CET
    expect(belgradeNow().isoWeekday).toBe(7);
    expect(chip("mladja")).toBe("sutra u 18:00");
    at("2026-03-29T01:30:00Z"); // 03:30 CEST (02:00–03:00 does not exist)
    expect(belgradeNow().minutes).toBe(3 * 60 + 30);
    expect(chip("mladja")).toBe("sutra u 18:00");
  });

  it("first Monday of summer time: 16:30Z is 18:30 CEST → the slot has started → „u sredu“", () => {
    at("2026-03-30T15:59:00Z"); // 17:59 CEST
    expect(chip("mladja")).toBe("danas u 18:00");
    at("2026-03-30T16:30:00Z"); // 18:30 CEST (a fixed +01:00 would say 17:30 → wrong „danas“)
    expect(chip("mladja")).toBe("u sredu u 18:00");
  });

  it("last Friday of winter time: 16:30Z is 17:30 CET → „danas u 18:00“", () => {
    at("2026-03-27T16:30:00Z");
    expect(chip("mladja")).toBe("danas u 18:00");
  });

  it("fall back: Sun 25 Oct 2026 02:30 (twice) is Sunday → „sutra“; Monday 16:30Z = 17:30 CET → „danas“", () => {
    at("2026-10-25T00:30:00Z"); // 02:30 CEST
    expect(chip("mladja")).toBe("sutra u 18:00");
    at("2026-10-25T01:30:00Z"); // 02:30 CET
    expect(chip("mladja")).toBe("sutra u 18:00");
    at("2026-10-26T16:30:00Z"); // Mon 17:30 CET
    expect(chip("mladja")).toBe("danas u 18:00");
  });

  it("midnight: Friday 23:30Z (winter) is already Saturday 00:30 in Belgrade → „u ponedeljak“", () => {
    at("2026-12-04T23:30:00Z"); // Sat 5 Dec 00:30 CET
    expect(belgradeNow().isoWeekday).toBe(6);
    expect(chip("aerobik")).toBe("u ponedeljak u 20:00");
  });
});

describe("„Sledeći trening“ scoreboard — earliest next training across the visible groups", () => {
  /** Board order = the S3/S4 program order (Mlađa, Starija, C starije, C mlađe, A i B, Aerobna). */
  const BOARD: readonly ScheduleGroup["id"][] = ["mladja", "starija", "c-starije", "c-mladje", "ab", "aerobik"];
  const C: readonly ScheduleGroup["id"][] = ["c-starije", "c-mladje"];
  const AB: readonly ScheduleGroup["id"][] = ["ab"];
  /**
   * "group · day · start[ ili alt]"; a start that has already begun today (an „ili“ slot whose
   * later option is still ahead) is marked with "*".
   */
  function board(ids: readonly ScheduleGroup["id"][] = BOARD): string | null {
    const best = earliestNext(ids.map((id) => groupSlots(group(id), isFixed)), belgradeNow());
    if (!best) return null;
    const { next } = best;
    const alt = next.alt.length ? ` ili ${next.alt.join(" ili ")}` : "";
    return `${ids[best.index]} · ${formatNextDay(next, ACC)} · ${next.start}${next.started ? "*" : ""}${alt}`;
  }

  it("Monday 17:00 → Mlađa „danas“ 18:00 (both options of the „ili“ slot have started)", () => {
    at("2026-09-28T17:00:00+02:00");
    expect(board()).toBe("mladja · danas · 18:00");
  });

  it("Monday 20:30 → A i B „sutra“ 17:30 (earlier than C mlađe 19:30 and every Wednesday slot)", () => {
    at("2026-09-28T20:30:00+02:00");
    expect(board()).toBe("ab · sutra · 17:30");
  });

  it("Friday evening → Monday's „ili“ slot, both options named (the earliest training of the week)", () => {
    at("2026-09-25T21:00:00+02:00");
    expect(board()).toBe("c-starije · u ponedeljak · 08:30 ili 16:00");
  });

  it("an „ili“ slot today whose first option has begun still counts while the later one is ahead", () => {
    at("2026-09-28T12:00:00+02:00"); // Mon noon: 08:30 is over, 16:00 is ahead (earlier than Mlađa 18:00)
    expect(board()).toBe("c-starije · danas · 08:30* ili 16:00");
    at("2026-09-28T09:00:00+02:00"); // Mon 09:00: the 08:30 option is in progress
    expect(board()).toBe("c-starije · danas · 08:30* ili 16:00");
    at("2026-09-28T16:00:00+02:00"); // Mon 16:00: the last option has started → the next fixed start
    expect(board()).toBe("mladja · danas · 18:00");
  });

  it("C program: never empty and never past Monday (Fri 14:40, Thu evening, Saturday, Monday evening)", () => {
    at("2026-09-25T14:40:00+02:00"); // Fri: C starije and C mlađe both train 08:30 or 16:00 today
    expect(board(C)).toBe("c-starije · danas · 08:30* ili 16:00");
    at("2026-10-01T21:00:00+02:00"); // Thu night: C mlađe's 19:30 has started → Friday („ili“)
    expect(board(C)).toBe("c-starije · sutra · 08:30 ili 16:00");
    at("2026-09-26T10:00:00+02:00"); // Sat: Monday („Vidimo se u ponedeljak!“), not Tuesday 19:30
    expect(board(C)).toBe("c-starije · u ponedeljak · 08:30 ili 16:00");
    at("2026-09-28T20:30:00+02:00"); // Mon evening: C mlađe Tuesday 19:30 comes before Wednesday
    expect(board(C)).toBe("c-mladje · sutra · 19:30");
  });

  it("A i B program: the „ili“ days and the fixed Ut/Če 17:30", () => {
    at("2026-09-26T10:00:00+02:00"); // Saturday
    expect(board(AB)).toBe("ab · u ponedeljak · 08:30 ili 16:00");
    at("2026-09-28T07:00:00+02:00"); // Mon 07:00
    expect(board(AB)).toBe("ab · danas · 08:30 ili 16:00");
    at("2026-09-28T17:00:00+02:00"); // Mon 17:00: both options have started → Tue 17:30
    expect(board(AB)).toBe("ab · sutra · 17:30");
    at("2026-09-29T18:00:00+02:00"); // Tue 18:00: 17:30 has started → Wednesday („ili“)
    expect(board(AB)).toBe("ab · sutra · 08:30 ili 16:00");
    at("2026-09-25T14:40:00+02:00"); // Fri 14:40
    expect(board(AB)).toBe("ab · danas · 08:30* ili 16:00");
  });

  /** Every group that shares the board's slot, in board order (SC3-03). */
  function tied(ids: readonly ScheduleGroup["id"][] = BOARD): string {
    const best = earliestNext(ids.map((id) => groupSlots(group(id), isFixed)), belgradeNow());
    return best ? best.tied.map((i) => ids[i]).join(" + ") : "";
  }

  it("a slot shared by several groups names all of them (ties in board order; `index` is the first)", () => {
    at("2026-09-25T14:40:00+02:00"); // Fri: C starije, C mlađe and A i B all train 08:30 ili 16:00
    expect(tied()).toBe("c-starije + c-mladje + ab");
    expect(tied(C)).toBe("c-starije + c-mladje");
    expect(tied(AB)).toBe("ab");
    at("2026-09-25T21:00:00+02:00"); // Fri night → Monday's „ili“ slot: C mlađe does not train on Monday
    expect(tied()).toBe("c-starije + ab");
    at("2026-09-28T17:00:00+02:00"); // Mon 17:00 → Mlađa 18:00 alone
    expect(tied()).toBe("mladja");
    at("2026-09-28T20:30:00+02:00"); // Mon 20:30 → A i B Tue 17:30 alone (C mlađe starts at 19:30)
    expect(tied()).toBe("ab");
    at("2026-09-29T20:00:00+02:00"); // Tue 20:00 → Wednesday's „ili“ slot: C starije + A i B
    expect(tied()).toBe("c-starije + ab");
  });

  it("a fixed start at the same minute as an „ili“ slot's later option is not a tie", () => {
    const fixed16: Slot[] = [{ iso: 1, start: "16:00", startMin: 960, fixed: true, block: 0 }];
    const ili: Slot[] = [
      { iso: 1, start: "08:30", startMin: 510, fixed: false, block: 0 },
      { iso: 1, start: "16:00", startMin: 960, fixed: false, block: 0 },
    ];
    at("2026-09-28T12:00:00+02:00"); // Mon noon: both are next at 16:00, but they are different slots
    const best = earliestNext([ili, fixed16], belgradeNow());
    expect(best?.index).toBe(0);
    expect(best?.tied).toEqual([0]);
  });

  it("every filter has a next training at every quarter hour of the week (the board is never empty)", () => {
    const filters: readonly (readonly ScheduleGroup["id"][])[] = [BOARD, C, AB, ["mladja"], ["starija"], ["aerobik"]];
    for (let q = 0; q < 7 * 96; q++) {
      at(new Date(Date.parse("2026-09-28T00:00:00+02:00") + q * 15 * 60_000).toISOString());
      for (const ids of filters) expect(board(ids), `${ids.join("+")} at +${q * 15} min`).not.toBeNull();
    }
  });

  it("formatNextDay gives the day part of every chip form", () => {
    at("2026-09-28T09:00:00+02:00");
    const n = nextTraining(groupSlots(group("mladja"), isFixed), belgradeNow())!;
    expect(formatNextDay(n, ACC)).toBe("danas");
    expect(formatNextDay({ ...n, offset: 1 }, ACC)).toBe("sutra");
    expect(formatNextDay({ offset: 3, iso: 4, start: "19:30" }, ACC)).toBe("u četvrtak");
  });
});
