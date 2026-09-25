/**
 * S10 „Jedan skok, tri kadra“ — geometry of the enrollment leap band (pure, no
 * DOM). The three steps are three frames of ONE split leap on a Marey plate:
 * takeoff (back foot on the mat, pitched up), apex (level split, high), landing
 * (front foot on the mat, pitched down = „postaje član kluba“). The server
 * renders the static chronophotograph from it; the lazy motion chunk flies the
 * solid silhouette along the same trajectory, so the flight ends exactly on the
 * landed frame.
 *
 * Units: the band's own viewBox. The silhouette is the logo's #leap symbol
 * (viewBox 262 48 230 150), drawn 1:1 by <use x=262 y=48 width=230 height=150>,
 * so symbol coordinates are the frame's local coordinates.
 */

export interface Pt {
  x: number;
  y: number;
}

/** Landmarks on the #leap silhouette (symbol coordinates, measured from the path). */
export const LEAP_SYMBOL = { x: 262, y: 48, width: 230, height: 150 } as const;
/** Sole of the back foot: the lowest point once the figure is pitched to takeoff (−24°). */
const BACK_SOLE: Pt = { x: 279.9, y: 170.8 };
/** Sole of the front foot: the lowest point at the landing pitch (+6°). */
const FRONT_SOLE: Pt = { x: 485.5, y: 194.6 };
/** Centre of mass: the hips, where the torso meets the split. */
const HIP: Pt = { x: 365, y: 166 };

/** Pitch of the three frames (deg, clockwise positive). −10° is a level split. */
const PITCH = { takeoff: -24, apex: -10, landing: 6 } as const;

export interface BandSpec {
  /** viewBox width/height. */
  w: number;
  h: number;
  /** Mat line y. */
  mat: number;
  /** Silhouette scale (symbol units → band units). */
  s: number;
  /** Hip x of the takeoff frame; the apex and landing follow every `step`. */
  x0: number;
  step: number;
  /** Height of the apex frame's hips above the takeoff/landing hips. */
  lift: number;
  /**
   * Optional mat ticks for the apex (its hip projection) and the landing (the front sole's
   * contact), when they must meet other marks; they replace the even `step` spacing.
   */
  ticks?: { apex: number; landing: number };
}

/**
 * ≥640px: frames over the three step columns. Each mat tick stands under its step numeral's
 * centre (column left + half the numeral), measured in the DOM: 1440/1920 → 14 · 426 · 834,
 * 1280 → 14 · 428 · 836, 1024 → 16 · 432 · 844, 768 → 19 · 435 · 846 band units. The chosen
 * 428 / 837 keep every tick within ≈4px of its numeral on desktop (≤8px at 640).
 */
export const WIDE: BandSpec = { w: 1200, h: 200, mat: 186, s: 0.54, x0: 58, step: 408, lift: 100, ticks: { apex: 428, landing: 837 } };
/** <640px: frames centred on the band's thirds, a compact arc above the step list. */
export const NARROW: BandSpec = { w: 350, h: 108, mat: 92, s: 0.3, x0: 42, step: 122, lift: 40 };

/** Final opacity of the two ghost frames (the landing is solid); the band's CSS colours them
 *  with the shared leotard ghost tokens (--ghost-1 takeoff, --ghost-2 apex). */
export const FRAME_OPACITY = { takeoff: 0.42, apex: 0.5 } as const;

export type FrameKind = "takeoff" | "apex" | "landing";

export interface BandFrame {
  kind: FrameKind;
  /** SVG transform for the <g> that holds the <use>. */
  transform: string;
  /** World hip position (the trajectory passes through it). */
  hip: Pt;
  /** World x of the mat tick under the frame (contact point, or the hip for the apex). */
  tickX: number;
  pitch: number;
}

export interface Band {
  spec: BandSpec;
  frames: [BandFrame, BandFrame, BandFrame];
  /** Quadratic trajectory through the three hips: M p0 Q c p2 (passes the apex hip at t = .5). */
  path: string;
  p0: Pt;
  c: Pt;
  p2: Pt;
  /** Landing contact (front sole) — the origin of the stuck-landing squash. */
  landing: Pt;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Rotates the symbol-space vector `v` by `deg` and scales it by `s`. */
function turn(v: Pt, deg: number, s: number): Pt {
  const a = rad(deg);
  return { x: s * (v.x * Math.cos(a) - v.y * Math.sin(a)), y: s * (v.x * Math.sin(a) + v.y * Math.cos(a)) };
}

/** transform = translate(hip) rotate(pitch) scale(s) translate(−HIP): the hip is the frame's origin. */
export function frameTransform(hip: Pt, pitch: number, s: number): string {
  return `translate(${r1(hip.x)} ${r1(hip.y)}) rotate(${r1(pitch)}) scale(${s}) translate(${-HIP.x} ${-HIP.y})`;
}

/** Hip position that puts `contact` (a symbol point) on the mat, with the hip at x = hipX. */
function hipOnMat(contact: Pt, pitch: number, s: number, hipX: number, mat: number): { hip: Pt; contactX: number } {
  const d = turn({ x: contact.x - HIP.x, y: contact.y - HIP.y }, pitch, s);
  return { hip: { x: hipX, y: mat - d.y }, contactX: hipX + d.x };
}

export function buildBand(spec: BandSpec): Band {
  const { s, x0, step, mat, lift, ticks } = spec;
  const take = hipOnMat(BACK_SOLE, PITCH.takeoff, s, x0, mat);
  // A landing tick fixes the front sole's contact; the hip stands back from it by the pitched sole offset.
  const landHipX = ticks ? ticks.landing - hipOnMat(FRONT_SOLE, PITCH.landing, s, 0, mat).contactX : x0 + 2 * step;
  const land = hipOnMat(FRONT_SOLE, PITCH.landing, s, landHipX, mat);
  const p0 = take.hip;
  const p2 = land.hip;
  // Apex `lift` above the chord, midway in x unless its tick says otherwise. The quadratic passes
  // through it at t = .5 (with an off-centre apex x is no longer exactly linear in t; at ±13
  // units over 716 the horizontal speed varies by a few percent).
  const apex: Pt = { x: ticks ? ticks.apex : (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 - lift };
  const c: Pt = { x: 2 * apex.x - (p0.x + p2.x) / 2, y: 2 * apex.y - (p0.y + p2.y) / 2 };
  const frames: Band["frames"] = [
    { kind: "takeoff", transform: frameTransform(p0, PITCH.takeoff, s), hip: p0, tickX: take.contactX, pitch: PITCH.takeoff },
    { kind: "apex", transform: frameTransform(apex, PITCH.apex, s), hip: apex, tickX: apex.x, pitch: PITCH.apex },
    { kind: "landing", transform: frameTransform(p2, PITCH.landing, s), hip: p2, tickX: land.contactX, pitch: PITCH.landing },
  ];
  return {
    spec,
    frames,
    path: `M${r1(p0.x)} ${r1(p0.y)}Q${r1(c.x)} ${r1(c.y)} ${r1(p2.x)} ${r1(p2.y)}`,
    p0,
    c,
    p2,
    landing: { x: land.contactX, y: mat },
  };
}

/** Point on the trajectory at parameter t (0 takeoff → .5 apex → 1 landing). */
export function pointAt(b: Pick<Band, "p0" | "c" | "p2">, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * b.p0.x + 2 * u * t * b.c.x + t * t * b.p2.x,
    y: u * u * b.p0.y + 2 * u * t * b.c.y + t * t * b.p2.y,
  };
}

/**
 * Parameter t at which the trajectory reaches horizontal position `x` (clamped to the flight).
 * The flight runs on x at a constant speed and reads y (and the pitch) off the path at that x:
 * a real leap's ballistics, the same model as the hero's floor pass and the title marks (X
 * linear, Y a parabola). x(t) is quadratic when the apex tick sits off the chord's midpoint.
 */
export function tAtX(b: Pick<Band, "p0" | "c" | "p2">, x: number): number {
  const a = b.p0.x - 2 * b.c.x + b.p2.x;
  const k = 2 * (b.c.x - b.p0.x);
  const d = b.p0.x - x;
  const t = Math.abs(a) < 1e-9 ? -d / k : (-k + Math.sqrt(Math.max(0, k * k - 4 * a * d))) / (2 * a);
  return Math.min(1, Math.max(0, t));
}

/** Torso pitch at parameter t: a quadratic through takeoff (0), apex (.5) and landing (1). */
export function pitchAt(t: number): number {
  const { takeoff: a, apex: m, landing: b } = PITCH;
  // Lagrange through (0,a) (.5,m) (1,b).
  return a * (2 * t - 1) * (t - 1) - 4 * m * t * (t - 1) + b * t * (2 * t - 1);
}
