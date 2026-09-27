"use client";

import { useEffect } from "react";
import { motionAllowed, prefersLessMotion, whenNear } from "@/lib/motion-env";
import { belgradeNow } from "@/lib/time";
import type { PostcardsController } from "./camp-postcards";

/**
 * Tiny island of S8 (kept in the first-load bundle; no gsap here):
 * 1. hides the camp note after mount once Europe/Belgrade is past its data-until (CAMP.noteUntil, D-19);
 * 2. loads the postcard stack (gsap + Draggable/Inertia) when the section is ≤1 viewport
 *    away — or on the first prev/next click, whichever comes first;
 * 3. when motion is allowed (any device), loads the „last beam routine“ when the horizon is
 *    near: scrubbed by the scroll (MorphSVG, no ScrollTrigger; camp-beam.ts, D-60).
 */
export function CampIsland() {
  useEffect(() => {
    const layout = document.querySelector<HTMLElement>("[data-camp]");
    if (!layout) return;

    // The cutoff travels in data-until (CAMP.noteUntil) so this island never bundles content/copy.
    const note = layout.querySelector<HTMLElement>("[data-camp-note]");
    const until = note?.dataset.until;
    if (note && until && belgradeNow().ymd > until) note.hidden = true;

    let cancelled = false;
    const cleanups: (() => void)[] = [];

    // --- Postcards -------------------------------------------------------
    const stack = layout.querySelector<HTMLElement>("[data-postcards]");
    let controller: Promise<PostcardsController | null> | null = null;
    const arm = () =>
      (controller ??= import("./camp-postcards")
        .then(({ armPostcards }) => (cancelled ? null : armPostcards(layout, { inertia: !prefersLessMotion() })))
        .catch(() => null));

    if (stack && stack.querySelectorAll("[data-postcard]").length > 1) {
      cleanups.push(whenNear(stack, () => void arm()));
      const onClick = (e: MouseEvent) => {
        const btn = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-postcards-dir]") : null;
        if (!btn) return;
        const dir = btn.dataset.postcardsDir === "prev" ? -1 : 1;
        void arm().then((c) => c?.go(dir));
      };
      layout.addEventListener("click", onClick);
      cleanups.push(() => layout.removeEventListener("click", onClick));
    }

    // --- Beam → wave: the last beam routine (motion allowed, every device) ---
    const horizon = layout.querySelector<SVGSVGElement>("[data-horizon]");
    let disarmBeam: (() => void) | undefined;
    if (horizon && motionAllowed()) {
      cleanups.push(
        whenNear(horizon, () => {
          import("./camp-beam")
            .then(async ({ armBeam }) => {
              if (cancelled) return;
              const disarm = await armBeam(horizon);
              if (cancelled) disarm();
              else disarmBeam = disarm;
            })
            .catch(() => {
              /* decorative — the static wave stays */
            });
        }),
      );
    }

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      disarmBeam?.();
      void controller?.then((c) => c?.destroy());
    };
  }, []);

  return null;
}
