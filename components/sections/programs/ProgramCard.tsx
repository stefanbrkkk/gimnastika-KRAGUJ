import type { Program } from "@/content/programs";
import { CTA } from "@/content/site";
import { typesetSr } from "@/lib/typeset";
import { PROGRAMS_UI, programSchedule, programStyle } from "./model";
import { ProgramIcon } from "./ProgramIcon";
import { ScheduleLines } from "./ScheduleLines";

/**
 * One program "frame" of the contact sheet: a plate in the program color with
 * the apparatus drawing, then title, age, description, days/times and the two
 * CTAs (filled first, as in every CTA pair on the page). Server-rendered and
 * complete without JS; the island (ProgramsBrowser) adds the detail sheet (tap
 * on the card or the + button) and filtering.
 * The card is a white print on the dark section: it carries the light theme
 * tokens itself (data-theme="light").
 */
export function ProgramCard({ program }: { program: Program }) {
  const titleId = `program-${program.id}-naslov`;
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
        <ProgramIcon icon={program.icon} label={program.iconLabel} className="pc-icon" />
        <button
          type="button"
          className="pc-open"
          data-program-open={program.id}
          aria-haspopup="dialog"
          aria-label={PROGRAMS_UI.openLabel(program.title)}
        >
          <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 5.5v13M5.5 12h13" />
          </svg>
        </button>
      </div>
      <div className="pc-body">
        <h3 id={titleId} className="pc-title text-h3">
          {typesetSr(program.title)}
        </h3>
        {program.age ? <p className="pc-age label-caps">{typesetSr(program.age)}</p> : null}
        <p className="pc-desc">{typesetSr(program.description)}</p>
        <ScheduleLines groups={programSchedule(program)} className="pc-sched" />
        <div className="pc-actions">
          <a href="#kontakt" data-booking={program.title} className="btn btn-primary">
            {CTA.trial}
          </a>
          <a href="#raspored" data-schedule-program={program.id} className="btn btn-secondary">
            {CTA.viewSchedule}
          </a>
        </div>
      </div>
    </article>
  );
}
