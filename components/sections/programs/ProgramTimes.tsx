import type { CSSProperties } from "react";
import { dayByCode, SCHEDULE_LOCATION, SCHEDULE_UI } from "@/content/schedule";
import { typesetSr } from "@/lib/typeset";
import type { DayStripRow } from "./model";

/**
 * Optional by-day cross-check inside „Programi i termini“. The cards give each
 * parent their group's schedule; this native disclosure answers the different
 * question „what is happening on Tuesday?" without making everyone read the
 * same long timetable twice. The island only marks today and fills the next line.
 * Without JS the disclosure still works and the cards carry every time.
 */
export function ProgramTimes({ rows }: { rows: readonly DayStripRow[] }) {
  const days = rows.filter((r) => r.sessions.length > 0);
  return (
    <div className="pg-times">
      <p className="pg-next" data-nextline="" hidden>
        <span className="pg-next__label">{typesetSr(`${SCHEDULE_UI.next}: `)}</span>
        <span data-nextline-text="" />
      </p>
      <details className="pg-times__details">
        <summary className="pg-times__summary">{SCHEDULE_UI.dayOverview}</summary>
        <ol className="pg-ts">
        {days.map((row) => {
          const d = dayByCode(row.day);
          return (
            <li key={row.day} className="pg-ts__row" data-ts-day={row.day}>
              <span className="pg-ts__day" aria-hidden="true">
                {d.short}
              </span>
              <span className="sr-only">{d.full}</span>
              <span className="pg-ts__today" data-ts-today="" hidden>
                {SCHEDULE_UI.today}
              </span>
              <ul className="pg-ts__sessions">
                {row.sessions.map((s) => (
                  <li key={`${s.groupId}${s.times}`} className="pg-ts__session">
                    <span className="pg-ts__swatch" style={{ "--sw": s.color } as CSSProperties} aria-hidden="true" />
                    <span className="pg-ts__time tabular">{typesetSr(s.times)}</span>{" "}
                    <span className="pg-ts__group">{typesetSr(s.groupName)}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
        </ol>
        <p className="pg-times__weekend">{typesetSr(SCHEDULE_LOCATION.weekendEmpty)}</p>
      </details>
    </div>
  );
}
