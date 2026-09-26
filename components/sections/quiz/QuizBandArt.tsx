/**
 * The darkroom strip's picture (server component, no client code): a Marey chronophotograph
 * of one tumbling pass drawn once — measuring grid, mat, the three landing apparatus, two latent
 * exposures of #leap (the take-off at 01 and the apex: two real phases of the leap, figure
 * system R3), the flier and the three landing poses. At frame 03 she becomes the recommended
 * program's pose on its apparatus (plan §5.3): a crossfade from the leap to the pose at
 * touchdown, then the pose sticks about its contact. Every state is chosen by CSS from the data
 * attributes QuizBand sets (data-step / data-v / data-app / data-dir), so the quiz island ships
 * none of this geometry. Poses per variant and develop delays travel as inline custom properties
 * (geometry.ts); the motion itself is CSS (styles/sections/quiz.css).
 *
 * Paint order is the print's: the scene (apparatus, grid, mat) → exposures → flier → landing
 * pose. The exposures are phases of the first leap (x ≤ 454) and every landing apparatus stands
 * right of 03's left edge (x ≥ 465), so no ghost crosses an apparatus line and nothing needs
 * masking (the QP3-05 occluder is gone). The brand figure (the flier and its two exposures) and
 * the poses share this svg: each pose is its own nested <svg data-figure="pose:<id>">.
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
  LANDING,
  MAT_Y,
  PUFF,
  USE_X,
  USE_Y,
  VB_H,
  VB_W,
  transformOf,
  type BandApparatus,
} from "./geometry";
import { POSES } from "@/components/brand/poses.generated";
import { iconArt } from "./views";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

const [X1, X2, X3] = FRAME_X;
const MAJOR = new Set<number>(FRAME_X);
const APPS: readonly BandApparatus[] = ["parter", "greda", "preskok"];

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

/** The two exposures: the take-off at 01 and the apex. */
function Exposures() {
  return EXPOSURES.map((e, i) => {
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
  });
}

const Puff = () =>
  PUFF.map(([dx, dy], i) => <circle key={i} r={4.5} style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, "--i": i } as Vars} />);

/** The recommended program's pose at 03, placed on its apparatus (hidden until her landing). */
function Landings() {
  return APPS.map((id) => {
    const l = LANDING[id];
    return (
      <g key={id} className={`qb-land qb-land--${id}`} style={{ "--at": `${l.at[0]}px ${l.at[1]}px` } as Vars}>
        <g className="qb-land-stick">
          <svg
            data-figure={`pose:${l.id}`}
            x={l.x}
            y={l.y}
            width={l.width}
            height={l.height}
            viewBox={l.viewBox}
            overflow="visible"
            aria-hidden="true"
            focusable="false"
          >
            <path d={POSES[l.id].d} />
          </svg>
        </g>
        {/* Chalk off her hands on the beam and the table; the star is in the air. */}
        {id === "parter" ? null : (
          <g className="qb-puff" transform={`translate(${l.at[0]} ${l.at[1]})`}>
            <Puff />
          </g>
        )}
      </g>
    );
  });
}

export function QuizBandArt() {
  return (
    <svg className="quiz-band__svg" viewBox={`0 0 ${VB_W} ${VB_H}`} focusable="false" style={flierVars} data-figure="brand:quiz">
      {/* The apparatus of the recommended program under frame 03, drawn in as she lands. */}
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

      {/* Measuring grid over the scene's apparatus, under the exposures. */}
      <g className="qb-grid">
        {GRID_X.map((x) => (
          <line key={x} x1={x} x2={x} y1={8} y2={MAT_Y} data-major={MAJOR.has(x) ? "" : undefined} />
        ))}
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
        <Exposures />
      </g>

      {/* The flier: X and base height (.qb-fly, transition), the parabola (.qb-hop), torso pitch
          (.qb-pitch) and the stuck landing on 02, compressed from the feet (.qb-stick). At 03 her
          body (.qb-body) crossfades into the landing pose. */}
      <g className="qb-fly">
        <g className="qb-body">
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
        </g>
        <g className="qb-puff" transform={`translate(${FOOT.x} ${FOOT.y})`}>
          <Puff />
        </g>
      </g>

      <Landings />
    </svg>
  );
}
