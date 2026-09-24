/**
 * S2 quiz — „Koji program je za vaše dete?“ (§5). Pure recommendation logic, no DOM.
 *
 * Step 1 asks the child's age (3…18). Step 2 („Da li je već treniralo gimnastiku?“)
 * is asked only if age ≥ 8. Rules, in this exact order — the first match wins:
 *   1. 3–7                                              → Mlađa početna grupa
 *   2. 8 & „Tek počinje“                                → both beginner groups + QUIZ.noteAge8
 *   3. ≥9 & „Tek počinje“                               → Starija početna grupa
 *   4. ≥8 & („Treniralo je rekreativno“ | „Takmičilo se“) → Takmičarske grupe (A, B i C program)
 *                                                          + QUIZ.noteCompetitive
 * Every result also carries QUIZ.aerobicHint (no age claim).
 * Results name schedule group ids from content/schedule.ts so the UI can show schedule chips.
 */
import { QUIZ, type Experience } from "@/content/copy";
import type { ScheduleGroup } from "@/content/schedule";

export type QuizGroupId = ScheduleGroup["id"];
export type QuizResultKind = "mladja" | "obe-pocetne" | "starija" | "takmicarske";

export interface QuizRule {
  kind: QuizResultKind;
  /** Inclusive age range. */
  ages: readonly [from: number, to: number];
  /** Step-2 answers this rule matches; null = step 2 is not asked. */
  experience: readonly Experience[] | null;
  /** Schedule groups to show, in display order. */
  groups: readonly QuizGroupId[];
  /** Extra note shown under the groups. */
  note: string | null;
}

export interface QuizRecommendation {
  kind: QuizResultKind;
  groups: readonly QuizGroupId[];
  note: string | null;
  /** Shown with every result. */
  aerobicHint: string;
}

export type QuizOutcome = { status: "ask-experience" } | { status: "result"; recommendation: QuizRecommendation };

const [BEGINNER, RECREATIONAL, COMPETED] = QUIZ.experience;

/** Step 2 is asked only from this age on. */
export const EXPERIENCE_FROM_AGE = 8;

/** The §5 rules, in order. First match wins. */
export const QUIZ_RULES: readonly QuizRule[] = [
  { kind: "mladja", ages: [3, 7], experience: null, groups: ["mladja"], note: null },
  { kind: "obe-pocetne", ages: [8, 8], experience: [BEGINNER], groups: ["mladja", "starija"], note: QUIZ.noteAge8 },
  { kind: "starija", ages: [9, QUIZ.ageMax], experience: [BEGINNER], groups: ["starija"], note: null },
  {
    kind: "takmicarske",
    ages: [8, QUIZ.ageMax],
    experience: [RECREATIONAL, COMPETED],
    groups: ["ab", "c-starije", "c-mladje"],
    note: QUIZ.noteCompetitive,
  },
];

/** Ages offered as step-1 chips: 3 … 18. */
export const QUIZ_AGES: readonly number[] = Array.from(
  { length: QUIZ.ageMax - QUIZ.ageMin + 1 },
  (_, i) => QUIZ.ageMin + i,
);

export function isQuizAge(age: unknown): age is number {
  return typeof age === "number" && Number.isInteger(age) && age >= QUIZ.ageMin && age <= QUIZ.ageMax;
}

/** True when the quiz must ask step 2 for this age. */
export const needsExperience = (age: number): boolean => age >= EXPERIENCE_FROM_AGE;

const isExperience = (value: unknown): value is Experience =>
  (QUIZ.experience as readonly unknown[]).includes(value);

/**
 * Recommends a program. `experience` is ignored under 8 (step 2 is not asked there).
 * Throws RangeError for an age outside 3…18 (or not an integer) and TypeError for an
 * unknown step-2 answer.
 */
export function recommend(age: number, experience?: Experience): QuizOutcome {
  if (!isQuizAge(age)) throw new RangeError(`Quiz age must be an integer ${QUIZ.ageMin}–${QUIZ.ageMax}, got ${String(age)}`);
  if (experience !== undefined && !isExperience(experience)) {
    throw new TypeError(`Unknown quiz answer: ${String(experience)}`);
  }
  const answer = needsExperience(age) ? experience : undefined;
  if (needsExperience(age) && answer === undefined) return { status: "ask-experience" };

  const rule = QUIZ_RULES.find(
    (r) =>
      age >= r.ages[0] &&
      age <= r.ages[1] &&
      (r.experience === null ? answer === undefined : answer !== undefined && r.experience.includes(answer)),
  );
  if (!rule) throw new Error(`No quiz rule for age ${age} / ${String(answer)}`);
  return {
    status: "result",
    recommendation: { kind: rule.kind, groups: rule.groups, note: rule.note, aerobicHint: QUIZ.aerobicHint },
  };
}

/**
 * Precomputed outcomes for the client island (keeps the rules out of the browser bundle):
 * index = age − 3; a kind when step 2 is not asked, otherwise one kind per QUIZ.experience answer.
 */
export type QuizOutcomeTable = readonly (QuizResultKind | readonly QuizResultKind[])[];

export function buildOutcomeTable(): QuizOutcomeTable {
  const kindOf = (o: QuizOutcome): QuizResultKind => {
    if (o.status !== "result") throw new Error("Incomplete quiz answer");
    return o.recommendation.kind;
  };
  return QUIZ_AGES.map((age) =>
    needsExperience(age) ? QUIZ.experience.map((exp) => kindOf(recommend(age, exp))) : kindOf(recommend(age)),
  );
}
