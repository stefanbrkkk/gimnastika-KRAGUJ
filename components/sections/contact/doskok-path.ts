/**
 * Geometry of the finale flight („Poslednji skok“) — pure math, no DOM, no GSAP.
 *
 * The silhouette takes off from the S11 title's mark with a short hop (a parabola: up to
 * the apex, then straight down past the mark until it is clear of the title's glyphs),
 * and drops into a back-salto dismount through the three static ghost frames onto the
 * button. The dismount is a centripetal Catmull-Rom spline through those points (it never
 * loops or cusps); hop and spline are sampled into one polyline so a position can be
 * looked up by arc length. The timing is ballistic: a decelerating rise to the apex, then
 * an accelerating fall into the landing — except that the salto's tuck gets the time its
 * turn needs (saltoClock, CV3-02).
 */
export interface Pt {
  x: number;
  y: number;
}

export interface FlightPath {
  /** Total arc length in px. */
  length: number;
  /** Arc length at each input point (same order). */
  anchors: number[];
  /** Point at arc length s (clamped). */
  at(s: number): Pt;
}

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Centripetal Catmull-Rom (alpha .5) between p1 and p2 (Barry–Goldman). */
function catmull(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const k = (a: Pt, b: Pt) => Math.max(Math.sqrt(dist(a, b)), 1e-4);
  const t0 = 0;
  const t1 = t0 + k(p0, p1);
  const t2 = t1 + k(p1, p2);
  const t3 = t2 + k(p2, p3);
  const tt = t1 + (t2 - t1) * t;
  const a1 = lerp(p0, p1, (tt - t0) / (t1 - t0));
  const a2 = lerp(p1, p2, (tt - t1) / (t2 - t1));
  const a3 = lerp(p2, p3, (tt - t2) / (t3 - t2));
  const b1 = lerp(a1, a2, (tt - t0) / (t2 - t0));
  const b2 = lerp(a2, a3, (tt - t1) / (t3 - t1));
  return lerp(b1, b2, (tt - t1) / (t2 - t1));
}

/** A polyline looked up by arc length; `anchorAt` are sample indices of the key points. */
function polylinePath(pts: readonly Pt[], anchorAt: readonly number[]): FlightPath {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const lens: number[] = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1]! + Math.hypot(xs[i]! - xs[i - 1]!, ys[i]! - ys[i - 1]!));
  const length = lens[lens.length - 1]!;
  return {
    length,
    anchors: anchorAt.map((i) => lens[Math.min(i, lens.length - 1)]!),
    at(s: number): Pt {
      const v = Math.min(Math.max(s, 0), length);
      let lo = 0;
      let hi = lens.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (lens[mid]! < v) lo = mid;
        else hi = mid;
      }
      const span = lens[hi]! - lens[lo]! || 1;
      const t = (v - lens[lo]!) / span;
      return { x: xs[lo]! + (xs[hi]! - xs[lo]!) * t, y: ys[lo]! + (ys[hi]! - ys[lo]!) * t };
    },
  };
}

/** Samples of a centripetal Catmull-Rom spline through `points` (mirrored end tangents). */
function splineSamples(points: readonly Pt[], samplesPerSegment: number): { pts: Pt[]; anchorAt: number[] } {
  const n = points.length;
  const first = points[0]!;
  const last = points[n - 1]!;
  const ext = [lerp(points[1]!, first, 2), ...points, lerp(points[n - 2]!, last, 2)];
  const pts: Pt[] = [first];
  const anchorAt = [0];
  for (let i = 1; i < n; i++) {
    for (let j = 1; j <= samplesPerSegment; j++) pts.push(catmull(ext[i - 1]!, ext[i]!, ext[i + 1]!, ext[i + 2]!, j / samplesPerSegment));
    anchorAt.push(pts.length - 1);
  }
  return { pts, anchorAt };
}

export function buildPath(points: readonly Pt[], samplesPerSegment = 32): FlightPath {
  if (points.length < 2) throw new Error("buildPath: needs two points");
  const { pts, anchorAt } = splineSamples(points, samplesPerSegment);
  return polylinePath(pts, anchorAt);
}

/**
 * The finale's flight: a hop off the take-off point P0 — a parabola whose top is `rise` px
 * above P0, drifting linearly to `drop` (straight under the mark, clear of the title) — and
 * then the spline from `drop` through `through` (the ghost frames and the landing).
 * Anchors: [P0, apex, drop, ...through]. With rise 0 the apex is P0 (no rise).
 */
export function buildFlight(p0: Pt, rise: number, drop: Pt, through: readonly Pt[], samplesPerSegment = 32): FlightPath {
  const h = Math.max(0, rise);
  const fall = drop.y - p0.y + h; // apex → drop, px (> 0: the drop point is below the apex)
  // Parabola y(u) = p0.y − 4·h·u·(1 − u)… generalised to unequal ends: up h, down `fall`.
  // Split the hop at the apex in proportion to √height (ballistic: time ∝ √height).
  const uA = h > 0 ? Math.sqrt(h) / (Math.sqrt(h) + Math.sqrt(Math.max(fall, 1))) : 0;
  const N = 24;
  const hop: Pt[] = [];
  let apexAt = 0;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = p0.x + (drop.x - p0.x) * u;
    let y: number;
    if (u <= uA && uA > 0) {
      const v = u / uA; // 0 → 1: decelerating rise
      y = p0.y - h * (1 - (1 - v) * (1 - v));
    } else {
      const v = uA < 1 ? (u - uA) / (1 - uA) : 1; // 0 → 1: accelerating fall
      y = p0.y - h + fall * v * v;
    }
    if (u <= uA) apexAt = i;
    hop.push({ x, y });
  }
  const spline = splineSamples([drop, ...through], samplesPerSegment);
  const pts = [...hop, ...spline.pts.slice(1)];
  const anchorAt = [0, apexAt, N, ...spline.anchorAt.slice(1).map((i) => i + N)];
  return polylinePath(pts, anchorAt);
}

/**
 * Ballistic timing along the path: progress s(t) in px of arc length.
 * Rise (0 → apex) decelerates, fall (apex → landing) accelerates; `carry` keeps some
 * speed through the apex (the horizontal part of a real flight), so nothing stops dead.
 */
export interface FlightTiming {
  /** Seconds from take-off to the apex. */
  rise: number;
  /** Seconds from the apex to touchdown. */
  fall: number;
  /** Arc length at the apex. */
  apex: number;
  /** Total arc length. */
  length: number;
}

const CARRY = 0.6;
/** f(u) = c·u + (1−c)·u² — accelerating from speed c. */
const accel = (u: number) => CARRY * u + (1 - CARRY) * u * u;
const accelInv = (v: number) => (-CARRY + Math.sqrt(CARRY * CARRY + 4 * (1 - CARRY) * v)) / (2 * (1 - CARRY));
const decel = (u: number) => 1 - accel(1 - u);
const decelInv = (v: number) => 1 - accelInv(1 - v);

export function flightTiming(path: FlightPath, apexIndex: number, drop: number, rise: number, total: number): FlightTiming {
  // Ballistic split: time up ∝ √rise height, time down ∝ √(rise + drop).
  const up = rise > 0 ? Math.sqrt(Math.max(rise, 1)) : 0;
  const down = Math.sqrt(Math.max(rise + drop, 1));
  // A little quicker off the mark than pure ballistics: the take-off is a spring, not a float.
  const riseTime = (0.8 * total * up) / (up + down);
  return { rise: riseTime, fall: total - riseTime, apex: path.anchors[apexIndex] ?? 0, length: path.length };
}

/** Arc length reached at time t (seconds since take-off). */
export function progressAt(timing: FlightTiming, t: number): number {
  const { rise, fall, apex, length } = timing;
  if (t <= 0) return 0;
  if (t < rise) return apex * decel(t / rise);
  if (t < rise + fall) return apex + (length - apex) * accel((t - rise) / fall);
  return length;
}

/** Time (seconds since take-off) at which the flier reaches arc length s. */
export function timeAt(timing: FlightTiming, s: number): number {
  const { rise, fall, apex, length } = timing;
  if (s <= 0) return 0;
  if (s < apex) return rise * decelInv(s / apex);
  if (s < length) return rise + fall * accelInv((s - apex) / (length - apex));
  return rise + fall;
}

/** Arc-length speed (px/s) of the ballistic clock at time t (right-hand value at the apex). */
function speedAt(timing: FlightTiming, t: number): number {
  const { rise, fall, apex, length } = timing;
  if (t < rise) return rise > 0 ? (apex / rise) * (CARRY + 2 * (1 - CARRY) * (1 - t / rise)) : 0;
  const u = Math.min(Math.max((t - rise) / (fall || 1), 0), 1);
  return ((length - apex) / (fall || 1)) * (CARRY + 2 * (1 - CARRY) * u);
}

/** Cubic Hermite from (t0, s0, v0) to (t1, s1, v1). */
function hermite(t0: number, t1: number, s0: number, s1: number, v0: number, v1: number) {
  const h = t1 - t0;
  return (t: number) => {
    const u = (t - t0) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * s0 + (u3 - 2 * u2 + u) * h * v0 + (-2 * u3 + 3 * u2) * s1 + (u3 - u2) * h * v1;
  };
}

/**
 * The flight's clock with the salto's tuck timed by its turn, not by its arc length (CV3-02).
 *
 * On the ballistic clock the tuck (drop point → ghost 1) only gets the time its arc length
 * earns: where that arc is short next to the drop (phones ≈ 390: 77 px after a 73 px fall)
 * the 290° turn had ~160 ms, a whip. This clock gives the tuck at least `minTuck` s and
 * takes that time from what comes before it: the hop and the upright drop beside the title
 * play quicker by one factor (their ballistic shape kept — a harder spring, a shorter
 * fall), while the landing and everything from ghost 1 on keep their time, so the total
 * stays. Only below `minPace` (never quicker than that) does ghost 1 move later, the
 * open-out after it running correspondingly quicker. Through the tuck the arc position is
 * a cubic Hermite from the drop's speed to ghost 1's: C1 (no speed jump at either end) and
 * monotone (never backwards) — the salto slows through the inverted part and opens out
 * into the fall onto the button. With enough tuck time already it is the ballistic clock.
 */
export interface SaltoClock {
  /** Seconds from take-off to the apex / the drop point / ghost 1 / touchdown. */
  apex: number;
  drop: number;
  g1: number;
  land: number;
  /** Arc length reached at time t. */
  progress(t: number): number;
  /** A ballistic-clock time at or after ghost 1, on this clock (ghosts 2 and 3). */
  map(tBase: number): number;
}

export function saltoClock(timing: FlightTiming, sDrop: number, sG1: number, minTuck: number, minPace = 0.55): SaltoClock {
  const { rise, fall } = timing;
  const land = rise + fall;
  const baseDrop = timeAt(timing, sDrop);
  const baseG1 = timeAt(timing, sG1);
  if (baseG1 - baseDrop >= minTuck || !(sG1 > sDrop && baseDrop > 0 && fall > 0)) {
    return { apex: rise, drop: baseDrop, g1: baseG1, land, progress: (t) => progressAt(timing, t), map: (t) => t };
  }

  // The hop and the drop, played `pace` × their ballistic time.
  const pace = Math.max(minPace, (baseG1 - minTuck) / baseDrop);
  const drop = baseDrop * pace;
  // Ghost 1 moves only when the drop cannot give the time; it always leaves the open-out room.
  const g1 = Math.min(Math.max(baseG1, drop + minTuck), baseG1 + (land - baseG1) * 0.5);
  const squeeze = (land - baseG1) / (land - g1); // ≥ 1: the open-out's speed factor
  const unmap = (t: number) => baseG1 + (t - g1) * squeeze;

  // The tuck: from the (quickened) drop's speed to ghost 1's; a Fritsch–Carlson guard keeps
  // both end speeds in the monotone region (a no-op on every measured layout).
  const sec = (sG1 - sDrop) / (g1 - drop);
  let v0 = speedAt(timing, baseDrop) / pace;
  let v1 = speedAt(timing, baseG1) * squeeze;
  const r = Math.hypot(v0 / sec, v1 / sec);
  if (r > 3) {
    v0 = (v0 * 3) / r;
    v1 = (v1 * 3) / r;
  }
  const tuck = hermite(drop, g1, sDrop, sG1, v0, v1);

  return {
    apex: rise * pace,
    drop,
    g1,
    land,
    progress(t: number): number {
      if (t <= drop) return progressAt(timing, t / pace);
      if (t <= g1) return tuck(t);
      return progressAt(timing, unmap(t));
    },
    map: (t) => (t <= baseG1 ? t : g1 + (t - baseG1) / squeeze),
  };
}

/** Piecewise-linear value at time t through (time, value) keys sorted by time. */
export function keyed(keys: readonly (readonly [number, number])[], t: number): number {
  const first = keys[0];
  if (!first) return 0;
  if (t <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i]!;
    const [t0, v0] = keys[i - 1]!;
    if (t <= t1) return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return keys[keys.length - 1]![1];
}
