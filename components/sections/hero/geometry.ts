/**
 * Parabola geometry of the share image (components/seo/art.ts — the OG still:
 * the silhouette's leap from the mat into the logo). The hero itself is drawn
 * by pass.ts (the floor pass); this module is kept for the OG image only.
 *
 * Pure math, no gsap. The art is drawn in LOGO UNITS (the logo is 490 × 213 at
 * scale 1). Each variant is one parabola (a quadratic Bézier, written as the
 * equivalent cubic) from a takeoff on the mat line to the silhouette's exact
 * position inside the logo.
 *
 * Ghost frames must sit exactly where the motion layer's
 * gsap.set(el, { motionPath: { path, align: path, alignOrigin: [.5, .6], end: p } })
 * puts them, so the no-JS/first-paint composition and the animated one match
 * to the sub-pixel. MotionPathPlugin measures a Bézier with 12 chord samples
 * (resolution 12), maps progress → t by linear interpolation between samples,
 * and aligns the element's box point (bbox.x + .5·w, bbox.y + .6·h) to the
 * path point. positionAt() reproduces that; tests/hero-geometry.test.ts
 * checks it against gsap's own path utilities.
 */
import { ALIGN_ORIGIN, GHOST_P, LEAP_BOX, LEAP_IN_LOGO } from "./constants";

type Pt = readonly [number, number];

export interface VariantSpec {
  /** viewBox width in logo units. */
  width: number;
  /** viewBox height = the mat line (the floor) in logo units. */
  mat: number;
  /** Top-left of the full logo (scale 1). Its lowest ink sits at y + 194.7. */
  logo: Pt;
  /** x of the takeoff (the silhouette's legs touch the mat). */
  takeoffX: number;
  /** Height (y) of the flight's apex, reached at t = .5. */
  apexY: number;
}

export interface ArtVariant {
  width: number;
  height: number;
  logo: Pt;
  /** Cubic path data, as parsed by gsap and the browser. */
  d: string;
  /** translate() of each ghost frame's box (GHOST_P order). */
  ghosts: Pt[];
  /** Ghost origin points on the path (for the tick marks on the mat). */
  ghostPoints: Pt[];
  /** translate() of the landed silhouette (= its position inside the logo). */
  landed: Pt;
}

const round = (v: number, digits = 2) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

/** Offset from the silhouette box's top-left to its align origin. */
const ORIGIN_DX = ALIGN_ORIGIN[0] * LEAP_BOX.width;
const ORIGIN_DY = ALIGN_ORIGIN[1] * LEAP_BOX.height;
/** The silhouette's lowest ink is 146.7 units below its box top. */
const LEGS_BELOW_ORIGIN = 146.7 - ORIGIN_DY;

/**
 * Point at progress p (0–1) on a single-subpath cubic Bézier chain, the way
 * MotionPathPlugin resolves `end: p` (resolution 12).
 * seg = [x0, y0, c1x, c1y, c2x, c2y, x1, y1, …]
 */
export function positionAt(seg: readonly number[], p: number, resolution = 12): Pt {
  const samples: number[] = [];
  let length = 0;
  let ax = seg[0]!;
  let ay = seg[1]!;
  for (let j = 2; j < seg.length; j += 6) {
    const x2 = seg[j]! - ax;
    const y2 = seg[j + 1]! - ay;
    const x3 = seg[j + 2]! - ax;
    const y3 = seg[j + 3]! - ay;
    const x4 = seg[j + 4]! - ax;
    const y4 = seg[j + 5]! - ay;
    let px = 0;
    let py = 0;
    for (let i = 1; i <= resolution; i++) {
      const t = (1 / resolution) * i;
      const inv = 1 - t;
      const nx = (t * t * x4 + 3 * inv * (t * x3 + inv * x2)) * t;
      const ny = (t * t * y4 + 3 * inv * (t * y3 + inv * y2)) * t;
      length += Math.hypot(nx - px, ny - py);
      samples.push(length);
      px = nx;
      py = ny;
    }
    ax += x4;
    ay += y4;
  }
  if (p <= 0) return [seg[0]!, seg[1]!];
  if (p >= 1) return [seg[seg.length - 2]!, seg[seg.length - 1]!];

  const target = length * p;
  let i = 0;
  while (i < samples.length - 1 && samples[i]! < target) i++;
  const min = i ? samples[i - 1]! : 0;
  const max = samples[i]!;
  const t = (1 / resolution) * ((target - min) / (max - min) + (i % resolution));
  const k = Math.floor(i / resolution) * 6;
  const inv = 1 - t;
  const bx = seg[k]!;
  const by = seg[k + 1]!;
  const x = (t * t * (seg[k + 6]! - bx) + 3 * inv * (t * (seg[k + 4]! - bx) + inv * (seg[k + 2]! - bx))) * t + bx;
  const y = (t * t * (seg[k + 7]! - by) + 3 * inv * (t * (seg[k + 5]! - by) + inv * (seg[k + 3]! - by))) * t + by;
  return [x, y];
}

/** The quadratic parabola P0 → P2 with its apex at t = .5, as an equivalent cubic. */
export function parabola(p0: Pt, p2: Pt, apexY: number): number[] {
  const qx = (p0[0] + p2[0]) / 2;
  const qy = 2 * apexY - (p0[1] + p2[1]) / 2;
  const c1: Pt = [p0[0] + (2 / 3) * (qx - p0[0]), p0[1] + (2 / 3) * (qy - p0[1])];
  const c2: Pt = [p2[0] + (2 / 3) * (qx - p2[0]), p2[1] + (2 / 3) * (qy - p2[1])];
  return [p0[0], p0[1], c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]].map((v) => round(v));
}

export function buildVariant(spec: VariantSpec): ArtVariant {
  const [lx, ly] = spec.logo;
  const landing: Pt = [lx + LEAP_IN_LOGO.x + ORIGIN_DX, ly + LEAP_IN_LOGO.y + ORIGIN_DY];
  const takeoff: Pt = [spec.takeoffX, spec.mat - LEGS_BELOW_ORIGIN];
  const seg = parabola(takeoff, landing, spec.apexY);
  const d = `M${seg[0]} ${seg[1]}C${seg.slice(2).join(" ")}`;
  const ghostPoints = GHOST_P.map((p) => positionAt(seg, p));
  const toBox = ([x, y]: Pt): Pt => [round(x - ORIGIN_DX, 3), round(y - ORIGIN_DY, 3)];
  return {
    width: spec.width,
    height: spec.mat,
    logo: spec.logo,
    d,
    ghosts: ghostPoints.map(toBox),
    ghostPoints: ghostPoints.map(([x, y]) => [round(x), round(y)] as Pt),
    landed: [lx + LEAP_IN_LOGO.x, ly + LEAP_IN_LOGO.y],
  };
}
