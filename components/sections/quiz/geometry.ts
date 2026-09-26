/**
 * Geometry of the quiz's darkroom strip — a Marey chronophotograph of one tumbling pass.
 * Pure numbers, server-side only (the island never imports this: the art is rendered by a
 * server component and the motion is CSS keyed on data attributes).
 *
 * The flier (the club silhouette, #leap) takes off at frame 01, lands at 02 and touches down at
 * 03 — one hop per answer. Ages 3–7 skip the second question: ONE longer flight 01 → 03. At 03
 * she becomes the recommended program's pose on its apparatus (plan §5.3): the card's own scene
 * (programs/pose-scene.ts), drawn at one scale for every result. The motion model is the one the
 * CSS plays (styles/sections/quiz.css):
 *   X     linear (a ballistic flight has constant horizontal speed),
 *   Y     a parabola: out-quad up to the apex at 50 %, in-quad down,
 *   base  the landing height changes linearly with X (a raised landing on greda/parter),
 *   pitch nose-up at take-off, level at the apex, nose-down into the landing, then level.
 * The print's two exposures (the take-off at 01 and the apex of the leap) are samples of that
 * model, so each ghost sits exactly where — and appears exactly when — the flier passes it.
 */

import { POSES } from "@/components/brand/poses.generated";
import { posePlacement } from "../programs/pose-scene";

/** The four landing variants of the print: flat (mat), a raised floor or beam, or the long single flight. */
export type BandVariant = "flat" | "parter" | "greda" | "skip";
/** Apparatus drawn at frame 03 (ProgramIcon ids): the recommended primary program's. */
export type BandApparatus = "parter" | "greda" | "preskok";

export const VB_W = 720;
/** 8 units taller than v2 (204/192): headroom for the 1.5× apparatus (QP2-12), so the leaps onto
 *  the higher beam and the deeper floor keep the v2 flight heights and stay inside the strip. */
export const VB_H = 212;
export const MAT_Y = 200;
/** Frame centres along the mat: 01 take-off · 02 contact · 03 landing. */
export const FRAME_X = [130, 360, 590] as const;

/** Aspect of #leap (LEAP_VIEWBOX 230×150); not imported so no path strings travel along. */
const LEAP_ASPECT = 150 / 230;
export const FIG_W = 184;
export const FIG_H = Math.round(FIG_W * LEAP_ASPECT); // 120
/** Centre of mass of the silhouette, as a fraction of its box (measured from the path's fill). */
const COM_FX = 0.49;
const COM_FY = 0.64;
/** Lowest point (the front foot) — it touches the mat when the figure is level. */
const FOOT_FX = 0.955;
const FOOT_FY = 0.977;
/** Horizontal extremes of the fill (measured): the back toe and the front toe tip. */
export const BACK_TOE = [0.011, 0.713] as const;
export const FRONT_TOE = [0.983, 0.963] as const;

/** The silhouette's low points (fractions of its box): front foot, back foot, seat of the split. */
export const LOW_POINTS: readonly (readonly [fx: number, fy: number])[] = [
  [FOOT_FX, FOOT_FY],
  [0.02, 0.72],
  [0.5, 0.92],
];
/** Where a point of the silhouette (fractions of its box) is in the strip, for a figure in a pose. */
export function pointOf(p: Pose, fx: number, fy: number): readonly [x: number, y: number] {
  const a = (p.r * Math.PI) / 180;
  const dx = (fx - COM_FX) * FIG_W;
  const dy = (fy - COM_FY) * FIG_H;
  return [p.x + dx * Math.cos(a) - dy * Math.sin(a), p.y + dx * Math.sin(a) + dy * Math.cos(a)];
}
/** The lowest point of a figure in a pose (user units): nothing may sink below the surface it is on. */
export function lowestY(p: Pose): number {
  return Math.max(...LOW_POINTS.map(([fx, fy]) => pointOf(p, fx, fy)[1]));
}

/** <use> offset so the figure's local origin is its centre of mass. */
export const USE_X = r1(-COM_FX * FIG_W);
export const USE_Y = r1(-COM_FY * FIG_H);
/** Centre of mass → front foot (unrotated): the landing contact, where the chalk puffs. */
export const FOOT = { x: r1((FOOT_FX - COM_FX) * FIG_W), y: r1((FOOT_FY - COM_FY) * FIG_H) };
/** Centre-of-mass height when the figure stands level on the mat. */
export const REST_Y = r1(MAT_Y - FOOT.y);

/** Flight durations (ms) — mirrored by --qb-fly / --qb-fly-long in quiz.css. */
export const FLIGHT_MS = 600;
export const FLIGHT_LONG_MS = 700;
/** Apex heights (user units) — mirrored by --qb-hop in quiz.css. */
export const HOP = 48;
export const HOP_LONG = 64;
/** The ghost left at a take-off frame is the flier just after leaving the floor. */
const TAKEOFF_T = 0.12;
/** Pitch keyframes (t, degrees) — mirrored by @keyframes qb-pitch-* in quiz.css. */
export const PITCH_KEYS: readonly (readonly [t: number, deg: number])[] = [
  [0, 0],
  [0.12, -18],
  [0.5, -4],
  [0.88, 4],
  [1, 0],
];

/* ---- The landing scene at frame 03 (ProgramIcon's 48-unit drawings, scaled into the band) ---- */

interface ApparatusPlacement {
  /** translate(x y) scale(s) of the 48-unit icon drawing. */
  x: number;
  y: number;
  s: number;
  /** How far above the mat the leap touches down (0 = on the mat). */
  lift: number;
}

const [, , X3] = FRAME_X;

/**
 * Anchor coordinates in ProgramIcon's 48-unit drawings (tests/quiz.test.ts checks that S3's
 * drawings still contain them). Every drawing stands on the icon floor y = 42.
 */
export const ICON = {
  floor: 42,
  /** Carpet in perspective: front edge x 1.5–35 at y 42, back edge x 13–46.5 at y 22. */
  parter: { back: 22, land: 32, frontLeft: 1.5, frontRight: 35, backLeft: 13, backRight: 46.5 },
  /** Beam top y 21.5 over x 3.5–44.5. */
  greda: { top: 21.5, left: 3.5, right: 44.5 },
  /** Vault table top y 14 over x 25.5–47; run-up dashes from x 1. */
  preskok: { top: 14, left: 25.5, right: 47, run: 1 },
} as const;

/**
 * One scale for every landing scene (band units per icon unit): the card's scene — pose and
 * apparatus in the approved sheet's proportions — at the largest size at which the handspring
 * on the vault table stays inside the strip (its toes ≥ −8, as the flier's arms) and the leap
 * still lands on the beam without leaving the strip in flight (hop 2's lift ≤ 72). Every pose is
 * drawn at SCENE_S × its scene scale (0.52 band units per pose unit: ≈65 % of the flier's body).
 * Stroke weight stays constant in strip units (quiz.css divides by --s).
 */
export const SCENE_S = 3.44;
/**
 * parter  — the competition floor in perspective (front edge y 42, back edge y 22): its front
 *           edge on the mat, its back corner 6 units inside the strip's right edge. The leap's
 *           front foot touches down mid-depth (y 32) inside the carpet's right edge; the star
 *           springs from it into the air over the floor.
 * greda   — the beam (top y 21.5, x 3.5–44.5) on its legs: the leap's front foot touches down on
 *           the beam's top at its right end, the seat of the split over the beam; the cartwheel
 *           puts both hands on the beam's middle.
 * preskok — run-up, springboard and table, the handspring centred over 03. Her hands take the
 *           table 98 units above the mat, higher than any leap can land inside the strip, so the
 *           leap sticks on the mat at 03 and the vault scene is drawn in as she touches down.
 */
export const APPARATUS: Readonly<Record<BandApparatus, ApparatusPlacement>> = {
  parter: {
    x: r1(VB_W - 6 - ICON.parter.backRight * SCENE_S),
    y: r1(MAT_Y - ICON.floor * SCENE_S),
    s: SCENE_S,
    lift: r1((ICON.floor - ICON.parter.land) * SCENE_S),
  },
  greda: {
    x: r1(X3 + FOOT.x + 6 - ICON.greda.right * SCENE_S),
    y: r1(MAT_Y - ICON.floor * SCENE_S),
    s: SCENE_S,
    lift: r1((ICON.floor - ICON.greda.top) * SCENE_S),
  },
  preskok: {
    x: r1(X3 - (posePlacement("preskok").box.x + posePlacement("preskok").box.width / 2) * SCENE_S),
    y: r1(MAT_Y - ICON.floor * SCENE_S),
    s: SCENE_S,
    lift: 0,
  },
};

/** The landing pose: the program's pose on its apparatus, in band units. */
export interface Landing {
  id: keyof typeof POSES;
  /** The nested <svg>'s box. */
  x: number;
  y: number;
  width: number;
  height: number;
  viewBox: string;
  /** The contact (hands, foot; the star's feet): the stick squashes about it, the chalk puffs there. */
  at: readonly [x: number, y: number];
  /** Band units per pose unit. */
  scale: number;
}

function landing(icon: BandApparatus): Landing {
  const a = APPARATUS[icon];
  const p = posePlacement(icon);
  const vb = POSES[p.id].viewBox;
  const band = (u: number, v: number) => [r1(a.x + u * a.s), r1(a.y + v * a.s)] as const;
  const [x, y] = band(p.box.x, p.box.y);
  return {
    id: p.id,
    x,
    y,
    width: r1(p.box.width * a.s),
    height: r1(p.box.height * a.s),
    viewBox: `${vb.x} ${vb.y} ${vb.width} ${vb.height}`,
    at: band(p.at[0], p.at[1]),
    scale: p.k * a.s,
  };
}

export const LANDING: Readonly<Record<BandApparatus, Landing>> = {
  parter: landing("parter"),
  greda: landing("greda"),
  preskok: landing("preskok"),
};

/** Landing height (above the mat) of each variant. */
export const LIFT: Readonly<Record<BandVariant, number>> = {
  flat: 0,
  parter: APPARATUS.parter.lift,
  greda: APPARATUS.greda.lift,
  skip: APPARATUS.parter.lift,
};

/* ---- The flight model ---- */

/** CSS cubic-bezier(x1, y1, x2, y2) evaluated at progress t (bisection on x). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const at = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s ** 2 * (1 - s) + s ** 3;
  let lo = 0;
  let hi = 1;
  let s = t;
  for (let i = 0; i < 40; i++) {
    s = (lo + hi) / 2;
    if (at(x1, x2, s) < t) lo = s;
    else hi = s;
  }
  return at(y1, y2, s);
}

/** Out-quad up to the apex, in-quad down (exact quadratic halves). Returns the lift ≥ 0. */
export function hopAt(t: number, amp: number): number {
  if (t <= 0 || t >= 1) return 0;
  return t < 0.5
    ? amp * cubicBezier(1 / 3, 2 / 3, 2 / 3, 1, t / 0.5)
    : amp * (1 - cubicBezier(1 / 3, 0, 2 / 3, 1 / 3, (t - 0.5) / 0.5));
}

/** Piecewise-linear pitch (degrees) at progress t. */
export function pitchAt(t: number): number {
  for (let i = 1; i < PITCH_KEYS.length; i++) {
    const [t0, d0] = PITCH_KEYS[i - 1]!;
    const [t1, d1] = PITCH_KEYS[i]!;
    if (t <= t1) return d0 + ((d1 - d0) * (t - t0)) / (t1 - t0);
  }
  return 0;
}

export interface Pose {
  x: number;
  y: number;
  r: number;
}

export interface Hop {
  from: readonly [x: number, lift: number];
  to: readonly [x: number, lift: number];
  amp: number;
}

/** Where the flier is at progress t of a hop (centre of mass, pitch). */
export function poseAt(hop: Hop, t: number): Pose {
  const x = hop.from[0] + (hop.to[0] - hop.from[0]) * t;
  const lift = hop.from[1] + (hop.to[1] - hop.from[1]) * t;
  return { x: r1(x), y: r1(REST_Y - lift - hopAt(t, hop.amp)), r: r1(pitchAt(t)) };
}

const [X1, X2] = FRAME_X;
const HOP1: Hop = { from: [X1, 0], to: [X2, 0], amp: HOP };
const SKIP: Hop = { from: [X1, 0], to: [X3, LIFT.skip], amp: HOP_LONG };

/* ---- The two exposures ---- */

/**
 * Figure system R3 (docs/plan-figure-system.md §5.3): the print keeps two real phases of the
 * leap, never a copy of the flier's own pose — the take-off at 01 and the apex. The landing is
 * the flier herself.
 */
export type ExposureId = "takeoff" | "apex";

export interface Exposure {
  id: ExposureId;
  /** The take-off is the answer frame 01 (it develops lavender); the apex is in flight (ice). */
  key: boolean;
  /** Placement per variant. */
  pose: Readonly<Record<BandVariant, Pose>>;
  /** Develop delay (ms) after the tap on the two-question path / on the single long flight. */
  delay: number;
  delaySkip: number;
}

const VARIANTS: readonly BandVariant[] = ["flat", "parter", "greda", "skip"];

/** The apex of a hop: the top of the parabola (hopAt), half-way in time and in X. */
export const APEX_T = 0.5;

/**
 * Both phases are samples of the first leap: at progress `t` of hop 1 on the two-question path
 * (01 → 02, the same on every landing variant) and of the one long flight 01 → 03 (`skip`),
 * whose apex is over 02. Each develops when the flier passes it (t × flight time).
 */
function exposure(id: ExposureId, key: boolean, t: number): Exposure {
  const hop = poseAt(HOP1, t);
  const pose = { flat: hop, parter: hop, greda: hop, skip: poseAt(SKIP, t) };
  return { id, key, pose, delay: Math.round(t * FLIGHT_MS), delaySkip: Math.round(t * FLIGHT_LONG_MS) };
}

const rest = (x: number, lift = 0): Pose => ({ x, y: r1(REST_Y - lift), r: 0 });

export const EXPOSURES: readonly Exposure[] = [exposure("takeoff", true, TAKEOFF_T), exposure("apex", false, APEX_T)];

/** The flier's resting places: 01, 02 and the landing at 03 per variant. */
export const FLIER = {
  f0: rest(X1),
  f1: rest(X2),
  f2: Object.fromEntries(VARIANTS.map((v) => [v, rest(X3, LIFT[v])])) as Record<BandVariant, Pose>,
} as const;

/** Measuring grid: minor lines every 46 units (ten per hop … five per frame gap), majors on the frames. */
export const GRID_STEP = 46;
export const GRID_X: readonly number[] = Array.from({ length: 15 }, (_, i) => X1 - 2 * GRID_STEP + i * GRID_STEP);

/** Chalk puff at the front foot on landing: five grains, (dx, dy) in user units. */
export const PUFF: readonly (readonly [dx: number, dy: number])[] = [
  [-16, -6],
  [-7, -13],
  [4, -15],
  [14, -9],
  [22, -3],
];

export const transformOf = (p: Pose): string => `translate(${p.x}px, ${p.y}px) rotate(${p.r}deg)`;

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}
