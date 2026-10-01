"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BOOKING } from "@/content/copy";
import { programById } from "@/content/programs";
import { SCHEDULE_LOCATION, type DayCode, type ProgramId } from "@/content/schedule";
import { CTA } from "@/content/site";
import { playExercise } from "@/lib/exercise-scrub";
import { loadMotion } from "@/lib/load-motion";
import { DUR, EASE, MQ, motionAllowed } from "@/lib/motion-env";
import { occurrenceDates, withGcalDates } from "@/lib/schedule-logic";
import { belgradeNow } from "@/lib/time";
import { typesetSr } from "@/lib/typeset";
import { PROGRAM_BIB, programSchedule, programStyle, PROGRAMS_UI } from "./model";
import { ProgramIcon, type ExercisePrint } from "./ProgramIcon";
import { ScheduleLines } from "./ScheduleLines";

/**
 * Program detail sheet (lazy chunk). Native <dialog> + showModal(): the page
 * behind is inert, Tab is wrapped inside the panel, Esc / backdrop / close
 * button close it and focus returns to the card's + button.
 * Motion: the card becomes the sheet. The panel starts as a card-sized window
 * (clip-path) placed exactly over the card and opens out to its full box
 * (transform + clip-path only). Content is never scaled, so there is no
 * distortion to hide and no empty slab: the colored plate, icon and title are
 * there from the first frame. On close the window shrinks back onto the card (0.18s
 * takeoff, fully opaque); the card reappears in the frame the sheet closes, so the
 * two are never printed over each other. Reduced motion: 150ms crossfade.
 * The plate is the apparatus scene (QP-21): a large drawing on the mat line and Marey grid with
 * the program's pose on it (plan §5.4). With motion the apparatus draws as the window opens and
 * the gymnast performs her whole exercise into the pose, the key phases staying behind as ghost
 * frames (playExercise, D-55: SHEET_PLAY_MS). Without motion: the finished exercise.
 * The sheet is a light print even though it lives inside the dark S3 section
 * (data-theme="light" on the dialog; .ps-panel sets its own tokens).
 * Links inside (booking / schedule) close the sheet synchronously and let the
 * click continue to the document-level delegates of those islands.
 */

const OPEN_DURATION = 0.42; // between DUR.base and DUR.reveal: a large shared-element move
/** The exercise plays from the first frame of the opening and lands after the apparatus's line
 *  is complete (draw 300–800ms): 18–22 frames at ≈70ms, the preview sheets' rate (D-55). */
const SHEET_PLAY_MS = 1400;
/** The exercise's frames: their own lazy chunk (shared with the card scrub, D-53). */
const loadExercises = () => import("./program-exercises").then((m) => m.PROGRAM_EXERCISES);
/** Display-only: the school's name and the street address never split across lines
 *  (typesetSr has no fixed phrases); SCHEDULE_LOCATION.sub itself is unchanged. */
const glueVenue = (text: string) =>
  text.replace(/Toza Dragović/g, "Toza\u00A0Dragović").replace(/Save Kovačevića (\d+)/g, "Save\u00A0Kovačevića\u00A0$1");
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Gsap = Awaited<ReturnType<typeof loadMotion>>["gsap"];

const px = (v: number) => `${Math.round(v * 10) / 10}px`;
/** inset() with four explicit radii, so GSAP interpolates every number of the string. */
const inset = (top: number, right: number, bottom: number, left: number, radii: readonly number[]) =>
  `inset(${px(top)} ${px(right)} ${px(bottom)} ${px(left)} round ${radii.map(px).join(" ")})`;
const radiiOf = (el: Element) => {
  const cs = getComputedStyle(el);
  return [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(
    (r) => parseFloat(r) || 0,
  );
};

/** The card's static print of the exercise (its server-rendered ghost frames): the sheet draws
 *  the same ghosts without shipping the frames in its own chunk. Their `d` never changes (the
 *  scrub only shows and hides them). */
const printOf = (card: HTMLElement): ExercisePrint => ({
  ghosts: Array.from(card.querySelectorAll<SVGPathElement>(".pc-icon .ex-ghost"), (g) => ({
    frame: Number(g.dataset.frame),
    d: g.getAttribute("d") ?? "",
  })),
});

interface ProgramSheetProps {
  programId: string;
  card: HTMLElement;
  onClosed: () => void;
  /** Server-rendered calendar actions of this program (fixed slots only). */
  calendar?: ReactNode;
}

export default function ProgramSheet({ programId, card, onClosed, calendar }: ProgramSheetProps) {
  const program = programById(programId as ProgramId);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const onClosedRef = useRef(onClosed);
  const [exercise] = useState(() => printOf(card));

  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    if (!dialog || !panel) return;

    const opener = card.querySelector<HTMLElement>("[data-program-open]");
    const root = document.documentElement;
    let gsap: Gsap | null = null;
    let stopPlay: (() => void) | null = null;
    let cancelled = false;
    let closing = false;
    let done = false;
    let shown = false;

    const lock = () => {
      root.style.setProperty("overflow", "hidden");
      root.style.setProperty("scrollbar-gutter", "stable");
    };
    const unlock = () => {
      root.style.removeProperty("overflow");
      root.style.removeProperty("scrollbar-gutter");
    };

    /** Cleanup shared by every close path. Idempotent. */
    const finish = (returnFocus: boolean) => {
      if (done) return;
      done = true;
      card.style.removeProperty("visibility");
      unlock();
      if (dialog.open) dialog.close();
      if (returnFocus) opener?.focus({ preventScroll: true });
      onClosedRef.current();
    };

    /**
     * The card's box relative to the panel's untransformed layout box: the translation that puts
     * the panel's top-left corner on the card, and the clip that cuts the panel to the card's size.
     */
    const onCard = () => {
      const c = card.getBoundingClientRect();
      const d = dialog.getBoundingClientRect();
      const x = c.left - (d.left + panel.offsetLeft);
      const y = c.top - (d.top + panel.offsetTop);
      return { x, y, clip: inset(0, panel.offsetWidth - c.width, panel.offsetHeight - c.height, 0, radiiOf(card)) };
    };
    const fullClip = () => inset(0, 0, 0, 0, radiiOf(panel));

    const close = (animate: boolean, returnFocus = true) => {
      if (closing || done) return;
      closing = true;
      if (!animate) return finish(returnFocus);
      if (gsap && motionAllowed()) {
        dialog.setAttribute("data-closing", "");
        gsap.killTweensOf(panel);
        const to = onCard();
        // The opaque window shrinks back onto the (still hidden) card; finish() shows the card
        // in the same frame the sheet closes: one clean swap, never a double exposure.
        gsap.fromTo(
          panel,
          { clipPath: panel.style.clipPath || fullClip() },
          { x: to.x, y: to.y, clipPath: to.clip, duration: DUR.fast, ease: EASE.takeoff, onComplete: () => finish(returnFocus) },
        );
      } else if (typeof panel.animate === "function") {
        dialog.setAttribute("data-closing", "");
        panel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: "linear", fill: "forwards" }).onfinish = () => finish(returnFocus);
      } else {
        finish(returnFocus);
      }
    };

    const show = () => {
      shown = true;
      lock();
      dialog.showModal();
      titleRef.current?.focus({ preventScroll: true });
    };

    (async () => {
      if (motionAllowed()) {
        const [m, exercises] = await Promise.all([loadMotion(), loadExercises().catch(() => null)]);
        if (cancelled) return;
        gsap = m.gsap;
        // The scene: the apparatus draws on the plate as the window opens (programs.css) and the
        // gymnast performs her exercise into the pose. It starts while the dialog is still
        // closed (display: none), so her first frame and the ghosts still to come are there from
        // the first painted frame instead of fading out of the static print. Without its chunk
        // she simply stands in her pose.
        const figure = panel.querySelector<SVGSVGElement>(".ps-icon svg[data-figure]");
        if (figure && exercises) stopPlay = playExercise(figure, exercises[program.icon], SHEET_PLAY_MS, () => (stopPlay = null));
        show();
        dialog.setAttribute("data-scene", "");
        const from = onCard();
        card.style.setProperty("visibility", "hidden");
        gsap.fromTo(
          panel,
          { x: from.x, y: from.y, clipPath: from.clip },
          { x: 0, y: 0, clipPath: fullClip(), duration: OPEN_DURATION, ease: EASE.stick, clearProps: "transform,clipPath" },
        );
      } else {
        show();
        if (typeof panel.animate === "function") panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "linear" });
      }
    })();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      } else if (e.key === "Tab") {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        const current = document.activeElement;
        if (e.shiftKey && (current === first || !panel.contains(current))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && current === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    // Android back / other close requests.
    const onCancel = (e: Event) => {
      e.preventDefault();
      close(true);
    };
    // A close we did not start (the browser forced it): clean up without animation.
    // Ignore stale close events (e.g. from a previous effect run) while not shown / open again.
    const onNativeClose = () => {
      if (!shown || dialog.open) return;
      finish(!closing);
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target === dialog) return close(true); // backdrop
      if (target.closest("[data-sheet-close]")) return close(true);
      // CTA links: close now, keep the event going to the booking/schedule delegates.
      if (target.closest("a[href]")) close(false);
    };

    // A live switch to reduced motion ends the exercise at once, on its final pose.
    const reduce = window.matchMedia(MQ.reduce);
    const onReduce = () => {
      if (reduce.matches) stopPlay?.();
    };
    reduce.addEventListener("change", onReduce);

    // Google links carry the build-date occurrence; re-date them to the next
    // occurrence from today, so an old sheet never opens a past event.
    panel.querySelectorAll<HTMLAnchorElement>("a[data-gcal]").forEach((a) => {
      const [days, start, end] = (a.getAttribute("data-gcal") ?? "").split("|");
      if (!days || !start || !end) return;
      a.href = withGcalDates(
        a.href,
        occurrenceDates(days.split(",") as DayCode[], start, end, belgradeNow(new Date()), true),
      );
    });

    dialog.addEventListener("keydown", onKeyDown);
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onNativeClose);
    dialog.addEventListener("click", onClick);

    return () => {
      cancelled = true;
      reduce.removeEventListener("change", onReduce);
      stopPlay?.();
      dialog.removeEventListener("keydown", onKeyDown);
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onNativeClose);
      dialog.removeEventListener("click", onClick);
      gsap?.killTweensOf(panel);
      card.style.removeProperty("visibility");
      unlock();
      if (dialog.open) dialog.close();
    };
  }, [card, program.icon]);

  const groups = programSchedule(program);
  const bib = PROGRAM_BIB[program.id];

  return (
    <dialog
      ref={dialogRef}
      className="program-sheet"
      data-theme="light"
      aria-labelledby="program-sheet-title"
      style={programStyle(program)}
    >
      <div ref={panelRef} className="ps-panel">
        {/* First in the panel, sticky in its scroller (QP4-03): the way out stays in view while
            the times are read on a short phone. At rest it sits on the plate's corner. */}
        <button type="button" className="ps-close" data-sheet-close="" aria-label={BOOKING.close}>
          <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
          </svg>
        </button>
        <div className="ps-inner">
          <div className="ps-plate" data-apparatus={program.icon}>
            {/* The scene's box (a size container): the stroke steps with the drawing's size. */}
            <span className="ps-scene">
              <ProgramIcon icon={program.icon} label={program.iconLabel} className="ps-icon" scene="sheet" exercise={exercise} />
            </span>
            {bib ? (
              <span className="pc-bib" aria-hidden="true">
                {bib}
              </span>
            ) : null}
          </div>
          <div className="ps-body">
            <h2 id="program-sheet-title" ref={titleRef} tabIndex={-1} className="ps-title text-h2">
              {typesetSr(program.title)}
            </h2>
            {program.age ? <p className="pc-age label-caps">{typesetSr(program.age)}</p> : null}
            <p className="ps-desc">{typesetSr(program.description)}</p>
            <section className="ps-schedule" aria-labelledby="program-sheet-raspored">
              <h3 id="program-sheet-raspored" className="ps-schedule__title label-caps">
                {PROGRAMS_UI.scheduleLabel}
              </h3>
              <ScheduleLines groups={groups} week className="ps-sched" />
              {calendar}
              <p className="ps-where text-small">{glueVenue(typesetSr(SCHEDULE_LOCATION.sub))}</p>
            </section>
          </div>
          {/* After the text, outside its scroller: pinned under it in portrait, under the scene in
              the landscape grid (QP4-02), so the CTAs never cover the times there. */}
          <div className="ps-actions">
            <a href="#kontakt" data-booking={program.title} className="btn btn-primary">
              {CTA.trial}
            </a>
          </div>
        </div>
      </div>
    </dialog>
  );
}
