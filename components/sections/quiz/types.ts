/**
 * View model passed from the server section to the quiz island (types only). Plain data, plus
 * a few server-rendered React nodes (plates, CTA label, hint) the island only places.
 */
import type { ReactNode } from "react";
import type { QuizOutcomeTable, QuizResultKind } from "@/lib/quiz";

/** Landing variant of the chronophotograph strip (components/sections/quiz/geometry.ts). */
export type QuizBandVariant = "flat" | "parter" | "greda" | "skip";

/** An apparatus drawing of S3's ProgramIcon (48-unit box): stroked paths (+ stroke weight) and solid dots. */
export interface QuizIconArt {
  paths: readonly { d: string; k?: "thin" | "rail" | "post" }[];
  dots: readonly { cx: number; cy: number; r: number }[];
}

export interface QuizGroupView {
  id: string;
  /** Group name (program title, or the schedule group name inside the competitive result). */
  name: string;
  /** Program age line, e.g. „3–8 godina“; null when the program has none. */
  meta: string | null;
  /** The S3 program plate (program colour + apparatus drawing), server-rendered (QuizPlate). */
  plate: ReactNode;
  /** Schedule chips: [days, times] — together they are formatBlock() of one block. */
  slots: readonly (readonly [days: string, times: string])[];
}

export interface QuizResultView {
  /** Heading above several sub-groups (competitive result); null → each group is its own heading. */
  heading: string | null;
  groups: readonly QuizGroupView[];
  note: string | null;
  /** Prefill for the booking sheet's „Grupa“ field (data-booking). */
  booking: string;
  /** Recommended program ids (S3 marks them: window „kraguj:recommend“). */
  programs: readonly string[];
  /** The strip's landing: variant (raised floor / beam / mat / single long flight) and apparatus. */
  band: { variant: QuizBandVariant; apparatus: "parter" | "greda" | "razboj" };
}

export interface QuizCopy {
  step1: string;
  step2: string;
  experience: readonly string[];
  /** Result CTA label (QuizCtaLabel): „Zakažite probni trening“ / „za ovu grupu“. */
  resultCta: ReactNode;
  finalNote: string;
  /** „Pitajte trenericu i za aerobnu gimnastiku.“ with the aerobic plate (QuizHint). */
  hint: ReactNode;
  back: string;
  restart: string;
  /** „god.“ — age unit in the answers caption. */
  ageUnit: string;
}

export interface QuizViewModel {
  ages: readonly number[];
  table: QuizOutcomeTable;
  views: Readonly<Record<QuizResultKind, QuizResultView>>;
  copy: QuizCopy;
}
