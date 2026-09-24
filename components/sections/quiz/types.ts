/** Serializable view model passed from the server section to the quiz island (types only). */
import type { QuizOutcomeTable, QuizResultKind } from "@/lib/quiz";

export interface QuizGroupView {
  id: string;
  /** Group name (program title, or the schedule group name inside the competitive result). */
  name: string;
  /** Program age line, e.g. „3–8 godina“; null when the program has none. */
  meta: string | null;
  /** Program color — swatch only, always next to the name. */
  color: string;
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
}

export interface QuizCopy {
  step1: string;
  step2: string;
  experience: readonly string[];
  resultCta: string;
  finalNote: string;
  aerobicHint: string;
  /** Aerobic program color (swatch next to the hint). */
  aerobicColor: string;
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
