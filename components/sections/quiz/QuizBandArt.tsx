/**
 * The darkroom strip's picture (server component, no client code): a Marey chronophotograph
 * of one tumbling pass drawn once — measuring grid, mat, the three apparatus drawings, seven
 * latent exposures of #leap and the flier. Every state is chosen by CSS from the data
 * attributes QuizBand sets (data-step / data-v / data-app / data-dir), so the quiz island
 * ships none of this geometry. Poses per variant and develop delays travel as inline custom
 * properties (geometry.ts); the motion itself is CSS (styles/sections/quiz.css).
 */
import type { CSSProperties } from "react";
import {
  APPARATUS,
  EXPOSURES,
  FLIER,
  FOOT,
  FRAME_X,
  FIG_H,
  FIG_W,
  GRID_X,
  MAT_Y,
  PUFF,
  USE_X,
  USE_Y,
  VB_H,
  VB_W,
  transformOf,
  type BandApparatus,
} from "./geometry";
import { iconArt } from "./views";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

const [X1, X2, X3] = FRAME_X;
const MAJOR = new Set<number>(FRAME_X);
const APPS: readonly BandApparatus[] = ["parter", "greda", "razboj"];

/** Resting places of the flier, per state (CSS picks one: .quiz-band[data-step][data-v]). */
const flierVars: Vars = {
  "--f0": transformOf(FLIER.f0),
  "--f1": transformOf(FLIER.f1),
  "--f2-flat": transformOf(FLIER.f2.flat),
  "--f2-parter": transformOf(FLIER.f2.parter),
  "--f2-greda": transformOf(FLIER.f2.greda),
  "--f2-skip": transformOf(FLIER.f2.skip),
};

function Leap() {
  return <use href="#leap" x={USE_X} y={USE_Y} width={FIG_W} height={FIG_H} />;
}

export function QuizBandArt() {
  return (
    <svg className="quiz-band__svg" viewBox={`0 0 ${VB_W} ${VB_H}`} focusable="false" style={flierVars}>
      <g className="qb-grid">
        {GRID_X.map((x) => (
          <line key={x} x1={x} x2={x} y1={8} y2={MAT_Y} data-major={MAJOR.has(x) ? "" : undefined} />
        ))}
      </g>

      {/* The apparatus of the recommended program, drawn in under frame 03 as she lands. */}
      <g className="qb-apps">
        {APPS.map((id) => {
          const a = APPARATUS[id];
          const art = iconArt(id);
          return (
            <g
              key={id}
              className={`qb-app qb-app--${id}`}
              transform={`translate(${a.x} ${a.y}) scale(${a.s})`}
              style={{ "--s": a.s } as Vars}
            >
              {art.paths.map(({ d, k }) => (
                <path key={d} d={d} pathLength={1} data-k={k} />
              ))}
            </g>
          );
        })}
      </g>

      <line className="qb-mat" x1={16} x2={X1} y1={MAT_Y} y2={MAT_Y} />
      <line className="qb-mat qb-mat--span" x1={X1} x2={X3} y1={MAT_Y} y2={MAT_Y} />
      {/* Ages 3–7: one longer flight — no contact between 01 and 03. */}
      <line className="qb-mat qb-mat--air" x1={X1} x2={X3} y1={MAT_Y} y2={MAT_Y} />
      <line className="qb-mat" x1={X3} x2={VB_W - 16} y1={MAT_Y} y2={MAT_Y} />
      {[X1, X2, X3].map((x, i) => (
        <line key={x} className={`qb-tick qb-tick--${i + 1}`} x1={x} x2={x} y1={MAT_Y} y2={MAT_Y + 9} />
      ))}

      <g className="qb-latent">
        {EXPOSURES.map((e, i) => {
          const style: Vars = {
            "--i": i,
            "--t-flat": transformOf(e.pose.flat),
            "--t-parter": transformOf(e.pose.parter),
            "--t-greda": transformOf(e.pose.greda),
            "--t-skip": transformOf(e.pose.skip),
            "--d": `${e.delay}ms`,
            "--ds": `${e.delaySkip}ms`,
          };
          return (
            <g key={e.id} className={`qf qf--${e.id}`} data-key={e.key ? "" : undefined} style={style}>
              <Leap />
            </g>
          );
        })}
      </g>

      {/* The flier: X and base height (.qb-fly, transition), the parabola (.qb-hop), torso pitch
          (.qb-pitch) and the stuck landing, compressed from the feet (.qb-stick). */}
      <g className="qb-fly">
        <g className="qb-hop">
          <g className="qb-pitch">
            <g transform={`translate(0 ${FOOT.y})`}>
              <g className="qb-stick">
                <g transform={`translate(0 ${-FOOT.y})`}>
                  <Leap />
                </g>
              </g>
            </g>
          </g>
        </g>
        <g className="qb-puff" transform={`translate(${FOOT.x} ${FOOT.y})`}>
          {PUFF.map(([dx, dy], i) => (
            <circle key={i} r={4.5} style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, "--i": i } as Vars} />
          ))}
        </g>
      </g>
    </svg>
  );
}
