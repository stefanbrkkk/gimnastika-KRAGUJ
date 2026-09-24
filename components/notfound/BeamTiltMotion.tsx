"use client";

import { useEffect, useState } from "react";
import { motionAllowed } from "@/lib/motion-env";
import { GHOSTS, swayAt } from "./scene";
import { SETTLE_KICK, balanceTarget, createBalance, gravityAngle, isSettled, stepBalance } from "./tilt";

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

/**
 * Tilt island for the 404 scene — a lazy chunk, loaded by BeamTiltLoader on the
 * 404 only. Motion allowed only (static under reduced motion / Save-Data): a
 * one-shot wobble on load, then the upper body counter-rotates with DeviceOrientation. Android: no permission needed. iOS: a tap on
 * NOT_FOUND.enableTilt calls DeviceOrientationEvent.requestPermission().
 * One rAF loop, running only while she moves and the page is visible.
 * `label` = NOT_FOUND.enableTilt, passed from the server so content/copy.ts stays out of this chunk.
 */
export default function BeamTiltMotion({ label }: { label: string }) {
  const [askPermission, setAskPermission] = useState(false);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-nf-stage]");
    const Ctor = orientationCtor();
    if (!root || !motionAllowed()) return;
    const figure = root.querySelector<SVGGElement>("[data-nf-figure]");
    const ghosts = Array.from(root.querySelectorAll<SVGGElement>("[data-nf-ghost]"));
    if (!figure) return;

    let state = createBalance(GHOSTS.length, SETTLE_KICK);
    let target = 0;
    let raf = 0;
    let last = 0;

    const render = () => {
      figure.setAttribute("transform", swayAt(state.angle));
      // ghost 0 is the oldest frame → it follows the last lag in the chain
      ghosts.forEach((g, i) => {
        const lag = state.lags[GHOSTS.length - 1 - i] ?? state.angle;
        g.setAttribute("transform", swayAt(GHOSTS[i]!.fan + lag));
      });
    };
    const frame = (now: number) => {
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

    document.addEventListener("visibilitychange", onVisibility);
    // Listen right away: Android sends data without any prompt.
    window.addEventListener("deviceorientation", onOrientation);
    wake();
    // iOS sends nothing until a tap grants permission. Chromium also exposes
    // requestPermission, so only ask on touch devices that stayed silent for 1 s.
    const askTimer =
      typeof Ctor?.requestPermission === "function" && navigator.maxTouchPoints > 0
        ? window.setTimeout(() => {
            if (!gotData) setAskPermission(true);
          }, 1000)
        : 0;
    return () => {
      sleep();
      window.clearTimeout(askTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("deviceorientation", onOrientation);
    };
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
