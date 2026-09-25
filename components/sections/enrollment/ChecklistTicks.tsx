"use client";

import { useEffect } from "react";
import { motionAllowed, queuePrimaryMotion } from "@/lib/motion-env";

/**
 * Tick-in length (ms), mirrored from styles/sections/enrollment.css: the last of
 * the five ticks starts at --dur-tap + 4 × 60ms and draws for --dur-base.
 */
const TICKS_MS = 100 + 4 * 60 + 280;

/**
 * Plays the „Šta poneti“ checklist once: sets data-ticked on the list when it is
 * well inside the viewport; the CSS draws each tick (stroke-dashoffset) with a
 * short stagger. It is S10's primary motion, so it waits its turn in the
 * page-wide queue (e.g. behind a heading landing still in flight). No gsap, no
 * rAF loop. Without JS / under reduced motion the ticks are static (the hidden
 * state exists only under html.js-motion + prefers-reduced-motion: no-preference).
 */
export function ChecklistTicks({ targetId }: { targetId: string }) {
  useEffect(() => {
    const list = document.getElementById(targetId);
    if (!list) return;
    const tick = () => list.setAttribute("data-ticked", "");
    if (!motionAllowed() || typeof IntersectionObserver === "undefined") {
      tick();
      return;
    }
    let live = true;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void queuePrimaryMotion(TICKS_MS).then(() => {
            if (live) tick();
          });
        }
      },
      { rootMargin: "0px 0px -20% 0px", threshold: 0.6 },
    );
    io.observe(list);
    return () => {
      live = false;
      io.disconnect();
    };
  }, [targetId]);
  return null;
}
