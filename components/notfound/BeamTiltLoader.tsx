"use client";

import { useEffect, useState, useSyncExternalStore, type ComponentType } from "react";
import { MQ, motionAllowed } from "@/lib/motion-env";

type TiltProps = { label: string };
type Tilt = ComponentType<TiltProps>;

/** Re-evaluates on a live switch of prefers-reduced-motion (the tilt then unmounts → static scene). */
const subscribeReduce = (onChange: () => void) => {
  const mq = window.matchMedia(MQ.reduce);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

/**
 * The root not-found boundary is part of the root layout's tree, so its client
 * code ships with EVERY page. This loader is all that ships; the tilt logic is a
 * separate chunk fetched only when the 404 actually renders (after hydration) AND
 * motion is allowed — reduced-motion and Save-Data visitors never download it.
 *
 * Failure isolation without an error boundary: a chunk that fails to load is
 * caught right here (the static beam scene stays, never Next's error screen), and
 * BeamTiltMotion guards its own mount. A plain import() instead of next/dynamic +
 * QuietBoundary because Turbopack copies QuietBoundary into this every-page chunk
 * (+0.24 KB gz on the home page's first load).
 */
export function BeamTiltLoader({ label }: TiltProps) {
  // Server + hydration: false. Right after hydration: whether motion is allowed.
  const motion = useSyncExternalStore(subscribeReduce, motionAllowed, () => false);
  const [tilt, setTilt] = useState<{ Component: Tilt } | null>(null);

  useEffect(() => {
    if (!motion || tilt) return;
    let live = true;
    import("./BeamTiltMotion").then(
      (m) => live && setTilt({ Component: m.default }),
      () => {}, // failed chunk (network, stale deploy): keep the static scene
    );
    return () => {
      live = false;
    };
  }, [motion, tilt]);

  return motion && tilt ? <tilt.Component label={label} /> : null;
}
