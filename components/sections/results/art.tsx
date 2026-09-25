/**
 * S7 decorative SVGs (server-rendered, complete final state; results-motion.ts
 * draws them once on enter when motion is allowed).
 */

export type MedalKind = "gold" | "silver" | "bronze";

/**
 * Three-step podium drawn up from the bottom edge of the „Medalje“ gradient band:
 * 2nd (left) · 1st (centre) · 3rd (right), then the two step dividers.
 * Medal marks rest above the steps (gold/silver/bronze tokens only here).
 * Under the line sits its dotted ghost (the chronophotograph „ghost → solid“): hidden
 * by the solid line in the final state, it is what shows while the draw waits its turn.
 */
export const PODIUM = {
  viewBox: "0 0 296 112",
  d: "M36 112V68H108V38H180V82H252V112M108 68V112M180 82V112",
  marks: [
    { kind: "silver", cx: 72, cy: 53 },
    { kind: "gold", cx: 144, cy: 23 },
    { kind: "bronze", cx: 216, cy: 67 },
  ] satisfies { kind: MedalKind; cx: number; cy: number }[],
} as const;

export function Podium() {
  return (
    <svg className="podium" viewBox={PODIUM.viewBox} aria-hidden="true" focusable="false" data-podium="">
      <path className="podium__ghost" d={PODIUM.d} />
      <path className="podium__line" d={PODIUM.d} data-podium-line="" />
      {PODIUM.marks.map((m) => (
        <circle key={m.kind} className={`podium__mark medal-fill--${m.kind}`} cx={m.cx} cy={m.cy} r="9" data-podium-mark="" />
      ))}
    </svg>
  );
}

/**
 * White dry-brush stroke over photo 01 (one of the page's two brush annotations),
 * echoing the white strokes on the club-jacket sleeves. It sweeps up across the empty
 * floor in the lower right — beside the group, never over a person.
 * Coordinates are in the photo's own 960 × 720 space (4:3, uncropped).
 */
const BRUSH = [
  // body of the stroke, then a heavier core (the loaded middle), then dry bristle streaks
  { d: "M672 708C768 706 858 676 906 616C934 580 948 530 951 468", w: 10, o: 1 },
  { d: "M712 704C790 698 858 668 898 622C920 596 934 562 940 522", w: 17, o: 1 },
  { d: "M688 698C778 694 850 664 894 610C918 580 932 540 938 492", w: 3, o: 0.8 },
  { d: "M730 714C806 710 870 684 912 636M926 614C938 592 946 562 949 528", w: 2.5, o: 0.75 },
  { d: "M752 695C806 688 852 668 884 640", w: 2, o: 0.6 },
] as const;

export function Brush() {
  return (
    <svg className="results-brush" viewBox="0 0 960 720" aria-hidden="true" focusable="false" data-brush="">
      {BRUSH.map((b, i) => (
        <path key={i} d={b.d} strokeWidth={b.w} opacity={b.o} data-brush-stroke="" />
      ))}
    </svg>
  );
}
