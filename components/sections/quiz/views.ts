/**
 * Builds the quiz view model on the server (content → plain props), so the client
 * island ships no content modules and no rule logic — only a precomputed table.
 */
import { QUIZ } from "@/content/copy";
import { programById } from "@/content/programs";
import { formatDays, formatTimes, groupById, type ScheduleGroup } from "@/content/schedule";
import { QUIZ_AGES, QUIZ_RULES, buildOutcomeTable, type QuizResultKind } from "@/lib/quiz";
import { typesetSr } from "@/lib/typeset";
import { glueDash } from "../programs/model";
import type { QuizGroupView, QuizResultView, QuizViewModel } from "./types";

/** Mechanical quiz UI strings live in content/copy.ts (QUIZ.back / restart / ageUnit). */
export const QUIZ_UI = { back: QUIZ.back, restart: QUIZ.restart, ageUnit: QUIZ.ageUnit } as const;

/**
 * Booking prefill („Grupa“) for the age-8 beginner result, which offers both beginner groups.
 * One short label instead of „Mlađa početna grupa / Starija početna grupa“: the booking sheet
 * adds an unknown label as its own option, and this one must read well in a select and an SMS.
 */
export const BOTH_BEGINNERS_BOOKING = "Mlađa ili starija početna grupa";

/** One schedule chip per block: [days, times]; joined with a space they equal formatBlock(block). */
export function slotsOf(id: ScheduleGroup["id"]): QuizGroupView["slots"] {
  return groupById(id).blocks.map((b) => [formatDays(b.days), formatTimes(b)] as const);
}

/**
 * Display typography for a group name (text unchanged apart from no-break spaces): the spaced
 * dash stays with the word before it and a program designation („C program“, „A i B program“)
 * never splits, so „Takmičarke — C program, starije“ wraps only after the dash or the comma.
 */
export const groupNameDisplay = (name: string): string =>
  glueDash(name).replace(/\b[ABC](?: i [ABC])? program\b/g, (m) => m.replace(/ /g, "\u00A0"));

/** `programName`: show the program title + age (beginner results) instead of the schedule group name. */
export function groupView(id: ScheduleGroup["id"], programName: boolean): QuizGroupView {
  const group = groupById(id);
  const program = programById(group.programId);
  return {
    id,
    name: groupNameDisplay(programName ? program.title : group.name),
    meta: programName && program.age ? typesetSr(program.age) : null,
    color: program.color,
    slots: slotsOf(id),
  };
}

export function resultView(kind: QuizResultKind): QuizResultView {
  const rule = QUIZ_RULES.find((r) => r.kind === kind);
  if (!rule) throw new Error(`Unknown quiz result ${kind}`);
  const competitive = kind === "takmicarske";
  const groups = rule.groups.map((id) => groupView(id, !competitive));
  // Display strings are typeset (lib/typeset: no-break spaces only); the booking label stays raw.
  return {
    heading: competitive ? typesetSr(QUIZ.competitiveTitle) : null,
    groups,
    note: rule.note ? typesetSr(rule.note) : null,
    // Prefills the booking sheet's „Grupa“ field.
    booking: competitive
      ? QUIZ.competitiveTitle
      : kind === "obe-pocetne"
        ? BOTH_BEGINNERS_BOOKING
        : rule.groups.map((id) => programById(groupById(id).programId).title).join(" / "),
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
      step1: typesetSr(QUIZ.step1),
      step2: typesetSr(QUIZ.step2),
      experience: QUIZ.experience,
      resultCta: typesetSr(QUIZ.resultCta),
      finalNote: typesetSr(QUIZ.finalNote),
      aerobicHint: typesetSr(QUIZ.aerobicHint),
      aerobicColor: programById("aerobik").color,
      back: QUIZ_UI.back,
      restart: QUIZ_UI.restart,
      ageUnit: QUIZ_UI.ageUnit,
    },
  };
}
