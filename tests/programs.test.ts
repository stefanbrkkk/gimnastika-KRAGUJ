import { describe, expect, it } from "vitest";
import {
  blockParts,
  chipByKey,
  filterHint,
  filterStatus,
  glueDash,
  matchingIds,
  PROGRAM_BIB,
  PROGRAM_CHIPS,
  programDays,
  programSchedule,
  TIME_JOINER,
  usableChips,
} from "@/components/sections/programs/model";
import { QUIZ } from "@/content/copy";
import { PROGRAMS, programById, visiblePrograms } from "@/content/programs";
import { formatBlock, SCHEDULE, type ProgramId } from "@/content/schedule";

const VISIBLE: ProgramId[] = ["mladja", "starija", "c-program", "ab-program", "aerobik"];

describe("programs: visible cards", () => {
  it("shows the five §5 programs in card order while SHOW_TRAMPOLINE is false", () => {
    expect(visiblePrograms(false).map((p) => p.id)).toEqual(VISIBLE);
  });
});

describe("programs: schedule lines", () => {
  it("renders exactly formatBlock() for every block (both shift-note settings)", () => {
    for (const shift of [false, true]) {
      for (const group of SCHEDULE) {
        for (const block of group.blocks) {
          const parts = blockParts(block, shift);
          expect(`${parts.days} ${parts.times.join(TIME_JOINER)}`).toBe(formatBlock(block, shift));
          expect(parts.text).toBe(formatBlock(block, shift));
        }
      }
    }
  });

  it("matches the §5 S3 card lines (hard-coded)", () => {
    const lines = (id: ProgramId) =>
      programSchedule(programById(id), false).map((g) => ({ label: g.label, text: g.blocks.map((b) => b.text).join("; ") }));
    expect(lines("mladja")).toEqual([{ label: undefined, text: "Po, Sr, Pe 18:00–19:00" }]);
    expect(lines("starija")).toEqual([{ label: undefined, text: "Po, Sr, Pe 19:00–20:00" }]);
    expect(lines("c-program")).toEqual([
      { label: "Starije", text: "Po, Sr, Pe 08:30–10:30 ili 16:00–18:00" },
      { label: "Mlađe", text: "Ut, Če 19:30–21:30; Pe 08:30–10:30 ili 16:00–18:00" },
    ]);
    expect(lines("ab-program")).toEqual([
      { label: undefined, text: "Po, Sr, Pe 08:30–10:30 ili 16:00–18:00; Ut, Če 17:30–19:30" },
    ]);
    expect(lines("aerobik")).toEqual([{ label: undefined, text: "Po, Sr, Pe 20:00–21:30" }]);
  });

  it("gives screen readers full day names", () => {
    const [group] = programSchedule(programById("c-program"), false);
    expect(group?.blocks[0]?.daysFull).toBe("ponedeljak, sreda, petak");
  });
});

describe("programs: age chips", () => {
  const ids = (key: Parameters<typeof chipByKey>[0]) => matchingIds(chipByKey(key), VISIBLE);

  it("keeps every program under „Sve“ (the all-chip label shared with S4 and S9)", () => {
    expect(chipByKey("svi").label).toBe("Sve");
    expect(ids("svi")).toEqual(VISIBLE);
  });

  it("follows the §5 quiz rules: 3–8 → mlađa, 8+ → starija or competitive", () => {
    expect(ids("3-8")).toEqual(["mladja"]);
    expect(ids("8+")).toEqual(["starija", "c-program", "ab-program"]);
    expect(ids("takmicarke")).toEqual(["c-program", "ab-program"]);
  });

  it("never matches a program that is not visible (e.g. trampolina behind its flag)", () => {
    for (const chip of PROGRAM_CHIPS) {
      expect(matchingIds(chip, VISIBLE)).not.toContain("trampolina");
    }
  });

  it("drops chips that would produce an empty row", () => {
    expect(usableChips(VISIBLE).map((c) => c.key)).toEqual(["svi", "3-8", "8+", "takmicarke"]);
    expect(usableChips(["aerobik"]).map((c) => c.key)).toEqual(["svi"]);
  });

  it("announces what is shown and keeps aerobic gymnastics findable", () => {
    expect(filterStatus(chipByKey("svi"), VISIBLE)).toBe("");
    expect(filterStatus(chipByKey("3-8"), VISIBLE)).toBe(`Prikazano: 1 od 5 programa. ${QUIZ.aerobicHint}`);
    expect(filterStatus(chipByKey("takmicarke"), VISIBLE)).toBe(`Prikazano: 2 od 5 programa. ${QUIZ.aerobicHint}`);
  });

  it("keeps the aerobic hint separately for the phone line under the row", () => {
    expect(filterHint(chipByKey("svi"), VISIBLE)).toBe("");
    expect(filterHint(chipByKey("8+"), VISIBLE)).toBe(QUIZ.aerobicHint);
    expect(filterHint(chipByKey("3-8"), ["mladja", "starija"])).toBe("");
  });

  it("uses only program ids that exist", () => {
    const known = new Set(PROGRAMS.map((p) => p.id));
    for (const chip of PROGRAM_CHIPS) for (const id of chip.ids ?? []) expect(known.has(id)).toBe(true);
  });
});

describe("programs: typography", () => {
  it("glues a spaced dash to the word before it, text otherwise unchanged", () => {
    expect(glueDash("Takmičarke — C program")).toBe("Takmičarke\u00A0— C program");
    expect(glueDash("Mlađa početna grupa")).toBe("Mlađa početna grupa");
  });
});

describe("programs: plate print", () => {
  it("renders each bib from the program's own age line or title — no new fact", () => {
    for (const p of visiblePrograms(false)) {
      const bib = PROGRAM_BIB[p.id];
      if (bib === null) {
        expect(p.age).toBeNull(); // no age claim, no bib (aerobic gymnastics)
        expect(p.id).toBe("aerobik");
        continue;
      }
      const source = `${p.age ?? ""} ${p.title}`;
      for (const token of bib.split(/[·+]/).filter(Boolean)) expect(source).toContain(token);
    }
    expect(PROGRAM_BIB.mladja).toBe("3–8");
    expect(PROGRAM_BIB.starija).toBe("8+");
    expect(PROGRAM_BIB["c-program"]).toBe("C");
    expect(PROGRAM_BIB["ab-program"]).toBe("A·B");
  });

  it("gives the card one week row: the union of all its groups' days", () => {
    const days = (id: ProgramId) => [...programDays(programById(id))].sort();
    expect(days("mladja")).toEqual(["pe", "po", "sr"]);
    expect(days("c-program")).toEqual(["ce", "pe", "po", "sr", "ut"]); // starije Po Sr Pe + mlađe Ut Če Pe
    expect(days("ab-program")).toEqual(["ce", "pe", "po", "sr", "ut"]);
  });
});
