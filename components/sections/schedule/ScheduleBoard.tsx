"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { gsap as GsapInstance } from "gsap";
import type { Flip as FlipInstance } from "gsap/Flip";
import type { DayCode } from "@/content/schedule";
import { SCHEDULE_FILTER_EVENT, SCHEDULE_PROGRAM_ATTR, type ScheduleFilterDetail } from "@/lib/events";
import { loadMotion } from "@/lib/load-motion";
import { DUR, EASE, prefersLessMotion, whenNear } from "@/lib/motion-env";
import { occurrenceDates, withGcalDates } from "@/lib/schedule-logic";
import { useBelgradeMinute } from "./clock";
import { SCHEDULE_UI as T } from "./copy";

type View = "group" | "day";
type FlipPlugin = typeof FlipInstance;
type Gsap = typeof GsapInstance;

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

interface ScheduleBoardProps {
  programs: readonly ProgramOption[];
  days: readonly DayOption[];
  /** Server-rendered "Po grupi" view (group cards). */
  byGroup: ReactNode;
  /** Server-rendered "Po danu" panels, one per day (data-day). */
  byDay: ReactNode;
  /** Server-rendered location card (beside the panels on desktop, below them on phones). */
  aside: ReactNode;
}

const ITEM = "[data-sched-item]";
const LEAVING = "data-leaving";
const VIEWS: readonly { id: View; label: string }[] = [
  { id: "group", label: T.byGroup },
  { id: "day", label: T.byDay },
];

const matches = (el: HTMLElement, filter: string): boolean => filter === "all" || el.dataset.program === filter;

/**
 * Filter = `hidden` on every [data-sched-item] of another program (both views).
 * Items that are fading out (data-leaving, Flip) are left alone; the Flip finishes them.
 */
function applyFilter(root: HTMLElement, filter: string): void {
  root.querySelectorAll<HTMLElement>(ITEM).forEach((el) => {
    if (!el.hasAttribute(LEAVING)) el.hidden = !matches(el, filter);
  });
}

/** Leaving items end hidden, with no inline leftovers from the fade. */
function settleLeaving(els: readonly HTMLElement[]): void {
  els.forEach((el) => {
    el.hidden = true;
    el.removeAttribute(LEAVING);
    el.removeAttribute("aria-hidden");
    el.style.removeProperty("opacity");
    el.style.removeProperty("transform");
    el.style.removeProperty("translate");
    el.style.removeProperty("rotate");
    el.style.removeProperty("scale");
  });
}

const onScreen = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

const shown = (el: HTMLElement): boolean => !el.hidden && !el.hasAttribute(LEAVING);

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
 * Schedule island: segmented control [Po grupi] · [Po danu] with a sliding pill,
 * program filter pills (Flip, lazily loaded: moves + enter fade + leave fade;
 * instant under reduced motion) with a polite status line, the day strip (today
 * selected after mount, Europe/Belgrade), the after-mount Google Calendar date
 * refresh, and the cross-section filter contract ([data-schedule-program] clicks
 * and SCHEDULE_FILTER_EVENT). All content is server-rendered; without JS the
 * controls are hidden and the "Po grupi" view is the complete schedule.
 */
export function ScheduleBoard({ programs, days, byGroup, byDay, aside }: ScheduleBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const motion = useRef<{ Flip: FlipPlugin; gsap: Gsap } | null>(null);
  const flipTl = useRef<ReturnType<FlipPlugin["from"]> | null>(null);
  const [view, setView] = useState<View>("group");
  const [filter, setFilter] = useState("all");
  const [pickedDay, setPickedDay] = useState<DayCode | null>(null);
  const [interacted, setInteracted] = useState(false);
  const [status, setStatus] = useState("");
  /** Filter and day changes are announced (view switches are announced by the tabs themselves). */
  const [announce, setAnnounce] = useState(0);
  const announcePending = useRef(false);

  // Today (Europe/Belgrade) exists only after mount: SSR renders no selection.
  const now = useBelgradeMinute();
  const today = now ? (days.find((d) => d.iso === now.isoWeekday)?.code ?? null) : null;
  const selectedDay = pickedDay ?? today;

  const choose = useCallback((next: string) => {
    const root = rootRef.current;
    if (!root) return;
    // Finish a running filter animation first (its onComplete settles the leaving items).
    flipTl.current?.progress(1).kill();
    flipTl.current = null;
    const m = motion.current;
    const panel = root.querySelector<HTMLElement>('.sched-panel:not([hidden])');
    const animate = Boolean(m && panel && !prefersLessMotion() && onScreen(panel));
    const targets = animate && panel ? Array.from(panel.querySelectorAll<HTMLElement>(ITEM)) : [];
    const state = m && targets.length ? m.Flip.getState(targets) : null;
    // Visible items of the animated panel that the new filter removes fade out first:
    // `data-leaving` hides them for Flip's measurement (display: none, NOT the !important
    // [hidden] rule), so Flip can bring them back absolutely positioned while they fade.
    const leaving = state ? targets.filter((el) => !el.hidden && !matches(el, next)) : [];
    leaving.forEach((el) => {
      el.setAttribute(LEAVING, "");
      el.setAttribute("aria-hidden", "true");
    });
    applyFilter(root, next);
    setFilter(next);
    announcePending.current = true;
    setAnnounce((n) => n + 1);
    if (m && state) {
      flipTl.current = m.Flip.from(state, {
        duration: DUR.base,
        ease: EASE.stick,
        scale: true,
        simple: true,
        absoluteOnLeave: true,
        onEnter: (els) =>
          m.gsap.fromTo(
            els,
            { opacity: 0, scale: 0.96 },
            { opacity: 1, scale: 1, duration: DUR.base, ease: EASE.stick, clearProps: "opacity,transform" },
          ),
        // Exit ≤200ms: the shrink uses the exit ease; the fade is linear so a leaving item is
        // already half gone while the remaining ones glide past it (it sits under them, z -1).
        onLeave: (els) =>
          m.gsap
            .timeline()
            .to(els, { opacity: 0, duration: DUR.fast, ease: "none" }, 0)
            .to(els, { scale: 0.96, duration: DUR.fast, ease: EASE.takeoff }, 0),
        onComplete: () => settleLeaving(leaving),
        onInterrupt: () => settleLeaving(leaving),
      });
    }
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

  // Swipeable pill row (phones): fade the edge that has more pills behind it.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const update = () => {
      const max = row.scrollWidth - row.clientWidth;
      row.toggleAttribute("data-more-start", max > 1 && row.scrollLeft > 4);
      row.toggleAttribute("data-more-end", max > 1 && row.scrollLeft < max - 4);
    };
    update();
    row.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    ro?.observe(row);
    return () => {
      row.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, []);

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
    setStatus((prev) => (prev === text ? `${text}\u00A0` : text));
  }, [announce, view, selectedDay, filter, days]);

  // Google Calendar links: the static href holds the build-date occurrence (no-JS fallback);
  // after mount (and on every minute tick) point `dates` at the next real occurrence.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !now) return;
    root.querySelectorAll<HTMLAnchorElement>("a[data-gcal]").forEach((a) => {
      const [dayList = "", start = "", end = ""] = (a.dataset.gcal ?? "").split("|");
      const href = a.getAttribute("href");
      if (!dayList || !start || !end || !href) return;
      const next = withGcalDates(href, occurrenceDates(dayList.split(",") as DayCode[], start, end, now, true));
      if (next !== href) a.setAttribute("href", next);
    });
  }, [now]);

  // Flip is loaded only when the section is ≤1 viewport away, never under reduced motion / Save-Data.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersLessMotion()) return;
    let alive = true;
    const stop = whenNear(root, () => {
      loadMotion()
        .then(async (m) => {
          const Flip = await m.loadFlip();
          if (alive) motion.current = { Flip, gsap: m.gsap };
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
      stop();
      flipTl.current?.progress(1).kill();
    };
  }, []);

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
    if (v !== view) flipTl.current?.progress(1).kill();
    setView(v);
    setInteracted(true);
  };
  const pickDay = (d: DayCode) => {
    setPickedDay(d);
    setInteracted(true);
    announcePending.current = true;
    setAnnounce((n) => n + 1);
  };
  const dayCodes = days.map((d) => d.code);
  const focusDay: DayCode = selectedDay ?? dayCodes[0] ?? "po";

  const check = (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="sched-pill__check">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );

  return (
    <div ref={rootRef} className="sched-board" data-view={view} data-interacted={interacted ? "" : undefined}>
      <div className="sched-controls">
        <div className="sched-views" role="tablist" aria-label={T.viewsLabel} data-active={view}>
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
        </div>

        {/* Two line wrappers: display:contents (one swipeable row on phones, one line on wide
            screens); real lines of 3 + rest on tablets, so the pills never leave a lone orphan. */}
        <div ref={rowRef} className="sched-filters" role="group" aria-label={T.filterLabel}>
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
        <p className="sr-only" role="status" aria-live="polite">
          {status}
        </p>
      </div>

      <div role="tabpanel" id="sched-panel-group" aria-labelledby="sched-tab-group" className="sched-panel" hidden={view !== "group"}>
        {byGroup}
      </div>

      <div role="tabpanel" id="sched-panel-day" aria-labelledby="sched-tab-day" className="sched-panel" hidden={view !== "day"}>
        <div className="sched-strip" role="tablist" aria-label={T.dayStripLabel}>
          {days.map((d) => (
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
              onClick={() => pickDay(d.code)}
              onKeyDown={(e) => roving(e, dayCodes, focusDay, pickDay, (k) => `sched-daytab-${k}`)}
            >
              <span className="sched-strip__short" aria-hidden="true">
                {d.short}
              </span>
              <span className="sr-only">{d.full}</span>
              {today === d.code ? <span className="sched-strip__today">{T.today}</span> : null}
            </button>
          ))}
        </div>
        <div className="sched-days" data-selected={selectedDay ?? undefined}>
          {byDay}
        </div>
      </div>

      <div className="sched-aside">{aside}</div>
    </div>
  );
}
