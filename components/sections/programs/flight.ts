/**
 * The phone/tablet row's filter flight (QP4-01), as pure functions: imported only by the lazy
 * ./programs-motion chunk and by tests/programs.test.ts, never by the island.
 *
 * On the scroll-snap row a filter moves frames sideways on screen. A frame may glide there only
 * as fast as the eye can follow it: no visible frame may move more than 24px between two frames.
 * The house stick ease (cubic-bezier(.16,1,.3,1)) leaves at ≈6× its mean speed and puts about a
 * third of a 0.28s flight into the first frame, so the row glides on its own bounded ease, over a
 * time that grows with the distance, and a frame that would have to cross more of the screen than
 * that re-lands instead: it takes off where it stands and lands where it goes, like a leaver and an
 * arrival.
 */

/** Peak on-screen speed of a glide, px per ms: 14px in a 17ms frame, and still 24px in a 30ms
 *  one (a frame dropped on a busy phone). */
export const GLIDE_SPEED = 0.8;

/** The glide's ease: leaves at 4/3 of the mean speed (its peak), holds it and brakes onto the mark
 *  (slope 0 at 1). A stuck landing, without the stick ease's jump off the mark. */
export const glideEase = (p: number): number => (4 * p - p ** 4) / 3;
/** glideEase′(0), the ease's steepest slope. */
export const GLIDE_PEAK = 4 / 3;

/** Seconds a glide takes when its longest on-screen move is `reach` px, within [min, max]. */
export const glideTime = (reach: number, min: number, max: number): number =>
  Math.min(Math.max((GLIDE_PEAK * reach) / GLIDE_SPEED / 1000, min), max);

/** The longest move a glide of at most `max` seconds can make at GLIDE_SPEED. */
export const glideReach = (max: number): number => (GLIDE_SPEED * max * 1000) / GLIDE_PEAK;

export interface Span {
  left: number;
  right: number;
  top: number;
}

export interface RowMove {
  /** Where the frame stood (screen) and where it rests after the filter (screen). */
  from: Span;
  to: Span;
}

export interface Hop {
  index: number;
  dx: number;
  dy: number;
  /** Its take-off spot is on screen (it takes off there). */
  off: boolean;
  /** Its landing spot is on screen (it drops in there). */
  on: boolean;
}

/**
 * Splits the frames that stay into gliders and hoppers. `lo`/`hi` are the row's visible edges on
 * screen. A frame whose path never crosses them is unseen and ignored. A seen frame glides when its
 * move is ≤ `maxReach`, else it hops. Returns the hoppers and the longest seen glide (px), which
 * sets the glide's time (glideTime).
 */
export function planRow(moves: readonly RowMove[], lo: number, hi: number, maxReach: number): { hops: Hop[]; reach: number } {
  const seen = (l: number, r: number) => r > lo && l < hi;
  const hops: Hop[] = [];
  let reach = 0;
  moves.forEach(({ from, to }, index) => {
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    if (!seen(Math.min(from.left, to.left), Math.max(from.right, to.right))) return;
    const d = Math.hypot(dx, dy);
    if (d > maxReach) hops.push({ index, dx, dy, off: seen(from.left, from.right), on: seen(to.left, to.right) });
    else reach = Math.max(reach, d);
  });
  return { hops, reach };
}
