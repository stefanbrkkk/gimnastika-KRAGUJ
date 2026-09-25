"use client";

import { useEffect } from "react";
import { motionAllowed, whenNear } from "@/lib/motion-env";

type Arm = (el: HTMLElement) => () => void;

/**
 * Arms S5's two motions, each only when its element is ≤1 viewport away: the club print's
 * landing (./print-motion) and the „Hronologija“ flier (./timeline-motion). Both modules use
 * GSAP (@/lib/motion) and are imported lazily — never in the first-load bundle.
 * Reduced motion / Save-Data / no JS: nothing loads, the static final state stays.
 */
export function AboutMotion() {
  useEffect(() => {
    if (!motionAllowed()) return;
    let cancelled = false;
    const disarms: (() => void)[] = [];
    const stops: (() => void)[] = [];
    const arm = (el: HTMLElement | null, load: () => Promise<Arm>) => {
      if (!el) return;
      stops.push(
        whenNear(el, () => {
          load()
            .then((armFn) => {
              if (!cancelled && motionAllowed()) disarms.push(armFn(el));
            })
            .catch(() => {
              /* motion is decorative — the static final state stays */
            });
        }),
      );
    };
    arm(document.querySelector<HTMLElement>("[data-about-print]"), () => import("./print-motion").then((m) => m.armPrint));
    arm(document.querySelector<HTMLElement>("[data-timeline]"), () => import("./timeline-motion").then((m) => m.armTimeline));
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
      disarms.forEach((disarm) => disarm());
    };
  }, []);
  return null;
}
