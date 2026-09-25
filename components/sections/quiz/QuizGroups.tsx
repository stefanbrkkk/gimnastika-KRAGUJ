/**
 * Recommended group(s) with their schedule chips. Shared by the quiz island's result
 * card and the static no-JS guide (no hooks, no client-only code).
 */
import type { QuizResultView } from "./types";

/** A time range („08:30–10:30“): never broken at its dash; lines wrap around „ ili “ instead. */
const RANGE = /(\d{1,2}:\d{2}–\d{1,2}:\d{2})/;

interface QuizGroupsProps {
  view: QuizResultView;
  /** Put data-quiz-focus + tabIndex=-1 on the first heading (island focus target). */
  focusFirst?: boolean;
}

export function QuizGroups({ view, focusFirst = false }: QuizGroupsProps) {
  const Name = view.heading ? "h4" : "h3";
  const focusProps = (on: boolean) => (on && focusFirst ? { tabIndex: -1, "data-quiz-focus": "" } : {});
  return (
    <>
      {view.heading ? (
        <h3 className="quiz-result__title text-h3" {...focusProps(true)}>
          {view.heading}
        </h3>
      ) : null}
      <ul className="quiz-groups" data-count={view.groups.length} data-sub={view.heading ? "" : undefined}>
        {view.groups.map((g, i) => (
          <li key={g.id} className="quiz-group">
            <Name className="quiz-group__name" {...focusProps(!view.heading && i === 0)}>
              <span className="quiz-swatch" style={{ background: g.color }} aria-hidden="true" />
              {g.name}
            </Name>
            {g.meta ? <p className="quiz-group__meta">{g.meta}</p> : null}
            <ul className="quiz-slots">
              {g.slots.map(([days, times]) => (
                <li key={days + times} className="quiz-slot">
                  <span className="quiz-slot__days">{days}</span>{" "}
                  <span className="quiz-slot__times tabular">
                    {times
                      .split(RANGE)
                      .filter(Boolean)
                      .map((part, k) =>
                        RANGE.test(part) ? (
                          <span key={k} className="quiz-slot__time">
                            {part}
                          </span>
                        ) : part.trim() === "ili" ? (
                          <span key={k} className="quiz-slot__or">
                            {part}
                          </span>
                        ) : (
                          part
                        ),
                      )}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {view.note ? <p className="quiz-note">{view.note}</p> : null}
    </>
  );
}

interface QuizActionsProps {
  booking: string;
  cta: string;
  finalNote: string;
  aerobicHint: string;
  aerobicColor: string;
}

/** CTA (prefills the booking sheet) + the small final line + the aerobic hint. */
export function QuizActions({ booking, cta, finalNote, aerobicHint, aerobicColor }: QuizActionsProps) {
  return (
    <div className="quiz-result__act">
      <a href="#kontakt" data-booking={booking} className="btn btn-primary quiz-cta">
        {cta}
      </a>
      <p className="quiz-final">{finalNote}</p>
      <p className="quiz-hint">
        <span className="quiz-swatch" style={{ background: aerobicColor }} aria-hidden="true" />
        <span className="quiz-hint__text">{aerobicHint}</span>
      </p>
    </div>
  );
}
