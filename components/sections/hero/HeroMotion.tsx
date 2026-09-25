"use client";

/**
 * Hero motion layer — loaded lazily (next/dynamic, ssr:false) right after
 * hydration. Together with gsap core + MotionPathPlugin + CustomEase this is
 * the initial animation chunk (≤45 KB gz). ScrollTrigger loads only after the
 * intro, on (min-width:1024px) and (pointer:fine).
 *
 * Intro = the FLOOR PASS (pass.ts), ≤ 1.9 s (PASS_END ≈ 1.66 s). One clock
 * drives one render(t), so the gymnast, the floor and the logo stay in step:
 *   0–.42     the mat line draws left → right (stroke-dashoffset)
 *   .02–.40   the gymnast runs in low along the mat: two running bounds
 *   .40–.50   the plant: push leg under the body, front leg kicks
 *   .50–1.16  the flight: the legs scissor open to the split, hang at the apex,
 *             gravity brings her down onto the front toe — the logo's pose
 *   …         each ghost frame fades in the instant she passes it (a shutter)
 *   ~.95–1.66 the wordmark wipes in behind her as she comes down
 *   1.16      touchdown: a squash about the toe and a rebound (to 1.46), a puff
 *             of chalk (≤ .38 s) and the floor giving 2.5 px under her (≤ .34 s)
 * Every frame is the same pure pose(t) that placed the server-rendered ghost
 * frames; only transform, opacity, clip-path and stroke-dashoffset change.
 * Desktop: pin +=80%, scrub .5 — ghost frames fade one by one, the mat line
 * extends and drops into the floor-exercise diagonal toward the next section
 * (routed around the text, spine.ts). The pin is created only while the page
 * rests at the top (never under a scrolled viewport or a deep link).
 */
import { useEffect } from "react";
import { EASE, MQ, gsap, loadScrollTrigger, queuePrimaryMotion, registerMotion } from "@/lib/motion";
import { CHALK, COMPACT_PASS, HIP_BACK, HIP_FRONT, PASS, PASS_END, WIDE_PASS, legAttr, makePass, matrixAttr, type PassSpec, type Pt } from "./pass";
import { spinePath, type SpineRect } from "./spine";

type ScrollTriggerStatic = Awaited<ReturnType<typeof loadScrollTrigger>>;

const SVG_NS = "http://www.w3.org/2000/svg";
const q = <T extends Element>(root: ParentNode, sel: string) => root.querySelector<T>(sel);
const qa = <T extends Element>(root: ParentNode, sel: string) => Array.from(root.querySelectorAll<T>(sel));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** The floor gives under the landing: depth (px), half-width and offset behind the toe (art units). */
const FLEX = { depth: 2.5, half: 90, behind: 40, steps: 24 } as const;

/**
 * Mat flex profile, 1 → 0 → a small rebound → 0 over s ∈ [0, 1]: the floor
 * gives fast under the impact and springs back.
 */
function flexAt(s: number): number {
  if (s <= 0 || s >= 1) return 0;
  if (s < 0.18) return Math.sin((Math.PI / 2) * (s / 0.18));
  const u = (s - 0.18) / 0.82;
  return (1 - u) ** 2 * Math.cos(1.5 * Math.PI * u);
}

/**
 * The flex as a polyline in the mat's own units (x: % of the mat's width, y: px
 * below the line), a raised-cosine trough centred a little behind the toe, cut
 * at the mat's right end; plus the dash pattern that hides the straight mat
 * under it (pathLength = 1).
 */
function flexGeometry(art: SVGSVGElement, matSvg: SVGSVGElement, spec: PassSpec, toe: Pt) {
  const a = art.getBoundingClientRect();
  const m = matSvg.getBoundingClientRect();
  if (!a.width || !m.width) return null;
  const k = a.width / spec.width;
  const toMat = (units: number) => ((a.left + units * k - m.left) / m.width) * 100;
  const xc = toMat(toe[0] - FLEX.behind);
  const w = (FLEX.half * k * 100) / m.width;
  const xa = Math.max(0, xc - w);
  const xb = Math.min(100, xc + w);
  const pts: string[] = [];
  for (let i = 0; i <= FLEX.steps; i++) {
    const x = xa + ((xb - xa) * i) / FLEX.steps;
    const y = (FLEX.depth * (1 + Math.cos((Math.PI * (x - xc)) / w))) / 2;
    pts.push(`${r3(x)} ${r3(y)}`);
  }
  return { d: `M${pts.join("L")}`, dash: `${r3(xa / 100)} ${r3((xb - xa) / 100)} 1` };
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
      const matSvg = q<SVGSVGElement>(decor, ".hero-mat");
      const flex = q<SVGPathElement>(decor, "[data-hero-flex]");
      const rect = section.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;
      if (!art || !mat || !matSvg || !flex || !inView || html.getAttribute("data-intro") === "done") {
        finish();
        return;
      }
      const spec = art.getAttribute("data-hero-variant") === "wide" ? WIDE_PASS : COMPACT_PASS;
      const pass = makePass(spec);
      const leap = q<SVGGElement>(art, "[data-hero-leap]")!;
      const legBack = q<SVGUseElement>(leap, '[data-hero-leg="back"]')!;
      const legFront = q<SVGUseElement>(leap, '[data-hero-leg="front"]')!;
      const wordmark = q<SVGUseElement>(art, "[data-hero-wordmark]")!;
      const ghosts = qa<SVGGElement>(art, "[data-hero-ghost]");
      const ticks = qa<SVGLineElement>(art, "[data-hero-tick]");
      const chalk = qa<SVGCircleElement>(art, "[data-hero-chalk] circle");
      // The resting values are the server-rendered ones (inline styles / attributes).
      const ghostTo = ghosts.map((g) => Number(g.style.opacity) || 0);
      const tickTo = ticks.map((t) => Number(t.style.opacity) || 0);
      const leapRest = leap.getAttribute("transform") ?? "";
      const flexGeo = flexGeometry(art, matSvg, spec, pass.touchdown);
      if (flexGeo) flex.setAttribute("d", flexGeo.d);
      // Chalk travels the same distance on screen in both variants.
      const chalkScale = spec.chalkR / WIDE_PASS.chalkR;
      const stick = gsap.parseEase(EASE.stick);

      let last = -1;
      const render = (t: number) => {
        // the floor
        mat.style.strokeDashoffset = String(r3(1 - stick(clamp01((t - PASS.mat[0]) / (PASS.mat[1] - PASS.mat[0])))));
        const give = flexGeo ? flexAt((t - PASS.land) / PASS.flex) : 0;
        if (Math.abs(give) > 0.02) {
          mat.style.strokeDasharray = flexGeo!.dash;
          flex.style.visibility = "visible";
          flex.setAttribute("transform", `translate(0 2) scale(1 ${r3(give)})`);
        } else if (last < 0 || flex.style.visibility === "visible") {
          mat.style.strokeDasharray = "";
          flex.style.visibility = "";
        }
        // the gymnast
        const p = pass.pose(t);
        leap.setAttribute("transform", matrixAttr(p.m));
        legBack.setAttribute("transform", legAttr(p.back, HIP_BACK));
        legFront.setAttribute("transform", legAttr(p.front, HIP_FRONT));
        leap.style.opacity = String(r3(clamp01((t - PASS.enter) / PASS.fadeIn)));
        // the shutter: each frame appears the instant she passes it
        spec.ghosts.forEach((at, i) => {
          const o = clamp01((t - at) / PASS.ghostFade);
          ghosts[i]!.style.opacity = String(r3(o * ghostTo[i]!));
          ticks[i]!.style.opacity = String(r3(o * tickTo[i]!));
        });
        // the wordmark, revealed behind her
        wordmark.style.clipPath = `inset(0% ${r3((1 - pass.wipe(t)) * 100)}% 0% 0%)`;
        // chalk off the mat at the touchdown
        CHALK.forEach(([dir, dist, , delay], i) => {
          const s = (t - PASS.land - delay) / (PASS.chalk - delay);
          const c = chalk[i]!;
          if (s <= 0 || s >= 1) {
            c.style.opacity = "0";
            return;
          }
          const d = dist * chalkScale * (1 - (1 - s) ** 3);
          const a = (dir * Math.PI) / 180;
          c.setAttribute("transform", `translate(${r3(Math.cos(a) * d)} ${r3(Math.sin(a) * d - 10 * chalkScale * s)})`);
          c.style.opacity = String(r3(0.85 * (s < 0.12 ? s / 0.12 : 1 - (s - 0.12) / 0.88)));
        });
        last = t;
      };

      // Back to the server-rendered final composition.
      const rest = () => {
        mat.style.strokeDashoffset = "";
        mat.style.strokeDasharray = "";
        flex.style.visibility = "";
        flex.removeAttribute("transform");
        leap.setAttribute("transform", leapRest);
        leap.style.opacity = "";
        legBack.removeAttribute("transform");
        legFront.removeAttribute("transform");
        ghosts.forEach((g, i) => (g.style.opacity = String(ghostTo[i])));
        ticks.forEach((l, i) => (l.style.opacity = String(tickTo[i])));
        wordmark.style.clipPath = "";
        chalk.forEach((c) => {
          c.style.opacity = "";
          c.removeAttribute("transform");
        });
      };

      html.setAttribute("data-intro", "running");
      performance.mark("kraguj:intro-start");

      // t = 0 — set in the same frame as data-hero-ready, so nothing flashes.
      render(0);
      decor.setAttribute("data-hero-ready", "");

      // The hero is the page's first primary motion: it only registers its
      // duration (never waits), so other sections' primary motions queue after it.
      void queuePrimaryMotion(PASS_END * 1000);

      const clock = { t: 0 };
      gsap.to(clock, {
        t: PASS_END,
        duration: PASS_END,
        ease: "none",
        onUpdate: () => render(clock.t),
        onComplete: () => {
          rest();
          finish();
        },
      });

      // Reverted mid-intro (reduced motion switched on): the final composition at once.
      return () => {
        rest();
        if (!disposed && html.getAttribute("data-intro") === "running") finish();
      };
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
 * one by one while the mat line extends into the right margin, drops down it
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

  // Oldest frames decay first, like afterimages. The diagonal grows out of the
  // mat's right end (under the logo) from the first wheel tick and reaches the
  // hero's bottom edge exactly at the pin's end.
  const ghosts = qa<SVGGElement>(art, "[data-hero-ghost]");
  const ticks = qa<SVGLineElement>(art, "[data-hero-tick]");
  const tl = gsap
    .timeline({ defaults: { ease: "none" } })
    .to(ghosts, { opacity: 0, duration: 0.2, stagger: 0.09 }, 0)
    .to(ticks, { opacity: 0, duration: 0.2, stagger: 0.09 }, 0)
    .fromTo(line, { strokeDashoffset: 1 }, { strokeDashoffset: 0, autoRound: false, duration: 1 }, 0);

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
