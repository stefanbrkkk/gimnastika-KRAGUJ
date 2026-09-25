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
 * extends and drops into the floor-exercise diagonal toward the next section
 * (routed around the text, spine.ts). The pin is created only while the page
 * rests at the top (never under a scrolled viewport or a deep link).
 */
import { useEffect } from "react";
import { DUR, EASE, MQ, gsap, loadScrollTrigger, queuePrimaryMotion, registerMotion } from "@/lib/motion";
import { ALIGN_ORIGIN, GHOST_OPACITY, GHOST_P, INTRO } from "./constants";
import { spinePath, type SpineRect } from "./spine";

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

      // The hero is the page's first primary motion: it only registers its
      // duration (never waits), so other sections' primary motions queue after it.
      void queuePrimaryMotion(INTRO.wordmark[1] * 1000);

      gsap
        .timeline({ onComplete: finish })
        .to(mat, { strokeDashoffset: 0, autoRound: false, duration: INTRO.matDraw[1] - INTRO.matDraw[0], ease: EASE.stick }, INTRO.matDraw[0])
        // The silhouette appears on the mat just before it takes off.
        .to(leap, { opacity: 1, duration: DUR.tap, ease: "none" }, flightStart - DUR.tap)
        .to(leap, { motionPath: { path, align: path, alignOrigin: ALIGN_ORIGIN }, duration: flight, ease: EASE.hang }, flightStart)
        .to(ghosts, { opacity: (i: number) => GHOST_OPACITY[i]!, duration: DUR.fast, ease: "none", stagger: INTRO.ghostStagger }, firstGhostAt)
        .to(ticks, { opacity: (i: number) => tickTo[i]!, duration: DUR.fast, ease: "none", stagger: INTRO.ghostStagger }, firstGhostAt)
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
    // The pin inserts 80vh of spacing after the hero. It is created only while
    // the page rests at the top, so it never shifts a scrolled viewport, never
    // cuts off a smooth hash scroll (deep link /#raspored, a nav click during
    // the intro) and never snaps back a visitor who scrolled during the intro.
    // Otherwise it is armed the first time the page returns to the top.
    let scrollStarted = false;
    function startScrollChoreography() {
      if (scrollStarted || disposed) return;
      scrollStarted = true;
      mm.add(`${MQ.desktopFine} and ${MQ.noReduce}`, (ctx) => {
        let live = true;
        let cleanup: (() => void) | undefined;
        let stopWaiting: (() => void) | undefined;
        const arm = (ScrollTrigger: ScrollTriggerStatic) => {
          if (!live || disposed || cleanup) return;
          ctx.add(() => {
            cleanup = pinHero(ScrollTrigger, section!, decor!, visibleArt());
          });
        };
        loadScrollTrigger()
          .then((ScrollTrigger) => {
            if (!live || disposed) return;
            if (restingAtTop()) arm(ScrollTrigger);
            else stopWaiting = whenBackAtTop(() => arm(ScrollTrigger));
          })
          // The scrub is an enhancement: a failed chunk leaves the static hero.
          .catch(() => {});
        return () => {
          live = false;
          stopWaiting?.();
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
 * The page rests at the top: not scrolled, and no deep link whose target lies
 * further down (the browser may still be smooth-scrolling to it).
 */
function restingAtTop(): boolean {
  if (window.scrollY > 1) return false;
  let id = "";
  try {
    id = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return true;
  }
  if (!id || id === "top") return true;
  const target = document.getElementById(id);
  return !target || target.getBoundingClientRect().top + window.scrollY <= 1;
}

/** Calls `onTop` once, the first time the page comes back to the top after having left it. */
function whenBackAtTop(onTop: () => void): () => void {
  let left = window.scrollY > 1;
  const onScroll = () => {
    if (window.scrollY > 1) {
      left = true;
    } else if (left) {
      stop();
      onTop();
    }
  };
  const stop = () => window.removeEventListener("scroll", onScroll);
  window.addEventListener("scroll", onScroll, { passive: true });
  return stop;
}

/** Text boxes of the hero statement, relative to the section, inflated by `pad`. */
function textBoxes(section: HTMLElement, origin: DOMRect, pad: number): SpineRect[] {
  const boxes: SpineRect[] = [];
  const add = (r: DOMRect) => {
    if (r.width > 0 && r.height > 0) {
      boxes.push({
        left: r.left - origin.left - pad,
        top: r.top - origin.top - pad,
        right: r.right - origin.left + pad,
        bottom: r.bottom - origin.top + pad,
      });
    }
  };
  const range = document.createRange();
  qa<HTMLElement>(section, ".hero__eyebrow, .hero__title, .hero__sub, .hero__trust li").forEach((el) => {
    range.selectNodeContents(el);
    Array.from(range.getClientRects()).forEach(add);
  });
  qa<HTMLElement>(section, ".hero__ctas .btn").forEach((el) => add(el.getBoundingClientRect()));
  return boxes;
}

/**
 * Pins the hero for 80% of a viewport of scroll. Scrubbed: the ghost frames fade
 * one by one, then the mat line extends into the right margin, drops down it
 * and turns into the floor-exercise diagonal that leaves through the hero's
 * bottom edge toward the next section — around the text, never through it.
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

  // Route: mat end → right margin → down the margin → a 28° diagonal through
  // the empty space under the aside, out through the hero's bottom edge toward
  // the next section. It never crosses text (see spine.ts).
  const layout = () => {
    const s = section.getBoundingClientRect();
    const m = matSvg.getBoundingClientRect();
    const w = section.clientWidth;
    const h = section.offsetHeight;
    const matY = m.top + m.height / 2 - s.top;
    const matEnd = m.right - s.left;
    const inner = q<HTMLElement>(section, ".hero__inner");
    const left = inner ? parseFloat(getComputedStyle(inner).paddingLeft) + inner.getBoundingClientRect().left - s.left : 48;
    spine.setAttribute("viewBox", `0 0 ${w} ${h}`);
    line.setAttribute(
      "d",
      spinePath({
        matY,
        matEnd,
        // Hugs the content column: half the margin, at most 32px out.
        turn: matEnd + Math.min(32, (w - matEnd) / 2),
        bottom: h,
        left,
        obstacles: textBoxes(section, s, 16),
      }),
    );
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
