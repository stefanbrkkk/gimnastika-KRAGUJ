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
 * The card's „Sledeći trening“ tag: „danas u 18:00“ on the card's top edge (≥640 px).
 * The label is for screen readers only — the section scoreboard carries it visibly.
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
          <svg className="sched-next__leap" viewBox="0 0 230 150" aria-hidden="true" focusable="false">
            <use href="#leap" />
          </svg>
          <span className="sr-only">{label}: </span>
          <strong className="sched-next__value tabular">{formatNextTraining(next, accusatives)}</strong>
        </>
      ) : null}
    </p>
  );
}
