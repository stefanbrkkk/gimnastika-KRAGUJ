"use client";

import { useEffect } from "react";
import { motionAllowed } from "@/lib/motion-env";

/**
 * Plays the „Šta poneti“ checklist once: sets data-ticked on the list when it is
 * well inside the viewport; the CSS draws each tick (stroke-dashoffset) with a
 * short stagger. No gsap, no rAF loop. Without JS / under reduced motion the
 * ticks are static (the hidden state exists only under html.js-motion).
 */
export function ChecklistTicks({ targetId }: { targetId: string }) {
  useEffect(() => {
    const list = document.getElementById(targetId);
    if (!list) return;
    if (!motionAllowed() || typeof IntersectionObserver === "undefined") {
      list.setAttribute("data-ticked", "");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          list.setAttribute("data-ticked", "");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -20% 0px", threshold: 0.6 },
    );
    io.observe(list);
    return () => io.disconnect();
  }, [targetId]);
  return null;
}
