/**
 * S8 postcard stack (§4 Camp): flick the top postcard sideways (Draggable type "x"
 * + InertiaPlugin) or use the prev/next buttons (WCAG 2.5.7). Vertical page scroll
 * stays native (allowNativeTouchScrolling → touch-action: pan-y on the cards).
 * Loaded lazily by CampIsland — never part of the first-load bundle.
 *
 * Reduced motion / Save-Data: Draggable stays, without inertia; changes are instant.
 * Only transform (x, y, xPercent, yPercent, rotation, scale) and z-index change.
 *
 * The new top card lands on the pile (MI-05): it settles in from just above and sticks the
 * landing with one small squash. At ≥1024 the exits are asymmetric (RC-08): a card leaving
 * to the LEFT (a throw or „prev“) only tucks −22% of the stage and changes layer at the apex,
 * so it never crosses the text column; to the right it leaves 62% as before.
 */
import type { Draggable } from "gsap/Draggable";
import { DUR, EASE, MQ, gsap, loadDraggable, registerMotion } from "@/lib/motion";
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
  { xPercent: 22, yPercent: -8, rotation: 6 },
  { xPercent: -24, yPercent: -2, rotation: -6 },
];
const slotAt = (i: number): Slot => SLOTS[Math.min(i, SLOTS.length - 1)] ?? SLOTS[0]!;

/** Fraction of the stage width a flick must travel (or be thrown) to send the card back. */
const FLICK = 0.22;
/** Exit distances (× stage width): phones both ways; ≥1024 right / left (RC-08). */
const OUT = 1.05;
const OUT_RIGHT = 0.62;
const OUT_LEFT_WIDE = 0.22;
const TILT = 14;
/** The fan re-settles like a landing (§4 reveal token, ease stick); exits use DUR.fast (≤200 ms). */
const RESTACK = DUR.reveal;
/** ≥1024: how far left a card can be dragged at most (and never over the text; RC-08). */
const DRAG_LEFT_WIDE = 0.25;
/** The new top card's landing: from 10px above and 2% larger, contact squash at 70% of the settle. */
const LAND_FROM = { y: -10, scale: 1.02 } as const;
const CONTACT_AT = RESTACK * 0.7;

export async function armPostcards(layout: HTMLElement, { inertia }: { inertia: boolean }): Promise<PostcardsController> {
  registerMotion();
  const Draggable = await loadDraggable();
  const stage = layout.querySelector<HTMLElement>("[data-postcards]");
  const cards = stage ? Array.from(stage.querySelectorAll<HTMLElement>("[data-postcard]")) : [];
  const indexEl = layout.querySelector<HTMLElement>("[data-postcards-index]");
  const liveEl = layout.querySelector<HTMLElement>("[data-postcards-live]");
  const n = cards.length;
  if (!stage || n < 2) return { go: () => {}, destroy: () => {} };

  // Re-checked on every change, so a live switch to reduced motion makes changes instant.
  const reduce = window.matchMedia(MQ.reduce);
  const animate = () => inertia && !reduce.matches;
  const order = cards.slice();
  const width = () => stage.getBoundingClientRect().width;
  /** ≥1024 the stack stands beside the text column: left exits only tuck (RC-08). */
  const wide = window.matchMedia("(min-width: 1024px)");
  const textCol = layout.querySelector<HTMLElement>(".camp__text");
  /**
   * ≥1024: how far a card may travel left before it would touch the lead or the note
   * (16px clear, plus room for the drag tilt). Measured, so it holds at every width.
   */
  const leftRoom = (card: HTMLElement): number => {
    if (!wide.matches || !textCol) return Infinity;
    const right = Math.max(0, ...Array.from(textCol.children, (c) => c.getBoundingClientRect().right));
    const frame = (card.querySelector(".frame") ?? card).getBoundingClientRect();
    const x = Number(gsap.getProperty(card, "x")) || 0;
    return Math.max(24, frame.left - x - right - 40);
  };
  const exitLeft = (card: HTMLElement) => (wide.matches ? Math.min(width() * OUT_LEFT_WIDE, leftRoom(card)) : width() * OUT);
  const exitRight = () => width() * (wide.matches ? OUT_RIGHT : OUT);
  let tl: gsap.core.Timeline | null = null;
  let draggables: Draggable[] = [];
  /** The last throw's snap decision (a throw past the flick line leaves the stack). */
  let exiting = false;
  /** Left drag bound of the current press (≥1024: the room beside the text column). */
  let leftLimit = Infinity;
  /** A left flick counts once it covers most of the room it has (≥1024), else the usual line. */
  const flickLeft = () => Math.min(width() * FLICK, leftLimit * 0.6);

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

  /**
   * Every card to its slot; the card that changed layer gets its z-index first. The new top
   * card lands on the pile: it settles from just above, then one contact squash (EASE.land).
   */
  const restack = (timeline: gsap.core.Timeline) => {
    const at = timeline.duration(); // one start time for every card (not ">" — that chains them)
    order.forEach((card, i) => {
      timeline.set(card, { zIndex: n - i }, at);
      timeline.to(card, { ...slotAt(i), x: 0, duration: RESTACK, ease: EASE.stick }, at);
    });
    const top = order[0];
    if (!top) return;
    timeline.fromTo(
      top,
      { ...LAND_FROM, transformOrigin: "50% 100%" },
      { y: 0, scale: 1, duration: CONTACT_AT, ease: EASE.stick, immediateRender: false },
      at,
    );
    timeline.fromTo(
      top,
      { scaleX: 1.015, scaleY: 0.97 },
      { scaleX: 1, scaleY: 1, duration: DUR.base, ease: EASE.land, immediateRender: false },
      at + CONTACT_AT,
    );
  };

  const snapInstant = () => order.forEach((card, i) => gsap.set(card, { ...slotAt(i), x: 0, zIndex: n - i }));

  /** Top card → back. `thrown`: it already left the stack under the pointer. */
  const next = (thrown: boolean) => {
    const top = order.shift();
    if (!top) return;
    order.push(top);
    announce();
    if (!animate()) {
      ctx.add(snapInstant);
      return;
    }
    ctx.add(() => {
      tl = gsap.timeline({ onComplete: () => void (tl = null) });
      if (!thrown) {
        tl.to(top, { x: width() * OUT_RIGHT, rotation: slotAt(0).rotation + 10, duration: DUR.fast, ease: EASE.takeoff });
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
    if (!animate()) {
      ctx.add(snapInstant);
      return;
    }
    ctx.add(() => {
      tl = gsap.timeline({ onComplete: () => void (tl = null) });
      const out = wide.matches ? Math.min(width() * OUT_LEFT_WIDE, leftRoom(back)) : width() * OUT_RIGHT;
      tl.to(back, { x: -out, rotation: slotAt(0).rotation - 10, duration: DUR.fast, ease: EASE.takeoff });
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
        // The drag bounds (≥1024, applied on press) hold: the card stops at the text column.
        edgeResistance: 0.9,
        // A flick leaves quickly; the card never glides on off-screen.
        minDuration: 0.2,
        maxDuration: 0.5,
        cursor: "grab",
        activeCursor: "grabbing",
        onPress(this: Draggable) {
          finish();
          // ≥1024 the text column sits left of the stack: the card never covers it.
          leftLimit = wide.matches ? Math.min(width() * DRAG_LEFT_WIDE, leftRoom(card)) : Infinity;
          this.applyBounds(Number.isFinite(leftLimit) ? { minX: -leftLimit, maxX: width() * 2 } : { minX: -1e5, maxX: 1e5 });
        },
        onDrag(this: Draggable) {
          gsap.set(card, { rotation: slotAt(0).rotation + (this.x / width()) * TILT });
        },
        onThrowUpdate(this: Draggable) {
          gsap.set(card, { rotation: slotAt(0).rotation + (this.x / width()) * TILT });
        },
        ...(inertia
          ? {
              snap: {
                x: (end: number) => {
                  exiting = end < 0 ? -end > flickLeft() : end > width() * FLICK;
                  if (!exiting) return 0;
                  return end < 0 ? -exitLeft(card) : exitRight();
                },
              },
              onThrowComplete(this: Draggable) {
                // A throw past the flick line is an exit (at ≥1024 a left exit is a short tuck).
                if (exiting) next(true);
                exiting = false;
              },
            }
          : {
              onDragEnd(this: Draggable) {
                if (this.x < 0 ? -this.x > flickLeft() : this.x > width() * FLICK) next(true);
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
