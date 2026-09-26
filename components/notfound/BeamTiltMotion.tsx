"use client";

import { useEffect, useState } from "react";
import { motionAllowed } from "@/lib/motion-env";
import { swayAt } from "./sway";
import { SCORE_POST_MS, SETTLE_KICK, balanceTarget, createBalance, gravityAngle, isSettled, pointerTarget, stepBalance } from "./tilt";

type Permission = "granted" | "denied" | "default";
type OrientationCtor = { requestPermission?: () => Promise<Permission> };

const orientationCtor = (): OrientationCtor | null =>
  typeof window !== "undefined" && "DeviceOrientationEvent" in window ? (window.DeviceOrientationEvent as unknown as OrientationCtor) : null;

const screenAngle = (): number => {
  const a = typeof screen !== "undefined" ? screen.orientation?.angle : undefined;
  if (typeof a === "number") return a;
  const legacy = (window as Window & { orientation?: number }).orientation;
  return typeof legacy === "number" ? legacy : 0;
};

/** Laptops and desktops: the pointer is the balance input (DeviceOrientation stays primary where it exists). */
const FINE = "(pointer: fine)";
/** notfound.css posts the score by itself this long after first paint (a missing tilt chunk). */
const SCORE_FAILSAFE_MS = 3600;

/**
 * Tilt island for the 404 scene — a lazy chunk, loaded by BeamTiltLoader on the
 * 404 only, and only when motion is allowed (static under reduced motion / Save-Data;
 * a live switch to reduced motion unmounts it and restores the static pose):
 * 1. on load she visibly loses and catches her balance (SETTLE_KICK), swaying at the
 *    ankle of her support foot, and when the catch is over the judges' board posts 4.04
 *    (data-posted → CSS LED posting);
 * 2. then her body counter-rotates about the ankle with DeviceOrientation (Android: no
 *    permission needed; iOS: a tap on NOT_FOUND.enableTilt calls
 *    DeviceOrientationEvent.requestPermission());
 * 3. with a fine pointer she leans toward the pointer instead (pointerTarget) and
 *    rights herself when it leaves the page.
 * One rAF loop, running only while she moves and the page is visible; pointer
 * moves only store the position and wake it.
 * `label` = NOT_FOUND.enableTilt, passed from the server so content/copy.ts stays out of this chunk.
 */
export default function BeamTiltMotion({ label }: { label: string }) {
  const [askPermission, setAskPermission] = useState(false);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-nf-stage]");
    const Ctor = orientationCtor();
    if (!root || !motionAllowed()) return;
    const figure = root.querySelector<SVGGElement>("[data-nf-figure]");
    const scene = root.querySelector<SVGSVGElement>(".nf-scene");
    const score = root.querySelector<HTMLElement>("[data-nf-score]");
    if (!figure) return;

    let state = createBalance(0, SETTLE_KICK);
    let target = 0;
    let raf = 0;
    let last = 0;
    let pointerX: number | null = null;

    const render = () => figure.setAttribute("transform", swayAt(state.angle));
    const frame = (now: number) => {
      if (pointerX !== null && !gotData && scene) {
        const r = scene.getBoundingClientRect();
        target = pointerTarget(pointerX, r.left, r.width);
      }
      state = stepBalance(state, target, (now - last) / 1000);
      last = now;
      render();
      if (isSettled(state, target)) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (raf || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? sleep() : wake());
    let gotData = false;
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      if (!gotData) {
        gotData = true;
        setAskPermission(false);
      }
      const next = balanceTarget(gravityAngle(e.beta, e.gamma, screenAngle()));
      if (Math.abs(next - target) < 0.25) return;
      target = next;
      wake();
    };

    // Desktop balance: the pointer tilts her (sampled once per frame inside the loop).
    const fine = window.matchMedia(FINE).matches;
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointerX = e.clientX;
      wake();
    };
    const onPointerLeave = () => {
      pointerX = null;
      target = 0;
      wake();
    };

    // The judges post the score once the load catch is over. A late chunk (the CSS
    // failsafe already posted it at 3.6 s) shows it without replaying the posting.
    let postTimer = 0;
    if (score && !score.hasAttribute("data-posted")) {
      // The failsafe clock starts when the board is first styled (≈ first paint).
      const painted = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
      const failsafeAt = painted + SCORE_FAILSAFE_MS - 100;
      const now = performance.now();
      const at = Math.min(now + SCORE_POST_MS, failsafeAt);
      postTimer = window.setTimeout(() => score.setAttribute("data-posted", at > now ? "true" : "late"), Math.max(0, at - now));
    }

    let askTimer = 0;
    const stop = () => {
      sleep();
      window.clearTimeout(askTimer);
      window.clearTimeout(postTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      // Unmounted (e.g. a live switch to reduced motion) or failed: back to the static composition.
      figure.setAttribute("transform", swayAt(0));
    };
    try {
      document.addEventListener("visibilitychange", onVisibility);
      // Listen right away: Android sends data without any prompt.
      window.addEventListener("deviceorientation", onOrientation);
      if (fine) {
        window.addEventListener("pointermove", onPointer, { passive: true });
        document.documentElement.addEventListener("pointerleave", onPointerLeave);
      }
      wake();
      // iOS sends nothing until a tap grants permission. Chromium also exposes
      // requestPermission, so only ask on touch devices that stayed silent for 1 s.
      if (typeof Ctor?.requestPermission === "function" && navigator.maxTouchPoints > 0) {
        askTimer = window.setTimeout(() => {
          if (!gotData) setAskPermission(true);
        }, 1000);
      }
    } catch {
      // No error boundary above this optional enhancement (BeamTiltLoader): an
      // unexpected API failure must leave the static scene, never an error screen.
      stop();
      return;
    }
    return stop;
  }, []);

  const enableTilt = async () => {
    try {
      await orientationCtor()?.requestPermission?.(); // "granted" → the listener starts receiving data
    } catch {
      // not allowed here (no user activation / insecure context): stay static
    }
    setAskPermission(false);
    // the button disappears: keep focus in the page instead of dropping it on <body>
    document.getElementById("sadrzaj")?.focus({ preventScroll: true });
  };

  return askPermission ? (
    <button type="button" className="btn btn-secondary nf__tilt" onClick={enableTilt}>
      {label}
    </button>
  ) : null;
}
