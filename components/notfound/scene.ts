import { POSES } from "@/components/brand/poses.generated";
import { ANKLE } from "./sway";

export { ANKLE, swayAt } from "./sway";

/**
 * 404 scene geometry (SVG user units). The gymnast is the pose family's scale ("vaga",
 * docs/plan-figure-system.md §4 P7, components/brand/poses.generated.ts): one figure, drawn at
 * one scene unit per pose unit, i.e. the logo figure's body size.
 *
 * Balancing in a scale, a gymnast sways at the ankle while the support foot stays flat on the
 * beam. The one-path pose is therefore cut just above the foot (pose y ≈ 148, where only the
 * 8-unit-wide support leg crosses) with two clip paths that overlap by a few units: the foot
 * stays on the beam's padded top and the rest of her rotates about the ankle.
 *
 * The view ends exactly on the floor: the gym floor itself is a full-bleed CSS line under the
 * scene (notfound.css .nf__stage::after), so the beam stands on the same floor that runs
 * across the page.
 */
export const FLOOR_Y = 352;
export const VIEW = { x: 0, y: 84, width: 720, height: FLOOR_Y - 84 } as const;
export const BEAM = { x: 64, y: 250, width: 592, height: 12, radius: 3 } as const;
/** Padded top face of the beam (lighter than the steel body, so it reads as a beam, not a bench). */
export const BEAM_TOP = 2.5;
/** Beam supports (x of each A-frame's apex). */
export const LEGS = [168, 552] as const;
/**
 * A-frame supports drawn like the S8 camp beam: two legs splayed ±14° from the
 * beam's underside to a 68-unit foot bar resting on the floor.
 */
export const LEG_SPLAY = Math.round((FLOOR_Y - (BEAM.y + BEAM.height)) * Math.tan((14 * Math.PI) / 180) * 10) / 10;
export const FOOT_HALF = 34;
/** Stroke centre of the foot bars (6-unit stroke: its bottom edge sits on the floor). */
export const FOOT_Y = FLOOR_Y - 3;

export const POSE = POSES.scale;
/** The pose's support-foot anchor (its heel on the floor line), in pose units. */
export const FOOT_CONTACT = POSE.contacts.foot;
/**
 * Where her support foot stands, on the beam's padded top face: 20 units left of its middle,
 * so her figure (arms and head reach further right of the foot than the free leg reaches
 * left) is centred on the beam and her forward lean keeps clear of the judges' board.
 */
export const STAND = { x: 340, y: BEAM.y } as const;
/** The pose's box in scene units: the foot contact lands exactly on STAND. */
export const FIGURE = {
  x: STAND.x - FOOT_CONTACT[0],
  y: STAND.y - FOOT_CONTACT[1],
  width: POSE.viewBox.width,
  height: POSE.viewBox.height,
} as const;

/** Pose units → scene units. */
export const toScene = (x: number, y: number) => ({ x: FIGURE.x + x, y: FIGURE.y + y }) as const;

const poly = (pts: readonly (readonly [number, number])[]) => pts.map(([x, y]) => `${x},${y}`).join(" ");
/** The part that stays on the beam: the foot, from 2 units above the ankle down. */
export const SUPPORT_CUT = ANKLE.y - 2;
export const SUPPORT_CLIP = poly([
  [-40, SUPPORT_CUT],
  [FIGURE.width + 40, SUPPORT_CUT],
  [FIGURE.width + 40, FIGURE.height + 40],
  [-40, FIGURE.height + 40],
]);
/**
 * The part that sways: everything above the ankle, reaching 2 units below it inside the leg's
 * column only (so the instep never rotates with her). Generous margins: rotated, she leaves
 * the pose's own box (the pose svg does not clip).
 */
export const SWAY_CUT = ANKLE.y + 2;
export const LEG_COLUMN = { left: 96, right: 109 } as const;
export const SWAY_CLIP = poly([
  [-200, -200],
  [FIGURE.width + 200, -200],
  [FIGURE.width + 200, SUPPORT_CUT],
  [LEG_COLUMN.right, SUPPORT_CUT],
  [LEG_COLUMN.right, SWAY_CUT],
  [LEG_COLUMN.left, SWAY_CUT],
  [LEG_COLUMN.left, SUPPORT_CUT],
  [-200, SUPPORT_CUT],
]);

/**
 * The judges' board (C-19): before the catch it shows a perfect 10.00; the
 * wobble costs points and it posts 4.04. Aligned on the decimal point, so the
 * tens digit goes dark. [before, after] per display cell.
 */
export const SCORE_CELLS = [
  ["1", ""],
  ["0", "4"],
  [".", "."],
  ["0", "0"],
  ["0", "4"],
] as const;
