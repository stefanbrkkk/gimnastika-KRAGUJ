import { BASE_ANGLE, BEAM, FLOOR_Y, GHOSTS, LEAP_SIZE, LEGS, LEGS_CLIP, PIVOT, TORSO_CLIP, USE_AT, VIEW, rotateAbout, swayAt } from "./scene";

/**
 * „Ravnoteža na gredi“: the club silhouette in a split on a balance beam, with
 * three ghost frames of the sway she has just caught. Decorative (aria-hidden);
 * this server-rendered state is the complete final composition (no JS, reduced
 * motion). BeamTilt rotates the upper-body groups [data-nf-figure] / [data-nf-ghost].
 */
export function BeamScene() {
  const leap = { href: "#leap", ...USE_AT, ...LEAP_SIZE };
  return (
    <svg
      className="nf-scene"
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
      preserveAspectRatio="xMidYMid slice"
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
      <line className="nf-scene__floor" x1={VIEW.x} x2={VIEW.x + VIEW.width} y1={FLOOR_Y} y2={FLOOR_Y} />
      <g className="nf-scene__beam">
        {LEGS.map((x) => (
          <g key={x}>
            <line x1={x} x2={x} y1={BEAM.y + BEAM.height} y2={FLOOR_Y - 1} />
            <line x1={x - 34} x2={x + 34} y1={FLOOR_Y - 1} y2={FLOOR_Y - 1} />
          </g>
        ))}
        <rect x={BEAM.x} y={BEAM.y} width={BEAM.width} height={BEAM.height} rx={BEAM.radius} />
      </g>
      <g transform={rotateAbout(BASE_ANGLE, PIVOT)}>
        {GHOSTS.map((g, i) => (
          <g key={i} transform={swayAt(g.fan)} style={{ color: g.color, opacity: g.opacity }} data-nf-ghost={i}>
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
