/**
 * The floor-exercise diagonal of the desktop scrub (§4 HERO: "the mat line
 * extends and drops into a diagonal toward the next section … the page
 * spine"). Pure geometry, no DOM, no gsap — tests/hero-geometry.test.ts
 * covers it.
 *
 * Route (hero-section coordinates, px):
 *   mat end → H to the right margin (`turn`) → V down the margin → a diagonal
 *   down-left at a fixed pitch that leaves through the hero's bottom edge.
 * The drop continues just far enough that the diagonal clears every text box
 * (`obstacles`, already inflated by the caller): the line never crosses the
 * eyebrow, the H1, the subline, the CTAs or the trust strip. It slips past
 * the ragged right edge of the trust list and under the H1's last line.
 *
 * With `next` (the next section's title mark), the route runs on into that
 * section: the diagonal continues to a level floor in the empty band above
 * the section's content, runs along it to a lane beside the title, drops
 * down the lane to the title's baseline and ends at the mark — the second
 * exposure travels it and hands over to the mark's own landing.
 */

export type Pt = readonly [number, number];

export interface SpineRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SpineNext {
  /** The level floor in the band above the next section's content (y). */
  floorY: number;
  /** x of the lane beside the title where the route drops to the mark. */
  dropX: number;
  /** The end: the mark's takeoff point on the title's baseline. */
  end: Pt;
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
  /** Where the route runs on to (the next section's title mark). */
  next?: SpineNext;
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

/** The route as points (hero-section coordinates). */
export function spineRoute(input: SpineInput): Pt[] {
  const { matY, matEnd, turn, bottom, left, next } = input;
  const slope = input.slope ?? SPINE_SLOPE;
  const minRun = input.minRun ?? 32;
  const pts: Pt[] = [
    [matEnd, matY],
    [turn, matY],
  ];
  const y0 = diagonalStart(input);
  if (!next) {
    // No room left for a diagonal: the line simply drops off the bottom edge.
    if (y0 > bottom - minRun) return [...pts, [turn, bottom + 1]];
    let yEnd = bottom + 1;
    let xEnd = turn - (yEnd - y0) / slope;
    if (xEnd < left) {
      xEnd = left;
      yEnd = y0 + (turn - left) * slope;
    }
    return [...pts, [turn, y0], [xEnd, yEnd]];
  }
  // On into the next section: the diagonal (or the drop) reaches the band's
  // floor, runs level to the lane beside the title, drops to the baseline and
  // ends at the mark.
  const { floorY, dropX, end } = next;
  const start = Math.min(y0, floorY);
  const xFloor = turn - (floorY - start) / slope;
  const route: Pt[] = [...pts, [turn, start]];
  if (xFloor <= dropX) {
    // the diagonal reaches the lane before the floor: along it to the lane, then down the lane
    route.push([dropX, start + (turn - dropX) * slope]);
  } else {
    route.push([xFloor, floorY], [dropX, floorY]);
  }
  route.push([dropX, end[1]], end);
  // drop repeated points
  return route.filter((p, i) => i === 0 || Math.hypot(p[0] - route[i - 1]![0], p[1] - route[i - 1]![1]) > 0.25);
}

/**
 * The route with its corners rounded (radius r, less where a segment is
 * short): each corner becomes a quadratic arc sampled into short chords, so
 * the line and the figure riding it turn smoothly.
 */
export function roundRoute(pts: readonly Pt[], r: number, steps = 8): Pt[] {
  if (pts.length < 3) return [...pts];
  const out: Pt[] = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i]!;
    const [cx, cy] = pts[i + 1]!;
    const l1 = Math.hypot(bx - ax, by - ay);
    const l2 = Math.hypot(cx - bx, cy - by);
    const t = Math.min(r, l1 / 2, l2 / 2);
    if (t < 0.5) {
      out.push([bx, by]);
      continue;
    }
    const p0: Pt = [bx - ((bx - ax) / l1) * t, by - ((by - ay) / l1) * t];
    const p2: Pt = [bx + ((cx - bx) / l2) * t, by + ((cy - by) / l2) * t];
    for (let k = 0; k <= steps; k++) {
      const s = k / steps;
      out.push([(1 - s) ** 2 * p0[0] + 2 * s * (1 - s) * bx + s * s * p2[0], (1 - s) ** 2 * p0[1] + 2 * s * (1 - s) * by + s * s * p2[1]]);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** SVG path data of a route. */
export const routePath = (pts: readonly Pt[]): string => pts.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join("");

/** SVG path data of the spine (hero part, "M x y H turn V y0 L x1 y1" or "… V bottom"). */
export function spinePath(input: SpineInput): string {
  const { matY, matEnd, turn } = input;
  const pts = spineRoute({ ...input, next: undefined });
  const head = `M${r1(matEnd)} ${r1(matY)}H${r1(turn)}`;
  if (pts.length === 3) return `${head}V${r1(pts[2]![1])}`;
  const [, , [, y0], [x1, y1]] = pts as [Pt, Pt, Pt, Pt];
  return `${head}V${r1(y0)}L${r1(x1)} ${r1(y1)}`;
}

/** A polyline measured by arc length: the point, its direction and the segment index at distance s. */
export function measure(pts: readonly Pt[]) {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const length = acc[acc.length - 1]!;
  return {
    length,
    /** Arc length at each point. */
    at: acc as readonly number[],
    point(s: number): { x: number; y: number; dx: number; dy: number; seg: number } {
      const d = Math.min(Math.max(s, 0), length);
      let i = 1;
      while (i < acc.length - 1 && acc[i]! < d) i++;
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const segLen = acc[i]! - acc[i - 1]! || 1;
      const u = (d - acc[i - 1]!) / segLen;
      return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, dx: (b[0] - a[0]) / segLen, dy: (b[1] - a[1]) / segLen, seg: i - 1 };
    },
  };
}
