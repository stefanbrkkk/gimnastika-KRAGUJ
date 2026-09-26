/**
 * S10 „Jedna zvezda, tri koraka“ — geometry of the enrollment band (pure, no DOM; plan §5.9).
 * The three steps are phases of ONE cartwheel on a Marey plate, finishing in the salute over
 * step 3 („Ako se detetu dopadne, postaje član kluba“): a routine ends with a salute.
 *   cart1 (the start, one foot down)      over step 1 — its foot on tick 1
 *   cart2 (through the handstand)         over step 2 — its hands centred on tick 2
 *   cart3 (the landing lunge)             approaching step 3
 *   salute (feet together, arms in a V)   over step 3 — its feet on tick 3
 * Every support lands ahead of the previous one (foot → hands → lunge foot → feet), and no two
 * figures stand closer than ≈70% of the wider one (the pose sheet's legibility rule).
 *
 * Units: the band's own viewBox. The figures are the pose family (components/brand/
 * poses.generated.ts) scaled by `s`; each is its own nested <svg data-figure="pose:<id>">.
 * The motion chunk (leap-motion.ts) never imports this module (it would pull the path strings):
 * it reads the few numbers it needs from the markup (data-origin).
 */
import { POSES, type PoseData } from "@/components/brand/poses.generated";

export interface Pt {
  x: number;
  y: number;
}

/** The figures in the order of the movement; the salute is the solid one. */
export const SEQUENCE = ["cart1", "cart2", "cart3", "salute"] as const;
export type FigureId = (typeof SEQUENCE)[number];

export interface BandSpec {
  /** viewBox width/height. */
  w: number;
  h: number;
  /** Mat line y. */
  mat: number;
  /** Pose units → band units (the pose family is drawn at the logo figure's body scale). */
  s: number;
  /**
   * The three mat ticks, one per step numeral (GE2-09): cart1's foot, cart2's hands and the
   * salute's feet stand on them.
   */
  ticks: readonly [number, number, number];
  /** Centre distance from cart3 to the salute, in widths of the wider of the two (≥ .7). */
  landGap: number;
}

/**
 * ≥640px: the figures over the three step columns. Each tick stands under its step numeral's
 * centre (column left + half the numeral), measured in the DOM: 1440/1920 → 14 · 426 · 834,
 * 1280 → 14 · 428 · 836, 1024 → 16 · 432 · 844, 768 → 19 · 435 · 846 band units. 14 / 428 / 837
 * keep every tick within ≈4px of its numeral on desktop (≤8px at 640).
 */
export const WIDE: BandSpec = { w: 1200, h: 200, mat: 186, s: 0.64, ticks: [14, 428, 837], landGap: 0.85 };
/** <640px: a compact plate above the step list; the ticks carry the step numbers 1–3. */
export const NARROW: BandSpec = { w: 350, h: 108, mat: 92, s: 0.36, ticks: [16, 142, 306], landGap: 0.8 };

export interface BandFigure {
  id: FigureId;
  /** The nested <svg>'s box in band units. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The support on the mat (band units): the stuck landing's squash pivots on it. */
  support: Pt;
}

export interface Band {
  spec: BandSpec;
  figures: [BandFigure, BandFigure, BandFigure, BandFigure];
}

const pose = (id: FigureId): PoseData => POSES[id];

/** The support of each figure in pose units: a foot, the hands' midpoint or the feet. */
function supportOf(id: FigureId): Pt {
  const p = pose(id);
  const c = p.contacts ?? {};
  const floor = p.floor ?? p.viewBox.y + p.viewBox.height;
  const at = (k: string) => {
    const v = c[k];
    if (!v) throw new Error(`pose ${id} has no contact "${k}"`);
    return v;
  };
  switch (id) {
    case "cart1":
    case "cart3":
      return { x: at("foot")[0], y: floor };
    case "cart2":
      return { x: (at("handL")[0] + at("handR")[0]) / 2, y: floor };
    case "salute":
      return { x: p.viewBox.x + p.viewBox.width / 2, y: floor };
  }
}

/** The figure placed with its support at band x = `supportX`, standing on the mat. */
function place(id: FigureId, supportX: number, { s, mat }: BandSpec): BandFigure {
  const { viewBox } = pose(id);
  const sp = supportOf(id);
  const x = supportX - (sp.x - viewBox.x) * s;
  const y = mat - (sp.y - viewBox.y) * s;
  return { id, x, y, width: viewBox.width * s, height: viewBox.height * s, support: { x: supportX, y: mat } };
}

const centre = (f: BandFigure) => f.x + f.width / 2;

export function buildBand(spec: BandSpec): Band {
  const [t1, t2, t3] = spec.ticks;
  const cart1 = place("cart1", t1, spec);
  const cart2 = place("cart2", t2, spec);
  const salute = place("salute", t3, spec);
  // cart3 approaches step 3: its centre `landGap` widths (of the wider figure) before the salute's.
  const probe = place("cart3", 0, spec);
  const cx = centre(salute) - spec.landGap * Math.max(probe.width, salute.width);
  const cart3 = place("cart3", cx - centre(probe), spec);
  return { spec, figures: [cart1, cart2, cart3, salute] };
}

/** Band units rounded to 0.1 for the markup. */
export const r1 = (n: number) => Math.round(n * 10) / 10;
