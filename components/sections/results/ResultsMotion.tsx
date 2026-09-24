"use client";

import { useEffect } from "react";
import { motionAllowed, whenNear } from "@/lib/motion-env";

/**
 * Arms the S7 motion sequence only when „Uspesi“ is ≤1 viewport away: the GSAP code
 * (./results-motion → @/lib/motion + SplitText + DrawSVG) is imported lazily then,
 * never in the first-load bundle. Reduced motion / Save-Data: nothing loads and the
 * static final state stays.
 */
export function ResultsMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-results]");
    if (!root || !motionAllowed()) return;
    let cancelled = false;
    let disarm: (() => void) | undefined;
    const stopNear = whenNear(root, () => {
      import("./results-motion")
        .then(async ({ armResults }) => {
          if (cancelled || !motionAllowed()) return;
          const d = await armResults(root);
          if (cancelled) d();
          else disarm = d;
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
