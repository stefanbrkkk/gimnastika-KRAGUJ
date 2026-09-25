"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { QuietBoundary } from "@/components/ui/QuietBoundary";
import { HERO } from "@/content/copy";
import { motionAllowed } from "@/lib/motion-env";

/** gsap core + MotionPath + CustomEase + the intro timeline: the initial animation chunk. */
const HeroMotion = dynamic(() => import("./HeroMotion"), { ssr: false });
/** Loaded only on the third tap on the landed silhouette. */
const EasterEgg = dynamic(() => import("./EasterEgg"), { ssr: false });

const noSubscribe = () => () => {};
/** Server + hydration: false. Right after hydration: whether the intro may run. */
const introAllowed = () => motionAllowed() && document.documentElement.getAttribute("data-intro") !== "skipped";

/**
 * The motion chunk failed (network, stale deploy) or threw: show the complete
 * final composition right away instead of waiting for the head-script
 * failsafe, and mark the intro "skipped" so nothing touches it afterwards
 * (other sections keep html.js-motion).
 */
function HeroFinalState() {
  useEffect(() => {
    const html = document.documentElement;
    if (html.getAttribute("data-intro") !== "done") html.setAttribute("data-intro", "skipped");
    document.querySelector("#top [data-hero-decor]")?.setAttribute("data-hero-ready", "");
  }, []);
  return null;
}

/**
 * Tiny client island of the hero (kept in the first-load bundle): starts the
 * lazy motion layer right after hydration when motion is allowed, and counts
 * taps on the landed silhouette for the easter egg. Both lazy chunks sit in a
 * QuietBoundary: a failed or throwing enhancement never replaces the page with
 * Next's error screen.
 */
export function HeroMotionLoader() {
  const motion = useSyncExternalStore(noSubscribe, introAllowed, () => false);
  const [egg, setEgg] = useState(false);
  const closeEgg = useCallback(() => setEgg(false), []);

  useEffect(() => {
    const section = document.getElementById("top");
    if (!section) return;
    let taps = 0;
    let last = 0;
    const onTap = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-hero-leap-hit]")) return;
      if (document.documentElement.getAttribute("data-intro") === "running") return;
      const now = e.timeStamp;
      taps = now - last < 700 ? taps + 1 : 1;
      last = now;
      if (taps >= 3) {
        taps = 0;
        setEgg(true);
      }
    };
    section.addEventListener("click", onTap);
    return () => section.removeEventListener("click", onTap);
  }, []);

  return (
    <>
      {motion ? (
        <QuietBoundary fallback={<HeroFinalState />}>
          <HeroMotion />
        </QuietBoundary>
      ) : null}
      {egg ? (
        <QuietBoundary>
          <EasterEgg onClose={closeEgg} />
        </QuietBoundary>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {egg ? HERO.easterEgg.tooltip : ""}
      </p>
    </>
  );
}
