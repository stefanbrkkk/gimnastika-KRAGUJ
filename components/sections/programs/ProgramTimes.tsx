import type { CSSProperties } from "react";
import { dayByCode, SCHEDULE_LOCATION, SCHEDULE_UI } from "@/content/schedule";
import { typesetSr } from "@/lib/typeset";
import type { DayStripRow } from "./model";

/**
 * Compact by-day overview inside „Programi i termini“ (the merged S4 day view).
 * Server-rendered text that never goes stale; the island only marks today
 * (unhides the row's „danas“ tag) and fills the next-training line.
 * Without JS the next line stays hidden — the cards above carry every time.
 */
export function ProgramTimes({ rows }: { rows: readonly DayStripRow[] }) {
  const days = rows.filter((r) => r.sessions.length > 0);
  return (
    <div className="pg-times">
      <h3 className="pg-times__title label-caps">{SCHEDULE_UI.byDay}</h3>
      <p className="pg-next" data-nextline="" hidden>
        <span className="pg-next__label">{typesetSr(`${SCHEDULE_UI.next}: `)}</span>
        <span data-nextline-text="" />
      </p>
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
    </div>
  );
}
