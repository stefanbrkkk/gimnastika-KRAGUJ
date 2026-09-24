"use client";

import { useEffect } from "react";
import { motionAllowed } from "@/lib/motion-env";

/**
 * Marks every chronophotograph heading mark as "landed" when it enters the
 * viewport — the CSS in styles/ui.css plays the short landing. One observer
 * for the whole page; no rAF loop. Without motion, marks are static.
 */
export function HeadingLandings() {
  useEffect(() => {
    const marks = Array.from(document.querySelectorAll<SVGElement>(".chrono-mark[data-land]"));
    if (!motionAllowed() || typeof IntersectionObserver === "undefined") {
      marks.forEach((m) => m.setAttribute("data-landed", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute("data-landed", "");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    marks.forEach((m) => io.observe(m));
    return () => io.disconnect();
  }, []);
  return null;
}
