/**
 * The cards' exercises (D-53, D-54): each card's gymnast performs her whole exercise with the
 * scroll (lib/exercise-scrub.ts, D-52). Scrolling plays it, scrolling back rewinds it, a stopped
 * scroll holds her mid-move; the key phases she passes stay behind as ghost frames.
 *  - Trigger: the card's plate. The exercise starts when the plate's centre crosses CARD_SCRUB.from
 *    (fractions of the viewport height from its top) and is finished at CARD_SCRUB.to.
 *  - Phones/tablets (the horizontal row): a card also plays as it is swiped in. The gate is how
 *    far its plate has slid into the row's visible box from the right (slideIn), and the
 *    progress is the smaller of the two, so a card waiting off to the right stands at its start
 *    and runs through the exercise while it slides in. A card the row has passed (off to the
 *    left) stays finished, as a card scrolled up past the viewport does; swiping back rewinds
 *    the card that slides back out to the right. On the ≥1024 sheet every plate is inside the
 *    strip's box, so the gate is 1.
 * The frames are a lazy chunk of their own (./program-exercises), fetched when this arms. Until
 * then — and without it, and after a live switch to reduced motion — every card keeps the
 * server-rendered static print: the finished exercise, ghosts and final pose.
 */
import type { ApparatusIcon } from "@/content/programs";
import { scrubExercises, type ScrubScene } from "@/lib/exercise-scrub";
import { MQ } from "@/lib/motion-env";

/** The viewport lines the plate's centre crosses at the first and the last frame (D-54): she
 *  starts once the plate is nearly whole on screen (its drawing sits in its lower part, so at
 *  the bottom edge she is still below the fold) and lands before the plate reaches the middle. */
export const CARD_SCRUB = { from: 0.95, to: 0.45 } as const;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * How far a plate (left edge, width: px) has slid into a box whose right edge is `boxRight`,
 * from the right: 0 until it enters, 1 once it is wholly in — and after, when it has moved on
 * past the box's left edge.
 */
export const slideIn = (left: number, width: number, boxRight: number): number =>
  width > 0 ? clamp01((boxRight - left) / width) : 1;

export function armCardExercises(strip: HTMLElement): () => void {
  let disposed = false;
  let stop: (() => void) | null = null;
  const halt = () => {
    stop?.();
    stop = null;
  };
  const reduce = window.matchMedia(MQ.reduce);
  const onReduce = () => {
    if (reduce.matches) halt();
  };
  reduce.addEventListener("change", onReduce);

  import("./program-exercises").then(
    ({ PROGRAM_EXERCISES }) => {
      if (disposed || reduce.matches) return;
      // The row's visible box: the strip (it bleeds to the viewport's edges on phones) within the viewport.
      const boxRight = () => Math.min(strip.getBoundingClientRect().right, window.innerWidth);
      const scenes: ScrubScene[] = [];
      for (const plate of Array.from(strip.querySelectorAll<HTMLElement>("[data-program-card] .pc-plate"))) {
        const data = PROGRAM_EXERCISES[plate.dataset.apparatus as ApparatusIcon];
        const figure = plate.querySelector<SVGSVGElement>(".pc-icon svg[data-figure]");
        if (!data || !figure) continue;
        const gate = () => {
          const r = plate.getBoundingClientRect();
          return slideIn(r.left, r.width, boxRight());
        };
        scenes.push({ trigger: plate, figure, data, ...CARD_SCRUB, gate });
      }
      // The engine sets every card to its scroll position at once — a card waiting off to the
      // right of the row stands at her first frame, so no swipe shows a sliver of the finished
      // pose — and holds the cards on screen now in their static print.
      stop = scrubExercises(scenes);
    },
    // No chunk: the cards keep their finished exercise.
    () => {},
  );

  return () => {
    disposed = true;
    reduce.removeEventListener("change", onReduce);
    halt();
  };
}
