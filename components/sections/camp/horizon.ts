/**
 * S8 „horizon“: the balance beam that becomes the summer sea (§4 Camp, design review v2).
 * One morphing path, two shapes with the SAME command structure (M + n × C), so MorphSVG
 * interpolates point-for-point: the beam is the wave's curve flattened and compressed
 * between its two ends. Around it: the beam's 10px bar and its splayed legs (visible only
 * while the scrubbed routine has not let go) and two echo swell lines behind the wave (the sea's depth).
 * Shared by the server markup (wave + echoes = the static final state) and the lazy
 * routine (camp-beam.ts). The SVG stretches (preserveAspectRatio="none"); every stroke is
 * non-scaling, so weights stay true on any width.
 */
export const HORIZON_VIEWBOX = { width: 1440, height: 80 } as const;

const WAVE_Y = 34;
export const BEAM_Y = 22;
export const BEAM_X0 = 196;
export const BEAM_X1 = 1244;
/** Bottom of the legs' feet (user units; below the viewBox — the SVG overflows visibly). */
const FOOT_Y = 97;

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

/** Sea wave — the static final state (no JS, reduced motion, after the routine). */
export const WAVE_D = build((x) => x, (s) => s.peak, WAVE_Y);

/** Beam top — the same curve flattened onto one line between the beam's ends. */
export const BEAM_D = build(
  (x) => BEAM_X0 + ((x - X_START) / (X_END - X_START)) * (BEAM_X1 - BEAM_X0),
  () => BEAM_Y,
  BEAM_Y,
);

/** The beam's bar: a straight 10px non-scaling stroke (a rect would distort when stretched). */
export const BAR_D = `M${BEAM_X0} ${BEAM_Y}H${BEAM_X1}`;

/** Two splayed legs with long feet, under the bar near its ends. */
export const LEG_XS = [BEAM_X0 + 150, BEAM_X1 - 150] as const;
export const LEGS_D = LEG_XS.map(
  (x) => `M${x} ${BEAM_Y + 5}L${x - 14} ${FOOT_Y}M${x} ${BEAM_Y + 5}L${x + 14} ${FOOT_Y}M${x - 30} ${FOOT_Y}H${x + 30}`,
).join("");
export const LEGS_FOOT_Y = FOOT_Y;

/**
 * Echo swells behind the wave (RC-13): the same curve shifted left and down, stretched by a
 * few percent so each still reaches past the right edge.
 */
export const ECHO_DS = [
  { dx: -36, dy: 9 },
  { dx: -72, dy: 18 },
].map(({ dx, dy }) => {
  const k = (X_END + 12 - X_START - dx) / (X_END - X_START);
  return build((x) => X_START + dx + (x - X_START) * k, (s) => s.peak + dy, WAVE_Y + dy);
});
