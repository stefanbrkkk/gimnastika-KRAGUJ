"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
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
 * Tiny client island of the hero (kept in the first-load bundle): starts the
 * lazy motion layer right after hydration when motion is allowed, and counts
 * taps on the landed silhouette for the easter egg.
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
      {motion ? <HeroMotion /> : null}
      {egg ? <EasterEgg onClose={closeEgg} /> : null}
      <p className="sr-only" aria-live="polite">
        {egg ? HERO.easterEgg.tooltip : ""}
      </p>
    </>
  );
}
