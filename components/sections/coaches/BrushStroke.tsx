import { BRUSH_STRANDS, WALL, gapDashes } from "./brush-geometry";

/**
 * White hand-drawn brush annotation over photo 05 (one of the page's max two, §3): an
 * editor's grease-pencil loop around the two coaches' heads and shoulders — the way a coach
 * marks the chosen frame on a contact sheet — drawn as a dry brush echoing the white strokes
 * on the club-jacket sleeves and the S7 „Medalje“ underline. Static and fully visible without
 * JS / with reduced motion; coaches-motion.ts draws it once at hand speed with DrawSVG.
 *
 * Five overlapping strands (brush-geometry.ts, design review AC2-01): the loaded core and four
 * bristles offset along the curve's normal, landing and lifting one after another, so both
 * ends splay. Every strand has round caps and joins (a brush, not a vector). The two thinnest
 * bristles run dry in places: a static mask (so DrawSVG still owns the dash) that is white
 * everywhere except short half-grey marks, so a dry spot thins the strand to half instead of
 * cutting a hole through to the photo, and never clips the strand's round ends (AC3-02).
 * A faint navy under-stroke (a copy of the core, masked to the pale wall at the upper right)
 * keeps the white legible where the loop crosses the wall and nowhere else.
 *
 * Geometry: drawn in the 600×400 space of the 3:2 print. The SVG box always equals the photo
 * box and its viewBox is the WHOLE photo (1200×1600) with `xMaxYMid slice` — exactly what the
 * image does with object-fit: cover. coaches.css then places the loop group on the photo per
 * layout (CSS transform on .brush__art):
 *   3:2 print (object-position 50% 29%)  → translate(0, 400) scale(2)
 *   desktop column print (100% 50%)       → translate(0, 232) scale(2)
 * so the loop stays around the two coaches at every crop.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

export function BrushStroke() {
  const core = BRUSH_STRANDS[0];
  if (!core) return null;
  const fade = r2(WALL.feather / WALL.w);
  return (
    <svg
      className="brush"
      viewBox="0 0 1200 1600"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      focusable="false"
      data-brush=""
    >
      <defs>
        <linearGradient id="brush-wall-fade">
          <stop offset="0" stopColor="#000" />
          <stop offset={fade} stopColor="#fff" />
          <stop offset={r2(1 - fade)} stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id="brush-wall" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="400">
          <rect x={WALL.x} y={WALL.y} width={WALL.w} height={WALL.h} fill="url(#brush-wall-fade)" />
        </mask>
        {BRUSH_STRANDS.map((s, i) =>
          s.gaps ? (
            <mask key={i} id={`brush-gaps-${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="400">
              <rect width="600" height="400" fill="#fff" />
              <path d={s.path} fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth={s.w + 4} strokeDasharray={gapDashes(s.gaps)} />
            </mask>
          ) : null,
        )}
      </defs>
      <g className="brush__art" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path className="brush__shadow" d={core.path} strokeWidth="13" mask="url(#brush-wall)" data-brush-path="shadow" />
        {BRUSH_STRANDS.map((s, i) => (
          <path
            key={i}
            className="brush__strand"
            d={s.path}
            strokeWidth={s.w}
            opacity={s.opacity}
            mask={s.gaps ? `url(#brush-gaps-${i})` : undefined}
            data-brush-path={i === 0 ? "core" : "strand"}
            data-loop={s.loop}
          />
        ))}
      </g>
    </svg>
  );
}
