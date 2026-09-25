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
 * "Sledeći trening: danas u 18:00". Rendered empty on the server (its row keeps
 * its height, so nothing shifts when the text arrives after mount); updates
 * every minute via the shared clock. When no fixed slot is next it turns invisible
 * but keeps its row, so the card height never changes after hydration.
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
          {/* One text column: on a narrow card the value wraps under the label, never under the icon. */}
          <span className="sched-next__text">
            <span className="sched-next__label">{label}:</span>{" "}
            <strong className="sched-next__value tabular">{formatNextTraining(next, accusatives)}</strong>
          </span>
        </>
      ) : null}
    </p>
  );
}
