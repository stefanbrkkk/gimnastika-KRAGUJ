"use client";

import { useEffect } from "react";
import { motionAllowed, whenNear } from "@/lib/motion-env";

/**
 * Arms the „Hronologija“ line only when the timeline is ≤1 viewport away: the GSAP
 * code (./timeline-motion → @/lib/motion) is imported lazily then, never in the
 * first-load bundle. Reduced motion / Save-Data / no JS: the full static line stays.
 */
export function TimelineMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-timeline]");
    if (!root || !motionAllowed()) return;
    let cancelled = false;
    let disarm: (() => void) | undefined;
    const stopNear = whenNear(root, () => {
      import("./timeline-motion")
        .then(({ armTimeline }) => {
          if (!cancelled && motionAllowed()) disarm = armTimeline(root);
        })
        .catch(() => {
          /* motion is decorative — the static final state stays */
        });
    });
    return () => {
      cancelled = true;
      stopNear();
      disarm?.();
    };
  }, []);
  return null;
}
