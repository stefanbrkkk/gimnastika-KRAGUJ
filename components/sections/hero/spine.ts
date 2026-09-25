/**
 * The floor-exercise diagonal of the desktop scrub (§4 HERO: "the mat line
 * extends and drops into a diagonal toward the next section"). Pure geometry,
 * no DOM, no gsap — tests/hero-geometry.test.ts covers it.
 *
 * Route (section coordinates, px):
 *   mat end → H to the right margin (`turn`) → V down the margin → a diagonal
 *   down-left at a fixed pitch that leaves through the hero's bottom edge.
 * The drop continues just far enough that the diagonal clears every text box
 * (`obstacles`, already inflated by the caller): the line never crosses the
 * eyebrow, the H1, the subline, the CTAs or the trust strip. It slips past
 * the ragged right edge of the trust list and under the H1's last line.
 */

export interface SpineRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SpineInput {
  /** y of the mat line. */
  matY: number;
  /** x where the mat line ends (the container's right edge). */
  matEnd: number;
  /** x of the vertical drop (in the right margin, right of every text box). */
  turn: number;
  /** The hero's bottom edge (the diagonal leaves through it). */
  bottom: number;
  /** Leftmost x the diagonal may reach (the container's left edge). */
  left: number;
  /** Text boxes the line must not cross (inflated by the caller). */
  obstacles: readonly SpineRect[];
  /** Pitch of the diagonal: dy / dx (tan of the angle below horizontal). */
  slope?: number;
  /** Shortest vertical run worth drawing as a diagonal; below it the line just drops. */
  minRun?: number;
}

/** 28° below horizontal — the pitch of the leotard gradient (118deg), mirrored toward the left. */
export const SPINE_SLOPE = Math.tan((28 * Math.PI) / 180);

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Does the diagonal from (turn, y0) going down-left with `slope` cross `r` before `bottom`? */
function crosses(r: SpineRect, turn: number, y0: number, bottom: number, slope: number): boolean {
  const top = Math.max(r.top, y0);
  const end = Math.min(r.bottom, bottom);
  if (top > end) return false;
  const xAtTop = turn - (top - y0) / slope;
  const xAtEnd = turn - (end - y0) / slope;
  // x decreases as y grows: the segment's x-range inside the band is [xAtEnd, xAtTop].
  return xAtEnd <= r.right && xAtTop >= r.left;
}

/** Start of the diagonal on the drop: the highest y0 from which the diagonal clears every obstacle. */
export function diagonalStart(input: SpineInput): number {
  const { matY, turn, bottom, obstacles } = input;
  const slope = input.slope ?? SPINE_SLOPE;
  let y0 = matY;
  // Each push only moves y0 down (to pass right of the obstacle at its bottom), so this converges.
  for (let pass = 0; pass <= obstacles.length; pass++) {
    let moved = false;
    for (const r of obstacles) {
      if (crosses(r, turn, y0, bottom, slope)) {
        y0 = r.bottom - (turn - r.right) * slope + 0.5;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return y0;
}

/** SVG path data of the spine. */
export function spinePath(input: SpineInput): string {
  const { matY, matEnd, turn, bottom, left } = input;
  const slope = input.slope ?? SPINE_SLOPE;
  const minRun = input.minRun ?? 32;
  const head = `M${r1(matEnd)} ${r1(matY)}H${r1(turn)}`;
  const y0 = diagonalStart(input);
  // No room left for a diagonal: the line simply drops off the bottom edge.
  if (y0 > bottom - minRun) return `${head}V${r1(bottom + 1)}`;
  let yEnd = bottom + 1;
  let xEnd = turn - (yEnd - y0) / slope;
  if (xEnd < left) {
    xEnd = left;
    yEnd = y0 + (turn - left) * slope;
  }
  return `${head}V${r1(y0)}L${r1(xEnd)} ${r1(yEnd)}`;
}
