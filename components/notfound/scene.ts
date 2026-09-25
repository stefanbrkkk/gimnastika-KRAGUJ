/**
 * 404 scene geometry (SVG user units). The silhouette is the sprite's #leap
 * (box 230 × 150, logo coordinates 262…492 × 48…198). Rotated −4.5° about her
 * hip she sits in a split on the beam: rear foot on the wood, pointed front
 * foot just above it.
 *
 * Balancing in a split, a gymnast sways from the waist while the legs stay on
 * the beam. The one-path silhouette is therefore cut at the waist (logo y ≈ 150,
 * where only the 26-unit-wide torso crosses) with two clip paths that overlap by
 * a few units, and only the upper body rotates, about the waist centre.
 *
 * The view ends exactly on the floor: the gym floor itself is a full-bleed CSS
 * line under the scene (notfound.css .nf__stage::after), so the beam stands on
 * the same floor that runs across the page.
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
/** Beam centre top = where her hip rests. */
export const PIVOT = { x: 360, y: 250 } as const;
/** Her hip (lowest ink between the legs) inside the #leap box: logo (377, 186) − (262, 48). */
export const HIP = { x: 115, y: 138 } as const;
export const LEAP_SIZE = { width: 230, height: 150 } as const;
/** Rest rotation (about PIVOT) that seats her on the beam. */
export const BASE_ANGLE = -4.5;

/** Where the <use href="#leap"> box sits in scene units. */
export const USE_AT = { x: PIVOT.x - HIP.x, y: PIVOT.y - HIP.y } as const;
/** Logo coordinates → scene units (before the BASE_ANGLE rotation). */
const L = (x: number, y: number): readonly [number, number] => [x - 262 + USE_AT.x, y - 48 + USE_AT.y];
const poly = (pts: readonly (readonly [number, number])[]) => pts.map(([x, y]) => `${x},${y}`).join(" ");

/** Upper body: everything above the waist cut (the pointed front toe, x < 300, stays with the legs). */
export const TORSO_CLIP = poly([L(250, 30), L(500, 30), L(500, 156), L(330, 156), L(330, 150), L(250, 150)]);
/** Legs and hips: everything below logo y = 148 (2–6 units of overlap with the torso). */
export const LEGS_CLIP = poly([L(250, 148), L(500, 148), L(500, 210), L(250, 210)]);
/** Waist centre = the upper body's rotation pivot. */
export const WAIST = { x: L(372, 152)[0], y: L(372, 152)[1] } as const;

/**
 * Ghost frames of the sway she has just caught (static composition = final
 * state): extra rotation of the upper body. Oldest first; colour and opacity
 * come from the shared --ghost-1…3 tokens (ice → lavender → violet on dark).
 */
export const GHOSTS = [{ fan: -21 }, { fan: -14 }, { fan: -7 }] as const;

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

const r2 = (v: number) => Math.round(v * 100) / 100;
export const rotateAbout = (deg: number, p: { x: number; y: number }): string => `rotate(${r2(deg)} ${p.x} ${p.y})`;
/** Upper-body rotation (relative to the seated pose). */
export const swayAt = (deg: number): string => rotateAbout(deg, WAIST);
