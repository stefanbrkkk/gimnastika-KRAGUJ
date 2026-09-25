import { Fragment } from "react";
import { DAYS, type DayCode } from "@/content/schedule";
import { TIME_JOINER, type ProgramScheduleGroup } from "./model";

/** A time range („08:30–10:30“) never breaks at its dash (an optional shift note after it may wrap). */
const RANGE = /(\d{1,2}:\d{2}–\d{1,2}:\d{2})/;

interface ScheduleLinesProps {
  groups: readonly ProgramScheduleGroup[];
  className?: string;
  /** Adds a Po–Ne 7-dot week row per group (the detail sheet's "full schedule"; the S4 look). */
  week?: boolean;
  /** One week row for the whole program, above the lines (the card, QP-07): union of its days. */
  summaryWeek?: ReadonlySet<DayCode>;
}

/** The S4 7-dot week row: training days filled with the program colour. Visual only. */
function WeekRow({ days }: { days: ReadonlySet<DayCode> }) {
  return (
    <ol className="pg-week" aria-hidden="true">
      {DAYS.map((d) => (
        <li key={d.code} className="pg-week__day" data-on={days.has(d.code) ? "" : undefined}>
          <span className="pg-week__dot" />
          <span className="pg-week__label">{d.short}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Days/times of a program, text exactly as formatBlock(): the day list is a
 * small label (full day names for screen readers), the times use the tabular
 * "time" style, and each alternative slot of "… ili …" wraps as a whole.
 * The optional week row is visual only (aria-hidden): the lines carry the text.
 */
export function ScheduleLines({ groups, className, week, summaryWeek }: ScheduleLinesProps) {
  return (
    <div className={["pg-sched", className].filter(Boolean).join(" ")}>
      {summaryWeek ? <WeekRow days={summaryWeek} /> : null}
      {groups.map(({ label, group, blocks, days }) => (
        <div key={group.id} className="pg-sched__group">
          {label ? <p className="pg-sched__label label-caps">{label}</p> : null}
          {week ? <WeekRow days={days} /> : null}
          <ul className="pg-sched__blocks">
            {blocks.map((b) => (
              <li key={b.text} className="pg-sched__block">
                <span className="pg-sched__days" aria-hidden="true">
                  {b.days}
                </span>
                <span className="sr-only">{b.daysFull}</span>{" "}
                <span className="pg-sched__times tabular">
                  {b.times.map((t, i) => (
                    <Fragment key={t}>
                      {i > 0 ? <span className="pg-sched__or">{TIME_JOINER}</span> : null}
                      <span className="pg-sched__slot">
                        {t
                          .split(RANGE)
                          .filter(Boolean)
                          .map((part, k) =>
                            RANGE.test(part) ? (
                              <span key={k} className="pg-sched__range">
                                {part}
                              </span>
                            ) : (
                              part
                            ),
                          )}
                      </span>
                    </Fragment>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
