"use client";

/**
 * Hero motion layer — loaded lazily (next/dynamic, ssr:false) right after
 * hydration. Together with gsap core + MotionPathPlugin + CustomEase this is
 * the initial animation chunk (≤45 KB gz). ScrollTrigger loads only after the
 * intro, on (min-width:1024px) and (pointer:fine).
 *
 * Intro ≤1.9 s (§4 HERO):
 *   0–.35   mat line draws left→right (stroke-dashoffset)
 *   .2–1.2  the white silhouette flies the parabola (align, alignOrigin [.5,.6],
 *           ease "hang") and lands exactly at its logo position
 *   …       it leaves 6 ghost frames (placed with gsap.set motionPath end p,
 *           fills stepped, opacity .10→.28, stagger .12)
 *   1.1–1.9 the wordmark reveals by a clip-path wipe
 * Desktop: pin +=80%, scrub .5 — ghost frames fade one by one, the mat line
 * extends and drops into the floor-exercise diagonal toward the next section.
 */
import { useEffect } from "react";
import { EASE, MQ, gsap, loadScrollTrigger, registerMotion } from "@/lib/motion";
import { ALIGN_ORIGIN, GHOST_OPACITY, GHOST_P, INTRO } from "./constants";

type ScrollTriggerStatic = Awaited<ReturnType<typeof loadScrollTrigger>>;

const SVG_NS = "http://www.w3.org/2000/svg";
const q = <T extends Element>(root: ParentNode, sel: string) => root.querySelector<T>(sel);
const qa = <T extends Element>(root: ParentNode, sel: string) => Array.from(root.querySelectorAll<T>(sel));

/** First τ (0–1) where the eased progress reaches p (the flier passes a ghost frame). */
function timeAtProgress(ease: (t: number) => number, p: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < p) lo = mid;
    else hi = mid;
  }
  return hi;
}

export default function HeroMotion() {
  useEffect(() => {
    const html = document.documentElement;
    // The head-script failsafe fired: leave the final composition alone.
    if (html.getAttribute("data-intro") === "skipped") return;
    const section = document.getElementById("top");
    const decor = section && q<HTMLElement>(section, "[data-hero-decor]");
    if (!section || !decor) return;

    registerMotion();
    let disposed = false;
    const mm = gsap.matchMedia();

    const visibleArt = () => qa<SVGSVGElement>(decor, "[data-hero-variant]").find((s) => s.getBoundingClientRect().width > 0);

    const finish = () => {
      if (html.getAttribute("data-intro") !== "done") {
        html.setAttribute("data-intro", "done");
        performance.mark("kraguj:intro-end");
      }
      decor.setAttribute("data-hero-ready", "");
      // Outside the intro's matchMedia context.
      requestAnimationFrame(startScrollChoreography);
    };

    // ---- Intro (no reduced motion; Save-Data never gets here: no js-motion) ----
    mm.add(MQ.noReduce, () => {
      const art = visibleArt();
      const mat = q<SVGPathElement>(decor, "[data-hero-mat]");
      const rect = section.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;
      if (!art || !mat || !inView || html.getAttribute("data-intro") === "done") {
        finish();
        return;
      }
      const path = q<SVGPathElement>(art, "[data-hero-path]")!;
      const leap = q<SVGGElement>(art, "[data-hero-leap]")!;
      const wordmark = q<SVGUseElement>(art, "[data-hero-wordmark]")!;
      const ghosts = qa<SVGGElement>(art, "[data-hero-ghost]");
      const ticks = qa<SVGLineElement>(art, "[data-hero-tick]");
      const tickTo = ticks.map((t) => Number(getComputedStyle(t).opacity) || 0);
      const along = (end: number) => ({ path, align: path, alignOrigin: ALIGN_ORIGIN, end });

      html.setAttribute("data-intro", "running");
      performance.mark("kraguj:intro-start");

      // t = 0 — set in the same frame as data-hero-ready, so nothing flashes.
      // (pathLength = 1, so dash tweens use autoRound: false — gsap rounds px otherwise.)
      gsap.set(mat, { strokeDashoffset: 1 });
      ghosts.forEach((g, i) => gsap.set(g, { motionPath: along(GHOST_P[i]!), opacity: 0 }));
      gsap.set(ticks, { opacity: 0 });
      gsap.set(wordmark, { clipPath: "inset(0% 100% 0% 0%)" });
      gsap.set(leap, { motionPath: along(0), opacity: 0 });
      decor.setAttribute("data-hero-ready", "");

      const [flightStart, flightEnd] = INTRO.flight;
      const flight = flightEnd - flightStart;
      const firstGhostAt = flightStart + flight * timeAtProgress(gsap.parseEase(EASE.hang), GHOST_P[0]);

      gsap
        .timeline({ onComplete: finish })
        .to(mat, { strokeDashoffset: 0, autoRound: false, duration: INTRO.matDraw[1] - INTRO.matDraw[0], ease: EASE.stick }, INTRO.matDraw[0])
        .to(leap, { opacity: 1, duration: 0.14, ease: "none" }, flightStart - 0.12)
        .to(leap, { motionPath: { path, align: path, alignOrigin: ALIGN_ORIGIN }, duration: flight, ease: EASE.hang }, flightStart)
        .to(ghosts, { opacity: (i: number) => GHOST_OPACITY[i]!, duration: 0.18, ease: "none", stagger: INTRO.ghostStagger }, firstGhostAt)
        .to(ticks, { opacity: (i: number) => tickTo[i]!, duration: 0.18, ease: "none", stagger: INTRO.ghostStagger }, firstGhostAt)
        .to(
          wordmark,
          { clipPath: "inset(0% 0% 0% 0%)", duration: INTRO.wordmark[1] - INTRO.wordmark[0], ease: EASE.stick },
          INTRO.wordmark[0],
        );
    });

    // Reduced motion (live change included): the static final composition.
    mm.add(MQ.reduce, () => {
      decor.setAttribute("data-hero-ready", "");
    });

    // ---- Desktop only: pin + scrub after the intro ----
    let scrollStarted = false;
    function startScrollChoreography() {
      if (scrollStarted || disposed) return;
      scrollStarted = true;
      mm.add(`${MQ.desktopFine} and ${MQ.noReduce}`, (ctx) => {
        let live = true;
        let cleanup: (() => void) | undefined;
        loadScrollTrigger().then((ScrollTrigger) => {
          if (!live || disposed) return;
          ctx.add(() => {
            cleanup = pinHero(ScrollTrigger, section!, decor!, visibleArt());
          });
        });
        return () => {
          live = false;
          cleanup?.();
        };
      });
    }

    return () => {
      disposed = true;
      mm.revert();
    };
  }, []);

  return null;
}

/**
 * Pins the hero for 80% of a viewport of scroll. Scrubbed: the ghost frames fade
 * one by one, then the mat line extends to the right edge and drops into the
 * floor-exercise diagonal toward the next section (bottom-left).
 */
function pinHero(
  ScrollTrigger: ScrollTriggerStatic,
  section: HTMLElement,
  decor: HTMLElement,
  art: SVGSVGElement | undefined,
): () => void {
  const matSvg = q<SVGSVGElement>(decor, ".hero-mat");
  if (!art || !matSvg) return () => {};

  const spine = document.createElementNS(SVG_NS, "svg");
  spine.setAttribute("class", "hero-spine");
  spine.setAttribute("aria-hidden", "true");
  spine.setAttribute("focusable", "false");
  const line = document.createElementNS(SVG_NS, "path");
  line.setAttribute("pathLength", "1");
  spine.appendChild(line);
  section.prepend(spine);

  const layout = () => {
    const s = section.getBoundingClientRect();
    const m = matSvg.getBoundingClientRect();
    const w = section.clientWidth;
    const h = section.offsetHeight;
    const y = m.top + m.height / 2 - s.top;
    const x0 = m.right - s.left;
    const turn = w - Math.min(32, (w - x0) / 2);
    const inner = q<HTMLElement>(section, ".hero__inner");
    const left = inner ? parseFloat(getComputedStyle(inner).paddingLeft) + inner.getBoundingClientRect().left - s.left : 48;
    spine.setAttribute("viewBox", `0 0 ${w} ${h}`);
    line.setAttribute("d", `M${x0} ${y}H${turn}L${left} ${h}`);
  };
  layout();
  ScrollTrigger.addEventListener("refreshInit", layout);

  // Oldest frames decay first, like afterimages.
  const ghosts = qa<SVGGElement>(art, "[data-hero-ghost]");
  const ticks = qa<SVGLineElement>(art, "[data-hero-tick]");
  const tl = gsap
    .timeline({ defaults: { ease: "none" } })
    .to(ghosts, { opacity: 0, duration: 0.2, stagger: 0.09 }, 0)
    .to(ticks, { opacity: 0, duration: 0.2, stagger: 0.09 }, 0)
    .fromTo(line, { strokeDashoffset: 1 }, { strokeDashoffset: 0, autoRound: false, duration: 0.75 }, 0.25);

  ScrollTrigger.create({
    trigger: section,
    // A hero taller than the viewport pins when its bottom reaches the viewport bottom.
    start: () => (section.offsetHeight > window.innerHeight + 1 ? "bottom bottom" : "top top"),
    end: "+=80%",
    pin: true,
    scrub: 0.5,
    animation: tl,
    invalidateOnRefresh: true,
  });
  ScrollTrigger.refresh();

  return () => {
    ScrollTrigger.removeEventListener("refreshInit", layout);
    spine.remove();
  };
}
