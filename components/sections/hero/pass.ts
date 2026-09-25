/**
 * FLOOR PASS — the hero's choreography as pure math (no DOM, no gsap).
 *
 * One function, pose(t), is shared by the server composition (HeroArt: every
 * ghost frame is the gymnast at one shutter time) and the motion layer
 * (HeroMotion: the same pose every frame), so the no-JS frame and the animated
 * one match by construction — a chronophotograph of one real motion.
 *
 * The pass, like a leap pass on the floor: two low running bounds along the mat
 * (the gymnast comes from the far corner of the diagonal, so she grows a
 * little), the plant (the push leg reaches under the body, the front leg kicks),
 * a ballistic flight in which the legs scissor open to the full split and hang
 * at the apex, and the landing on the front toe — which is exactly the logo's
 * pose: the club's gymnast is caught at the instant she touches down.
 *
 * The rig: the logo's silhouette is not redrawn. Three clipped copies of the
 * same #leap symbol (torso, back leg, front leg) make the body; each leg turns
 * about its hip joint, and the disc around each joint stays with the torso — a
 * disc turned about its own centre maps onto itself, so the hip never opens.
 * With both legs at 0° the three parts are the logo, exactly.
 *
 * Units: art units = logo units (the logo is 490 × 213 at scale 1). A pose is a
 * matrix for the 230 × 150 silhouette box plus the two leg angles (degrees,
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

/** Centre of mass (the pelvis, a little above the hips). */
export const COM: Pt = [112, 118];
export const HIP_BACK: Pt = [100.5, 128];
export const HIP_FRONT: Pt = [125, 121];
/** The front toe's contact point = the silhouette's lowest ink (the touchdown). */
export const TOE_FRONT: Pt = [222.7, 146.7];
/** Ground contacts of each leg (tip and sole of the pointed foot). */
const FEET_BACK: readonly Pt[] = [
  [2.1, 108.2],
  [4.8, 111.4],
];
const FEET_FRONT: readonly Pt[] = [TOE_FRONT, [226.1, 144.8]];

/**
 * Clip regions of the three parts (box coordinates). The leg regions end in an
 * arc of their joint disc (1.5 units inside it, so the parts overlap and no
 * hairline shows at rest); the torso keeps both discs.
 */
export const RIG_CLIP = {
  torso: "M-30-30H260V90H127.5V110H125V165H100.5V128H96L90 100H-30Z",
  torsoDiscs: [
    [HIP_BACK[0], HIP_BACK[1], 11],
    [HIP_FRONT[0], HIP_FRONT[1], 14],
  ] as const,
  back: "M-30 100H90L95 117V120.25A9.5 9.5 0 0 0 100.5 137.5V165H-30Z",
  front: "M127.5 90H260V165H125V133.5A12.5 12.5 0 0 0 127.5 108.75Z",
} as const;

// ---------------------------------------------------------------------------
// Timing (s from the intro start). The whole intro ends at PASS.end ≤ 1.9 s.
// ---------------------------------------------------------------------------

export const PASS = {
  /** The mat line draws left → right. */
  mat: [0, 0.42],
  /** The gymnast runs in (fades in over `fadeIn`). */
  enter: 0.02,
  fadeIn: 0.08,
  /** The takeoff foot lands (end of the run). */
  plant: 0.4,
  /** She leaves the floor. */
  launch: 0.5,
  /** The front toe touches the mat inside the logo. */
  land: 1.16,
  /** The landing squash has settled: the logo pose, at rest. */
  settle: 1.46,
  /** Chalk puff and mat flex, from the touchdown. */
  chalk: 0.38,
  flex: 0.34,
  /** The wordmark finishes its wipe this long after the touchdown. */
  wipeAfter: 0.5,
  /** Ghost frames fade in over this, from the instant the gymnast passes them. */
  ghostFade: 0.18,
} as const;

/** The intro's last motion ends here (§7: ≤ 1.9 s). */
export const PASS_END = PASS.land + PASS.wipeAfter;

/** Motion character (degrees, ratios). */
const STYLE = {
  /** Forward lean while running. */
  lean: 10,
  /** The running bound: legs at each contact, and how far they open in the air (a leap step). */
  runBack: -40,
  runFront: 24,
  gather: 12,
  /** The plant: push leg under the body, front leg starting its kick. */
  plantBack: -70,
  plantFront: 8,
  plantLean: 2,
  /** Leaving the floor: push leg extended down-back, front leg kicked above horizontal. */
  pushBack: -78,
  kickFront: -16,
  launchLean: -3,
  /** Compression on the plant (scale y). */
  squash: 0.9,
  /** Flight progress by which the legs reach the full split, and the body levels. */
  splitBy: 0.46,
  levelBy: 0.5,
  /** Apex hang (0 = pure ballistics): time-warp amplitude. */
  hang: 0.2,
  /** Landing: squash about the front toe, rebound overshoot, forward tip, back-leg give. */
  landSquash: 0.9,
  overshoot: 0.1,
  landTip: 2,
  landBack: 4,
} as const;

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
  /** Centre-of-mass x at the entry, at the mid-run contact and at the plant. */
  run: readonly [number, number, number];
  /** How far the body travels over the planted foot. */
  push: number;
  /** Height of a running bound. */
  hop: number;
  /** Depth scale at the entry, the contact and the plant (the far corner of the diagonal → full size). */
  depth: readonly [number, number, number];
  /** Depth scale leaving the floor … */
  depthLaunch: number;
  /** … and the flight progress by which she is full size (she comes toward the camera). */
  fullSizeBy: number;
  /** Height of the flight above the straight launch → landing line. */
  lift: number;
  /** The six shutter times of the ghost frames. */
  ghosts: readonly [number, number, number, number, number, number];
  /** Chalk speck radius (art units — the compact art is drawn smaller). */
  chalkR: number;
}

/**
 * Phones and portrait tablets: a high leap from the left edge over the „K“,
 * landing in a logo that fills the right two-thirds. Container 320 px → 1 unit ≈ .45 px.
 */
export const COMPACT_PASS: PassSpec = {
  width: 713,
  mat: 404,
  logo: [223, 404 - 196],
  run: [-150, -40, 90],
  push: 20,
  hop: 10,
  depth: [0.62, 0.7, 0.8],
  depthLaunch: 0.84,
  fullSizeBy: 0.9,
  lift: 230,
  ghosts: [0.33, 0.47, 0.575, 0.67, 0.79, 0.95],
  chalkR: 5,
};

/**
 * Landscape ≥ 640 px and desktop: the long pass across the band above the
 * headline. Container 1320 px → 1 unit = .8 px.
 */
export const WIDE_PASS: PassSpec = {
  width: 1650,
  mat: 256,
  logo: [1650 - 490, 256 - 196],
  run: [-190, 100, 440],
  push: 50,
  hop: 10,
  depth: [0.8, 0.86, 0.92],
  depthLaunch: 0.96,
  fullSizeBy: 0.5,
  lift: 75,
  ghosts: [0.17, 0.29, 0.47, 0.6, 0.715, 0.85],
  chalkR: 3.4,
};

// ---------------------------------------------------------------------------
// Math
// ---------------------------------------------------------------------------

const RAD = Math.PI / 180;
const lerp = (a: number, b: number, s: number) => a + (b - a) * s;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (s: number) => s * s * (3 - 2 * s);
const easeOut = (s: number, p = 2) => 1 - (1 - s) ** p;
const easeInOut = (s: number) => (s < 0.5 ? 2 * s * s : 1 - (-2 * s + 2) ** 2 / 2);

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

export const apply = (m: Matrix, p: Pt): Pt => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

/** p turned deg° about joint j. */
export function turn(p: Pt, j: Pt, deg: number): Pt {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  const x = p[0] - j[0];
  const y = p[1] - j[1];
  return [j[0] + x * c - y * s, j[1] + x * s + y * c];
}

/** The body with its centre of mass at x and its lowest foot `gap` above the mat. */
function grounded(spec: PassSpec, x: number, gap: number, r: number, sx: number, sy: number, back: number, front: number): Matrix {
  const m = about(COM, [x, 0], r, sx, sy);
  const feet = [...FEET_BACK.map((p) => turn(p, HIP_BACK, back)), ...FEET_FRONT.map((p) => turn(p, HIP_FRONT, front))];
  const low = Math.max(...feet.map((p) => apply(m, p)[1]));
  m[5] += spec.mat - gap - low;
  return m;
}

/** Legs of a running bound at progress u (under the body at contact, a leap step in the air). */
function stepLegs(last: boolean, u: number) {
  const air = Math.sin(Math.PI * u);
  let back = STYLE.runBack + STYLE.gather * air;
  let front = STYLE.runFront - STYLE.gather * air;
  let lean: number = STYLE.lean;
  if (last) {
    // the last step: the takeoff leg reaches under the body, the lean comes up
    const w = smooth(clamp01((u - 0.4) / 0.6));
    back = lerp(back, STYLE.plantBack, w);
    front = lerp(front, STYLE.plantFront, w);
    lean = lerp(STYLE.lean, STYLE.plantLean, w);
  }
  return { back, front, lean };
}

export interface Pass {
  pose(t: number): Pose;
  /** The silhouette's position inside the logo (= translate of the landed figure). */
  landed: Pt;
  /** The front toe's touchdown point (chalk, mat flex). */
  touchdown: Pt;
  /** Wordmark wipe: revealed share (0–1) of the wordmark's ink width at time t. */
  wipe(t: number): number;
}

/** The wordmark's ink, x range in logo units (the box its clip-path inset is relative to). */
export const WORDMARK_INK = { x0: 10.9, x1: 335.2 } as const;
/** Wordmark wipe: its edge trails the gymnast's centre of mass by this much during the descent. */
const WIPE_LAG = 180;
const WIPE_OPEN = 0.24;

export function makePass(spec: PassSpec): Pass {
  const [lx, ly] = spec.logo;
  const landed: Pt = [lx + LEAP_IN_LOGO.x, ly + LEAP_IN_LOGO.y];
  const rest: Matrix = [1, 0, 0, 1, landed[0], landed[1]];
  const touchdown = apply(rest, TOE_FRONT);
  const { run } = spec;
  const stepT = (k: number) => lerp(PASS.enter, PASS.plant, k / 2);

  function ground(t: number): Pose {
    if (t < PASS.plant) {
      const k = t < stepT(1) ? 0 : 1;
      const u = clamp01((t - stepT(k)) / (stepT(k + 1) - stepT(k)));
      const legs = stepLegs(k === 1, u);
      const d = lerp(spec.depth[k]!, spec.depth[k + 1]!, u);
      const x = lerp(run[k]!, run[k + 1]!, u);
      return { m: grounded(spec, x, spec.hop * 4 * u * (1 - u), legs.lean, d, d, legs.back, legs.front), back: legs.back, front: legs.front };
    }
    const s = clamp01((t - PASS.plant) / (PASS.launch - PASS.plant));
    const d = lerp(spec.depth[2], spec.depthLaunch, s);
    // a brief compression on the plant, then the extension onto the toe
    const q = Math.sin(Math.PI * Math.min(1, s / 0.8));
    const back = lerp(STYLE.plantBack, STYLE.pushBack, easeInOut(s));
    const front = lerp(STYLE.plantFront, STYLE.kickFront, easeOut(s));
    const r = lerp(STYLE.plantLean, STYLE.launchLean, s);
    const m = grounded(spec, run[2] + spec.push * easeOut(s, 1.6), 0, r, d * (1 + (1 - STYLE.squash) * 0.5 * q), d * (1 - (1 - STYLE.squash) * q), back, front);
    return { m, back, front };
  }

  const launchCom = apply(ground(PASS.launch).m, COM);
  const landCom = apply(rest, COM);
  const warp = (s: number) => s + (STYLE.hang * Math.sin(2 * Math.PI * s)) / (2 * Math.PI);

  function flight(t: number): Pose {
    const tau = warp(clamp01((t - PASS.launch) / (PASS.land - PASS.launch)));
    const x = lerp(launchCom[0], landCom[0], tau);
    const y = lerp(launchCom[1], landCom[1], tau) - 4 * spec.lift * tau * (1 - tau);
    const d = lerp(spec.depthLaunch, 1, smooth(clamp01(tau / spec.fullSizeBy)));
    const open = easeOut(clamp01(tau / STYLE.splitBy), 2.2);
    const r = lerp(STYLE.launchLean, 0, smooth(clamp01(tau / STYLE.levelBy)));
    // stretched as she leaves the floor
    const st = 1 - smooth(clamp01(tau / 0.25));
    return { m: about(COM, [x, y], r, d * (1 - 0.03 * st), d * (1 + 0.06 * st)), back: lerp(STYLE.pushBack, 0, open), front: lerp(STYLE.kickFront, 0, open) };
  }

  function landing(t: number): Pose {
    const s = clamp01((t - PASS.land) / (PASS.settle - PASS.land));
    // impact: a quick squash about the front toe, a rebound with a small overshoot
    let q: number;
    if (s < 0.22) q = easeOut(s / 0.22);
    else if (s < 0.6) q = 1 - (1 + STYLE.overshoot) * smooth((s - 0.22) / 0.38);
    else q = -STYLE.overshoot * (1 - smooth((s - 0.6) / 0.4));
    const sy = 1 - (1 - STYLE.landSquash) * q;
    const sx = 1 + (1 - STYLE.landSquash) * 0.4 * q;
    const give = Math.max(0, q);
    return { m: about(TOE_FRONT, touchdown, STYLE.landTip * give, sx, sy), back: STYLE.landBack * give, front: 0 };
  }

  function pose(t: number): Pose {
    if (t >= PASS.settle) return { m: rest, back: 0, front: 0 };
    if (t >= PASS.land) return landing(t);
    if (t >= PASS.launch) return flight(t);
    return ground(Math.max(t, PASS.enter));
  }

  // The edge trails her centre of mass, and opens only as she comes down
  // (WIPE_OPEN before the touchdown): nothing of the name shows while she is
  // still in the air above it.
  const edgeAt = (t: number) =>
    clamp01((apply(pose(t).m, COM)[0] - lx - WIPE_LAG - WORDMARK_INK.x0) / (WORDMARK_INK.x1 - WORDMARK_INK.x0)) *
    smooth(clamp01((t - PASS.land + WIPE_OPEN) / WIPE_OPEN));
  const edgeAtLand = edgeAt(PASS.land - 1e-6);
  function wipe(t: number): number {
    if (t < PASS.land) return edgeAt(t);
    return lerp(edgeAtLand, 1, easeOut(clamp01((t - PASS.land) / PASS.wipeAfter), 3));
  }

  return { pose, landed, touchdown, wipe };
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

/**
 * Chalk puff at the touchdown: [direction (deg, −90 = up), distance (wide art
 * units), radius factor, delay (s)]. It lifts up and forward off the toe — the
 * leg covers anything thrown back along the mat.
 */
export const CHALK: readonly (readonly [number, number, number, number])[] = [
  [-150, 30, 0.8, 0.02],
  [-124, 40, 1, 0],
  [-100, 30, 0.7, 0.03],
  [-74, 42, 1, 0.01],
  [-46, 36, 0.9, 0],
  [-20, 30, 0.7, 0.02],
];
