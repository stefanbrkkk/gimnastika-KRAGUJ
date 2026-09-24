/**
 * GSAP core + MotionPathPlugin + CustomEase (the initial animation chunk,
 * ≤45KB gz together with the hero timeline). Import this module ONLY from code
 * that is itself loaded lazily (next/dynamic ssr:false or import()) — see
 * lib/motion-env.ts. Every other plugin loads on demand via load*() below,
 * normally when its section is ≤1 viewport away (whenNear()).
 *
 * Rules: animate only transform, opacity, clip-path, stroke-dashoffset.
 * ONE primary motion per viewport. Never animate filter/backdrop-filter/box-shadow on scroll.
 * Reduced motion / saveData: no intro, pin, scrub, parallax, flips, draws; Flip is
 * instant or a 150ms crossfade; SplitText off; Draggable stays without inertia.
 */
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { EASE } from "./motion-env";

export { gsap, CustomEase, MotionPathPlugin };
export * from "./motion-env";

let registered = false;
/** Registers MotionPath + CustomEase and the named eases. Idempotent. */
export function registerMotion(): typeof gsap {
  if (!registered) {
    gsap.registerPlugin(MotionPathPlugin, CustomEase);
    CustomEase.create(EASE.stick, "M0,0 C0.16,1 0.3,1 1,1");
    CustomEase.create(EASE.takeoff, "M0,0 C0.7,0 0.84,0 1,1");
    CustomEase.create(EASE.flight, "M0,0 C0.45,0 0.55,1 1,1");
    CustomEase.create(EASE.rebound, "M0,0 C0.34,1.56 0.64,1 1,1");
    CustomEase.create(EASE.hang, "M0,0 C0.18,0.42 0.34,0.5 0.5,0.5 0.66,0.5 0.82,0.58 1,1");
    registered = true;
  }
  return gsap;
}

const cache = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load();
    cache.set(key, p);
  }
  return p;
}

/** Desktop (min-width:1024px, pointer:fine): load right after the hero intro. Elsewhere: lazily. */
export const loadScrollTrigger = () =>
  once("ScrollTrigger", async () => {
    const { ScrollTrigger } = await import("gsap/ScrollTrigger");
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    return ScrollTrigger;
  });

export const loadFlip = () =>
  once("Flip", async () => {
    const { Flip } = await import("gsap/Flip");
    gsap.registerPlugin(Flip);
    return Flip;
  });

export const loadSplitText = () =>
  once("SplitText", async () => {
    const { SplitText } = await import("gsap/SplitText");
    gsap.registerPlugin(SplitText);
    return SplitText;
  });

export const loadMorphSVG = () =>
  once("MorphSVG", async () => {
    const { MorphSVGPlugin } = await import("gsap/MorphSVGPlugin");
    gsap.registerPlugin(MorphSVGPlugin);
    return MorphSVGPlugin;
  });

export const loadDrawSVG = () =>
  once("DrawSVG", async () => {
    const { DrawSVGPlugin } = await import("gsap/DrawSVGPlugin");
    gsap.registerPlugin(DrawSVGPlugin);
    return DrawSVGPlugin;
  });

/** Draggable + InertiaPlugin (callers skip inertia under reduced motion). */
export const loadDraggable = () =>
  once("Draggable", async () => {
    const [{ Draggable }, { InertiaPlugin }] = await Promise.all([import("gsap/Draggable"), import("gsap/InertiaPlugin")]);
    gsap.registerPlugin(Draggable, InertiaPlugin);
    return Draggable;
  });

export const loadObserver = () =>
  once("Observer", async () => {
    const { Observer } = await import("gsap/Observer");
    gsap.registerPlugin(Observer);
    return Observer;
  });
