import { EXERCISE_ENROLL_CARTWHEEL } from "@/components/brand/exercises/enrollCartwheel.generated";
import { POSES } from "@/components/brand/poses.generated";
import { keyedOffset } from "@/lib/exercise-scrub";
import { buildBand, keyShifts, r1, type BandSpec } from "./leap-band";

const TICK = { wide: 10, narrow: 6 } as const;
const EXERCISE = EXERCISE_ENROLL_CARTWHEEL;

const pair = ([x, y]: readonly [number, number]) => `${r1(x)} ${r1(y)}`;

/**
 * „Jedna zvezda, tri koraka“ — the enrollment chronophotograph (plan §5.9): the three steps as
 * phases of one cartwheel on a mat line, finishing in the salute over step 3. Marey's measuring
 * rule: a tick under each step's support (cart1's foot, cart2's hands, the salute's feet), aligned
 * with the step numerals. Static final composition (server-rendered, aria-hidden): the three
 * phases are ghosts in the shared --ghost-1/2/3 tokens, the salute is the solid accent.
 * All four are frames of ONE exercise (enrollCartwheel, D-52) in the salute's nested <svg
 * data-figure="pose:salute" overflow="visible"> (the figure budget counts one): each ghost is its
 * key frame moved onto its step (keyShifts). With motion, leap-motion.ts scrubs the whole
 * cartwheel with the scroll — the flier wheels from step to step (the shifts blended between
 * keys, read from data-shifts / data-keys), each phase she passes stays as its ghost, and she
 * sticks the salute over step 3. `variant`: wide (≥640, over the three step columns) or narrow
 * (<640, a compact plate above the step list, ticks numbered 1–3).
 */
export function LeapBand({ spec, variant }: { spec: BandSpec; variant: "wide" | "narrow" }) {
  const band = buildBand(spec);
  const { w, h, mat, ticks } = spec;
  const tick = TICK[variant];
  const salute = band.figures[3];
  const vb = POSES[EXERCISE.pose].viewBox;
  const shifts = keyShifts(band, EXERCISE.keyOrigins);
  const shiftAt = keyedOffset(EXERCISE.keys, shifts);

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
      <svg
        className="en-band__figure"
        data-figure={`pose:${EXERCISE.pose}`}
        x={r1(salute.x)}
        y={r1(salute.y)}
        width={r1(salute.width)}
        height={r1(salute.height)}
        viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
        overflow="visible"
        data-keys={EXERCISE.keys.join(" ")}
        data-shifts={shifts.map(pair).join(",")}
        aria-hidden="true"
        focusable="false"
      >
        {EXERCISE.ghosts.map((f, i) => (
          <path
            key={f}
            className="ex-ghost en-band__ghost"
            data-phase={i + 1}
            data-frame={f}
            d={EXERCISE.frames[f]}
            transform={`translate(${pair(shiftAt(f))})`}
            fill="currentColor"
          />
        ))}
        <g className="en-band__stick">
          <path className="ex-solid en-band__solid" d={POSES[EXERCISE.pose].d} fill="currentColor" />
        </g>
      </svg>
    </svg>
  );
}
