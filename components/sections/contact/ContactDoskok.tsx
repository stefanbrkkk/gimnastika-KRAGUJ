"use client";

import { useEffect } from "react";
import { motionAllowed, whenNear } from "@/lib/motion-env";

/**
 * Arms the final-CTA „doskok“ only when S11 is ≤1 viewport away: the GSAP code
 * (./doskok → @/lib/motion) is imported lazily then, never in the first-load bundle.
 * Reduced motion / Save-Data (no html.js-motion): nothing loads, the static
 * silhouette keeps resting on the button.
 */
export function ContactDoskok() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-doskok]");
    if (!root || !motionAllowed()) return;
    let cancelled = false;
    let disarm: (() => void) | undefined;
    const stopNear = whenNear(root, () => {
      import("./doskok")
        .then(({ armDoskok }) => {
          if (!cancelled && motionAllowed()) disarm = armDoskok(root);
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
