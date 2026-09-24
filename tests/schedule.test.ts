/**
 * §7: "The schedule unit test compares content/schedule.ts against a HARD-CODED
 * copy of the table in §5, not against itself."
 * The strings below are copied verbatim from docs/master-prompt.md §5 S4 "Data".
 */
import { describe, expect, it } from "vitest";
import { DAYS, formatBlock, formatGroup, formatTimes, isFixed, SCHEDULE, SCHEDULE_LOCATION, SHIFT_NOTE } from "@/content/schedule";
import { daySessions } from "@/lib/schedule-logic";

const MASTER_PROMPT_S4_TABLE: readonly (readonly [string, string])[] = [
  ["Takmičarke — A i B program", "Po, Sr, Pe 08:30–10:30 ili 16:00–18:00; Ut, Če 17:30–19:30"],
  ["Takmičarke — C program, starije", "Po, Sr, Pe 08:30–10:30 ili 16:00–18:00"],
  ["Takmičarke — C program, mlađe", "Ut, Če 19:30–21:30; Pe 08:30–10:30 ili 16:00–18:00"],
  ["Mlađa početna grupa (3–8 god.)", "Po, Sr, Pe 18:00–19:00"],
  ["Starija početna grupa (8+ god.)", "Po, Sr, Pe 19:00–20:00"],
  ["Aerobna gimnastika", "Po, Sr, Pe 20:00–21:30"],
];

describe("content/schedule.ts matches master prompt §5 S4", () => {
  it("has exactly the six groups, in table order, with the exact names and times", () => {
    expect(SCHEDULE.map((g) => [g.name, formatGroup(g, false)])).toEqual(MASTER_PROMPT_S4_TABLE);
  });

  it("uses the exact sub line and weekend empty state", () => {
    expect(SCHEDULE_LOCATION.heading).toBe("Raspored treninga");
    expect(SCHEDULE_LOCATION.sub).toBe(
      "Sala Trgovinsko-ugostiteljske škole „Toza Dragović“ (u gradu poznata kao „ŠUP“), Save Kovačevića 25",
    );
    expect(SCHEDULE_LOCATION.weekendEmpty).toBe("Vikendom nema redovnih treninga. Vidimo se u ponedeljak!");
  });

  it("labels the week Po Ut Sr Če Pe Su Ne with the accusatives used by „Sledeći trening“", () => {
    expect(DAYS.map((d) => d.short).join(" ")).toBe("Po Ut Sr Če Pe Su Ne");
    expect(DAYS.slice(0, 5).map((d) => d.accusative)).toEqual(["ponedeljak", "utorak", "sredu", "četvrtak", "petak"]);
  });
});

describe("fixed vs. variable slots (§0 SHOW_SHIFT_NOTE, §5 S4 calendar)", () => {
  it("treats every „ili“ block as not fixed and every single range as fixed", () => {
    for (const group of SCHEDULE) {
      for (const block of group.blocks) {
        expect(isFixed(block)).toBe(!formatBlock(block, false).includes(" ili "));
      }
    }
  });

  it("groups without a fixed slot: only „Takmičarke — C program, starije“", () => {
    const noFixed = SCHEDULE.filter((g) => !g.blocks.some(isFixed)).map((g) => g.name);
    expect(noFixed).toEqual(["Takmičarke — C program, starije"]);
  });

  it("appends the shift note only to variable slots, only when the flag is on", () => {
    const ab = SCHEDULE.find((g) => g.id === "ab")!;
    const [variable, fixed] = ab.blocks;
    expect(formatTimes(variable!, true)).toBe("08:30–10:30 ili 16:00–18:00" + SHIFT_NOTE);
    expect(formatTimes(variable!, false)).toBe("08:30–10:30 ili 16:00–18:00");
    expect(formatTimes(fixed!, true)).toBe("17:30–19:30");
    expect(SHIFT_NOTE).toBe(" · po školskoj smeni");
  });
});

describe("„Po danu“ rows", () => {
  const names = (day: Parameters<typeof daySessions>[1]) => daySessions(SCHEDULE, day).map((r) => r.group.id);

  it("Monday lists the five Po/Sr/Pe groups, earliest first", () => {
    expect(names("po")).toEqual(["ab", "c-starije", "mladja", "starija", "aerobik"]);
  });

  it("Tuesday and Thursday: A i B 17:30, C mlađe 19:30", () => {
    expect(names("ut")).toEqual(["ab", "c-mladje"]);
    expect(names("ce")).toEqual(["ab", "c-mladje"]);
  });

  it("Friday has all six groups", () => {
    expect(names("pe")).toEqual(["ab", "c-starije", "c-mladje", "mladja", "starija", "aerobik"]);
  });

  it("weekend is empty", () => {
    expect(names("su")).toEqual([]);
    expect(names("ne")).toEqual([]);
  });
});
