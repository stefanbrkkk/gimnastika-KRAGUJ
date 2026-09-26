"use client";

import { useEffect } from "react";
import { MQ, motionAllowed } from "@/lib/motion-env";

/** The landing's flight keyframes (styles/ui.css): their end is the touchdown. */
const FLIGHT = "chrono-pitch";

/**
 * Page-wide client glue, mounted once from the layout:
 * 1. Marks every chronophotograph heading mark as "landed" when it enters the
 *    viewport — the CSS in styles/ui.css plays the short landing. One observer
 *    for the whole page; no rAF loop. Without motion, marks are static.
 * 2. Touchdown → rest: the ghost frames exist only in flight (plan-figure-system
 *    §5.1). When a mark's flight keyframes end — whoever started the landing (this
 *    observer, the hero's hand-off, a section's own motion) — the mark gets
 *    data-landed-rest and its CSS fades the afterimages out 400 ms later; a new
 *    landing clears it. Two delegated listeners, no timers.
 * 3. Hydration marker: html.js + html[data-hydrated]. scripts/defer-scripts.mjs
 *    reveals the no-JS fallbacks if hydration never happens (failed scripts).
 * 4. Live switch to reduced motion: drops html.js-motion, so every CSS pre-state
 *    scoped under it resolves to the final state at once (GSAP code reverts via
 *    gsap.matchMedia in each section).
 */
export function HeadingLandings() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js");
    root.dataset.hydrated = "1";

    const onFlight = (e: AnimationEvent) => {
      if (e.animationName !== FLIGHT || !(e.target instanceof Element)) return;
      e.target.closest(".chrono-mark")?.toggleAttribute("data-landed-rest", e.type === "animationend");
    };
    document.addEventListener("animationstart", onFlight);
    document.addEventListener("animationend", onFlight);

    const marks = Array.from(document.querySelectorAll<SVGElement>(".chrono-mark[data-land]"));
    const landAll = () => marks.forEach((m) => m.setAttribute("data-landed", ""));

    const reduce = window.matchMedia(MQ.reduce);
    const onReduce = () => {
      if (reduce.matches) {
        root.classList.remove("js-motion");
        landAll();
      }
    };
    reduce.addEventListener("change", onReduce);

    let io: IntersectionObserver | null = null;
    if (!motionAllowed() || typeof IntersectionObserver === "undefined") {
      landAll();
    } else {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              const mark = e.target;
              io?.unobserve(mark);
              // Already landed by its section's own motion (S7: title mask + landing in one slot).
              if (mark.hasAttribute("data-landed")) continue;
              // An accent (<3% of the viewport): no primary-motion slot, it may overlap content reveals.
              mark.setAttribute("data-landing", "");
              mark.setAttribute("data-landed", "");
            }
          }
        },
        { rootMargin: "0px 0px -35% 0px" },
      );
      marks.forEach((m) => io?.observe(m));
    }
    return () => {
      io?.disconnect();
      reduce.removeEventListener("change", onReduce);
      document.removeEventListener("animationstart", onFlight);
      document.removeEventListener("animationend", onFlight);
    };
  }, []);
  return null;
}
