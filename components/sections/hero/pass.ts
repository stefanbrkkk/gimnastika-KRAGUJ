/**
 * FLOOR PASS — the hero's choreography as pure math (no DOM, no gsap).
 *
 * One function, pose(t), is shared by the server composition (HeroArt: every
 * ghost frame is the gymnast at one shutter time) and the motion layer
 * (HeroMotion: the same pose every frame), so the no-JS frame and the animated
 * one match by construction — a chronophotograph of one real motion.
 *
 * The pass, like a leap pass on the floor: running strides with the legs
 * alternating (the far corner of the diagonal, so she grows a little), the
 * plant on the push leg while the kick leg brushes through, a ballistic flight
 * in which the legs open to the full split and hang at the apex, and the
 * landing on the front toe — which is exactly the logo's pose: the club's
 * gymnast is caught at the instant she touches down. The landing sticks
 * (EASE.land: compress about the toe, hold), never bounces.
 *
 * Physics that keep it athletic: the centre of mass moves on one smooth
 * horizontal speed curve from the first stride to the takeoff (it dips a
 * little under each planted foot, never stalls — only the vertical push is
 * impulsive); a planted foot never slides (the stance leg is solved for, the
 * body compresses over it); the takeoff speed is exactly the flight's.
 *
 * The rig: the logo's silhouette is not redrawn. Three clipped copies of the
 * same #leap symbol (torso, back leg, front leg) make the body; each leg turns
 * about a ball joint — a disc of ink inscribed in the thigh where it leaves
 * the pelvis (inside the logo's own ink, so at rest nothing changes). The
 * cut between torso and leg runs along two radii of that disc, so every cut
 * edge stays under the disc at any angle and the thigh's contour meets the
 * disc tangentially: a clean round hip, no notch, no lump. With both legs at
 * 0° the pieces are the logo, exactly.
 *
 * Units: art units = logo units (the logo is 490 × 213 at scale 1). A pose is
 * a matrix for the 230 × 150 silhouette box plus the two leg angles (degrees,
 * clockwise, 0 = the logo). y grows downwards.
 */
import { LEAP_IN_LOGO } from "./constants";

export type Pt = readonly [number, number];
/** SVG matrix(a b c d e f). */
export type Matrix = readonly [number, number, number, number, number, number];

export interface Pose {
  m: Matrix;
  /** Back-leg angle about HIP_BACK (deg). */
  back: number;
  /** Front-leg angle about HIP_FRONT (deg). */
  front: number;
}

// ---------------------------------------------------------------------------
// The rig, in silhouette-box coordinates (the #leap symbol box, 230 × 150)
// ---------------------------------------------------------------------------

/** Centre of mass (the pelvis). */
export const COM: Pt = [112, 118];
/** Ball joints: the centre of the disc inscribed in each thigh at the pelvis (measured on the logo's ink). */
export const HIP_BACK: Pt = [92.5, 126.25];
export const HIP_FRONT: Pt = [131, 125.1];
/** The toes (the far end of each leg); the front toe is the silhouette's lowest ink = the touchdown. */
export const TOE_BACK: Pt = [2.1, 108.2];
export const TOE_FRONT: Pt = [222.7, 146.7];

/**
 * The legs' clip regions (box coordinates): a wedge from each joint along the
 * two radii to where its disc touches the thigh's edges (measured on the
 * logo's ink), closed around the leg — clear of the arms and the other leg.
 */
export const BACK_WEDGE: readonly Pt[] = [HIP_BACK, [93.85, 100], [-30, 100], [-30, 165], [85.65, 165]];
export const FRONT_WEDGE: readonly Pt[] = [HIP_FRONT, [141.2, 100], [270, 100], [270, 165], [123.2, 165]];
const pathOf = (pts: readonly Pt[]) => `M${pts.map(([x, y]) => `${x} ${y}`).join("L")}Z`;
const BACK_CUT = pathOf(BACK_WEDGE);
const FRONT_CUT = pathOf(FRONT_WEDGE);

/**
 * Clip regions of the three pieces (box coordinates) and the joint discs
 * [cx, cy, r] drawn as ink with the torso. Each leg region is a wedge from its
 * joint along the two radii to the points where the disc touches the thigh's
 * edges, closed around the leg (clear of the arms and the other leg); the
 * torso is everything else (even-odd). The discs sit 0.1 inside the ink.
 */
export const RIG = {
  torso: `M-40-40H280V190H-40Z${BACK_CUT}${FRONT_CUT}`,
  back: BACK_CUT,
  front: FRONT_CUT,
  joints: [
    [HIP_BACK[0], HIP_BACK[1], 8.9],
    [HIP_FRONT[0], HIP_FRONT[1], 9.8],
  ],
} as const;

// ---------------------------------------------------------------------------
// Math
// ---------------------------------------------------------------------------

const RAD = Math.PI / 180;
const lerp = (a: number, b: number, s: number) => a + (b - a) * s;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (s: number) => s * s * (3 - 2 * s);
const easeOut = (s: number, p = 2) => 1 - (1 - s) ** p;

/** Cubic Hermite on u ∈ [0, 1]: end values p0, p1 and end slopes m0, m1 (per unit u). */
function hermite(p0: number, m0: number, p1: number, m1: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (3 * u2 - 2 * u3) * p1 + (u3 - u2) * m1;
}

/** Matrix mapping box point P to world point A, rotated r° and scaled (sx, sy) about P. */
function about(P: Pt, A: Pt, r: number, sx: number, sy: number): [number, number, number, number, number, number] {
  const c = Math.cos(r * RAD);
  const s = Math.sin(r * RAD);
  const a = c * sx;
  const b = s * sx;
  const cc = -s * sy;
  const d = c * sy;
  return [a, b, cc, d, A[0] - (a * P[0] + cc * P[1]), A[1] - (b * P[0] + d * P[1])];
}

/**
 * EASE.land — the CustomEase "M0,0 C0.22,1.12 0.36,1 1,1" registered by
 * lib/motion.ts (compress and hold, ≤ 3 % overshoot), solved here without gsap
 * so the server composition and the tests share it (tests compare it to gsap's).
 */
export function landEase(x: number): number {
  let s = x;
  for (let k = 0; k < 8; k++) {
    const fx = 3 * (1 - s) ** 2 * s * 0.22 + 3 * (1 - s) * s * s * 0.36 + s ** 3 - x;
    const dx = 3 * (1 - s) ** 2 * 0.22 + 6 * (1 - s) * s * (0.36 - 0.22) + 3 * s * s * (1 - 0.36);
    s = clamp01(s - fx / dx);
  }
  return 3 * (1 - s) ** 2 * s * 1.12 + 3 * (1 - s) * s * s + s ** 3;
}

export const apply = (m: Matrix, p: Pt): Pt => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

/** p turned deg° about joint j. */
export function turn(p: Pt, j: Pt, deg: number): Pt {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  const x = p[0] - j[0];
  const y = p[1] - j[1];
  return [j[0] + x * c - y * s, j[1] + x * s + y * c];
}

const LEGS = {
  back: { hip: HIP_BACK, toe: TOE_BACK },
  front: { hip: HIP_FRONT, toe: TOE_FRONT },
} as const;
type Leg = keyof typeof LEGS;

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export interface PassSpec {
  /** viewBox width (art units). */
  width: number;
  /** viewBox height = the mat line. */
  mat: number;
  /** Top-left of the full logo. Its lowest ink sits at y + 194.7. */
  logo: Pt;
  /** She appears (fades in) at `enter` in the air — the top of a chassé bound — centre of mass at `enterX`. */
  enter: number;
  enterX: number;
  /** The push foot (the logo's back leg) lands under her … */
  plant: number;
  /** … and leaves the floor: the takeoff. */
  launch: number;
  /** Horizontal speed at the entry (units/s); it rises smoothly to the takeoff speed the flight needs. */
  runSpeed: number;
  /** Share of the speed lost at the middle of the plant (0 = none). */
  dip: number;
  /** Height of the bound above its landing (the centre of mass at the entry). */
  hop: number;
  /**
   * The chassé's glide (optional): from this time the push toe skims the mat
   * into the plant. The bound's tail is lowered by the toe's clearance (eased
   * in over BRUSH_IN before it), so the foot that reads as planted — the leg under her,
   * pointed down — is on the floor, never a hair above it. The plant's solve
   * is unchanged; only the height of the approach changes.
   */
  brush?: number;
  /**
   * Where the push toe stands (optional): this many units above the mat line's
   * centre, so its tip sits on the line's upper edge rather than half into it
   * (the mat is 1.5 px at any scale; the logo's own toe stands 1.3 units above).
   */
  stand?: number;
  /** Forward lean in the bound (deg) and at the takeoff. */
  lean: number;
  launchLean: number;
  /** The push leg's angle at contact (deg forward of vertical). */
  reach: number;
  /** Depth scale at the entry and at the takeoff (the far corner of the diagonal → full size) … */
  depth: readonly [number, number];
  /** … and the flight progress by which she is full size (she comes toward the camera). */
  fullSizeBy: number;
  /** Touchdown time (s). */
  land: number;
  /** Height of the flight above the straight launch → landing line. */
  lift: number;
  /** Apex hang: time-warp amplitude of the flight (0 = pure ballistics). */
  hang: number;
  /** Pitch with the flight path (share of the path's slope, 0–1). */
  pitch: number;
  /** The shutter times of the ghost frames (oldest first). */
  ghosts: readonly number[];
}

/**
 * Leg angles (world, degrees forward of straight down) in the chassé bound:
 * the kick leg leads, the push leg trails and swings under her to plant.
 * The legs never cross — rigid legs cannot fold past each other.
 */
const BOUND = { kick: 68, trail: -66, kickPlant: 82 } as const;
/** The speed dip at the plant begins this long before the foot lands (s). */
const DIP_LEAD = 0.05;
/** Most the body compresses (or stretches) over the planted foot, in units of height. */
const SQUASH_UNITS = 6;
/** The kick leg's highest point after the takeoff (rig angle, deg). */
const KICK = -24;
/** The glide (PassSpec.brush) eases the bound's tail down onto the push toe over this long (s). */
const BRUSH_IN = 0.1;

/**
 * Timing shared by both variants (s from the intro start).
 * The intro ends at PASS_END ≤ 1.9 s (§7).
 */
export const PASS = {
  /** The mat line draws left → right. */
  mat: [0, 0.42],
  /** The gymnast fades in over this. */
  fadeIn: 0.1,
  /** The stick: compress about the toe (in), then EASE.land back to rest and hold. */
  stickIn: 0.07,
  stickOut: 0.26,
  /** Each ghost frame develops the instant she passes it: exposure overshoot to rest + `develop`, then it settles. */
  develop: 0.15,
  developRise: 0.06,
  developSettle: 0.4,
  /** The wordmark keeps developing this long after the touchdown. */
  wipeAfter: 0.42,
  /** The mat flex under the landing. */
  flex: 0.34,
} as const;

/** Landing squash (the brand's squash tokens, about the front toe). */
export const STICK = { sx: 1.03, sy: 0.94 } as const;

/**
 * Phones and portrait tablets: one chassé bound from the left, the plant, a
 * high leap over the „K“, landing in a logo that fills the right 61 %. The
 * bound starts whole inside the frame (never a fragment at the viewport
 * edge); the apex keeps its raised hand ≥ 37 units (≥ 16 px) below the art's
 * top, clear of the floating header's shadow. Container 350 px → 1 unit ≈ .44 px.
 * Five frames: the bound, the takeoff and three in flight — the rise, the
 * apex and the descent — each ≥ .7 of the figure's width from the next by x,
 * so the exposures read one by one at phone size (four in flight knotted
 * together around the apex).
 */
export const COMPACT_PASS: PassSpec = {
  width: 800,
  mat: 440,
  logo: [800 - 490, 440 - 196],
  enter: 0.04,
  enterX: 62,
  plant: 0.2,
  launch: 0.255,
  runSpeed: 700,
  dip: 0.3,
  hop: 8,
  lean: 8,
  launchLean: -4,
  reach: 16,
  depth: [0.5, 0.58],
  fullSizeBy: 0.92,
  land: 1.1,
  lift: 230,
  hang: 0.22,
  pitch: 0.2,
  ghosts: [0.05, 0.24, 0.385, 0.62, 0.935],
};

/**
 * Landscape ≥ 640 px and desktop: the long pass across the band above the
 * headline. Container 1320 px → 1 unit = .8 px.
 */
export const WIDE_PASS: PassSpec = {
  width: 1650,
  mat: 256,
  logo: [1650 - 490, 256 - 196],
  enter: 0.02,
  enterX: 50,
  plant: 0.25,
  launch: 0.3,
  runSpeed: 1350,
  dip: 0.3,
  hop: 14,
  // the push toe is on the mat from the takeoff ghost (.187) on: the low, long bound would
  // otherwise skim 2–3 units (≈ 2 px) above it for the last 60 ms before the plant
  brush: 0.185,
  // on the mat's upper half: ≤ .5 px into the 1.5 px line from 1024 (.56 px/unit) up
  stand: 0.6,
  lean: 8,
  launchLean: -3,
  reach: 22,
  depth: [0.8, 0.9],
  fullSizeBy: 0.55,
  land: 1.06,
  lift: 72,
  hang: 0.18,
  pitch: 0.2,
  ghosts: [0.057, 0.187, 0.298, 0.42, 0.555, 0.7],
};

/** The intro's last motion ends here (§7: ≤ 1.9 s): the later of the two variants. */
export const PASS_END = Math.max(COMPACT_PASS.land, WIDE_PASS.land) + PASS.wipeAfter;

// ---------------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------------

/** The wordmark's ink box inside the logo (logo units; getBBox of #wordmark): its clip-path box. */
export const WORDMARK_INK = { x0: 10.77, y0: 19.09, x1: 335.4, y1: 194.72 } as const;
/** The developing edge leans like the script (tan 17° ≈ .3): its half-run over the ink height. */
export const WORDMARK_LEAN = (0.3 * (WORDMARK_INK.y1 - WORDMARK_INK.y0)) / 2;
/**
 * The whole „K“ is inside the edge once it (at mid-height) reaches here. The
 * name starts developing with its whole first letter — never a lone sliver of
 * the stem floating on the mat.
 */
const FIRST_LETTER = 95;

export interface Pass {
  pose(t: number): Pose;
  /** The silhouette's position inside the logo (= translate of the landed figure). */
  landed: Pt;
  /** The front toe's touchdown point (mat flex). */
  touchdown: Pt;
  /** The intro's last motion ends here. */
  end: number;
  /** The back toe (world) at time t — the wordmark's developing edge trails it. */
  backToe(t: number): Pt;
  /**
   * The wordmark's developing edge at time t (logo units, at mid-height; it
   * leans by WORDMARK_LEAN): −∞ = nothing yet, +∞ = the whole name. It trails
   * the back toe, so the name only appears where she has already passed, and
   * runs on from the touchdown.
   */
  edge(t: number): number;
}

interface Body {
  x: number;
  y: number;
  lean: number;
  d: number;
  sx: number;
  sy: number;
}

const matrixOf = (b: Body): Matrix => about(COM, [b.x, b.y], b.lean, b.d * b.sx, b.d * b.sy);
/** The toe of `leg` turned `rig`° about its joint, relative to the centre of mass (box units). */
function toeVec(leg: Leg, rig: number): Pt {
  const L = LEGS[leg];
  const p = turn(L.toe, L.hip, rig);
  return [p[0] - COM[0], p[1] - COM[1]];
}
/** World offset of a box vector for a body (lean, depth, squash). */
function worldVec(b: Body, v: Pt): Pt {
  const c = Math.cos(b.lean * RAD);
  const s = Math.sin(b.lean * RAD);
  const x = v[0] * b.d * b.sx;
  const y = v[1] * b.d * b.sy;
  return [c * x - s * y, s * x + c * y];
}
/** Rig angle of `leg` whose toe points `deg` forward of straight down in the world, for a body leaning `lean`. */
function rigFor(leg: Leg, deg: number, lean: number): number {
  const L = LEGS[leg];
  const rest = Math.atan2(L.toe[1] - L.hip[1], L.toe[0] - L.hip[0]) / RAD;
  const a = 90 - deg - lean - rest;
  return a - 360 * Math.round(a / 360);
}

export function makePass(spec: PassSpec): Pass {
  const [lx, ly] = spec.logo;
  const landed: Pt = [lx + LEAP_IN_LOGO.x, ly + LEAP_IN_LOGO.y];
  const rest: Matrix = [1, 0, 0, 1, landed[0], landed[1]];
  const touchdown = apply(rest, TOE_FRONT);
  const landCom = apply(rest, COM);
  const { enter, plant, launch } = spec;
  /** The push toe's floor (the plant, the glide). */
  const mat = spec.mat - (spec.stand ?? 0);
  const flightT = spec.land - launch;
  const hold = launch - plant;

  // ---- Horizontal: one smooth speed curve from the entry to the takeoff ----
  // v(t) eases from runSpeed to the takeoff speed and dips (sin²) under the
  // planted foot. The takeoff speed is the flight's initial speed; it depends
  // on where the takeoff lands, so it is found by a fixed-point iteration.
  const dt = 1 / 2000;
  const n = Math.ceil((launch - enter) / dt);
  const xs = new Float64Array(n + 1);
  // (the dip starts a little before the foot lands, so it spreads over six frames at 60 fps)
  const dipFrom = plant - DIP_LEAD;
  const dipAt = (t: number) => (t > dipFrom && t < launch ? spec.dip * Math.sin((Math.PI * (t - dipFrom)) / (launch - dipFrom)) ** 2 : 0);
  let vLaunch = spec.runSpeed;
  for (let k = 0; k < 40; k++) {
    const v = (t: number) => lerp(spec.runSpeed, vLaunch, smooth((t - enter) / (launch - enter))) * (1 - dipAt(t));
    xs[0] = spec.enterX;
    for (let i = 1; i <= n; i++) {
      const t = enter + i * dt;
      xs[i] = xs[i - 1]! + ((v(t - dt) + v(t)) / 2) * dt;
    }
    vLaunch = ((landCom[0] - xs[n]!) * (1 + spec.hang)) / flightT;
  }
  const xAt = (t: number) => {
    const f = clamp01((t - enter) / (launch - enter)) * n;
    const i = Math.min(n - 1, Math.floor(f));
    return lerp(xs[i]!, xs[i + 1]!, f - i);
  };

  // ---- Ground phase: lean and depth ----
  const leanAt = (t: number) => lerp(spec.lean, spec.launchLean, smooth(clamp01((t - plant) / hold)));
  const depthAt = (t: number) => lerp(spec.depth[0], spec.depth[1], clamp01((t - enter) / (launch - enter)));
  const bodyAt = (t: number, y: number, sy = 1): Body => ({ x: xAt(t), y, lean: leanAt(t), d: depthAt(t), sx: 1 + (1 - sy) * 0.5, sy });

  // ---- The plant: the push foot never slides ----
  // At contact the push leg reaches `reach`° ahead of vertical; that fixes the
  // contact point. The centre of mass runs on one smooth curve from the bound's
  // descent into the flight's rise (no bump at the takeoff); the push leg is
  // solved so its toe stays on the contact point, and the body compresses over
  // it (scale y) so the toe stays on the mat.
  const b0 = bodyAt(plant, 0);
  const rig0 = rigFor("back", spec.reach, b0.lean);
  const footX = b0.x + worldVec(b0, toeVec("back", rig0))[0];
  /** The push leg's rig angle that puts its toe at footX (it sweeps back, clockwise, as she passes over it). */
  function legFor(t: number, sy: number): number {
    const b = bodyAt(t, 0, sy);
    let lo = rig0 - 15;
    let hi = rig0 + 85;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (b.x + worldVec(b, toeVec("back", mid))[0] > footX) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }
  const heightFor = (t: number, rig: number) => mat - worldVec(bodyAt(t, 0), toeVec("back", rig))[1];
  const contactY = heightFor(plant, rig0);
  const launchRig = legFor(launch, 1);
  const launchY = heightFor(launch, launchRig);
  // The bound: its top at the entry, landing on the push toe at the plant. The push leg swings
  // under her on a Hermite from the trail to the contact angle (the leg track below, keys 0–1).
  const trailRig = rigFor("back", BOUND.trail, spec.lean);
  const boundRig = (t: number) => hermite(trailRig, 0, rig0, 0, clamp01((t - enter) / (plant - enter)));
  const hopY = (t: number) => {
    const u = (plant - t) / (plant - enter);
    return contactY - spec.hop * (2 * u - u * u);
  };
  /** The push toe's clearance above the mat in the plain bound. */
  const clearance = (t: number) => mat - hopY(t) - worldVec(bodyAt(t, 0), toeVec("back", boundRig(t)))[1];
  // The glide: from `brush` the bound is lowered by exactly that clearance, so the toe skims the
  // mat into the plant and meets it where it did. Before, the lowering eases in on a Hermite that
  // joins it with the same slope (no kick in her fall), never more than the clearance (never
  // below the floor).
  const brush = spec.brush;
  const brushAt = brush === undefined ? 0 : clearance(brush);
  const brushRate = brush === undefined ? 0 : ((clearance(brush + 1e-4) - clearance(brush - 1e-4)) / 2e-4) * BRUSH_IN;
  function boundY(t: number): number {
    const y = hopY(t);
    if (brush === undefined || t <= brush - BRUSH_IN) return y;
    if (t >= brush) return y + clearance(t);
    return y + Math.min(clearance(t), hermite(0, 0, brushAt, brushRate, (t - (brush - BRUSH_IN)) / BRUSH_IN));
  }
  // vertical speeds: the bound's descent onto the foot (measured, with a glide), the flight's rise off it
  const vyIn = brush === undefined ? (2 * spec.hop) / (plant - enter) : (boundY(plant) - boundY(plant - 1e-4)) / 1e-4;
  const vyOut = ((landCom[1] - launchY - 4 * spec.lift) * (1 + spec.hang)) / flightT;
  // The body over a rigid leg would ride an arc (an inverted pendulum); the
  // centre of mass follows that arc plus a smooth correction that joins the
  // bound's descent to the flight's rise: the compression, then the push.
  const pendulum = (t: number) => heightFor(t, legFor(t, 1));
  const vPend = (t: number) => (pendulum(t + 1e-4) - pendulum(t - 1e-4)) / 2e-4;
  // The correction is limited to what a believable squash absorbs (≤ SQUASH_UNITS
  // of the leg's height): beyond that the push stays a little impulsive.
  let dIn = (vyIn - vPend(plant + 1e-4)) * hold;
  let dOut = (vyOut - vPend(launch - 1e-4)) * hold;
  let peak = 0;
  for (let u = 0; u <= 1; u += 0.05) peak = Math.max(peak, Math.abs(hermite(0, dIn, 0, dOut, u)));
  const give = Math.min(1, (SQUASH_UNITS * spec.depth[1]) / (peak || 1));
  dIn *= give;
  dOut *= give;
  function stance(t: number): { rig: number; y: number; sy: number } {
    const y = pendulum(t) + hermite(0, dIn, 0, dOut, clamp01((t - plant) / hold));
    const lean = leanAt(t) * RAD;
    let sy = 1;
    let rig = rig0;
    for (let k = 0; k < 4; k++) {
      rig = legFor(t, sy);
      const b = bodyAt(t, y, sy);
      const v = toeVec("back", rig);
      // the toe's height: sin(lean)·x′ + cos(lean)·y′, y′ = v.y·d·sy — solve for sy (a push-off may lift the toe early)
      sy = Math.min(1.1, Math.max(0.88, (mat - y - Math.sin(lean) * v[0] * b.d * b.sx) / (Math.cos(lean) * v[1] * b.d)));
    }
    return { rig, y, sy };
  }
  const rate = (t: number) => (stance(t + 1e-4).rig - stance(t - 1e-4).rig) / 2e-4;
  const spin = rate(launch - 1e-4);

  // Leg tracks outside the plant (rig angles): Hermite keys [t, angle, rate].
  type Key = [number, number, number];
  const track: Record<Leg, Key[]> = {
    back: [
      [enter, trailRig, 0],
      // the swing is stopped by the floor at the strike; then the plant is solved
      [plant, rig0, 0],
      // (the plant is solved) — then the split opens in the air
      // the push leg rises on into the split, slowing (its speed capped so it never swings past it)
      [launch, launchRig, Math.min(spin, (2.4 * -launchRig) / (flightT * 0.3))],
      [launch + flightT * 0.3, 0, 0],
      [spec.land, 0, 0],
    ],
    front: [
      [enter, rigFor("front", BOUND.kick, spec.lean), 0],
      [plant, rigFor("front", BOUND.kickPlant, leanAt(plant)), 0],
      // the kick: a battement through the plant, peaking just after the takeoff
      [launch + 0.07, KICK, 0],
      [launch + flightT * 0.62, -8, 0],
      [spec.land, 0, 0],
    ],
  };
  function legAt(leg: Leg, t: number): number {
    const keys = track[leg];
    if (t <= keys[0]![0]) return keys[0]![1];
    for (let k = 1; k < keys.length; k++) {
      const [t1, a1, r1] = keys[k]!;
      if (t <= t1) {
        const [t0, a0, r0] = keys[k - 1]!;
        const T = t1 - t0;
        return hermite(a0, r0 * T, a1, r1 * T, (t - t0) / T);
      }
    }
    return keys[keys.length - 1]![1];
  }

  function ground(t: number): Pose {
    if (t >= plant) {
      const st = stance(t);
      return { m: matrixOf(bodyAt(t, st.y, st.sy)), back: st.rig, front: legAt("front", t) };
    }
    // the bound: its top at the entry, landing on the push toe at the plant (a glide skims it in)
    return { m: matrixOf(bodyAt(t, boundY(t))), back: legAt("back", t), front: legAt("front", t) };
  }

  // ---- Flight (takeoff → touchdown), time-warped for the hang ----
  const launchBody = bodyAt(launch, launchY);
  const warp = (s: number) => s + (spec.hang * Math.sin(2 * Math.PI * s)) / (2 * Math.PI);
  function flight(t: number): Pose {
    const tau = clamp01((t - launch) / flightT);
    const w = warp(tau);
    const x = lerp(launchBody.x, landCom[0], w);
    const y = lerp(launchBody.y, landCom[1], w) - 4 * spec.lift * w * (1 - w);
    const d = lerp(spec.depth[1], 1, smooth(clamp01(tau / spec.fullSizeBy)));
    // pitch with the path (nose up on the rise, down on the descent), level for the landing
    const slope = Math.atan2(landCom[1] - launchBody.y - 4 * spec.lift * (1 - 2 * w), landCom[0] - launchBody.x) / RAD;
    const ramp = smooth(clamp01(tau / 0.25)) * (1 - smooth(clamp01((tau - 0.7) / 0.3)));
    const lean = lerp(spec.launchLean, 0, smooth(clamp01(tau / 0.3))) + spec.pitch * slope * ramp;
    return { m: about(COM, [x, y], lean, d, d), back: legAt("back", t), front: legAt("front", t) };
  }

  // ---- The stick: compress about the front toe, then EASE.land back to rest (hold) ----
  function stick(t: number): Pose {
    const u = t - spec.land;
    const q = u < PASS.stickIn ? easeOut(u / PASS.stickIn, 2) : 1 - landEase(clamp01((u - PASS.stickIn) / PASS.stickOut));
    const m = about(TOE_FRONT, touchdown, -1.2 * q, 1 + (STICK.sx - 1) * q, 1 - (1 - STICK.sy) * q);
    return { m, back: 5 * q, front: 0 };
  }
  const settle = spec.land + PASS.stickIn + PASS.stickOut;

  function pose(t: number): Pose {
    if (t >= settle) return { m: rest, back: 0, front: 0 };
    if (t >= spec.land) return stick(t);
    if (t >= launch) return flight(t);
    return ground(Math.max(t, enter));
  }

  const backToe = (t: number): Pt => {
    const p = pose(t);
    return apply(p.m, turn(TOE_BACK, HIP_BACK, p.back));
  };

  const trail = (t: number) => backToe(t)[0] - lx;
  const edgeLand = trail(spec.land);
  const open = WORDMARK_INK.x1 + WORDMARK_LEAN;
  function edge(t: number): number {
    const e = t < spec.land ? trail(t) : lerp(edgeLand, open, easeOut(clamp01((t - spec.land) / PASS.wipeAfter), 3));
    if (e < FIRST_LETTER) return -Infinity;
    return e >= open - 1e-6 ? Infinity : e;
  }

  return { pose, landed, touchdown, end: spec.land + PASS.wipeAfter, backToe, edge };
}

// ---------------------------------------------------------------------------
// Static composition
// ---------------------------------------------------------------------------

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export const matrixAttr = (m: Matrix) => `matrix(${m.map(r3).join(" ")})`;
export const legAttr = (deg: number, joint: Pt) => `rotate(${r3(deg)} ${joint[0]} ${joint[1]})`;

export interface GhostFrame {
  t: number;
  transform: string;
  back: string;
  front: string;
  /** Centre-of-mass x (the tick mark on the mat). */
  x: number;
}

export interface PassVariant {
  spec: PassSpec;
  width: number;
  height: number;
  logo: Pt;
  landed: Pt;
  touchdown: Pt;
  ghosts: GhostFrame[];
}

export function buildPass(spec: PassSpec): PassVariant {
  const p = makePass(spec);
  const ghosts = spec.ghosts.map((t) => {
    const g = p.pose(t);
    return { t, transform: matrixAttr(g.m), back: legAttr(g.back, HIP_BACK), front: legAttr(g.front, HIP_FRONT), x: r3(apply(g.m, COM)[0]) };
  });
  return { spec, width: spec.width, height: spec.mat, logo: spec.logo, landed: p.landed, touchdown: p.touchdown, ghosts };
}

// Server composition only; pure, so the motion layer's chunk drops them.
export const COMPACT = /* @__PURE__ */ buildPass(COMPACT_PASS);
export const WIDE = /* @__PURE__ */ buildPass(WIDE_PASS);
