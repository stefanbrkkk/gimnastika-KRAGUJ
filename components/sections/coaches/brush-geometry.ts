/**
 * Geometry of the KR-05 brush annotation (design review AC2-01): a dry-brush loop around the
 * two coaches' heads and shoulders, built like the S7 „Medalje“ underline — five overlapping
 * strands instead of one core, each offset along the curve's normal, with staggered starts
 * and ends so the ends splay into bristles.
 *
 * Space: the 600×400 „print space“ of the 3:2 crop of photo 05 (print (x, y) = photo
 * (2x, 2y + 232)); BrushStroke/coaches.css map it onto every crop. Heads at x ≈ 295–425,
 * y ≈ 88–205.
 *
 * The hand: it touches down at about 1–2 o'clock over the background wall, runs counter-
 * clockwise over the heads (the top arc about 8 % flatter than an ellipse, the radius wobbling
 * ±3 %), comes round a little wider than it started, overshoots the start by 4 % and leaves
 * the paper along the curve's tangent (≈30 units, the strands lifting one after another).
 *
 * Pure and deterministic (no randomness), evaluated on the server: the paths are part of the
 * static markup, the complete final state without JS. Kept compact: Catmull-Rom through
 * points every 20° as relative cubic Béziers, one decimal.
 */

const DEG = Math.PI / 180;
const CX = 362;
const CY = 146;
const RX = 138;
const RY = 92;
/** Rises left → right, with the floor diagonal. */
const TILT = -6 * DEG;
/** A hand-drawn oval leans like handwriting (top to the right). */
const LEAN = -0.1;
/** Touch-down angle (counter-clockwise from 3 o'clock): about 1–2 o'clock. */
const THETA0 = 26 * DEG;
/** Overshoot past the start, as a fraction of the loop. */
export const OVERSHOOT = 0.04;
/** The flick: how far the longest bristle carries on along the tangent. */
const FLICK = 30;
const STEP = 1 / 18; // 20°

type Pt = readonly [number, number];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Centreline at loop parameter u (0 = touch-down, 1 = back at the start, 1 + OVERSHOOT = lift). */
function centre(u: number): Pt {
  const th = THETA0 + u * 2 * Math.PI;
  const wobble = 1 + 0.02 * Math.sin(2 * th + 0.7) + 0.012 * Math.sin(3 * th + 2.1);
  // Starts a little inside and comes round a little wider: the second pass never retraces the first.
  const spiral = 0.975 + 0.05 * smooth(0.72, 1 + OVERSHOOT, u);
  const s = Math.sin(th);
  const dx = RX * wobble * spiral * Math.cos(th);
  const dy = -RY * wobble * spiral * (s > 0 ? s - 0.08 * s * s : s); // flatter top arc
  const lx = dx + LEAN * dy;
  return [CX + lx * Math.cos(TILT) - dy * Math.sin(TILT), CY + lx * Math.sin(TILT) + dy * Math.cos(TILT)];
}

/** Unit tangent (direction of travel) and outward normal at u. */
function frame(u: number): { t: Pt; n: Pt } {
  const e = 1e-4;
  const a = centre(u - e);
  const b = centre(u + e);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const t: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  // Counter-clockwise on screen (y down): the outward normal is (−t.y, t.x).
  return { t, n: [-t[1], t[0]] };
}

export interface StrandSpec {
  /** Stroke width (print-space units). */
  w: number;
  /** Offset along the outward normal. */
  d: number;
  /** Touch-down, as loop parameter (staggered: the bristles land after the core). */
  u0: number;
  /** How far past the lift point this bristle carries on along the tangent (0 = lifts with the core). */
  flick: number;
  opacity: number;
  /**
   * Dry-bristle gaps as [start, length] along the strand (print units): each one thins the
   * strand to half (a static mask, so DrawSVG still owns the dash) — never a hole.
   */
  gaps?: readonly (readonly [number, number])[];
}

/**
 * Five strands, loaded core first; the widths echo the S7 underline. Only the two thinnest
 * bristles run dry (AC3-02): short gaps (1–2 units) that thin the strand to half, rare while
 * the brush is loaded, closer together as it runs dry up the right side and into the flick.
 * None on the bottom arc (≈330–600 along these strands), where the loop crosses the coaches'
 * dark shirt and jackets and any break reads as a black tick.
 */
export const STRANDS: readonly StrandSpec[] = [
  { w: 4.4, d: 0, u0: 0, flick: 4, opacity: 1 },
  { w: 3.6, d: 2.2, u0: 0.03, flick: 12, opacity: 0.95 },
  { w: 2.8, d: -2.8, u0: 0.012, flick: 19, opacity: 0.9 },
  {
    w: 2.4,
    d: 4.6,
    u0: 0.05,
    flick: FLICK,
    opacity: 0.85,
    gaps: [[120, 1], [215, 1], [290, 1.5], [615, 1.5], [652, 2], [690, 2], [728, 2]],
  },
  {
    w: 1.5,
    d: -4.9,
    u0: 0.058,
    flick: 25,
    opacity: 0.8,
    gaps: [[95, 1], [190, 1.5], [268, 1.5], [604, 1.5], [632, 2], [662, 2], [684, 2]],
  },
];

/**
 * A strand's gaps as the dash list of a mask path: dashes are the gaps (a zero dash first, and
 * a long tail so the pattern never repeats).
 */
export function gapDashes(gaps: readonly (readonly [number, number])[]): string {
  const out: number[] = [0];
  let at = 0;
  for (const [start, len] of gaps) {
    out.push(start - at, len);
    at = start + len;
  }
  out.push(2000);
  return out.join(" ");
}

/**
 * A strand's offset along the loop: brush pressure breathes (the band swells and narrows),
 * and the bristles splay where the brush lands and, more, where it lifts.
 */
function splay(u: number): number {
  const pressure = 1 + 0.22 * Math.sin(2 * Math.PI * 1.3 * u + 1);
  return pressure * (1 + 0.3 * (1 - smooth(0, 0.06, u)) + 0.55 * smooth(0.96, 1 + OVERSHOOT, u));
}

/** A point of strand `s` at loop parameter u (offset along the normal). */
function strandAt(s: StrandSpec, u: number): Pt {
  const c = centre(u);
  const { n } = frame(u);
  const off = s.d * splay(u);
  return [c[0] + n[0] * off, c[1] + n[1] * off];
}

/** The lift-off: straight on along the tangent, the bristles spreading a little more as they leave. */
function flickAt(s: StrandSpec, k: number): Pt {
  const end = 1 + OVERSHOOT;
  const c = centre(end);
  const { t, n } = frame(end);
  const spread = s.d * splay(end) * (1 + 0.5 * k);
  const along = s.flick * k;
  return [c[0] + t[0] * along + n[0] * spread, c[1] + t[1] * along + n[1] * spread];
}

function strandPoints(s: StrandSpec): Pt[] {
  const end = 1 + OVERSHOOT;
  const pts: Pt[] = [];
  for (let u = s.u0; u < end - STEP / 3; u += STEP) pts.push(strandAt(s, u));
  pts.push(strandAt(s, end));
  if (s.flick > 0) pts.push(flickAt(s, 0.5), flickAt(s, 1));
  return pts;
}

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Share of the strand's length that follows the loop (the rest is the flick), for the draw timing. */
function loopShare(s: StrandSpec): number {
  const end = 1 + OVERSHOOT;
  let loop = 0;
  let prev = strandAt(s, s.u0);
  for (let i = 1; i <= 400; i++) {
    const p = strandAt(s, s.u0 + ((end - s.u0) * i) / 400);
    loop += dist(prev, p);
    prev = p;
  }
  const flick = s.flick > 0 ? dist(prev, flickAt(s, 0.5)) + dist(flickAt(s, 0.5), flickAt(s, 1)) : 0;
  return Math.round((loop / (loop + flick)) * 1000) / 1000;
}

const r1 = (n: number) => {
  const v = Math.round(n * 10) / 10;
  return Object.is(v, -0) ? "0" : String(v);
};

/** Catmull-Rom (centripetal-free, uniform) through the points → a compact relative cubic path. */
function toPath(pts: readonly Pt[]): string {
  const first = pts[0];
  if (!first) return "";
  let d = `M${r1(first[0])} ${r1(first[1])}`;
  let [px, py] = [Math.round(first[0] * 10) / 10, Math.round(first[1] * 10) / 10];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    const q = (v: number) => Math.round(v * 10) / 10;
    const [ex, ey] = [q(p2[0]), q(p2[1])];
    d += `c${r1(q(c1[0]) - px)} ${r1(q(c1[1]) - py)} ${r1(q(c2[0]) - px)} ${r1(q(c2[1]) - py)} ${r1(ex - px)} ${r1(ey - py)}`;
    [px, py] = [ex, ey];
  }
  return d;
}

export interface Strand extends StrandSpec {
  path: string;
  /** Share of the path that follows the loop; the rest is the flick. */
  loop: number;
}

export const BRUSH_STRANDS: readonly Strand[] = STRANDS.map((s) => ({ ...s, path: toPath(strandPoints(s)), loop: loopShare(s) }));

/**
 * Where the loop crosses the pale hall wall and ceiling at the upper right (print space): the
 * only place the white needs help, so only there a soft navy under-stroke (a mask on a copy
 * of the core) keeps it legible. Elsewhere the loop runs over the navy pillar, the blue wall
 * and the coaches' hair.
 */
export const WALL = { x: 414, y: 0, w: 72, h: 150, feather: 14 } as const;
