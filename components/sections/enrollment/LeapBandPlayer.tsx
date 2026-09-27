"use client";

import { useEffect } from "react";
import { motionAllowed, whenNear } from "@/lib/motion-env";

/**
 * Arms S10's cartwheel band (initial bundle: tiny, no gsap here). One viewport before the band it
 * loads the lazy chunk (leap-motion.ts), which scrubs the cartwheel with the scroll. Until then —
 * and if the chunk fails, and after an unmount — the band is its static chronophotograph; a band
 * already on screen stays static until it has left the view once (lib/exercise-scrub.ts).
 * Reduced motion / Save-Data / no JS: the static chronophotograph, untouched.
 */
export function LeapBandPlayer({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || !motionAllowed() || typeof IntersectionObserver === "undefined") return;
    let live = true;
    let disarm: (() => void) | undefined;
    const stopNear = whenNear(root, () => {
      import("./leap-motion").then(
        (m) => {
          if (live && motionAllowed()) disarm = m.armLeap(root);
        },
        () => {
          /* decorative — the static band stays */
        },
      );
    });
    return () => {
      live = false;
      stopNear();
      disarm?.();
    };
  }, [rootId]);
  return null;
}
