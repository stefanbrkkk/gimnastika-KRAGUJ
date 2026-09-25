"use client";

import { useEffect } from "react";
import { MQ, motionAllowed, queuePrimaryMotion } from "@/lib/motion-env";

/**
 * Page-wide client glue, mounted once from the layout:
 * 1. Marks every chronophotograph heading mark as "landed" when it enters the
 *    viewport — the CSS in styles/ui.css plays the short landing. One observer
 *    for the whole page; no rAF loop. Without motion, marks are static.
 * 2. Hydration marker: html.js + html[data-hydrated]. scripts/defer-scripts.mjs
 *    reveals the no-JS fallbacks if hydration never happens (failed scripts).
 * 3. Live switch to reduced motion: drops html.js-motion, so every CSS pre-state
 *    scoped under it resolves to the final state at once (GSAP code reverts via
 *    gsap.matchMedia in each section).
 */
export function HeadingLandings() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js");
    root.dataset.hydrated = "1";

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

    if (!motionAllowed() || typeof IntersectionObserver === "undefined") {
      landAll();
      return () => reduce.removeEventListener("change", onReduce);
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const mark = e.target;
            io.unobserve(mark);
            // A title landing is the first primary motion of its section (≈800 ms incl. delay).
            void queuePrimaryMotion(800).then(() => mark.setAttribute("data-landed", ""));
          }
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    marks.forEach((m) => io.observe(m));
    return () => {
      io.disconnect();
      reduce.removeEventListener("change", onReduce);
    };
  }, []);
  return null;
}
