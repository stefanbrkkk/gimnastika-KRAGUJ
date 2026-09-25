import {
  BASE_ANGLE,
  BEAM,
  BEAM_TOP,
  FOOT_HALF,
  FOOT_Y,
  GHOSTS,
  LEAP_SIZE,
  LEG_SPLAY,
  LEGS,
  LEGS_CLIP,
  PIVOT,
  SCORE_CELLS,
  TORSO_CLIP,
  USE_AT,
  VIEW,
  rotateAbout,
  swayAt,
} from "./scene";

/**
 * „Ravnoteža na gredi“: the club silhouette in a split on a balance beam, with
 * three ghost frames of the sway she has just caught. Decorative (aria-hidden);
 * this server-rendered state is the complete final composition (no JS, reduced
 * motion). BeamTilt rotates the upper-body groups [data-nf-figure] / [data-nf-ghost].
 * The beam stands on A-frames like the S8 camp beam; the floor under it is the
 * page-wide CSS line of .nf__stage.
 */
export function BeamScene() {
  const leap = { href: "#leap", ...USE_AT, ...LEAP_SIZE };
  const underside = BEAM.y + BEAM.height;
  return (
    <svg
      className="nf-scene"
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id="nf-torso">
          <polygon points={TORSO_CLIP} />
        </clipPath>
        <clipPath id="nf-legs">
          <polygon points={LEGS_CLIP} />
        </clipPath>
      </defs>
      <g className="nf-scene__beam">
        {LEGS.map((x) => (
          <path
            key={x}
            className="nf-scene__support"
            d={`M${x - LEG_SPLAY} ${FOOT_Y}L${x} ${underside}L${x + LEG_SPLAY} ${FOOT_Y}M${x - FOOT_HALF} ${FOOT_Y}H${x + FOOT_HALF}`}
          />
        ))}
        <rect className="nf-scene__body" x={BEAM.x} y={BEAM.y} width={BEAM.width} height={BEAM.height} rx={BEAM.radius} />
        <rect className="nf-scene__pad" x={BEAM.x + 1} y={BEAM.y} width={BEAM.width - 2} height={BEAM_TOP} rx={BEAM_TOP / 2} />
      </g>
      <g transform={rotateAbout(BASE_ANGLE, PIVOT)}>
        {GHOSTS.map((g, i) => (
          <g key={i} transform={swayAt(g.fan)} className={`nf-ghost nf-ghost--${i + 1}`} data-nf-ghost={i}>
            <g clipPath="url(#nf-torso)">
              <use {...leap} />
            </g>
          </g>
        ))}
        <g className="nf-scene__figure">
          <g clipPath="url(#nf-legs)">
            <use {...leap} />
          </g>
          <g transform={swayAt(0)} data-nf-figure="">
            <g clipPath="url(#nf-torso)">
              <use {...leap} />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

/**
 * The judges' board (C-19), decorative: the h1 carries the meaning. The static
 * state (no JS, reduced motion, Save-Data) is the posted 4.04. With motion it
 * first shows a perfect 10.00 (html.js-motion) and posts 4.04 row by row, like
 * an LED board, once she has caught her balance (BeamTiltMotion sets
 * data-posted; a CSS failsafe posts it if the tilt chunk never arrives).
 */
export function ScorePlate() {
  let k = 0;
  return (
    <div className="nf-score font-dot tabular" aria-hidden="true" data-nf-score="">
      {SCORE_CELLS.map(([before, after], i) =>
        before === after ? (
          <span key={i} className="nf-score__cell">
            {after}
          </span>
        ) : (
          <span key={i} className="nf-score__cell nf-score__cell--post" style={{ ["--k" as string]: k++ }}>
            <span className="nf-score__before">{before}</span>
            <span className="nf-score__after">{after}</span>
          </span>
        ),
      )}
    </div>
  );
}
