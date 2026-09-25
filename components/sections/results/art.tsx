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
 * the result sheet (RC-01). It rises gently left → right along the floor diagonal and flicks
 * up at the end. One band of overlapping strands along a hand-set centreline: solid where
 * the brush is loaded, ragged at the start, splitting into dry streaks towards the end.
 * The SVG scales uniformly with the word (no preserveAspectRatio="none"), so the weights
 * stay in proportion and DrawSVG measures true lengths.
 */
const brushY = (x: number) => 23 - 0.035 * x - 0.00012 * x * x;
const brushPath = (spans: readonly (readonly [number, number])[], dy: number): string =>
  spans
    .map(([x0, x1]) => {
      const pts: string[] = [];
      for (let x = x0; x < x1; x += 8) pts.push(`${x} ${(brushY(x) + dy).toFixed(1)}`);
      pts.push(`${x1} ${(brushY(x1) + dy).toFixed(1)}`);
      return `M${pts.join("L")}`;
    })
    .join("");

/** Strands: offset across the band, width, opacity and the spans where the bristle touches. */
const MEDAL_BRUSH = [
  { dy: 0, w: 6, o: 1, spans: [[8, 226]] },
  { dy: -1.4, w: 3, o: 1, spans: [[3, 236]] },
  { dy: -3.8, w: 4, o: 1, spans: [[14, 194], [202, 222]] },
  { dy: 3.4, w: 4.2, o: 1, spans: [[6, 184], [193, 213]] },
  { dy: -6.4, w: 2.2, o: 0.82, spans: [[24, 148], [158, 188], [197, 231]] },
  { dy: 6.1, w: 2, o: 0.72, spans: [[12, 130], [141, 174], [185, 205]] },
] as const;

export function MedalBrush() {
  return (
    <svg className="medals__brush" viewBox="0 0 240 32" aria-hidden="true" focusable="false" data-medal-brush="">
      {MEDAL_BRUSH.map((b, i) => (
        <path key={i} d={brushPath(b.spans, b.dy)} strokeWidth={b.w} opacity={b.o} data-brush-stroke="" />
      ))}
    </svg>
  );
}
