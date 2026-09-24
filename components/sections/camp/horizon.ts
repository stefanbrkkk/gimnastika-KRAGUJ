/**
 * S8 „horizon“: the gymnastics beam that becomes a sea wave (§4 Camp).
 * One path, two shapes with the SAME command structure (M + n × C), so MorphSVG
 * interpolates point-for-point: the beam is the wave's curve flattened and
 * compressed between its two ends. Shared by the server markup (wave = static
 * final state) and the lazy desktop scrub (camp-beam.ts).
 */
export const HORIZON_VIEWBOX = { width: 1440, height: 64 } as const;

const WAVE_Y = 34;
const BEAM_Y = 22;
const BEAM_X0 = 196;
const BEAM_X1 = 1244;

/** Half-waves: [length, amplitude] — an irregular, hand-set swell (not a sine). */
const SWELL: readonly (readonly [number, number])[] = [
  [58, 4], [84, 7], [96, 10], [78, 8], [112, 14], [92, 11], [128, 17], [104, 12],
  [86, 9], [118, 15], [98, 11], [76, 8], [110, 13], [90, 10], [72, 7], [66, 5],
];

const X_START = -24;
const X_END = HORIZON_VIEWBOX.width + 24;
const total = SWELL.reduce((sum, [len]) => sum + len, 0);
const scale = (X_END - X_START) / total;

const r = (n: number) => Math.round(n * 10) / 10;

interface Seg {
  x0: number;
  x1: number;
  peak: number;
}

const SEGS: Seg[] = (() => {
  let x = X_START;
  return SWELL.map(([len, amp], i) => {
    const w = len * scale;
    const seg = { x0: x, x1: x + w, peak: WAVE_Y + (i % 2 === 0 ? -amp : amp * 0.6) };
    x += w;
    return seg;
  });
})();

function build(mapX: (x: number) => number, y: (seg: Seg) => number, base: number): string {
  const first = SEGS[0];
  if (!first) return "";
  let d = `M${r(mapX(first.x0))} ${base}`;
  for (const s of SEGS) {
    const w = s.x1 - s.x0;
    const py = y(s);
    d += `C${r(mapX(s.x0 + w * 0.36))} ${r(py)} ${r(mapX(s.x1 - w * 0.36))} ${r(py)} ${r(mapX(s.x1))} ${base}`;
  }
  return d;
}

/** Sea wave — the static final state (no JS, mobile, reduced motion). */
export const WAVE_D = build((x) => x, (s) => s.peak, WAVE_Y);

/** Beam top — the same curve flattened onto one line between the beam's ends. */
export const BEAM_D = build(
  (x) => BEAM_X0 + ((x - X_START) / (X_END - X_START)) * (BEAM_X1 - BEAM_X0),
  () => BEAM_Y,
  BEAM_Y,
);

/** A-frame legs + feet under the beam; visible only at the start of the desktop scrub. */
export const LEGS_D = [BEAM_X0 + 132, BEAM_X1 - 132]
  .map((x) => `M${x} ${BEAM_Y + 3}L${x - 16} 60M${x} ${BEAM_Y + 3}L${x + 16} 60M${x - 30} 60H${x + 30}`)
  .join("");
