import { Fragment, type CSSProperties } from "react";
import { programById } from "@/content/programs";
import {
  activeDays,
  DAYS,
  dayByCode,
  formatBlock,
  formatDays,
  formatTimes,
  isFixed,
  SCHEDULE_LOCATION,
  type DayCode,
  type ScheduleBlock,
  type ScheduleGroup,
} from "@/content/schedule";
import { HERO } from "@/content/copy";
import { PRIMARY_PHONE, VENUE } from "@/content/site";
import { gcalData, googleCalendarUrl } from "@/lib/gcal";
import { fixedBlocks, icsHref } from "@/lib/ics";
import { telHref } from "@/lib/links";
import { daySessions, groupSlots } from "@/lib/schedule-logic";
import { SCHEDULE_UI as T } from "./copy";
import { NextTraining } from "./NextTraining";

const swatch = (color: string): CSSProperties => ({ ["--swatch" as string]: color });
const ACCUSATIVES = DAYS.map((d) => d.accusative);
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
/**
 * Display-only typesetting: a one-letter word („C“, „A“, „i“) never ends a line,
 * a dash never starts one, and an age such as „(3–8 god.)“ never splits.
 */
const glue = (s: string): string =>
  s
    .replace(/\s—/g, "\u00A0—")
    .replace(/(?<=^|\s)(\p{L})\s(?=\p{L})/gu, "$1\u00A0")
    .replace(/\s(god\.)/g, "\u00A0$1")
    .replace(/(\d)–(\d)/g, "$1\u2060–\u2060$2");

/** A slot such as „Ut, Če 19:30–21:30“ stays on one line inside running text. */
const nbsp = (s: string): string => s.replace(/ /g, "\u00A0");

/** A hyphenated compound („Trgovinsko-ugostiteljska“) never breaks at its hyphen (display only). */
function KeepHyphenated({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\S+-\S+)/).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="sched-nowrap">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** "Po, Sr, Pe" visible; "ponedeljak, sreda, petak" for screen readers. */
function DayNames({ days }: { days: readonly DayCode[] }) {
  return (
    <>
      <span aria-hidden="true">{formatDays(days)}</span>
      <span className="sr-only">{days.map((d) => dayByCode(d).full).join(", ")}</span>
    </>
  );
}

/**
 * "08:30–10:30 ili 16:00–18:00" in tabular numerals; each range never breaks,
 * the line may wrap before "ili". The text (incl. the SHOW_SHIFT_NOTE suffix)
 * comes from formatTimes().
 */
function Times({ block }: { block: ScheduleBlock }) {
  const ranges = block.times.map((t) => `${t.start}–${t.end}`);
  const base = ranges.join(" ili ");
  const full = formatTimes(block);
  const note = full.startsWith(base) ? full.slice(base.length) : "";
  return (
    <span className="sched-times tabular">
      {ranges.map((r, i) => (
        <Fragment key={r}>
          {i > 0 ? " " : null}
          <span className="sched-times__range">
            {i > 0 ? <span className="sched-times__or">ili </span> : null}
            {r}
          </span>
        </Fragment>
      ))}
      {note ? <span className="sched-times__note">{note}</span> : null}
    </span>
  );
}

/** 7-dot week row Po…Ne: active days filled with the program color + ring + bold label. */
function WeekRow({ group }: { group: ScheduleGroup }) {
  const on = activeDays(group);
  return (
    <ol className="sched-week" aria-label={T.weekLabel}>
      {DAYS.map((d) => {
        const active = on.has(d.code);
        return (
          <li key={d.code} className="sched-week__day" data-on={active ? "" : undefined}>
            <span className="sched-week__dot" aria-hidden="true" />
            <span className="sched-week__label" aria-hidden="true">
              {d.short}
            </span>
            <span className="sr-only">
              {d.full}, {active ? T.dayOn : T.dayOff}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CalendarIcon() {
  return (
    <svg className="sched-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg className="sched-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M13.5 5.5H18.5V10.5M18.5 5.5 10.5 13.5M16.5 14v4.5h-11v-11H10" />
    </svg>
  );
}

/** Same drawing as the page-chrome phone icon (24px grid, 1.75 stroke). */
function PhoneIcon() {
  return (
    <svg className="sched-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 3.5h2.6l1.4 4.1-2.1 1.5a11.5 11.5 0 0 0 6 6l1.5-2.1 4.1 1.4V17a2.5 2.5 0 0 1-2.7 2.5A15.8 15.8 0 0 1 4.5 6.2 2.5 2.5 0 0 1 7 3.5z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="sched-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

function GroupCard({ group, anchor }: { group: ScheduleGroup; anchor: Date }) {
  const program = programById(group.programId);
  const titleId = `sched-${group.id}-title`;
  const fixed = fixedBlocks(group);
  const mixed = fixed.length > 0 && fixed.length < group.blocks.length;
  return (
    <li className="sched-card" data-sched-item="" data-program={group.programId} style={swatch(program.color)}>
      <article className="sched-card__inner" aria-labelledby={titleId}>
        <div className="sched-card__head">
          <span className="sched-swatch sched-swatch--lg" aria-hidden="true" />
          <h3 id={titleId} className="sched-card__title">
            {glue(group.name)}
          </h3>
        </div>

        <WeekRow group={group} />

        <dl className="sched-blocks">
          {group.blocks.map((block) => (
            <div key={formatBlock(block)} className="sched-block">
              <dt className="sched-block__days">
                <DayNames days={block.days} />
              </dt>
              <dd className="sched-block__time">
                <Times block={block} />
              </dd>
            </div>
          ))}
        </dl>

        {fixed.length > 0 ? (
          <div className="sched-card__foot">
            <NextTraining slots={groupSlots(group, isFixed)} accusatives={ACCUSATIVES} label={T.next} />
            <div className="sched-cal">
              <a className="sched-cal__link" href={icsHref(group)} type="text/calendar" aria-describedby={titleId}>
                <CalendarIcon />
                {T.ics}
              </a>
              {fixed.map((block) => (
                <a
                  key={formatBlock(block)}
                  className="sched-cal__link"
                  href={googleCalendarUrl(group, block, anchor)}
                  data-gcal={gcalData(block)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-describedby={titleId}
                >
                  <ExternalIcon />
                  {T.gcal}
                  {fixed.length > 1 ? ` · ${formatBlock(block)}` : null}
                  <span className="sr-only"> {T.newTab}</span>
                </a>
              ))}
            </div>
            {mixed ? <p className="sched-cal__note">{T.fixedOnly(fixed.map((b) => nbsp(formatBlock(b))).join("; "))}</p> : null}
          </div>
        ) : (
          // No fixed slot (C program, starije): say why there is no calendar link and offer the call instead.
          <div className="sched-card__foot">
            <p className="sched-cal__note">{T.noFixed}</p>
            <div className="sched-cal">
              <a className="sched-cal__link" href={telHref(PRIMARY_PHONE.e164)}>
                <PhoneIcon />
                {HERO.ctaSecondary}
              </a>
            </div>
          </div>
        )}
      </article>
    </li>
  );
}

/** "Po grupi": a card per group (fully server-rendered — the no-JS schedule). */
export function GroupCards({ groups, anchor }: { groups: readonly ScheduleGroup[]; anchor: Date }) {
  return (
    <ul className="sched-cards" role="list">
      {groups.map((group) => (
        <GroupCard key={group.id} group={group} anchor={anchor} />
      ))}
    </ul>
  );
}

/** "Po danu": one panel per weekday; the island shows the selected one (all when none). */
export function DayPanels({ groups }: { groups: readonly ScheduleGroup[] }) {
  return (
    <>
      {DAYS.map((day) => {
        const rows = daySessions(groups, day.code);
        return (
          <section
            key={day.code}
            id={`sched-day-${day.code}`}
            className="sched-day"
            role="tabpanel"
            aria-labelledby={`sched-daytab-${day.code}`}
            data-day={day.code}
          >
            <h3 className="sched-day__title">{capitalize(day.full)}</h3>
            {rows.length > 0 ? (
              <>
                <ul className="sched-rows" role="list">
                  {rows.map(({ group, block }) => (
                    <li
                      key={`${group.id}-${formatBlock(block)}`}
                      className="sched-row"
                      data-sched-item=""
                      data-program={group.programId}
                      style={swatch(programById(group.programId).color)}
                    >
                      <span className="sched-row__time">
                        <Times block={block} />
                      </span>
                      <span className="sched-row__group">
                        <span className="sched-swatch" aria-hidden="true" />
                        {glue(group.name)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="sched-day__filtered">{T.filteredEmpty}</p>
              </>
            ) : (
              <div className="sched-day__empty">
                <svg className="sched-day__leap" viewBox="0 0 230 150" aria-hidden="true" focusable="false">
                  <use href="#leap" />
                </svg>
                <p>{day.iso >= 6 ? SCHEDULE_LOCATION.weekendEmpty : T.filteredEmpty}</p>
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}

/** Location card: the hall + "Otvorite u mapama". */
export function LocationCard() {
  return (
    <div className="sched-location" role="group" aria-labelledby="sched-location-title">
      <p className="label-caps sched-location__label">{T.addressLabel}</p>
      <h3 id="sched-location-title" className="sched-location__title">
        <KeepHyphenated text={VENUE.name} />
      </h3>
      <p className="sched-location__nick">
        {T.nicknamePrefix} {VENUE.nickname}
      </p>
      <p className="sched-location__street">
        {VENUE.street}
        <br />
        {VENUE.postalCode} {VENUE.city}
      </p>
      <a className="btn btn-secondary sched-location__maps" href={VENUE.mapsUrl} target="_blank" rel="noopener noreferrer">
        <PinIcon />
        {T.maps}
        <span className="sr-only"> {T.newTab}</span>
      </a>
    </div>
  );
}
