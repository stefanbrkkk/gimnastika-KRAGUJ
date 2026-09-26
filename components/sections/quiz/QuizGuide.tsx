/**
 * No-JS fallback: the same four rules as a compact static age → group guide, built
 * from content data (lib/quiz QUIZ_RULES + schedule). Shown only while <html> lacks
 * the "js" class (set by the inline head script before first paint); the interactive
 * island replaces it otherwise — no swap after hydration, so no layout shift. Its CTA is the
 * plain CTA.trial: there is no single recommended group to point „za ovu grupu“ at.
 */
import { Fragment } from "react";
import { QUIZ } from "@/content/copy";
import { CTA } from "@/content/site";
import { QUIZ_RULES } from "@/lib/quiz";
import { typesetSr } from "@/lib/typeset";
import { QuizBand } from "./QuizBand";
import { QuizBandArt } from "./QuizBandArt";
import { QuizActions, QuizGroups } from "./QuizGroups";
import { QUIZ_UI, aerobicHint, ctaLabel, resultView } from "./views";

const agesLabel = ([from, to]: readonly [number, number]) =>
  typesetSr(`${from === to ? from : `${from}–${to}`} ${QUIZ_UI.ageUnit}`);

export function QuizGuide() {
  return (
    <div className="quiz-card quiz-guide">
      <QuizBand step={2} still art={<QuizBandArt />} />
      <div className="quiz-body">
        <ol className="quiz-rules">
          {QUIZ_RULES.map((rule) => (
            <li key={rule.kind} className="quiz-rule">
              <p className="quiz-rule__if">
                <span className="quiz-rule__age tabular">{agesLabel(rule.ages)}</span>
                {rule.experience ? (
                  <span className="quiz-rule__exp">
                    {/* Each answer stays whole and the „·“ travels with the answer after it, so the
                        list wraps only before a separator, never leaving it at a line end. */}
                    {rule.experience.map((answer, i) => (
                      <Fragment key={answer}>
                        {i > 0 ? " " : null}
                        <span className="quiz-rule__answer">{i > 0 ? `· ${answer}` : answer}</span>
                      </Fragment>
                    ))}
                  </span>
                ) : null}
              </p>
              <div className="quiz-rule__then">
                <QuizGroups view={resultView(rule.kind)} />
              </div>
            </li>
          ))}
        </ol>
        {/* The guide lists every rule, so its CTA names no single group („… za ovu grupu“ is the result card's). */}
        <QuizActions
          booking=""
          cta={ctaLabel(CTA.trial, false)}
          finalNote={typesetSr(QUIZ.finalNote)}
          hint={aerobicHint()}
        />
      </div>
    </div>
  );
}
