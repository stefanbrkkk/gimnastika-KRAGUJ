"use client";

import { useEffect, useRef } from "react";
import { BOOKING } from "@/content/copy";
import { programById } from "@/content/programs";
import { SCHEDULE_LOCATION, type ProgramId } from "@/content/schedule";
import { CTA } from "@/content/site";
import { loadMotion } from "@/lib/load-motion";
import { DUR, EASE, motionAllowed } from "@/lib/motion-env";
import { glueDash, programSchedule, programStyle, PROGRAMS_UI } from "./model";
import { ProgramIcon } from "./ProgramIcon";
import { ScheduleLines } from "./ScheduleLines";

/**
 * Program detail sheet (lazy chunk). Native <dialog> + showModal(): the page
 * behind is inert, Tab is wrapped inside the panel, Esc / backdrop / close
 * button close it and focus returns to the card's + button.
 * Motion: the card becomes the sheet (Flip shared element, card → panel) and
 * the panel flies back onto the card on close. Reduced motion: 150ms crossfade.
 * Links inside (booking / schedule) close the sheet synchronously and let the
 * click continue to the document-level delegates of those islands.
 */

const FLIP_ID = "program-sheet";
const OPEN_DURATION = 0.42; // between DUR.base and DUR.reveal: a large shared-element move
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Motion = Awaited<ReturnType<typeof loadMotion>>;
type FlipPlugin = Awaited<ReturnType<Motion["loadFlip"]>>;

interface ProgramSheetProps {
  programId: string;
  card: HTMLElement;
  onClosed: () => void;
}

export default function ProgramSheet({ programId, card, onClosed }: ProgramSheetProps) {
  const program = programById(programId as ProgramId);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const onClosedRef = useRef(onClosed);

  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    const inner = innerRef.current;
    if (!dialog || !panel || !inner) return;

    const opener = card.querySelector<HTMLElement>("[data-program-open]");
    const root = document.documentElement;
    let motion: { gsap: Motion["gsap"]; Flip: FlipPlugin } | null = null;
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

    const close = (animate: boolean, returnFocus = true) => {
      if (closing || done) return;
      closing = true;
      if (!animate) return finish(returnFocus);
      if (motion && motionAllowed()) {
        dialog.setAttribute("data-closing", "");
        motion.gsap.to(inner, { opacity: 0, duration: DUR.tap, ease: "none" });
        motion.Flip.fit(panel, card, { scale: true, duration: DUR.fast, ease: EASE.takeoff, onComplete: () => finish(returnFocus) });
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
        const m = await loadMotion();
        const Flip = await m.loadFlip();
        if (cancelled) return;
        motion = { gsap: m.gsap, Flip };
        card.setAttribute("data-flip-id", FLIP_ID);
        const state = Flip.getState(card);
        card.removeAttribute("data-flip-id");
        show();
        card.style.setProperty("visibility", "hidden");
        m.gsap.set(inner, { opacity: 0 });
        Flip.from(state, { targets: panel, duration: OPEN_DURATION, ease: EASE.stick, scale: true });
        m.gsap.to(inner, { opacity: 1, duration: DUR.base, delay: OPEN_DURATION * 0.4, ease: "none" });
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

    dialog.addEventListener("keydown", onKeyDown);
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onNativeClose);
    dialog.addEventListener("click", onClick);

    return () => {
      cancelled = true;
      dialog.removeEventListener("keydown", onKeyDown);
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onNativeClose);
      dialog.removeEventListener("click", onClick);
      if (motion) {
        motion.gsap.killTweensOf([panel, inner]);
      }
      card.style.removeProperty("visibility");
      unlock();
      if (dialog.open) dialog.close();
    };
  }, [card]);

  const groups = programSchedule(program);

  return (
    <dialog ref={dialogRef} className="program-sheet" aria-labelledby="program-sheet-title" style={programStyle(program)}>
      <div ref={panelRef} className="ps-panel" data-flip-id={FLIP_ID}>
        <div ref={innerRef} className="ps-inner">
          <div className="ps-plate">
            <ProgramIcon icon={program.icon} label={program.iconLabel} className="ps-icon" />
            <button type="button" className="ps-close" data-sheet-close="" aria-label={BOOKING.close}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
              </svg>
            </button>
          </div>
          <div className="ps-body">
            <h2 id="program-sheet-title" ref={titleRef} tabIndex={-1} className="ps-title text-h2">
              {glueDash(program.title)}
            </h2>
            {program.age ? <p className="pc-age label-caps">{program.age}</p> : null}
            <p className="ps-desc">{program.description}</p>
            <section className="ps-schedule" aria-labelledby="program-sheet-raspored">
              <h3 id="program-sheet-raspored" className="ps-schedule__title label-caps">
                {PROGRAMS_UI.scheduleLabel}
              </h3>
              <ScheduleLines groups={groups} week className="ps-sched" />
              <p className="ps-where text-small">{SCHEDULE_LOCATION.sub}</p>
            </section>
            <div className="ps-actions">
              <a href="#raspored" data-schedule-program={program.id} className="btn btn-secondary">
                {CTA.viewSchedule}
              </a>
              <a href="#kontakt" data-booking={program.title} className="btn btn-primary">
                {CTA.trial}
              </a>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
