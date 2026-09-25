"use client";

/**
 * Hero motion layer — loaded lazily (next/dynamic, ssr:false) right after
 * hydration. Together with gsap core + MotionPathPlugin + CustomEase this is
 * the initial animation chunk (≤45 KB gz). ScrollTrigger loads only after the
 * intro, on (min-width:1024px) and (pointer:fine).
 *
 * Intro = the FLOOR PASS (pass.ts), ≤ 1.9 s. One clock drives one render(t),
 * so the gymnast, the floor and the logo stay in step:
 *   0–.42      the mat line draws left → right (stroke-dashoffset)
 *   from ~.02  she appears in the air — a chassé bound — and plants the push
 *              foot (it never slides), the kick leg sweeps through, takeoff
 *   … ~1.1     the flight: the legs open to the split, hang at the apex,
 *              gravity brings her down onto the front toe — the logo's pose
 *   …          each ghost frame develops the instant she passes it: an
 *              exposure overshoot (+.15), then it settles (.4 s)
 *   descent    the wordmark develops in her wake: a clip edge slanted like the
 *              script trails her back toe, the whole „K“ first; from the
 *              touchdown it runs on
 *   touchdown  the stick: compress about the front toe (.94 / 1.03), then
 *              EASE.land back and hold; the floor gives 2.5 px under her
 * render(t) touches only transform, opacity, clip-path and stroke-dashoffset;
 * restore() puts every attribute back as the server rendered it, and the
 * last frame equals that composition.
 * Desktop: pin +=50%, scrub .5 — scrub.ts, a separate chunk loaded with
 * ScrollTrigger after the intro.
 */
import { useEffect } from "react";
import { EASE, MQ, gsap, loadScrollTrigger, queuePrimaryMotion, registerMotion } from "@/lib/motion";
import { ghostOpacity } from "./constants";
import {
  COMPACT_PASS,
  HIP_BACK,
  HIP_FRONT,
  PASS,
  PASS_END,
  WIDE_PASS,
  WORDMARK_INK,
  WORDMARK_LEAN,
  legAttr,
  makePass,
  matrixAttr,
  type PassSpec,
  type Pt,
} from "./pass";

type ScrollTriggerStatic = Awaited<ReturnType<typeof loadScrollTrigger>>;
type PinHero = typeof import("./scrub").pinHero;

const q = <T extends Element>(root: ParentNode, sel: string) => root.querySelector<T>(sel);
const qa = <T extends Element>(root: ParentNode, sel: string) => Array.from(root.querySelectorAll<T>(sel));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const easeOut = (s: number) => 1 - (1 - s) * (1 - s);

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

/** Records the inline style / transform of elements and writes them back exactly. */
function snapshot(els: Element[]) {
  const saved = els.map((el) => [el.getAttribute("style"), el.getAttribute("transform")] as const);
  return () =>
    els.forEach((el, i) => {
      const [style, transform] = saved[i]!;
      if (style === null) el.removeAttribute("style");
      else el.setAttribute("style", style);
      if (transform === null) el.removeAttribute("transform");
      else el.setAttribute("transform", transform);
    });
}

/** A writer that touches the DOM only when a value changes. */
function writer() {
  const last = new Map<Element, Map<string, string | null>>();
  return (el: Element, key: string, value: string | null) => {
    let m = last.get(el);
    if (!m) last.set(el, (m = new Map()));
    if (m.get(key) === value) return;
    m.set(key, value);
    if (key === "transform") {
      if (value === null) el.removeAttribute(key);
      else el.setAttribute(key, value);
    } else (el as SVGElement).style.setProperty(key, value);
  };
}

/** Wordmark clip for a developing edge (logo units at mid-height): a polygon slanted like the script. */
function wordmarkClip(edge: number): string | null {
  if (edge === Infinity) return null;
  if (edge === -Infinity) return "inset(0 100% 0 0)";
  const { x0, x1 } = WORDMARK_INK;
  const pct = (x: number) => r3(((x - x0) / (x1 - x0)) * 100);
  // the edge through (edge ± lean) at the ink box's top/bottom, run on 10 % beyond both
  const lean = WORDMARK_LEAN * 1.2;
  return `polygon(-10% -10%, ${pct(edge + lean)}% -10%, ${pct(edge - lean)}% 110%, -10% 110%)`;
}

/**
 * The floor pass of one art variant as a pure function of time: render(t),
 * and restore() (the server-rendered final composition).
 */
function floorPass(art: SVGSVGElement, decor: HTMLElement) {
  const spec = art.getAttribute("data-hero-variant") === "wide" ? WIDE_PASS : COMPACT_PASS;
  const pass = makePass(spec);
  const mat = q<SVGPathElement>(decor, "[data-hero-mat]")!;
  const matSvg = q<SVGSVGElement>(decor, ".hero-mat")!;
  const flex = q<SVGPathElement>(decor, "[data-hero-flex]")!;
  const leap = q<SVGGElement>(art, "[data-hero-leap]")!;
  const legBack = q<SVGUseElement>(leap, '[data-hero-leg="back"]')!;
  const legFront = q<SVGUseElement>(leap, '[data-hero-leg="front"]')!;
  const wordmark = q<SVGUseElement>(art, "[data-hero-wordmark]")!;
  const ghosts = qa<SVGGElement>(art, "[data-hero-ghost]");
  const ticks = qa<SVGLineElement>(art, "[data-hero-tick]");
  const restoreAttrs = snapshot([mat, flex, leap, legBack, legFront, wordmark, ...ghosts, ...ticks]);
  const flexD = flex.getAttribute("d");
  const restore = () => {
    restoreAttrs();
    if (flexD !== null) flex.setAttribute("d", flexD);
  };
  const put = writer();
  const tickTo = ticks.map((_, i) => ghostOpacity(i, ticks.length) * 2.4);
  // The floor's give is measured just before the touchdown (a resize or a turn
  // of the phone during the intro never leaves it misplaced).
  let flexGeo: ReturnType<typeof flexGeometry> | undefined;
  const stick = gsap.parseEase(EASE.stick);

  const render = (t: number) => {
    // the floor, and its give under the landing
    put(mat, "stroke-dashoffset", String(r3(1 - stick(clamp01((t - PASS.mat[0]) / (PASS.mat[1] - PASS.mat[0]))))));
    if (flexGeo === undefined && t >= spec.land - 0.05) {
      flexGeo = flexGeometry(art, matSvg, spec, pass.touchdown);
      if (flexGeo) flex.setAttribute("d", flexGeo.d);
    }
    const give = flexGeo ? flexAt((t - spec.land) / PASS.flex) : 0;
    const flexing = Math.abs(give) > 0.02;
    put(mat, "stroke-dasharray", flexing ? flexGeo!.dash : null);
    put(flex, "visibility", flexing ? "visible" : null);
    put(flex, "transform", flexing ? `translate(0 2) scale(1 ${r3(give)})` : null);
    // the gymnast
    const p = pass.pose(t);
    put(leap, "transform", matrixAttr(p.m));
    put(legBack, "transform", legAttr(p.back, HIP_BACK));
    put(legFront, "transform", legAttr(p.front, HIP_FRONT));
    put(leap, "opacity", String(r3(clamp01((t - spec.enter) / PASS.fadeIn))));
    // the shutter: each frame develops the instant she passes it — an exposure
    // overshoot, then it settles to its resting value
    spec.ghosts.forEach((at, i) => {
      const since = t - at;
      const rest = ghostOpacity(i, spec.ghosts.length);
      const peak = rest + PASS.develop;
      let o = 0;
      if (since >= PASS.developRise) o = rest + (peak - rest) * (1 - easeOut(clamp01((since - PASS.developRise) / PASS.developSettle)));
      else if (since > 0) o = peak * easeOut(since / PASS.developRise);
      put(ghosts[i]!, "opacity", String(r3(o)));
      put(ticks[i]!, "opacity", String(r3(tickTo[i]! * clamp01(since / PASS.developRise))));
    });
    // the name develops in her wake
    put(wordmark, "clip-path", wordmarkClip(pass.edge(t)));
  };

  return { render, restore, end: pass.end };
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
      const rect = section.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;
      if (!art || !q(decor, "[data-hero-mat]") || !inView || html.getAttribute("data-intro") === "done") {
        finish();
        return;
      }
      const plate = floorPass(art, decor);

      html.setAttribute("data-intro", "running");
      performance.mark("kraguj:intro-start");

      // t = 0 — set in the same frame as data-hero-ready, so nothing flashes.
      plate.render(0);
      decor.setAttribute("data-hero-ready", "");

      // The hero is the page's first primary motion: it only registers its
      // duration (never waits), so other sections' primary motions queue after it.
      void queuePrimaryMotion(PASS_END * 1000);

      const clock = { t: 0 };
      const tween = gsap.to(clock, {
        t: plate.end,
        duration: plate.end,
        ease: "none",
        onUpdate: () => plate.render(clock.t),
        onComplete: () => {
          plate.restore();
          finish();
        },
      });

      // Reverted mid-intro (reduced motion switched on, unmount): the final composition at once.
      return () => {
        tween.kill();
        plate.restore();
        if (!disposed && html.getAttribute("data-intro") === "running") finish();
      };
    });

    // Reduced motion (live change included): the static final composition.
    mm.add(MQ.reduce, () => {
      decor.setAttribute("data-hero-ready", "");
    });

    // ---- Desktop only: pin + scrub after the intro ----
    // The pin inserts 50vh of spacing after the hero. It is created only while
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
        const arm = (ScrollTrigger: ScrollTriggerStatic, pinHero: PinHero) => {
          if (!live || disposed || cleanup) return;
          ctx.add(() => {
            cleanup = pinHero(ScrollTrigger, section!, decor!, visibleArt());
          });
        };
        Promise.all([loadScrollTrigger(), import("./scrub")])
          .then(([ScrollTrigger, { pinHero }]) => {
            if (!live || disposed) return;
            const armWith = () => arm(ScrollTrigger, pinHero);
            if (restingAtTop()) armWith();
            else stopWaiting = whenBackAtTop(armWith);
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
