/**
 * S7 decorative SVGs (server-rendered, complete final state; results-motion.ts
 * plays them once on enter when motion is allowed).
 */

export type MedalKind = "gold" | "silver" | "bronze";

/**
 * The podium rising out of the „Medalje“ panel (design review v2, RC-05): three solid
 * navy blocks (2nd · 1st · 3rd) standing on the bottom edge of the gradient band, the
 * same navy as the panel body below, so the podium and the panel read as one silhouette.
 * A 2.5 navy-950 outline draws over them and a medal with a V-ribbon stands on each step.
 * No place numerals: digits next to „Medalje“ would read as medal counts, which the club
 * has not confirmed (SOURCE RULE; qa results.noMedalCounts). Step heights + medal colours
 * carry the order.
 * Under the outline sits its dotted ghost (chronophotograph „ghost → solid“): hidden by the
 * outline in the final state, visible only while the ceremony waits for its turn.
 * Units: the floor is y = 116 (the band's bottom edge).
 */
const FLOOR = 116;
const STEP_W = 88;
const STEPS = [
  { place: "2", kind: "silver", x: 28, h: 44 },
  { place: "1", kind: "gold", x: 116, h: 64 },
  { place: "3", kind: "bronze", x: 204, h: 30 },
] as const satisfies readonly { place: string; kind: MedalKind; x: number; h: number }[];

const top = (h: number) => FLOOR - h;
const cx = (x: number) => x + STEP_W / 2;
/** Disc radius and the gap between the disc and its step. */
const R = 10;
const OUTLINE = (() => {
  const [second, first, third] = STEPS;
  return (
    `M${second.x} ${FLOOR}V${top(second.h)}H${first.x}V${top(first.h)}H${third.x}V${top(third.h)}H${third.x + STEP_W}V${FLOOR}` +
    `M${first.x} ${top(second.h)}V${FLOOR}M${third.x} ${top(third.h)}V${FLOOR}`
  );
})();

export const PODIUM_VIEWBOX = { x: 16, y: 10, width: 288, height: FLOOR - 10 } as const;

export function Podium() {
  const { x, y, width, height } = PODIUM_VIEWBOX;
  return (
    <svg className="podium" viewBox={`${x} ${y} ${width} ${height}`} aria-hidden="true" focusable="false" data-podium="">
      {STEPS.map((s) => (
        <g key={s.place} className="podium__step" data-podium-step="">
          {/* +1: the block overlaps the band edge, so no seam shows against the panel body. */}
          <rect className="podium__block" x={s.x} y={top(s.h)} width={STEP_W} height={s.h + 1} data-podium-block="" />
        </g>
      ))}
      <path className="podium__ghost" d={OUTLINE} />
      <path className="podium__line" d={OUTLINE} data-podium-line="" />
      {STEPS.map((s) => {
        const mx = cx(s.x);
        const my = top(s.h) - R - 1.5;
        return (
          <g key={s.kind} className="podium__medal" data-podium-medal={s.kind}>
            <path className="podium__ribbon" d={`M${mx - 7} ${my - R - 10}L${mx} ${my - R + 1}L${mx + 7} ${my - R - 10}`} />
            <circle className={`podium__disc medal-fill--${s.kind}`} cx={mx} cy={my} r={R} />
            <circle className="podium__disc-ring" cx={mx} cy={my} r={5.4} />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The white dry-brush underline under „Medalje“ — one of the page's two brush annotations
 * (§3), echoing the white strokes on the club-jacket sleeves: a coach marking the wins on
 * the result sheet (RC-01). Drawn by the same hand as the S5 loop around the coaches
 * (coaches/brush-geometry.ts, AC2-01): a loaded core and four bristle strands offset across
 * the stroke, the brush pressure breathing along it, and each bristle's dry gaps as a static
 * dash mask (so DrawSVG still owns the dash).
 *
 * Design review RC2-02: the centreline rises only ≈ 8 units over the word (its right end
 * stays under the „j“ descender) and every strand converges on the core at both ends
 * (offset × sin(π·x/240)^0.6), landing and lifting 6–14 units inside the core's ends — a
 * taper, never a stepped slab. At 1440 the body reads ≈ 5 px, the S5 loop's weight.
 * The SVG scales uniformly with the word (no preserveAspectRatio="none"), so the weights
 * stay in proportion and DrawSVG measures true lengths.
 */
const BRUSH_W = 240;
const brushY = (x: number) => 23 - 0.02 * x - 0.00005 * x * x;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** The strands meet the core at both ends: a short, pressed landing and a long dry lift. */
const taper = (x: number) => smooth(-4, 22, x) * Math.pow(smooth(BRUSH_W, 140, x), 0.7);
/** Brush pressure breathes along the stroke (as in the S5 loop). */
const pressure = (x: number) => 1 + 0.12 * Math.sin((2 * Math.PI * 1.3 * x) / BRUSH_W + 1);
const brushPath = (x0: number, x1: number, d: number): string => {
  const pts: string[] = [];
  const at = (x: number) => `${x} ${(brushY(x) + d * taper(x) * pressure(x)).toFixed(2)}`;
  for (let x = x0; x < x1; x += 6) pts.push(at(x));
  pts.push(at(x1));
  return `M${pts.join("L")}`;
};

interface BrushStrand {
  /** Stroke width (viewBox units; ≈ 0.56 px at 1440). */
  w: number;
  /** Offset across the stroke (before taper and pressure). */
  d: number;
  /** Where the bristle touches down and lifts (inside the core's ends). */
  x0: number;
  x1: number;
  o: number;
  /** Static dry gaps (a mask): few while the brush is loaded, more as it runs dry. */
  gaps?: string;
}

const MEDAL_BRUSH: readonly BrushStrand[] = [
  // The loaded core runs the full length; the body forms around it and thins to it at both ends.
  { w: 3.2, d: 0, x0: 9, x1: 234, o: 1 },
  { w: 2.8, d: 2.2, x0: 13, x1: 226, o: 1, gaps: "150 2 36 3 20 3 300" },
  { w: 2.6, d: -2.4, x0: 12, x1: 212, o: 0.95, gaps: "110 3 50 3 26 4 300" },
  // Dry bristles: a streak along the top that breaks up towards the lift, and a short one
  // under the loaded start.
  { w: 1.2, d: 4.8, x0: 28, x1: 230, o: 0.85, gaps: "58 4 34 5 22 6 13 7 8 8 6 9 300" },
  { w: 1.1, d: -4.6, x0: 20, x1: 150, o: 0.8, gaps: "46 4 30 5 18 6 300" },
];

export function MedalBrush() {
  return (
    <svg className="medals__brush" viewBox={`0 0 ${BRUSH_W} 32`} aria-hidden="true" focusable="false" data-medal-brush="">
      <defs>
        {MEDAL_BRUSH.map((b, i) =>
          b.gaps ? (
            <mask key={i} id={`medal-brush-gaps-${i}`} maskUnits="userSpaceOnUse" x="-8" y="-8" width={BRUSH_W + 16} height="48">
              <path d={brushPath(b.x0, b.x1, b.d)} fill="none" stroke="#fff" strokeWidth={b.w + 3} strokeDasharray={b.gaps} />
            </mask>
          ) : null,
        )}
      </defs>
      {MEDAL_BRUSH.map((b, i) => (
        <path
          key={i}
          d={brushPath(b.x0, b.x1, b.d)}
          strokeWidth={b.w}
          opacity={b.o}
          mask={b.gaps ? `url(#medal-brush-gaps-${i})` : undefined}
          data-brush-stroke=""
        />
      ))}
    </svg>
  );
}
