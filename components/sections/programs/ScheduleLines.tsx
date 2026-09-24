import { Fragment } from "react";
import { DAYS } from "@/content/schedule";
import { TIME_JOINER, type ProgramScheduleGroup } from "./model";

interface ScheduleLinesProps {
  groups: readonly ProgramScheduleGroup[];
  className?: string;
  /** Adds a Po–Ne week row per group (the detail sheet's "full schedule"). */
  week?: boolean;
}

/**
 * Days/times of a program, text exactly as formatBlock(): the day list is a
 * small label (full day names for screen readers), the times use the tabular
 * "time" style, and each alternative slot of "… ili …" wraps as a whole.
 * The optional week row is visual only (aria-hidden): the lines carry the text.
 */
export function ScheduleLines({ groups, className, week }: ScheduleLinesProps) {
  return (
    <div className={["pg-sched", className].filter(Boolean).join(" ")}>
      {groups.map(({ label, group, blocks, days }) => (
        <div key={group.id} className="pg-sched__group">
          {label ? <p className="pg-sched__label label-caps">{label}</p> : null}
          {week ? (
            <ol className="pg-week" aria-hidden="true">
              {DAYS.map((d) => (
                <li key={d.code} className="pg-week__day" data-on={days.has(d.code) ? "" : undefined}>
                  {d.short}
                </li>
              ))}
            </ol>
          ) : null}
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
                      <span className="pg-sched__slot">{t}</span>
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
