"use client";

import { formatNextTraining, nextTraining, type Slot } from "@/lib/schedule-logic";
import { useBelgradeMinute } from "./clock";

interface NextTrainingProps {
  slots: readonly Slot[];
  /** DAYS[].accusative in ISO order. */
  accusatives: readonly string[];
  label: string;
}

/**
 * The card's „Sledeći trening“ tag: a clock glyph and „danas u 18:00“ on the card's top edge
 * (≥640 px). UI chrome, so a line icon, never a figure (plan-figure-system R5). The label is for
 * screen readers only — the section scoreboard carries it visibly.
 * Rendered empty on the server and absolutely positioned, so nothing shifts when the text
 * arrives after mount or disappears (no fixed slot is next); updates every minute via the
 * shared clock.
 */
export function NextTraining({ slots, accusatives, label }: NextTrainingProps) {
  const now = useBelgradeMinute();
  const next = now ? nextTraining(slots, now) : null;
  return (
    <p className="sched-next" data-state={now ? (next ? "ready" : "none") : "pending"}>
      {next ? (
        <>
          <svg className="ui-icon sched-next__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4.75V8l2.25 1.75" />
          </svg>
          <span className="sr-only">{label}: </span>
          <strong className="sched-next__value tabular">{formatNextTraining(next, accusatives)}</strong>
        </>
      ) : null}
    </p>
  );
}
