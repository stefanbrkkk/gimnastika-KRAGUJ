import { HERO } from "@/content/copy";
import type { Program } from "@/content/programs";
import { formatBlock, groupById, SCHEDULE_UI as T } from "@/content/schedule";
import { PRIMARY_PHONE } from "@/content/site";
import { telHref } from "@/lib/links";
import { gcalData, googleCalendarUrl } from "@/lib/gcal";
import { fixedBlocks } from "@/lib/ics";
import { typesetSr } from "@/lib/typeset";

/** Drawn icons (24px grid, 1.75 stroke) for the compact calendar pills. */
const ExternalIcon = () => (
  <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M13.5 5.5H18.5V10.5M18.5 5.5 10.5 13.5M16.5 14v4.5h-11v-11H10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const PhoneIcon = () => (
  <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M7 3.5h2.6l1.4 4.1-2.1 1.5a11.5 11.5 0 0 0 6 6l1.5-2.1 4.1 1.4V17a2.5 2.5 0 0 1-2.7 2.5A15.8 15.8 0 0 1 4.5 6.2 2.5 2.5 0 0 1 7 3.5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Compact calendar actions of one program, right under its schedule lines: one
 * small pill per fixed block ("Google kalendar") plus a small call pill — no
 * scrolling to a footer, no .ics detour. A group without a fixed slot gets only
 * the call pill with the honest note. Google links carry the build-date
 * occurrence; the sheet chunk rewrites `dates` to the next one via data-gcal.
 */
export function ProgramCalendar({ program }: { program: Program }) {
  const anchor = new Date();
  return (
    <>
      {program.groups.map(({ id, label }) => {
        const group = groupById(id);
        const fixed = fixedBlocks(group);
        const titleId = `ps-cal-${group.id}`;
        const mixed = fixed.length > 0 && fixed.length < group.blocks.length;
        return (
          <div key={id} className="ps-cal">
            {label ? (
              <p className="ps-cal__label label-caps" id={titleId}>
                {typesetSr(label)}
              </p>
            ) : null}
            <p className="ps-cal__pills">
              {fixed.map((block) => (
                <a
                  key={block.days.join("") + (block.times[0]?.start ?? "")}
                  className="ps-cal__pill"
                  href={googleCalendarUrl(group, block, anchor)}
                  data-gcal={gcalData(block)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-describedby={label ? titleId : undefined}
                >
                  <ExternalIcon />
                  {typesetSr(T.gcal)}
                  <span className="sr-only">
                    {" "}
                    {typesetSr(formatBlock(block))} {T.newTab}
                  </span>
                </a>
              ))}
            </p>
            {mixed ? <p className="ps-cal__note">{typesetSr(T.fixedOnly(fixed.map((b) => formatBlock(b)).join("; ")))}</p> : null}
            {fixed.length === 0 ? <p className="ps-cal__note">{typesetSr(T.noFixed)}</p> : null}
          </div>
        );
      })}
      <p className="ps-cal__pills">
        <a className="ps-cal__pill" href={telHref(PRIMARY_PHONE.e164)}>
          <PhoneIcon />
          {typesetSr(HERO.ctaSecondary)}
        </a>
      </p>
    </>
  );
}
