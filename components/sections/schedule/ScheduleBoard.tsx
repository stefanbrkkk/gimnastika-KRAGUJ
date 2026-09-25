"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { DayCode } from "@/content/schedule";
import { SCHEDULE_FILTER_EVENT, SCHEDULE_PROGRAM_ATTR, type ScheduleFilterDetail } from "@/lib/events";
import { prefersLessMotion, whenNear } from "@/lib/motion-env";
import { earliestNext, formatNextDay, formatNextTraining, type Slot } from "@/lib/schedule-logic";
import { useBelgradeMinute } from "./clock";
import { SCHEDULE_UI as T } from "./copy";
import type { Enhancer } from "./schedule-enhance";

type View = "group" | "day";

export interface ProgramOption {
  id: string;
  label: string;
  color: string;
}

export interface DayOption {
  code: DayCode;
  short: string;
  full: string;
  /** "u ponedeljak / u sredu …" form, for the status line. */
  accusative: string;
  iso: number;
}

/** A group as the „Sledeći trening“ scoreboard needs it (computed on the server). */
export interface BoardGroup {
  programId: string;
  /** Display name (typeset on the server). */
  name: string;
  color: string;
  slots: readonly Slot[];
}

interface ScheduleBoardProps {
  /** Server-rendered section heading; from 1024px the view tabs sit in its row. */
  heading: ReactNode;
  programs: readonly ProgramOption[];
  days: readonly DayOption[];
  /** Groups in program order, for the scoreboard. */
  groups: readonly BoardGroup[];
  /** Server-rendered "Po grupi" view (group cards). */
  byGroup: ReactNode;
  /** Server-rendered "Po danu" panels, one per day (data-day). */
  byDay: ReactNode;
  /** Server-rendered location card (beside the panels on desktop, below them on phones). */
  aside: ReactNode;
}

const ITEM = "[data-sched-item]";
const LEAVING = "data-leaving";
const LANDING = ".sched-card, .sched-score, .sched-location";
const VIEWS: readonly { id: View; label: string }[] = [
  { id: "group", label: T.byGroup },
  { id: "day", label: T.byDay },
];

const matches = (el: HTMLElement, filter: string): boolean => filter === "all" || el.dataset.program === filter;

/**
 * Filter = `hidden` on every [data-sched-item] of another program (both views).
 * Items that are fading out (data-leaving, Flip) are left alone; the Flip finishes them.
 * The card list learns how many cards it shows (a lone card takes the whole row).
 */
function applyFilter(root: HTMLElement, filter: string): void {
  root.querySelectorAll<HTMLElement>(ITEM).forEach((el) => {
    if (!el.hasAttribute(LEAVING)) el.hidden = !matches(el, filter);
  });
  const cards = root.querySelector<HTMLElement>(".sched-cards");
  const count = String(Array.from(cards?.children ?? []).filter((el) => matches(el as HTMLElement, filter)).length);
  if (cards && cards.dataset.count !== count) cards.dataset.count = count;
}

const shown = (el: HTMLElement): boolean => !el.hidden && !el.hasAttribute(LEAVING);

const NO_DAYS: ReadonlySet<string> = new Set();

/**
 * Day panels ("Po danu") with no training of `filter`. Computed from the filter itself
 * (matches()), never from `hidden`: a running Flip sets `hidden` only when it completes.
 */
function emptyDaysFor(root: HTMLElement, filter: string): ReadonlySet<string> {
  if (filter === "all") return NO_DAYS;
  const empty = new Set<string>();
  root.querySelectorAll<HTMLElement>(".sched-day[data-day]").forEach((panel) => {
    const items = Array.from(panel.querySelectorAll<HTMLElement>(ITEM));
    if (panel.dataset.day && !items.some((el) => matches(el, filter))) empty.add(panel.dataset.day);
  });
  return empty;
}

/** Arrow/Home/End roving focus for a tablist (automatic activation). */
function roving<K>(e: KeyboardEvent, keys: readonly K[], current: K, pick: (k: K) => void, idOf: (k: K) => string): void {
  const i = Math.max(0, keys.indexOf(current));
  const last = keys.length - 1;
  const n = e.key === "ArrowRight" ? (i + 1) % keys.length : e.key === "ArrowLeft" ? (i + last) % keys.length : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
  const next = keys[n];
  if (n < 0 || next === undefined) return;
  e.preventDefault();
  pick(next);
  document.getElementById(idOf(next))?.focus();
}

/**
 * Schedule island: segmented control [Po grupi] · [Po danu] and the day strip, both with
 * a sliding pill; program filter pills with a polite status line; the „Sledeći trening“
 * scoreboard (earliest fixed start of the shown groups, after mount, every minute); the
 * day strip's after-mount today selection (Europe/Belgrade); and the cross-section filter
 * contract ([data-schedule-program] clicks and SCHEDULE_FILTER_EVENT). All content is
 * server-rendered; without JS the controls are hidden and the "Po grupi" view is the
 * complete schedule. Motion, today's marks, the Google Calendar date refresh and the
 * stuck-strip scroll correction live in a lazy chunk (schedule-enhance.ts) loaded when the
 * section is near; without it every change is instant.
 */
export function ScheduleBoard({ heading, programs, days, groups, byGroup, byDay, aside }: ScheduleBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const enh = useRef<Enhancer | null>(null);
  const [enhReady, setEnhReady] = useState(false);
  const [view, setView] = useState<View>("group");
  const [filter, setFilter] = useState("all");
  /** Days with no training of the filtered program (muted day tabs); none under „Sve“. */
  const [emptyDays, setEmptyDays] = useState<ReadonlySet<string>>(NO_DAYS);
  const [pickedDay, setPickedDay] = useState<DayCode | null>(null);
  /** Set by the first user view switch: from then on a newly shown panel eases in (CSS). */
  const [switched, setSwitched] = useState(false);
  const [status, setStatus] = useState("");
  /** Filter and day changes are announced (view switches are announced by the tabs themselves). */
  const [announce, setAnnounce] = useState(0);
  const announcePending = useRef(false);
  /** Set by a user's day pick only (not the after-mount today selection, a view or a filter change). */
  const dayPicked = useRef(false);
  /** Flip state of the visible day's rows, captured before a user's day pick commits. */
  const dayFlip = useRef<unknown>(null);

  // Today (Europe/Belgrade) exists only after mount: SSR renders no selection.
  const now = useBelgradeMinute();
  const today = now ? (days.find((d) => d.iso === now.isoWeekday)?.code ?? null) : null;
  const selectedDay = pickedDay ?? today;
  const accusatives = days.map((d) => d.accusative);

  const choose = useCallback((next: string) => {
    const root = rootRef.current;
    if (!root) return;
    const apply = () => applyFilter(root, next);
    if (enh.current) enh.current.filter(next, apply);
    else apply();
    setFilter(next);
    setEmptyDays(emptyDaysFor(root, next));
    announcePending.current = true;
    setAnnounce((n) => n + 1);
  }, []);

  // Keep the DOM in sync with the state (idempotent; covers re-rendered nodes), and keep
  // the active pill visible in the swipeable row on phones (horizontal scroll only).
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    applyFilter(root, filter);
    const row = rowRef.current;
    const pill = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (row && pill && row.scrollWidth > row.clientWidth) {
      const left = pill.offsetLeft; // the row is position: relative → its own offsetParent
      if (left < row.scrollLeft || left + pill.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = left - 20;
    }
  }, [filter]);

  // After a user's day pick: shared rows hold still while the new ones land, or — when the
  // strip is stuck — the panels come back under it (both in the lazy enhancer).
  useLayoutEffect(() => {
    const flipState = dayFlip.current;
    dayFlip.current = null;
    if (!dayPicked.current) return;
    dayPicked.current = false;
    if (view === "day") enh.current?.playDay(flipState);
  }, [selectedDay, view]);

  // Polite status after a user-initiated filter/day change: what the visible panel now shows.
  useEffect(() => {
    const root = rootRef.current;
    if (!announcePending.current || !root) return;
    announcePending.current = false;
    let text = "";
    if (view === "group") {
      const cards = Array.from(root.querySelectorAll<HTMLElement>(`#sched-panel-group ${ITEM}`));
      text = T.statusGroups(cards.filter(shown).length, cards.length);
    } else {
      const day = days.find((d) => d.code === selectedDay);
      const panel = day ? document.getElementById(`sched-day-${day.code}`) : null;
      if (day && panel) {
        const rows = Array.from(panel.querySelectorAll<HTMLElement>(ITEM));
        const visible = rows.filter(shown).length;
        // Empty day / filtered-empty: the same sentence the panel shows.
        text = visible > 0 ? T.statusDay(visible, rows.length, day.accusative) : rows.length > 0 ? T.filteredEmpty : (panel.querySelector(".sched-day__empty p")?.textContent ?? "");
      }
    }
    // Same text twice (e.g. two filters with equal counts) still has to be re-announced.
    setStatus((prev) => (prev === text ? `${text} ` : text));
  }, [announce, view, selectedDay, filter, days]);

  // The lazy enhancer (motion + today's marks) loads when the section is ≤1 viewport away.
  // If it cannot load, every landing pre-state resolves at once.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let alive = true;
    const stop = whenNear(root, () => {
      import("./schedule-enhance")
        .then((m) => {
          if (!alive) return;
          enh.current = m.enhance(root);
          setEnhReady(true);
        })
        .catch(() => root.querySelectorAll(LANDING).forEach((el) => el.setAttribute("data-landed", "")));
    });
    return () => {
      alive = false;
      stop();
      enh.current?.destroy();
      enh.current = null;
    };
  }, []);

  // Today's rows in „Po danu“ (finished / next / now line) and the Google Calendar dates
  // follow the minute clock (and the filter).
  useEffect(() => {
    enh.current?.sync(now, filter);
  }, [now, filter, enhReady]);

  // Contract: [data-schedule-program] links anywhere (the anchor itself scrolls to
  // #raspored) and window SCHEDULE_FILTER_EVENT → "Po grupi" filtered to that program.
  useEffect(() => {
    const valid = new Set(programs.map((p) => p.id));
    const show = (id: string | null | undefined, scroll: boolean) => {
      setView("group");
      choose(id && valid.has(id) ? id : "all");
      if (scroll) {
        document.getElementById("raspored")?.scrollIntoView({ behavior: prefersLessMotion() ? "auto" : "smooth", block: "start" });
      }
    };
    const onClick = (e: MouseEvent) => {
      const link = e.target instanceof Element ? e.target.closest(`[${SCHEDULE_PROGRAM_ATTR}]`) : null;
      if (link) show(link.getAttribute(SCHEDULE_PROGRAM_ATTR), false);
    };
    const onFilter = (e: Event) => show((e as CustomEvent<ScheduleFilterDetail>).detail?.programId, true);
    document.addEventListener("click", onClick);
    window.addEventListener(SCHEDULE_FILTER_EVENT, onFilter);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener(SCHEDULE_FILTER_EVENT, onFilter);
    };
  }, [programs, choose]);

  const pickView = (v: View) => {
    if (v !== view) {
      enh.current?.view();
      setSwitched(true);
    }
    setView(v);
  };
  const pickDay = (d: DayCode) => {
    if (d !== selectedDay) {
      dayPicked.current = true;
      if (view === "day") dayFlip.current = enh.current?.captureDay() ?? null;
    }
    setPickedDay(d);
    announcePending.current = true;
    setAnnounce((n) => n + 1);
  };
  const dayCodes = days.map((d) => d.code);
  const focusDay: DayCode = selectedDay ?? dayCodes[0] ?? "po";
  const dayIndex = selectedDay ? dayCodes.indexOf(selectedDay) : -1;

  // „Sledeći trening“: the earliest fixed start among the groups the filter shows.
  const shownGroups = groups.filter((g) => filter === "all" || g.programId === filter);
  const best = now ? earliestNext(shownGroups.map((g) => g.slots), now) : null;
  const bestGroup = best ? shownGroups[best.index] : undefined;

  const check = (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="ui-icon sched-pill__check">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );

  return (
    <div ref={rootRef} className="sched-board" data-view={view} data-switched={switched ? "" : undefined}>
      <div className="sched-head">
        {heading}
        <div
          className="sched-views"
          role="tablist"
          aria-label={T.viewsLabel}
          data-active={view}
          style={{ ["--v" as string]: view === "day" ? 1 : 0 } as CSSProperties}
        >
          <span className="sched-views__pill" aria-hidden="true" />
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              id={`sched-tab-${v.id}`}
              className="sched-views__tab"
              aria-selected={view === v.id}
              aria-controls={`sched-panel-${v.id}`}
              tabIndex={view === v.id ? 0 : -1}
              onClick={() => pickView(v.id)}
              onKeyDown={(e) => roving(e, VIEWS.map((x) => x.id), view, pickView, (k) => `sched-tab-${k}`)}
            >
              {v.label}
            </button>
          ))}
          {/* The labels again in white, clipped to the travelling pill: a label inverts exactly
              where the pill is, never blank mid-travel. */}
          <span className="sched-views__lit" aria-hidden="true">
            {VIEWS.map((v) => (
              <span key={v.id} data-on={v.id === view ? "" : undefined}>
                {v.label}
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* Two line wrappers: display:contents (one swipeable row on phones, one line on wide
          screens); real lines of 3 + rest on tablets, so the pills never leave a lone orphan. */}
      <div ref={rowRef} className="sched-filters" role="group" aria-label={T.filterLabel}>
        <div className="sched-filters__track">
          {[programs.slice(0, 2), programs.slice(2)].map((line, i) => (
            <span key={i} className="sched-filters__line">
              {i === 0 ? (
                <button type="button" className="sched-pill" aria-pressed={filter === "all"} onClick={() => choose("all")}>
                  {check}
                  {T.all}
                </button>
              ) : null}
              {line.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="sched-pill"
                  aria-pressed={filter === p.id}
                  onClick={() => choose(p.id)}
                  style={{ ["--swatch" as string]: p.color }}
                >
                  {check}
                  <span className="sched-swatch" aria-hidden="true" />
                  {p.label}
                </button>
              ))}
            </span>
          ))}
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      {/* The judges' scoreboard: time-dependent, so SSR renders the dark shell („––:––“).
          Each numeral is its own cell so only the digits that change post again (CSS). */}
      <div className="sched-score" data-state={now ? (best ? "ready" : "none") : "pending"}>
        <p className="sched-score__label" aria-hidden="true">
          {T.next}
        </p>
        <p className="sched-score__when" aria-hidden="true">
          {best ? formatNextDay(best.next, accusatives) : null}
        </p>
        <p className="sched-score__time font-dot" aria-hidden="true">
          {/* Doto's colon is a pair of 5-dot clusters; the board draws two round LEDs instead. */}
          {Array.from(best ? best.next.start : "––:––").map((c, i) => (
            <span
              key={`${i}${c}`}
              className={c === ":" ? "sched-score__c sched-score__colon" : "sched-score__c"}
              style={{ ["--c" as string]: i } as CSSProperties}
            >
              {c === ":" ? null : c}
            </span>
          ))}
        </p>
        <p className="sched-score__group" aria-hidden="true">
          {bestGroup ? (
            <>
              <span className="sched-swatch" style={{ ["--swatch" as string]: bestGroup.color } as CSSProperties} />
              {bestGroup.name}
            </>
          ) : null}
        </p>
        <p className="sr-only">{best && bestGroup ? `${T.next}: ${formatNextTraining(best.next, accusatives)}, ${bestGroup.name}` : null}</p>
      </div>

      <div role="tabpanel" id="sched-panel-group" aria-labelledby="sched-tab-group" className="sched-panel" hidden={view !== "group"}>
        {byGroup}
      </div>

      <div role="tabpanel" id="sched-panel-day" aria-labelledby="sched-tab-day" className="sched-panel" hidden={view !== "day"}>
        <div
          className="sched-strip"
          role="tablist"
          aria-label={T.dayStripLabel}
          data-sel={dayIndex >= 0 ? "" : undefined}
          style={{ ["--i" as string]: Math.max(0, dayIndex) } as CSSProperties}
        >
          <span className="sched-strip__pill" aria-hidden="true" />
          {days.map((d) => {
            const empty = emptyDays.has(d.code);
            return (
              <button
                key={d.code}
                type="button"
                role="tab"
                id={`sched-daytab-${d.code}`}
                className="sched-strip__day"
                aria-selected={selectedDay === d.code}
                aria-controls={`sched-day-${d.code}`}
                tabIndex={focusDay === d.code ? 0 : -1}
                data-weekend={d.iso >= 6 ? "" : undefined}
                data-empty={empty ? "" : undefined}
                onClick={() => pickDay(d.code)}
                onKeyDown={(e) => roving(e, dayCodes, focusDay, pickDay, (k) => `sched-daytab-${k}`)}
              >
                <span className="sched-strip__short" aria-hidden="true">
                  {d.short}
                </span>
                <span className="sr-only">
                  {d.full}
                  {empty ? `, ${T.dayOff}` : null}
                </span>
                {today === d.code ? <span className="sched-strip__today">{T.today}</span> : null}
              </button>
            );
          })}
          {/* White labels in the selected style (a label under the pill is navy on navy, so only these show there). */}
          <span className="sched-strip__lit" aria-hidden="true">
            {days.map((d) => (
              <span key={d.code} className="sched-strip__lit-day" data-on={d.code === selectedDay ? "" : undefined}>
                <span className="sched-strip__short">{d.short}</span>
                {today === d.code ? <span className="sched-strip__today">{T.today}</span> : null}
              </span>
            ))}
          </span>
        </div>
        <div className="sched-days" data-selected={selectedDay ?? undefined}>
          {byDay}
        </div>
      </div>

      <div className="sched-aside">{aside}</div>
    </div>
  );
}
