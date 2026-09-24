/**
 * Builds the quiz view model on the server (content → plain props), so the client
 * island ships no content modules and no rule logic — only a precomputed table.
 */
import { QUIZ } from "@/content/copy";
import { programById } from "@/content/programs";
import { formatDays, formatTimes, groupById, type ScheduleGroup } from "@/content/schedule";
import { QUIZ_AGES, QUIZ_RULES, buildOutcomeTable, type QuizResultKind } from "@/lib/quiz";
import type { QuizGroupView, QuizResultView, QuizViewModel } from "./types";

/** Mechanical quiz UI strings live in content/copy.ts (QUIZ.back / restart / ageUnit). */
export const QUIZ_UI = { back: QUIZ.back, restart: QUIZ.restart, ageUnit: QUIZ.ageUnit } as const;

/** One schedule chip per block: [days, times]; joined with a space they equal formatBlock(block). */
export function slotsOf(id: ScheduleGroup["id"]): QuizGroupView["slots"] {
  return groupById(id).blocks.map((b) => [formatDays(b.days), formatTimes(b)] as const);
}

/** `programName`: show the program title + age (beginner results) instead of the schedule group name. */
export function groupView(id: ScheduleGroup["id"], programName: boolean): QuizGroupView {
  const group = groupById(id);
  const program = programById(group.programId);
  return {
    id,
    name: programName ? program.title : group.name,
    meta: programName ? program.age : null,
    color: program.color,
    slots: slotsOf(id),
  };
}

export function resultView(kind: QuizResultKind): QuizResultView {
  const rule = QUIZ_RULES.find((r) => r.kind === kind);
  if (!rule) throw new Error(`Unknown quiz result ${kind}`);
  const competitive = kind === "takmicarske";
  const groups = rule.groups.map((id) => groupView(id, !competitive));
  const heading = competitive ? QUIZ.competitiveTitle : null;
  return {
    heading,
    groups,
    note: rule.note,
    // Prefills the booking sheet's „Grupa“ field; both beginner groups → „Mlađa početna grupa / Starija početna grupa“.
    booking: heading ?? groups.map((g) => g.name).join(" / "),
  };
}

export function buildQuizViewModel(): QuizViewModel {
  const kinds = QUIZ_RULES.map((r) => r.kind);
  const views = Object.fromEntries(kinds.map((k) => [k, resultView(k)])) as Record<QuizResultKind, QuizResultView>;
  return {
    ages: QUIZ_AGES,
    table: buildOutcomeTable(),
    views,
    copy: {
      step1: QUIZ.step1,
      step2: QUIZ.step2,
      experience: QUIZ.experience,
      resultCta: QUIZ.resultCta,
      finalNote: QUIZ.finalNote,
      aerobicHint: QUIZ.aerobicHint,
      aerobicColor: programById("aerobik").color,
      back: QUIZ_UI.back,
      restart: QUIZ_UI.restart,
      ageUnit: QUIZ_UI.ageUnit,
    },
  };
}
