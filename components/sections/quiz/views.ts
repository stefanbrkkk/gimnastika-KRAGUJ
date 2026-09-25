/**
 * Builds the quiz view model on the server (content → plain props), so the client
 * island ships no content modules and no rule logic — only a precomputed table.
 */
import { createElement, isValidElement, type ReactNode } from "react";
import { QUIZ } from "@/content/copy";
import { programById, type ApparatusIcon, type Program } from "@/content/programs";
import { formatDays, formatTimes, groupById, type ScheduleGroup } from "@/content/schedule";
import { QUIZ_AGES, QUIZ_RULES, buildOutcomeTable, type QuizResultKind } from "@/lib/quiz";
import { typesetSr } from "@/lib/typeset";
import { ProgramIcon } from "../programs/ProgramIcon";
import { glueDash } from "../programs/model";
import { QuizCtaLabel, QuizHint, QuizPlate } from "./QuizPlate";
import type { QuizGroupView, QuizIconArt, QuizResultView, QuizViewModel } from "./types";

/** Mechanical quiz UI strings live in content/copy.ts (QUIZ.back / restart / ageUnit). */
export const QUIZ_UI = { back: QUIZ.back, restart: QUIZ.restart, ageUnit: QUIZ.ageUnit } as const;

/**
 * Booking prefill („Grupa“) for the age-8 beginner result, which offers both beginner groups.
 * One short label instead of „Mlađa početna grupa / Starija početna grupa“: the booking sheet
 * adds an unknown label as its own option, and this one must read well in a select and an SMS.
 */
export const BOTH_BEGINNERS_BOOKING = "Mlađa ili starija početna grupa";

type Props = { className?: unknown; d?: unknown; cx?: unknown; cy?: unknown; r?: unknown; children?: ReactNode };

/** Depth-first walk over a rendered element tree (arrays of arrays, nulls). `visit` → false skips a subtree. */
function walk(node: ReactNode, visit: (type: unknown, props: Props) => boolean | void): void {
  if (Array.isArray(node)) {
    for (const kid of node) walk(kid as ReactNode, visit);
    return;
  }
  if (!isValidElement<Props>(node)) return;
  if (visit(node.type, node.props) === false) return;
  walk(node.props.children, visit);
}

const classOf = (props: Props): string => (typeof props.className === "string" ? props.className : "");
const STROKES = ["thin", "rail", "post", "solid"] as const;

/**
 * The apparatus drawing of S3's ProgramIcon (48-unit box), read from the component itself so
 * the quiz's plates and strip always draw exactly what the program cards draw. Takes the
 * static print of the whole drawing (.pi-latent) when there is one, otherwise every drawn
 * path; motion trails (.pi-fx) and the posed silhouette are left out. Server side only: the
 * strings reach the island as props, never the icon module.
 */
export function iconArt(icon: ApparatusIcon): QuizIconArt {
  const svg = ProgramIcon({ icon, label: "" });
  let scope: ReactNode = svg;
  walk(svg, (_, props) => {
    if (!classOf(props).split(" ").includes("pi-latent")) return;
    scope = props.children;
    return false;
  });
  const paths: { d: string; k?: (typeof STROKES)[number] }[] = [];
  const dots: { cx: number; cy: number; r: number }[] = [];
  walk(scope, (type, props) => {
    const cls = classOf(props).split(" ");
    if (cls.includes("pi-fx") || type === "use") return false;
    if (type === "path" && typeof props.d === "string" && !paths.some((p) => p.d === props.d)) {
      const k = STROKES.find((s) => cls.includes(`pi-${s}`));
      paths.push(k ? { d: props.d, k } : { d: props.d });
    }
    if (type === "circle" && [props.cx, props.cy, props.r].every((v) => typeof v === "number")) {
      const dot = { cx: props.cx as number, cy: props.cy as number, r: props.r as number };
      if (!dots.some((o) => o.cx === dot.cx && o.cy === dot.cy)) dots.push(dot);
    }
  });
  if (!paths.length) throw new Error(`ProgramIcon „${icon}“ has no drawing`);
  return { paths, dots };
}

/** Plate ink on a program color — the S3 cards' --pc-ink rule (programs/model programStyle). */
const inkOf = (program: Program): string => (program.colorIsDark ? "var(--color-ice-50)" : "var(--color-navy-900)");

/** Plate data of a program: its colour, the S3 ink rule and its apparatus drawing. */
export const plateOf = (program: Program) => ({ color: program.color, ink: inkOf(program), art: iconArt(program.icon) });

/** The aerobic hint „Pitajte trenericu i za aerobnu gimnastiku.“ with the aerobic program's plate. */
export const aerobicHint = (): ReactNode =>
  createElement(QuizHint, { text: typesetSr(QUIZ.aerobicHint), plate: plateOf(programById("aerobik")) });

/** A CTA label as a node; `label` is split into two levels (splitCta) when `levels`. */
export const ctaLabel = (label: string, levels: boolean): ReactNode => {
  const [main, sub] = levels ? splitCta(label) : [label, ""];
  return createElement(QuizCtaLabel, { main: typesetSr(main), sub: typesetSr(sub) });
};

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
  glueDash(name).replace(/\b[ABC](?: i [ABC])? program\b/g, (m) => m.replace(/ /g, " "));

/** `programName`: show the program title + age (beginner results) instead of the schedule group name. */
export function groupView(id: ScheduleGroup["id"], programName: boolean): QuizGroupView {
  const group = groupById(id);
  const program = programById(group.programId);
  return {
    id,
    name: groupNameDisplay(programName ? program.title : group.name),
    meta: programName && program.age ? typesetSr(program.age) : null,
    plate: createElement(QuizPlate, plateOf(program)),
    slots: slotsOf(id),
  };
}

/**
 * The strip's landing per result: ages 3–7 fly once, long, onto the floor podium (Mlađa
 * početna — parter); the 8-year-old beginner lands on the floor too (both beginner groups);
 * Starija početna lands on the beam; the competitive result flies off the uneven bars and
 * sticks the landing on the mat.
 */
const BAND: Readonly<Record<QuizResultKind, QuizResultView["band"]>> = {
  mladja: { variant: "skip", apparatus: "parter" },
  "obe-pocetne": { variant: "parter", apparatus: "parter" },
  starija: { variant: "greda", apparatus: "greda" },
  takmicarske: { variant: "flat", apparatus: "razboj" },
};

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
    programs: [...new Set(rule.groups.map((id) => groupById(id).programId))],
    band: BAND[kind],
  };
}

/**
 * The result CTA as two levels (QP-15): the action, then its object — „Zakažite probni
 * trening“ / „za ovu grupu“ — split before the last „ za “. Text unchanged: joined with one
 * space the parts are the whole label (the accessible name).
 */
export function splitCta(label: string): readonly [main: string, sub: string] {
  const cut = label.lastIndexOf(" za ");
  return cut > 0 ? [label.slice(0, cut), label.slice(cut + 1)] : [label, ""];
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
      resultCta: ctaLabel(QUIZ.resultCta, true),
      finalNote: typesetSr(QUIZ.finalNote),
      hint: aerobicHint(),
      back: QUIZ_UI.back,
      restart: QUIZ_UI.restart,
      ageUnit: QUIZ_UI.ageUnit,
    },
  };
}
