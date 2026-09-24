import { describe, expect, it } from "vitest";
import { QUIZ } from "@/content/copy";
import { SCHEDULE } from "@/content/schedule";
import {
  QUIZ_AGES,
  QUIZ_RULES,
  buildOutcomeTable,
  isQuizAge,
  needsExperience,
  recommend,
  type QuizRecommendation,
} from "@/lib/quiz";

const [TEK_POCINJE, REKREATIVNO, TAKMICILO_SE] = QUIZ.experience;

/** Unwraps a result; fails the test when the quiz asks for step 2 instead. */
function resultOf(outcome: ReturnType<typeof recommend>): QuizRecommendation {
  if (outcome.status !== "result") throw new Error(`Expected a result, got "${outcome.status}"`);
  return outcome.recommendation;
}

const MLADJA = ["mladja"];
const STARIJA = ["starija"];
const BOTH_BEGINNER = ["mladja", "starija"];
const TAKMICARSKE = ["ab", "c-starije", "c-mladje"];

describe("quiz — §7 acceptance cases", () => {
  it("(3) → Mlađa početna grupa", () => {
    const r = resultOf(recommend(3));
    expect(r.kind).toBe("mladja");
    expect(r.groups).toEqual(MLADJA);
  });

  it("(7) → Mlađa početna grupa", () => {
    const r = resultOf(recommend(7));
    expect(r.kind).toBe("mladja");
    expect(r.groups).toEqual(MLADJA);
  });

  it("(8, Tek počinje) → both beginner groups + age-8 note", () => {
    const r = resultOf(recommend(8, "Tek počinje"));
    expect(r.kind).toBe("obe-pocetne");
    expect(r.groups).toEqual(BOTH_BEGINNER);
    expect(r.note).toBe("Za uzrast od 8 godina trenerica predlaže grupu na probnom treningu.");
  });

  it("(8, Takmičilo se) → Takmičarske grupe + competitive note", () => {
    const r = resultOf(recommend(8, "Takmičilo se"));
    expect(r.kind).toBe("takmicarske");
    expect(r.groups).toEqual(TAKMICARSKE);
    expect(r.note).toBe("Grupu predlaže trenerica posle probnog treninga.");
  });

  it("(9, Tek počinje) → Starija početna grupa", () => {
    const r = resultOf(recommend(9, "Tek počinje"));
    expect(r.kind).toBe("starija");
    expect(r.groups).toEqual(STARIJA);
    expect(r.note).toBeNull();
  });

  it("(12, Treniralo je rekreativno) → Takmičarske grupe", () => {
    const r = resultOf(recommend(12, "Treniralo je rekreativno"));
    expect(r.kind).toBe("takmicarske");
    expect(r.groups).toEqual(TAKMICARSKE);
  });

  it("(16, Tek počinje) → Starija početna grupa", () => {
    const r = resultOf(recommend(16, "Tek počinje"));
    expect(r.kind).toBe("starija");
    expect(r.groups).toEqual(STARIJA);
  });
});

describe("quiz — step 2 and edge cases", () => {
  it("asks step 2 for age 8 without experience", () => {
    expect(recommend(8)).toEqual({ status: "ask-experience" });
  });

  it("asks step 2 for every age ≥ 8 and never below 8", () => {
    for (const age of QUIZ_AGES) {
      expect(needsExperience(age)).toBe(age >= 8);
      expect(recommend(age).status).toBe(age >= 8 ? "ask-experience" : "result");
    }
  });

  it("ignores experience under 8 (step 2 is not asked)", () => {
    expect(resultOf(recommend(5, TAKMICILO_SE)).kind).toBe("mladja");
    expect(resultOf(recommend(7, REKREATIVNO)).kind).toBe("mladja");
  });

  it("rejects out-of-range and non-integer ages", () => {
    for (const bad of [2, 19, 0, -1, 7.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => recommend(bad)).toThrow(RangeError);
      expect(isQuizAge(bad)).toBe(false);
    }
    expect(() => recommend("8" as unknown as number)).toThrow(RangeError);
  });

  it("rejects an unknown experience answer", () => {
    expect(() => recommend(10, "Nešto drugo" as never)).toThrow(TypeError);
  });

  it("uses the age range 3…18 from content", () => {
    expect(QUIZ_AGES[0]).toBe(QUIZ.ageMin);
    expect(QUIZ_AGES.at(-1)).toBe(QUIZ.ageMax);
    expect(QUIZ_AGES).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it("≥ 8 with recreational or competitive experience is always Takmičarske", () => {
    for (const age of QUIZ_AGES.filter((a) => a >= 8)) {
      expect(resultOf(recommend(age, REKREATIVNO)).kind).toBe("takmicarske");
      expect(resultOf(recommend(age, TAKMICILO_SE)).kind).toBe("takmicarske");
    }
  });

  it("≥ 9 beginners always get Starija; 8-year-old beginners get both", () => {
    for (const age of QUIZ_AGES.filter((a) => a >= 8)) {
      expect(resultOf(recommend(age, TEK_POCINJE)).kind).toBe(age === 8 ? "obe-pocetne" : "starija");
    }
  });

  it("every result carries the aerobic hint (no age claim)", () => {
    for (const age of QUIZ_AGES) {
      const answers = needsExperience(age) ? QUIZ.experience : [undefined];
      for (const exp of answers) {
        const r = resultOf(recommend(age, exp));
        expect(r.aerobicHint).toBe("Pitajte trenericu i za aerobnu gimnastiku.");
      }
    }
  });

  it("returns only schedule group ids that exist in content/schedule.ts", () => {
    const ids = new Set(SCHEDULE.map((g) => g.id));
    for (const rule of QUIZ_RULES) {
      for (const id of rule.groups) expect(ids.has(id)).toBe(true);
    }
  });
});

describe("quiz — rules and UI table", () => {
  it("rules are in the §5 order (first match wins)", () => {
    expect(QUIZ_RULES.map((r) => r.kind)).toEqual(["mladja", "obe-pocetne", "starija", "takmicarske"]);
    expect(QUIZ_RULES.map((r) => r.ages)).toEqual([
      [3, 7],
      [8, 8],
      [9, 18],
      [8, 18],
    ]);
  });

  it("the outcome table used by the island agrees with recommend() for every answer", () => {
    const table = buildOutcomeTable();
    expect(table).toHaveLength(QUIZ_AGES.length);
    QUIZ_AGES.forEach((age, i) => {
      const entry = table[i];
      if (!needsExperience(age)) {
        expect(entry).toBe(resultOf(recommend(age)).kind);
      } else {
        expect(Array.isArray(entry)).toBe(true);
        QUIZ.experience.forEach((exp, j) => {
          expect((entry as readonly string[])[j]).toBe(resultOf(recommend(age, exp)).kind);
        });
      }
    });
  });
});
