/**
 * S8 postcard stack (§4 Camp): flick the top postcard sideways (Draggable type "x"
 * + InertiaPlugin) or use the prev/next buttons (WCAG 2.5.7). Vertical page scroll
 * stays native (allowNativeTouchScrolling → touch-action: pan-y on the cards).
 * Loaded lazily by CampIsland — never part of the first-load bundle.
 *
 * Reduced motion / Save-Data: Draggable stays, without inertia; changes are instant.
 * Only transform (x, xPercent, yPercent, rotation) and z-index change.
 */
import type { Draggable } from "gsap/Draggable";
import { DUR, EASE, gsap, loadDraggable, registerMotion } from "@/lib/motion";
import { postcardCounter } from "./camp-copy";

export interface PostcardsController {
  /** 1 = next (top card goes to the back), -1 = previous (back card comes to the top). */
  go(dir: 1 | -1): void;
  destroy(): void;
}

interface Slot {
  xPercent: number;
  yPercent: number;
  rotation: number;
}

/** Must match `html.js .postcard[data-slot]` in styles/sections/camp.css (the pre-JS stack). */
const SLOTS: readonly Slot[] = [
  { xPercent: -7, yPercent: 1, rotation: -2 },
  { xPercent: 20, yPercent: -3, rotation: 5 },
  { xPercent: -24, yPercent: -2, rotation: -6 },
];
const slotAt = (i: number): Slot => SLOTS[Math.min(i, SLOTS.length - 1)] ?? SLOTS[0]!;

/** Fraction of the stage width a flick must travel (or be thrown) to send the card back. */
const FLICK = 0.22;
const OUT = 1.05;
const TILT = 14;

export async function armPostcards(layout: HTMLElement, { inertia }: { inertia: boolean }): Promise<PostcardsController> {
  registerMotion();
  const Draggable = await loadDraggable();
  const stage = layout.querySelector<HTMLElement>("[data-postcards]");
  const cards = stage ? Array.from(stage.querySelectorAll<HTMLElement>("[data-postcard]")) : [];
  const indexEl = layout.querySelector<HTMLElement>("[data-postcards-index]");
  const liveEl = layout.querySelector<HTMLElement>("[data-postcards-live]");
  const n = cards.length;
  if (!stage || n < 2) return { go: () => {}, destroy: () => {} };

  const animate = inertia;
  const order = cards.slice();
  const width = () => stage.getBoundingClientRect().width;
  let tl: gsap.core.Timeline | null = null;
  let draggables: Draggable[] = [];

  const ctx = gsap.context(() => {
    order.forEach((card, i) => gsap.set(card, { ...slotAt(i), x: 0, y: 0, zIndex: n - i }));
  });
  stage.setAttribute("data-armed", "");

  const finish = () => {
    if (tl) tl.progress(1);
    tl = null;
  };

  const announce = () => {
    const top = order[0];
    if (!top) return;
    const k = cards.indexOf(top) + 1;
    if (indexEl) indexEl.textContent = String(k);
    if (liveEl) liveEl.textContent = postcardCounter(k, n);
    order.forEach((card, i) => {
      card.dataset.slot = String(i);
    });
    draggables.forEach((d) => (d.target === top ? d.enable() : d.disable()));
  };

  /** Every card to its slot; the card that changed layer gets its z-index first. */
  const restack = (timeline: gsap.core.Timeline) => {
    const at = timeline.duration(); // one start time for every card (not ">" — that chains them)
    order.forEach((card, i) => {
      timeline.set(card, { zIndex: n - i }, at);
      timeline.to(card, { ...slotAt(i), x: 0, duration: DUR.reveal * 0.75, ease: EASE.stick }, at);
    });
  };

  const snapInstant = () => order.forEach((card, i) => gsap.set(card, { ...slotAt(i), x: 0, zIndex: n - i }));

  /** Top card → back. `thrown`: it already left the stack under the pointer. */
  const next = (thrown: boolean) => {
    const top = order.shift();
    if (!top) return;
    order.push(top);
    announce();
    if (!animate) {
      ctx.add(snapInstant);
      return;
    }
    ctx.add(() => {
      tl = gsap.timeline({ onComplete: () => void (tl = null) });
      if (!thrown) {
        tl.to(top, { x: width() * 0.62, rotation: slotAt(0).rotation + 10, duration: DUR.fast + 0.04, ease: EASE.takeoff });
      }
      tl.set(top, { zIndex: 0 });
      restack(tl);
    });
  };

  /** Back card → top: it slides out behind the stack, then lands on top. */
  const prev = () => {
    const back = order.pop();
    if (!back) return;
    order.unshift(back);
    announce();
    if (!animate) {
      ctx.add(snapInstant);
      return;
    }
    ctx.add(() => {
      tl = gsap.timeline({ onComplete: () => void (tl = null) });
      tl.to(back, { x: -width() * 0.62, rotation: slotAt(0).rotation - 10, duration: DUR.fast + 0.04, ease: EASE.takeoff });
      tl.set(back, { zIndex: n + 1 });
      restack(tl);
    });
  };

  ctx.add(() => {
    draggables = cards.map((card) => {
      const [d] = Draggable.create(card, {
        type: "x",
        inertia,
        allowNativeTouchScrolling: true,
        zIndexBoost: false,
        minimumMovement: 6,
        // A flick leaves quickly; the card never glides on off-screen.
        minDuration: 0.2,
        maxDuration: 0.5,
        cursor: "grab",
        activeCursor: "grabbing",
        onPress: finish,
        onDrag(this: Draggable) {
          gsap.set(card, { rotation: slotAt(0).rotation + (this.x / width()) * TILT });
        },
        onThrowUpdate(this: Draggable) {
          gsap.set(card, { rotation: slotAt(0).rotation + (this.x / width()) * TILT });
        },
        ...(inertia
          ? {
              snap: { x: (end: number) => (Math.abs(end) > width() * FLICK ? Math.sign(end) * width() * OUT : 0) },
              onThrowComplete(this: Draggable) {
                if (Math.abs(this.x) > width() * 0.5) next(true);
              },
            }
          : {
              onDragEnd(this: Draggable) {
                if (Math.abs(this.x) > width() * FLICK) next(true);
                else gsap.set(card, { x: 0, rotation: slotAt(0).rotation });
              },
            }),
      });
      return d!;
    });
  });
  announce();

  return {
    go(dir) {
      finish();
      if (dir === 1) next(false);
      else prev();
    },
    destroy() {
      finish();
      draggables.forEach((d) => d.kill());
      ctx.revert();
      stage.removeAttribute("data-armed");
    },
  };
}
