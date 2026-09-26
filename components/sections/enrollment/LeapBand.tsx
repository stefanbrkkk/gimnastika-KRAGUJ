import { POSES } from "@/components/brand/poses.generated";
import { buildBand, r1, type BandSpec } from "./leap-band";

const TICK = { wide: 10, narrow: 6 } as const;

/**
 * „Jedna zvezda, tri koraka“ — the enrollment chronophotograph (plan §5.9): the three steps as
 * phases of one cartwheel on a mat line, finishing in the salute over step 3. Marey's measuring
 * rule: a tick under each step's support (cart1's foot, cart2's hands, the salute's feet), aligned
 * with the step numerals. Static final composition (server-rendered, aria-hidden): the three
 * phases are ghosts in the shared --ghost-1/2/3 tokens, the salute is the solid accent.
 * Each figure is its own <svg data-figure="pose:<id>"> (the figure budget counts four), inside
 * a <g> the motion moves (leap-motion.ts: the fragments' travel, the salute's squash about
 * data-origin, its feet on the mat). `variant`: wide (≥640, over the three step columns) or
 * narrow (<640, a compact plate above the step list, ticks numbered 1–3).
 */
export function LeapBand({ spec, variant }: { spec: BandSpec; variant: "wide" | "narrow" }) {
  const band = buildBand(spec);
  const { w, h, mat, ticks } = spec;
  const tick = TICK[variant];

  return (
    <svg className="en-band" data-variant={variant} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
      <line className="en-band__mat" x1={0} x2={w} y1={mat} y2={mat} />
      {ticks.map((x, i) => (
        <line key={i} className="en-band__tick" data-step={i + 1} x1={x} x2={x} y1={mat} y2={mat + tick} />
      ))}
      {variant === "narrow"
        ? ticks.map((x, i) => (
            <text key={i} className="en-band__num" data-step={i + 1} x={x} y={h - 1} textAnchor="middle">
              {i + 1}
            </text>
          ))
        : null}
      {band.figures.map((f) => {
        const { d, viewBox: vb } = POSES[f.id];
        return (
          <g key={f.id} className="en-band__frame" data-frame={f.id} data-origin={`${r1(f.support.x)} ${r1(f.support.y)}`}>
            <svg
              data-figure={`pose:${f.id}`}
              x={r1(f.x)}
              y={r1(f.y)}
              width={r1(f.width)}
              height={r1(f.height)}
              viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
              aria-hidden="true"
              focusable="false"
            >
              <path d={d} fill="currentColor" />
            </svg>
          </g>
        );
      })}
    </svg>
  );
}
