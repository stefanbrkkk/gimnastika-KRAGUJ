/**
 * S10 „Jedna zvezda, tri koraka“ — the cartwheel band, scrubbed by the scroll (plan §5.9, D-52).
 * A LAZY chunk (imported only by LeapBandPlayer). No gsap: lib/exercise-scrub.ts sets the frame.
 *
 * The band is ONE cartwheel (the enrollCartwheel exercise: cart1 → cart2 → cart3 → salute and
 * the frames between). As the reader scrolls, the flier wheels from step 1 to step 3 — each key
 * phase moved onto its step by the shifts the server wrote into the markup (data-shifts, blended
 * between keys) — and every phase she passes stays behind as its ghost. Scrolling back rewinds
 * her; a stopped scroll holds her mid-wheel. As she reaches a step its mat tick lights and its
 * numeral darkens; over step 3 she sticks the salute (a CSS squash about her feet), and the first
 * time she gets there the twelve month lamps post like a scoreboard (CSS, styles/sections/
 * enrollment.css). A band on screen when this arms keeps its static composition until it has left
 * the view once (the engine's rule), so nothing jumps under the reader's eyes.
 * It imports nothing from leap-band.ts, so the band geometry and the pose paths stay out of it.
 */
import { EXERCISE_ENROLL_CARTWHEEL as EXERCISE } from "@/components/brand/exercises/enrollCartwheel.generated";
import { keyedOffset, scrubExercises, type ScrubScene } from "@/lib/exercise-scrub";

/**
 * The cartwheel is the longest exercise on the page (31 frames): it runs while the band's centre
 * crosses from the bottom edge to 35 % from the top, so she salutes when the steps are in view.
 */
const SCRUB = { from: 1, to: 0.35 } as const;

/** The frame at which she has reached each step: moving off step 1, cart2's hands on tick 2, the salute on tick 3. */
const REACHED = [1, EXERCISE.keys[1], EXERCISE.keys[3]] as const;
const LAST = EXERCISE.frames.length - 1;

/** data-shifts: "x y,x y,…" — one shift per key, in the exercise's units. */
function readShifts(figure: SVGSVGElement): [number, number][] | null {
  const shifts = (figure.dataset.shifts ?? "").split(",").map((p) => p.trim().split(/\s+/).map(Number));
  if (shifts.length !== EXERCISE.keys.length || shifts.some((p) => p.length !== 2 || p.some((v) => !Number.isFinite(v)))) return null;
  return shifts as [number, number][];
}

/** Arms the scrub on both bands (the hidden one never runs). Returns the cleanup: the static composition. */
export function armLeap(root: HTMLElement): () => void {
  const touched = new Set<Element>();
  const scenes: ScrubScene[] = [];
  for (const band of Array.from(root.querySelectorAll<SVGSVGElement>(".en-band"))) {
    const figure = band.querySelector<SVGSVGElement>(".en-band__figure");
    const shifts = figure && readShifts(figure);
    if (!figure || !shifts) continue;
    // Per step: this band's tick (and on the narrow band its number) and the list's numeral.
    const steps = [1, 2, 3].map((n) => [
      ...Array.from(band.querySelectorAll(`.en-band__tick[data-step="${n}"], .en-band__num[data-step="${n}"]`)),
      ...Array.from(root.querySelectorAll(`.en-step[data-step="${n}"] .en-step__num`)),
    ]);
    steps.flat().forEach((el) => touched.add(el));
    touched.add(figure);
    scenes.push({
      trigger: band,
      figure,
      data: EXERCISE,
      ...SCRUB,
      offset: keyedOffset(EXERCISE.keys, shifts),
      onFrame: (frame) => {
        root.setAttribute("data-leap", "scrub");
        steps.forEach((els, i) => els.forEach((el) => el.toggleAttribute("data-reached", frame >= REACHED[i]!)));
        figure.toggleAttribute("data-stuck", frame === LAST);
        if (frame === LAST) root.setAttribute("data-posted", "");
      },
    });
  }
  const unscrub = scrubExercises(scenes);
  return () => {
    unscrub();
    root.removeAttribute("data-leap");
    root.removeAttribute("data-posted");
    touched.forEach((el) => {
      el.removeAttribute("data-reached");
      el.removeAttribute("data-stuck");
    });
  };
}
