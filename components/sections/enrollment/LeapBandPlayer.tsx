"use client";

import { useEffect } from "react";
import { motionAllowed, whenNear } from "@/lib/motion-env";

/**
 * Arms S10's primary motion — „Jedan skok, tri kadra“ (initial bundle: tiny, no
 * gsap here). Only when the leap is still below the fold at hydration, it marks
 * the band data-leap="armed" (CSS pre-state under html.js-motion: the decorative
 * frames wait) and, one viewport before it, loads the lazy chunk
 * (leap-motion.ts), which watches for the band (in view for 350ms: a layout jump
 * is not an arrival), takes the primary-motion slot (≤250ms wait) and flies the
 * leap. A failed chunk or an
 * unmount always lands on the final state (data-leap="done").
 * Reduced motion / Save-Data / no JS: the static chronophotograph, untouched.
 */
export function LeapBandPlayer({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || !motionAllowed() || typeof IntersectionObserver === "undefined") return;
    if (root.getBoundingClientRect().top < window.innerHeight) return;
    const finish = () => root.setAttribute("data-leap", "done");
    root.setAttribute("data-leap", "armed");
    let live = true;
    let disarm: (() => void) | undefined;
    const stopNear = whenNear(root, () => {
      import("./leap-motion").then((m) => {
        if (live) disarm = m.armLeap(root);
      }, finish);
    });
    return () => {
      live = false;
      stopNear();
      disarm?.();
      if (root.getAttribute("data-leap") !== "play") finish();
    };
  }, [rootId]);
  return null;
}
