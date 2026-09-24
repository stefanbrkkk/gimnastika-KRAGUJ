/**
 * No-JS fallback: the same four rules as a compact static age → group guide, built
 * from content data (lib/quiz QUIZ_RULES + schedule). Shown only while <html> lacks
 * the "js" class (set by the inline head script before first paint); the interactive
 * island replaces it otherwise — no swap after hydration, so no layout shift.
 */
import { QUIZ } from "@/content/copy";
import { programById } from "@/content/programs";
import { QUIZ_RULES } from "@/lib/quiz";
import { QuizBand } from "./QuizBand";
import { QuizActions, QuizGroups } from "./QuizGroups";
import { QUIZ_UI, resultView } from "./views";

const agesLabel = ([from, to]: readonly [number, number]) =>
  `${from === to ? from : `${from}–${to}`} ${QUIZ_UI.ageUnit}`;

export function QuizGuide() {
  return (
    <div className="quiz-card quiz-guide">
      <QuizBand step={2} still />
      <div className="quiz-body">
        <ol className="quiz-rules">
          {QUIZ_RULES.map((rule) => (
            <li key={rule.kind} className="quiz-rule">
              <p className="quiz-rule__if">
                <span className="quiz-rule__age tabular">{agesLabel(rule.ages)}</span>
                {rule.experience ? <span className="quiz-rule__exp">{rule.experience.join("\u00a0· ")}</span> : null}
              </p>
              <div className="quiz-rule__then">
                <QuizGroups view={resultView(rule.kind)} />
              </div>
            </li>
          ))}
        </ol>
        <QuizActions
          booking=""
          cta={QUIZ.resultCta}
          finalNote={QUIZ.finalNote}
          aerobicHint={QUIZ.aerobicHint}
          aerobicColor={programById("aerobik").color}
        />
      </div>
    </div>
  );
}
