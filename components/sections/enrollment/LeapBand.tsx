import { buildBand, FRAME_OPACITY, LEAP_SYMBOL, type BandSpec } from "./leap-band";

const TICK = { wide: 10, narrow: 6 } as const;
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * „Jedan skok, tri kadra“ — one chronophotograph band: the three enrollment steps
 * as three frames of ONE split leap on a mat line (Marey's measuring rule: a tick
 * under each frame), linked by the dotted trajectory of the hips. Static final
 * composition (server-rendered, aria-hidden): takeoff and apex are ghost frames
 * (the shared leotard ghost tokens), the landing on step 3 is solid. The solid
 * flier (hidden at rest) and the reveal clip exist for the lazy motion chunk.
 * `variant` picks the layout: wide (≥640, frames over the three step columns)
 * or narrow (<640, a compact arc above the step list, frames numbered 1–3).
 */
export function LeapBand({ spec, variant }: { spec: BandSpec; variant: "wide" | "narrow" }) {
  const band = buildBand(spec);
  const { w, h, mat } = spec;
  const clipId = `en-band-reveal-${variant}`;
  const tick = TICK[variant];
  const use = <use href="#leap" x={LEAP_SYMBOL.x} y={LEAP_SYMBOL.y} width={LEAP_SYMBOL.width} height={LEAP_SYMBOL.height} />;
  const [takeoff, apex, landing] = band.frames;

  return (
    <svg
      className="en-band"
      data-variant={variant}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* The trajectory is exposed behind the flier (scaleX from the takeoff hip). */}
        <clipPath id={clipId}>
          <rect className="en-band__reveal" x={r1(band.p0.x - 6)} y={0} width={r1(band.p2.x - band.p0.x + 12)} height={mat} />
        </clipPath>
      </defs>
      <line className="en-band__mat" x1={0} x2={w} y1={mat} y2={mat} />
      {band.frames.map((f) => (
        <line key={f.kind} className="en-band__tick" data-frame={f.kind} x1={r1(f.tickX)} x2={r1(f.tickX)} y1={mat} y2={mat + tick} />
      ))}
      {variant === "narrow"
        ? band.frames.map((f, i) => (
            <text key={f.kind} className="en-band__num" data-frame={f.kind} x={r1(f.tickX)} y={h - 1} textAnchor="middle">
              {i + 1}
            </text>
          ))
        : null}
      <path className="en-band__path" d={band.path} clipPath={`url(#${clipId})`} />
      <g className="en-band__frame" data-frame="takeoff" transform={takeoff.transform} style={{ ["--o" as string]: FRAME_OPACITY.takeoff }}>
        {use}
      </g>
      <g className="en-band__frame" data-frame="apex" transform={apex.transform} style={{ ["--o" as string]: FRAME_OPACITY.apex }}>
        {use}
      </g>
      {/* The landing: its own group so the stuck-landing squash can pivot on the front foot. */}
      <g className="en-band__land">
        <g className="en-band__frame" data-frame="landing" transform={landing.transform}>
          {use}
        </g>
      </g>
      <g className="en-band__flier" transform={takeoff.transform}>
        {use}
      </g>
    </svg>
  );
}
