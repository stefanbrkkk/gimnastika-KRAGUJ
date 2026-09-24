"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { gsap as GsapInstance } from "gsap";
import type { Flip as FlipInstance } from "gsap/Flip";
import type { DayCode } from "@/content/schedule";
import { SCHEDULE_FILTER_EVENT, SCHEDULE_PROGRAM_ATTR, type ScheduleFilterDetail } from "@/lib/events";
import { loadMotion } from "@/lib/load-motion";
import { DUR, EASE, prefersLessMotion, whenNear } from "@/lib/motion-env";
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
  iso: number;
}

interface ScheduleBoardProps {
  programs: readonly ProgramOption[];
  days: readonly DayOption[];
  /** Server-rendered "Po grupi" view (group cards). */
  byGroup: ReactNode;
  /** Server-rendered "Po danu" panels, one per day (data-day). */
  byDay: ReactNode;
}

const ITEM = "[data-sched-item]";
const VIEWS: readonly { id: View; label: string }[] = [
  { id: "group", label: T.byGroup },
  { id: "day", label: T.byDay },
];

/** Filter = `hidden` on every [data-sched-item] of another program (both views). */
function applyFilter(root: HTMLElement, filter: string): void {
  root.querySelectorAll<HTMLElement>(ITEM).forEach((el) => {
    el.hidden = filter !== "all" && el.dataset.program !== filter;
  });
}

const onScreen = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

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
 * program filter pills (Flip, lazily loaded; instant under reduced motion),
 * the day strip (today selected after mount, Europe/Belgrade), and the
 * cross-section filter contract ([data-schedule-program] clicks and
 * SCHEDULE_FILTER_EVENT). All content is server-rendered; without JS the
 * controls are hidden and the "Po grupi" view is the complete schedule.
 */
export function ScheduleBoard({ programs, days, byGroup, byDay }: ScheduleBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const motion = useRef<{ Flip: FlipPlugin; gsap: Gsap } | null>(null);
  const flipTl = useRef<ReturnType<FlipPlugin["from"]> | null>(null);
  const [view, setView] = useState<View>("group");
  const [filter, setFilter] = useState("all");
  const [pickedDay, setPickedDay] = useState<DayCode | null>(null);
  const [interacted, setInteracted] = useState(false);

  // Today (Europe/Belgrade) exists only after mount: SSR renders no selection.
  const now = useBelgradeMinute();
  const today = now ? (days.find((d) => d.iso === now.isoWeekday)?.code ?? null) : null;
  const selectedDay = pickedDay ?? today;

  const choose = useCallback((next: string) => {
    const root = rootRef.current;
    if (!root) return;
    const m = motion.current;
    const panel = root.querySelector<HTMLElement>(':scope > [role="tabpanel"]:not([hidden])');
    const animate = Boolean(m && panel && !prefersLessMotion() && onScreen(panel));
    const targets = animate && panel ? Array.from(panel.querySelectorAll<HTMLElement>(ITEM)) : [];
    const state = m && targets.length ? m.Flip.getState(targets) : null;
    applyFilter(root, next);
    setFilter(next);
    if (m && state) {
      flipTl.current = m.Flip.from(state, {
        duration: DUR.base,
        ease: EASE.stick,
        scale: true,
        simple: true,
        onEnter: (els) =>
          m.gsap.fromTo(
            els,
            { opacity: 0, scale: 0.96 },
            { opacity: 1, scale: 1, duration: DUR.base, ease: EASE.stick, clearProps: "opacity,transform" },
          ),
      });
    }
  }, []);

  // Keep the DOM in sync with the state (idempotent; covers re-rendered nodes), and keep
  // the active pill visible in the swipeable row on phones (horizontal scroll only).
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    applyFilter(root, filter);
    const row = root.querySelector<HTMLElement>(".sched-filters");
    const pill = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (row && pill && row.scrollWidth > row.clientWidth) {
      const left = pill.offsetLeft; // the row is position: relative → its own offsetParent
      if (left < row.scrollLeft || left + pill.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = left - 20;
    }
  }, [filter]);

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
      flipTl.current?.kill();
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
    setView(v);
    setInteracted(true);
  };
  const pickDay = (d: DayCode) => {
    setPickedDay(d);
    setInteracted(true);
  };
  const dayCodes = days.map((d) => d.code);
  const focusDay: DayCode = selectedDay ?? dayCodes[0] ?? "po";

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

        <div className="sched-filters" role="group" aria-label={T.filterLabel}>
          <button type="button" className="sched-pill" aria-pressed={filter === "all"} onClick={() => choose("all")}>
            {T.all}
          </button>
          {programs.map((p) => (
            <button
              key={p.id}
              type="button"
              className="sched-pill"
              aria-pressed={filter === p.id}
              onClick={() => choose(p.id)}
              style={{ ["--swatch" as string]: p.color }}
            >
              <span className="sched-swatch" aria-hidden="true" />
              {p.label}
            </button>
          ))}
        </div>
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
    </div>
  );
}
