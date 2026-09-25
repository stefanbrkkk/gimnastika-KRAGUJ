import type { Program } from "@/content/programs";
import { CTA } from "@/content/site";
import { typesetSr } from "@/lib/typeset";
import { PROGRAM_BIB, PROGRAMS_UI, programDays, programSchedule, programStyle } from "./model";
import { ProgramIcon } from "./ProgramIcon";
import { ScheduleLines } from "./ScheduleLines";

/**
 * One program "frame" of the contact sheet. The plate is an apparatus print (QP-06): the
 * drawing stands on a mat line over a faint Marey measuring grid, with the program's
 * competitor bib („3–8“, „8+“, „C“, „A·B“) and an ink-outlined + that opens the detail sheet.
 * The plate takes the row's spare height, so every CTA sits at the same place (QP2-04); from
 * 160px it is the detail sheet's scene — the drawing scaled up, the club silhouette posed over
 * it (QP2-05).
 * Body: title, age, description, the week row + days/times, then ONE filled action and a quiet
 * tertiary link (QP-12). Server-rendered and complete without JS; the island
 * (ProgramsBrowser) adds the detail sheet, filtering and the quiz recommendation stamp.
 * The card is a white print on the dark section: it carries the light theme tokens itself.
 */
export function ProgramCard({ program }: { program: Program }) {
  const titleId = `program-${program.id}-naslov`;
  const bib = PROGRAM_BIB[program.id];
  return (
    <article
      className="program-card"
      data-theme="light"
      data-program-card=""
      data-program-id={program.id}
      aria-labelledby={titleId}
      style={programStyle(program)}
    >
      <div className="pc-plate">
        <ProgramIcon icon={program.icon} label={program.iconLabel} className="pc-icon" scene="card" />
        {bib ? (
          <span className="pc-bib" aria-hidden="true">
            {bib}
          </span>
        ) : null}
        {/* Quiz recommendation (QP-10): filled in and shown by the island on „kraguj:recommend“. */}
        <p className="pc-stamp" data-stamp="" hidden>
          {PROGRAMS_UI.recommended}
          <span className="pc-stamp__age" />
        </p>
        <button
          type="button"
          className="pc-open"
          data-program-open={program.id}
          aria-haspopup="dialog"
          aria-label={PROGRAMS_UI.openLabel(program.title)}
        >
          <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 6.5v11M6.5 12h11" />
          </svg>
        </button>
      </div>
      <div className="pc-body">
        <h3 id={titleId} className="pc-title text-h3">
          {typesetSr(program.title)}
        </h3>
        {program.age ? <p className="pc-age label-caps">{typesetSr(program.age)}</p> : null}
        <p className="pc-desc">{typesetSr(program.description)}</p>
        <ScheduleLines groups={programSchedule(program)} summaryWeek={programDays(program)} className="pc-sched" />
        <div className="pc-actions">
          <a href="#kontakt" data-booking={program.title} className="btn btn-primary">
            {typesetSr(CTA.trial)}
          </a>
          <a href="#raspored" data-schedule-program={program.id} className="pc-more">
            <span>{typesetSr(CTA.viewSchedule)}</span>
            <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M5 12h13m-5-5 5 5-5 5" />
            </svg>
          </a>
        </div>
      </div>
    </article>
  );
}
