"use client";

import { useEffect } from "react";
import { motionAllowed, whenNear } from "@/lib/motion-env";

/**
 * Arms the coaches motion (portrait reveal or plate develop, stamp, brush stroke) only when S6 is
 * ≤1 viewport away: ./coaches-motion (GSAP + DrawSVG) is imported lazily then.
 * Reduced motion / Save-Data / no JS: nothing loads, the static final state stays.
 */
export function CoachesMotion() {
  useEffect(() => {
    const root = document.getElementById("treneri");
    if (!root || !motionAllowed()) return;
    let cancelled = false;
    let disarm: (() => void) | undefined;
    const stopNear = whenNear(root, () => {
      import("./coaches-motion")
        .then(({ armCoaches }) => {
          if (!cancelled && motionAllowed()) disarm = armCoaches(root);
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
