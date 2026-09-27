/**
 * Each program's pose on its apparatus (docs/plan-figure-system.md §4–§5.4): the compositions
 * the owner approved on the pose sheet (docs/poses-sheet.png, scratchpad poses/build_sheet.mjs),
 * in ProgramIcon's 48-unit drawing. Pure numbers (no JSX): ProgramIcon draws them, the quiz
 * reads them for its plates and its landings, and the tests check every contact.
 *
 *   parter  — star / straddle jump (P1), over the floor mat
 *   greda   — cartwheel (P2), both hands on the beam
 *   razboj  — handstand on the HIGH rail (P3)
 *   preskok — handspring (P4), hands on the vault table
 *   aerobik — high kick (P5), standing on the mat line; the pose is the whole drawing
 *
 * Scale: the approved sheet's — the pose family is drawn in logo units at the logo figure's body
 * scale, and a scene draws it at today's posed-silhouette size, 35 icon units per 230-unit leap
 * box (the aerobic plate, whose pose IS the drawing, at the drawing's own 48 per 230). A pose is
 * placed by one anchor (its contact, in pose units) on one target (the apparatus anchor, in icon
 * units). Hands and feet meet the OUTER edge of the apparatus line: its path minus half the
 * stroke the card draws at a 150px drawing (≈2.8 CSS px, programs.css --sw steps).
 */
import {
  POSE_BAR_HANDSTAND,
  POSE_CARTWHEEL,
  POSE_HIGH_KICK,
  POSE_STAR,
  POSE_VAULT,
  type PoseData,
} from "@/components/brand/poses.generated";
import type { ApparatusIcon } from "@/content/programs";

/** The five program poses, imported by name: the lazy detail sheet ships these, not the family. */
export const PROGRAM_POSES = {
  star: POSE_STAR,
  cartwheel: POSE_CARTWHEEL,
  barHandstand: POSE_BAR_HANDSTAND,
  vault: POSE_VAULT,
  highKick: POSE_HIGH_KICK,
} as const satisfies Readonly<Record<string, PoseData>>;
export type ProgramPoseId = keyof typeof PROGRAM_POSES;

/** Icon units per pose unit on the apparatus scenes (the posed silhouette's size since QP-21). */
export const SCENE_K = 35 / 230;
/** …and on the aerobic plate, where the pose is the drawing itself (48 units per 230). */
export const AEROBIC_K = 48 / 230;
/** The card's line in icon units at a 150px drawing, and the heavier rail (× 1.4). */
export const SW_REF = 2.8 / (150 / 48);
const RAIL = 1.4;

/** The floor every apparatus stands on, and the apparatus anchors the poses meet (icon units). */
export const ICON_FLOOR = 42;
export const ANCHOR = {
  /** Floor mat: the star floats over its middle, feet 2.5 units above the carpet's back edge. */
  parter: { x: 24.5, y: 19.5 },
  /** Beam top (path y 21.5) at the beam's middle. */
  greda: { x: 24, y: 21.5 - SW_REF / 2 },
  /** High rail (path y 11.5), between its uprights (27.5, 43). */
  razboj: { x: 35.5, y: 11.5 - (SW_REF * RAIL) / 2 },
  /** Vault table top (path y 14), a hand's width in from its near end (25.5). */
  preskok: { x: 33.5, y: 14 - SW_REF / 2 },
  /** The mat line itself. */
  aerobik: { x: 26, y: ICON_FLOOR },
} as const satisfies Record<ApparatusIcon, { x: number; y: number }>;

export interface PoseScene {
  id: ProgramPoseId;
  /** Icon units per pose unit. */
  k: number;
  /** The pose's own anchor (pose units): its contact, or the bottom centre of an airborne pose. */
  anchor: readonly [number, number];
  /** Where the anchor lies on the drawing (icon units). */
  target: readonly [number, number];
}

const contact = (id: ProgramPoseId, name: string): readonly [number, number] => {
  const c = (PROGRAM_POSES[id] as { contacts?: Record<string, readonly [number, number]> }).contacts?.[name];
  if (!c) throw new Error(`pose ${id} has no contact „${name}“`);
  return c;
};
/** The midpoint of a pose's two hands on the floor line (cartwheel). */
const hands = (id: ProgramPoseId): readonly [number, number] => {
  const [l, r] = [contact(id, "handL"), contact(id, "handR")];
  return [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2];
};

export const PROGRAM_POSE: Readonly<Record<ApparatusIcon, PoseScene>> = {
  parter: {
    id: "star",
    k: SCENE_K,
    anchor: [PROGRAM_POSES.star.viewBox.width / 2, PROGRAM_POSES.star.viewBox.height - 2],
    target: [ANCHOR.parter.x, ANCHOR.parter.y],
  },
  greda: { id: "cartwheel", k: SCENE_K, anchor: hands("cartwheel"), target: [ANCHOR.greda.x, ANCHOR.greda.y] },
  razboj: { id: "barHandstand", k: SCENE_K, anchor: contact("barHandstand", "hand"), target: [ANCHOR.razboj.x, ANCHOR.razboj.y] },
  preskok: { id: "vault", k: SCENE_K, anchor: contact("vault", "hand"), target: [ANCHOR.preskok.x, ANCHOR.preskok.y] },
  aerobik: { id: "highKick", k: AEROBIC_K, anchor: contact("highKick", "foot"), target: [ANCHOR.aerobik.x, ANCHOR.aerobik.y] },
};

export interface PosePlacement {
  id: ProgramPoseId;
  k: number;
  /** Where the pose's viewBox origin lands (icon units): translate(ox oy) scale(k). */
  ox: number;
  oy: number;
  /** The nested <svg>'s box on the drawing (icon units). */
  box: { x: number; y: number; width: number; height: number };
  /** The contact on the drawing (icon units): the quiz strip sticks its landing about it. */
  at: readonly [number, number];
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** The pose of a program's apparatus, placed on its drawing. */
export function posePlacement(icon: ApparatusIcon): PosePlacement {
  const { id, k, anchor, target } = PROGRAM_POSE[icon];
  const vb = PROGRAM_POSES[id].viewBox;
  const ox = target[0] - anchor[0] * k;
  const oy = target[1] - anchor[1] * k;
  return {
    id,
    k,
    ox: r3(ox),
    oy: r3(oy),
    box: { x: r3(ox + vb.x * k), y: r3(oy + vb.y * k), width: r3(vb.width * k), height: r3(vb.height * k) },
    at: [r3(target[0]), r3(target[1])],
  };
}

/** The same placement as an SVG transform (the latent print draws the path with it). */
export const poseTransform = (p: PosePlacement): string => `translate(${p.ox} ${p.oy}) scale(${r3(p.k)})`;

/**
 * Headroom of a scene: how far it rises above the 48-unit drawing (icon units, ≥ 0). The plates
 * reserve it (programs.css --head), so nothing is cut by the plate's top edge. `top`: the
 * highest point of what the scene draws, in pose units: the highest ink over every frame of the
 * exercise the plate plays (D-56; tests/programs.test.ts measures it), or the pose's own top
 * when omitted.
 */
export const headroom = (icon: ApparatusIcon, top?: number): number => {
  const p = posePlacement(icon);
  return Math.max(0, -(p.oy + (top ?? PROGRAM_POSES[p.id].viewBox.y) * p.k));
};
