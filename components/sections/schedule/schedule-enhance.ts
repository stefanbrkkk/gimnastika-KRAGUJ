/**
 * Lazy enhancer of the schedule island (S4), loaded by ScheduleBoard when #raspored is
 * ≤1 viewport away — never part of the first-load JS. GSAP + Flip load from here only
 * when motion is allowed. Everything it does is progressive: without it (or under reduced
 * motion / Save-Data) every change is instant and every landing shows its final state.
 *
 * Gymnastics vocabulary (lib/motion-env.ts):
 *  - filter („dismount → glide → stick“): leaving items drop 8px and fade (120 ms,
 *    takeoff), the remaining ones hold 60 ms then glide into place (Flip, stick), new ones
 *    land (y −10 → 0, scale .97 → 1, land). The card list keeps its height until the motion
 *    ends, and a day card clips its rows, so the next section never paints over a moving item.
 *  - day change: rows shared by both days hold still (Flip keyed by data-flip-id), new rows
 *    land; the strip pill travels like a beam walk (CSS) and sticks its landing (squash).
 *  - landings on first view: a card's training days land on the mat line one by one
 *    (MI-1), the scoreboard posts its numerals row by row (MI-4), the location pictogram
 *    draws the floor diagonal and drops its pin (MI-6). CSS does the motion (schedule.css);
 *    this module only sets data-landed.
 *  - weekend pick: the chronophotograph leap replays toward Monday (MI-5).
 * Plus motion-independent jobs: today's rows in „Po danu“ (finished / next / now), the
 * Google Calendar links' dates, bringing the day panels back under a stuck strip, and the
 * edge fades of the swipeable pill row on phones.
 */
import type { gsap as GsapInstance } from "gsap";
import type { Flip as FlipInstance } from "gsap/Flip";
import { loadMotion } from "@/lib/load-motion";
import type { DayCode } from "@/content/schedule";
import { DUR, EASE, motionAllowed, queuePrimaryMotion } from "@/lib/motion-env";
import { occurrenceDates, withGcalDates } from "@/lib/schedule-logic";
import type { BelgradeNow } from "@/lib/time";

type Gsap = typeof GsapInstance;
type FlipPlugin = typeof FlipInstance;
type FlipState = ReturnType<FlipPlugin["getState"]>;
type Timeline = ReturnType<Gsap["timeline"]>;
type Motion = Timeline | ReturnType<Gsap["to"]>;

export interface Enhancer {
  /** Runs `apply` (the filter's DOM change) inside a Flip when the panel is on screen. */
  filter(next: string, apply: () => void): void;
  /** Flip state of the visible day's rows, taken before a user's day pick commits. */
  captureDay(): unknown;
  /**
   * After the pick committed: if the strip is stuck and the new day starts above it, scroll
   * the panels back under it; otherwise shared rows hold, new rows land, the pill sticks and
   * the weekend leap replays.
   */
  playDay(state: unknown): void;
  /** A view switch: finish a running filter motion; the tab pill sticks its landing. */
  view(): void;
  /** Today's rows in „Po danu“ (finished / next / „now“ line) and the Google Calendar dates. */
  sync(now: BelgradeNow | null, filter: string): void;
  destroy(): void;
}

const ITEM = "[data-sched-item]";
const LEAVING = "data-leaving";
const LANDING = ".sched-card, .sched-score, .sched-location";
const DAY_BY_ISO = ["po", "ut", "sr", "ce", "pe", "su", "ne"] as const;
/** Travel time of the sliding pills (CSS --sched-travel). */
const TRAVEL = 320;

const matches = (el: HTMLElement, filter: string): boolean => filter === "all" || el.dataset.program === filter;
const rendered = (el: Element): boolean => el.getClientRects().length > 0;
const onScreen = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

/** Leaving items end hidden, with no inline leftovers from the fade. */
function settle(els: readonly HTMLElement[]): void {
  els.forEach((el) => {
    el.hidden = true;
    el.removeAttribute(LEAVING);
    el.removeAttribute("aria-hidden");
    ["opacity", "transform", "translate", "rotate", "scale"].forEach((p) => el.style.removeProperty(p));
  });
}

/** Stuck-landing squash of a pill that has just arrived (compress, then hold). */
function squash(pill: Element | null | undefined, delay: number): void {
  if (!pill || typeof (pill as HTMLElement).animate !== "function") return;
  (pill as HTMLElement).animate([{ scale: "1 1" }, { scale: "1.05 0.9", offset: 0.35 }, { scale: "1 1" }], {
    duration: DUR.land * 1000,
    delay,
    easing: "cubic-bezier(0.22, 1.12, 0.36, 1)",
  });
}

/** Replays the landed chronophotograph leap of a weekend panel (styles/ui.css .chrono-mark). */
function leap(mark: Element | null): void {
  if (!mark) return;
  mark.setAttribute("data-reset", ""); // schedule.css: no transitions while the take-off state applies
  mark.removeAttribute("data-landing");
  mark.removeAttribute("data-landed");
  mark.getBoundingClientRect(); // style flush: the take-off state applies without a transition
  mark.removeAttribute("data-reset");
  mark.getBoundingClientRect();
  mark.setAttribute("data-landing", "");
  mark.setAttribute("data-landed", "");
}

/** Sets or removes a boolean attribute only when it changes. */
const mark = (el: Element, name: string, on: boolean): void => {
  if (el.hasAttribute(name) !== on) el.toggleAttribute(name, on);
};

export function enhance(root: HTMLElement): Enhancer {
  let m: { gsap: Gsap; Flip: FlipPlugin } | null = null;
  let lastNow: BelgradeNow | null = null;
  let tl: Motion | null = null;
  let alive = true;
  let io: IntersectionObserver | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const finish = () => {
    tl?.progress(1).kill();
    tl = null;
  };

  // Swipeable pill row (phones): fade the edge that has more pills behind it.
  const row = root.querySelector<HTMLElement>(".sched-filters");
  const edges = () => {
    if (!row) return;
    const max = row.scrollWidth - row.clientWidth;
    row.toggleAttribute("data-more-start", max > 1 && row.scrollLeft > 4);
    row.toggleAttribute("data-more-end", max > 1 && row.scrollLeft < max - 4);
  };
  edges();
  row?.addEventListener("scroll", edges, { passive: true });
  const ro = typeof ResizeObserver === "undefined" || !row ? null : new ResizeObserver(edges);
  if (row) ro?.observe(row);

  const landIn = (els: Element[], delay: number) =>
    m!.gsap.fromTo(
      els,
      { opacity: 0, y: -10, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: EASE.land, delay, stagger: 0.04, clearProps: "opacity,transform" },
    );

  if (motionAllowed()) {
    loadMotion()
      .then(async (mod) => {
        const Flip = await mod.loadFlip();
        if (alive) m = { gsap: mod.gsap, Flip };
      })
      .catch(() => {});

    // First-view landings. Cards are the section's primary motion (queued behind another
    // section's for ≤250 ms); the scoreboard and the pictogram are small accents.
    const targets = Array.from(root.querySelectorAll<HTMLElement>(LANDING)).filter((el) => !el.hasAttribute("data-landed"));
    const landCards = (cards: HTMLElement[]) => {
      cards.forEach((el) => el.setAttribute("data-landed", "go"));
      // The keyframes play once: afterwards a card may be hidden and shown by a filter without replaying them.
      const t = setTimeout(() => {
        timers.delete(t);
        cards.forEach((el) => el.setAttribute("data-landed", ""));
      }, 1100);
      timers.add(t);
    };
    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.setAttribute("data-landed", ""));
    } else {
      io = new IntersectionObserver(
        (entries) => {
          const hits = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
          if (!hits.length) return;
          hits.forEach((el) => io?.unobserve(el));
          const cards = hits.filter((el) => el.classList.contains("sched-card") && !el.hasAttribute("data-landed"));
          hits.filter((el) => !cards.includes(el)).forEach((el) => el.setAttribute("data-landed", ""));
          if (cards.length) void queuePrimaryMotion(600).then(() => alive && landCards(cards));
        },
        { threshold: 0.35 },
      );
      targets.forEach((el) => io?.observe(el));
    }
  }

  return {
    filter(next, apply) {
      finish();
      // Cards that have not landed yet show their final state (no second motion on a card that
      // enters). Set after Flip's measurements, so the tap forces no extra style recalc.
      const landAll = () => root.querySelectorAll(".sched-card:not([data-landed])").forEach((el) => el.setAttribute("data-landed", ""));
      const panel = root.querySelector<HTMLElement>(".sched-panel:not([hidden])");
      const byGroup = panel?.id === "sched-panel-group";
      const scope = panel?.querySelector<HTMLElement>(byGroup ? ".sched-cards" : ".sched-days");
      if (!m || !scope || !motionAllowed() || !onScreen(scope)) {
        landAll();
        apply();
        return;
      }
      const { gsap, Flip } = m;
      const boxes = byGroup ? [scope] : Array.from(scope.querySelectorAll<HTMLElement>(".sched-day")).filter(rendered);
      const targets = boxes.flatMap((b) => Array.from(b.querySelectorAll<HTMLElement>(ITEM)));
      const state = Flip.getState(targets);
      const h0 = scope.offsetHeight;
      // Visible items the new filter removes: `data-leaving` hides them for Flip's measurement
      // (display: none, NOT the !important [hidden] rule), so Flip brings them back absolutely
      // positioned while they fade.
      const leaving = targets.filter((el) => !el.hidden && !matches(el, next));
      leaving.forEach((el) => {
        el.setAttribute(LEAVING, "");
        el.setAttribute("aria-hidden", "true");
      });
      apply();
      // A card that changes size (the lone card takes the whole row) lands again instead of stretching.
      const resized = targets.filter((el) => {
        const s0 = state.getElementState(el);
        if (!s0?.isVisible || el.hidden || el.hasAttribute(LEAVING)) return false;
        return Math.abs(el.offsetWidth - s0.width) > 1 || Math.abs(el.offsetHeight - s0.height) > 1;
      });
      // Hold the list's height (min-height, no height animation) while items move, so the next
      // section never paints over them; day cards clip their rows instead. On release, the
      // location card below (stacked layouts) lands in its new place instead of popping up.
      const held = byGroup && scope.offsetHeight < h0;
      if (!byGroup) boxes.forEach((b) => b.setAttribute("data-flipping", ""));
      const release = () => {
        if (!held || !scope.style.minHeight) return;
        const aside = root.querySelector<HTMLElement>(".sched-aside");
        const y0 = aside?.getBoundingClientRect().top ?? 0;
        scope.style.removeProperty("min-height");
        if (aside && Math.abs(aside.getBoundingClientRect().top - y0) > 1 && onScreen(aside) && motionAllowed()) {
          aside.animate([{ opacity: 0.4, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], {
            duration: DUR.land * 1000,
            easing: "cubic-bezier(0.22, 1.12, 0.36, 1)",
          });
        }
      };
      const done = () => {
        settle(leaving);
        release();
        boxes.forEach((b) => b.removeAttribute("data-flipping"));
      };
      const stick = gsap.parseEase(EASE.stick);
      const hold = 0.06 / 0.36; // movers wait 60 ms for the leavers to clear
      const flip: Timeline = Flip.from(state, {
        targets: targets.filter((el) => !resized.includes(el)),
        duration: 0.36,
        ease: (p: number) => (p <= hold ? 0 : stick((p - hold) / (1 - hold))),
        scale: true,
        simple: true,
        absoluteOnLeave: true,
        onEnter: (els: Element[]) => landIn(els, 0.1),
        onLeave: (els: Element[]) =>
          gsap
            .timeline()
            .to(els, { opacity: 0, duration: 0.12, ease: "none" }, 0)
            .to(els, { y: 8, duration: 0.12, ease: EASE.takeoff }, 0),
        onComplete: done,
        onInterrupt: done,
      });
      // Set after Flip has measured the new layout (the held height moves no item).
      if (held) scope.style.minHeight = `${h0}px`;
      landAll();
      if (resized.length) flip.add(landIn(resized, 0), 0.1);
      // Movers and leavers are done at 0.36s; the entering items land inside the new layout.
      flip.call(release, [], 0.36);
      tl = flip;
    },

    captureDay() {
      finish();
      if (!m || !motionAllowed()) return null;
      const days = Array.from(root.querySelectorAll<HTMLElement>(".sched-days > .sched-day")).filter(rendered);
      const rows = days.length === 1 ? Array.from(days[0]!.querySelectorAll<HTMLElement>(ITEM)).filter((el) => !el.hidden) : [];
      return rows.length ? m.Flip.getState(rows) : null;
    },

    playDay(state) {
      // A day picked while the strip is stuck (the user scrolled into the previous day) keeps
      // the scroll position, which can leave the new day's first rows — or the whole shorter
      // panel — above the strip: bring the panels' top back just under it (no motion then).
      // The target uses the header-shown offset: scrolling up brings the header back.
      const strip = root.querySelector<HTMLElement>(".sched-strip");
      const daysBox = root.querySelector<HTMLElement>(".sched-days");
      if (strip && daysBox) {
        const target = (parseFloat(getComputedStyle(root).getPropertyValue("--sched-header-offset")) || 0) + strip.offsetHeight + 12;
        const top = daysBox.getBoundingClientRect().top;
        if (top < target) {
          window.scrollBy({ top: top - target, behavior: "instant" });
          return;
        }
      }
      if (!m || !motionAllowed()) return;
      const { gsap, Flip } = m;
      squash(root.querySelector(".sched-strip__pill"), TRAVEL - 40);
      const day = Array.from(root.querySelectorAll<HTMLElement>(".sched-days > .sched-day")).find(rendered);
      if (!day) return;
      const mark = day.querySelector(".sched-day__empty .chrono-mark");
      if (mark) {
        leap(mark);
        return;
      }
      const rows = Array.from(day.querySelectorAll<HTMLElement>(ITEM)).filter((el) => !el.hidden);
      if (!rows.length) return;
      if (!state) {
        tl = gsap.fromTo(rows, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.24, ease: EASE.stick, stagger: 0.03, clearProps: "opacity,transform" });
        return;
      }
      day.setAttribute("data-flipping", "");
      const done = () => day.removeAttribute("data-flipping");
      tl = Flip.from(state as FlipState, {
        targets: rows,
        duration: DUR.base,
        ease: EASE.stick,
        simple: true,
        onEnter: (els: Element[]) =>
          gsap.fromTo(els, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.24, ease: EASE.stick, stagger: 0.03, clearProps: "opacity,transform" }),
        onComplete: done,
        onInterrupt: done,
      });
    },

    view() {
      finish();
      if (motionAllowed()) squash(root.querySelector(".sched-views__pill"), TRAVEL - 40);
    },

    sync(now, filter) {
      // Google Calendar links: the static href holds the build-date occurrence (no-JS fallback);
      // point `dates` at the next real start, the same rule as „Sledeći trening“ (per minute only).
      if (now && now !== lastNow) {
        lastNow = now;
        root.querySelectorAll<HTMLAnchorElement>("a[data-gcal]").forEach((a) => {
          const [dayList = "", start = "", end = ""] = (a.dataset.gcal ?? "").split("|");
          const href = a.getAttribute("href");
          if (!dayList || !start || !end || !href) return;
          const next = withGcalDates(href, occurrenceDates(dayList.split(",") as DayCode[], start, end, now, true));
          if (next !== href) a.setAttribute("href", next);
        });
      }
      // Marks change only where they differ (no needless style invalidation on a filter tap).
      const code = now ? DAY_BY_ISO[now.isoWeekday - 1] : undefined;
      let started = false;
      let found = false;
      root.querySelectorAll<HTMLElement>(".sched-day").forEach((panel) => {
        const today = !!now && panel.dataset.day === code;
        panel.querySelectorAll<HTMLElement>(".sched-row").forEach((row) => {
          let first = Number.POSITIVE_INFINITY;
          let over = today;
          row.querySelectorAll<HTMLElement>(".sched-times__range").forEach((r) => {
            const past = today && Number(r.dataset.e) <= now!.minutes;
            first = Math.min(first, Number(r.dataset.s));
            mark(r, "data-past", past);
            over &&= past;
          });
          mark(row, "data-past", over);
          let next = false;
          let line = false;
          if (today && matches(row, filter)) {
            if (first <= now!.minutes) started = true;
            else if (!found) {
              found = next = true;
              line = started;
            }
          }
          mark(row, "data-next", next);
          mark(row, "data-now", line);
        });
      });
    },

    destroy() {
      alive = false;
      finish();
      row?.removeEventListener("scroll", edges);
      ro?.disconnect();
      io?.disconnect();
      timers.forEach(clearTimeout);
    },
  };
}
