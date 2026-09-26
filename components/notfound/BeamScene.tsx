import { BEAM, BEAM_TOP, FIGURE, FOOT_HALF, FOOT_Y, LEG_SPLAY, LEGS, POSE, SCORE_CELLS, SUPPORT_CLIP, SWAY_CLIP, VIEW, swayAt } from "./scene";

/**
 * „Ravnoteža na gredi“: one gymnast in a scale („vaga“, the pose family's P7) on a balance
 * beam, her support foot on its padded top. Decorative (aria-hidden); this server-rendered
 * state is the complete final composition (no JS, reduced motion: still and upright).
 * BeamTiltMotion rotates [data-nf-figure] — everything above the ankle — about the ankle;
 * the foot stays on the beam. The pose is its own <svg data-figure="pose:scale"> (the figure
 * contract, qa/figures.mjs); it does not clip, so a sway may leave its box. The beam stands
 * on A-frames like the S8 camp beam; the floor under it is the page-wide CSS line of .nf__stage.
 */
export function BeamScene() {
  const underside = BEAM.y + BEAM.height;
  const { viewBox } = POSE;
  return (
    <svg
      className="nf-scene"
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
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
      <svg
        className="nf-scene__figure"
        data-figure="pose:scale"
        x={FIGURE.x}
        y={FIGURE.y}
        width={FIGURE.width}
        height={FIGURE.height}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        overflow="visible"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <path id="nf-pose" d={POSE.d} />
          <clipPath id="nf-support">
            <polygon points={SUPPORT_CLIP} />
          </clipPath>
          <clipPath id="nf-sway">
            <polygon points={SWAY_CLIP} />
          </clipPath>
        </defs>
        <use href="#nf-pose" clipPath="url(#nf-support)" />
        <g transform={swayAt(0)} data-nf-figure="">
          <use href="#nf-pose" clipPath="url(#nf-sway)" />
        </g>
      </svg>
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
