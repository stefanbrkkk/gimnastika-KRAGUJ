/**
 * White hand-drawn brush annotation over photo 05 (one of the page's max two, §3): an
 * editor's grease-pencil loop around the two coaches' heads and shoulders — the way a coach
 * marks the chosen frame on a contact sheet — drawn as a dry brush echoing the white strokes
 * on the club-jacket sleeves. Static and fully visible without JS / with reduced motion;
 * coaches-motion.ts draws it once at hand speed with DrawSVG.
 *
 * One open loop (design review AC-05): it starts at the lower right, runs counter-clockwise
 * over the heads and ends with a flick past its start. The taper comes from the same path:
 * the loaded core stops at ≈88 % (LOOP), the two bristle strands run on through the flick
 * (LOOP + FLICK), the thin one broken by bristle gaps (a static dash mask, so DrawSVG can
 * still draw it).
 *
 * Geometry: drawn in the 600×400 space of the 3:2 print (heads at x ≈ 300–425, y ≈ 90–185).
 * The SVG box always equals the photo box and its viewBox is the WHOLE photo (1200×1600) with
 * `xMaxYMid slice` — exactly what the image does with object-fit: cover. coaches.css then
 * places the loop group on the photo per layout (CSS transform on .brush__art):
 *   3:2 print (object-position 50% 29%)  → translate(0, 400) scale(2)
 *   desktop column print (100% 50%)       → translate(0, 232) scale(2)
 * so the loop stays around the two coaches at every crop.
 */
const START = "M443.5 222.1";
const LOOP =
  "C452.5 215.7 485.9 200.3 497.2 183.7C508.6 167.1 517.2 141.8 511.6 122.7C506.1 103.7 486.7 82.4 464.2 69.3C441.7 56.3 407.3 46.3 376.6 44.5C345.8 42.7 306.6 47.9 279.7 58.5C252.8 69.1 227 89.5 215.2 108.1C203.3 126.8 202.5 151.7 208.8 170.5C215.1 189.2 233.9 207.7 253.3 220.4C272.6 233.1 300.3 242.3 324.8 246.5C349.4 250.8 377.7 249.6 400.5 246.2C423.2 242.7 445.2 233.3 461.3 225.6";
/** The hand leaving the paper: only the bristles carry on. */
const FLICK = "C477.4 217.9 487.6 208.4 496.8 200.2C506.1 192.1 513.6 180.6 516.9 176.6";
const CORE = `${START}${LOOP}`;
const STRAND = `${START}${LOOP}${FLICK}`;
/** Bristle gaps of the thin strand. */
const GAPS = "46 4 22 3 70 5";

export function BrushStroke() {
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
        <mask id="brush-bristles">
          <path d={STRAND} fill="none" stroke="#fff" strokeWidth="6" strokeDasharray={GAPS} />
        </mask>
      </defs>
      <g className="brush__art" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Soft navy under-stroke keeps the white legible over the pale hall walls. */}
        <path className="brush__shadow" d={CORE} transform="translate(1.5 2.5)" strokeWidth="10" data-brush-path="core" />
        <path className="brush__strand" d={CORE} strokeWidth="8" data-brush-path="core" />
        <path className="brush__strand brush__strand--mid" d={STRAND} transform="translate(2.5 -3.2)" strokeWidth="4.5" data-brush-path="strand" />
        <g transform="translate(-3 3.5)">
          <path className="brush__strand brush__strand--thin" d={STRAND} strokeWidth="2" mask="url(#brush-bristles)" data-brush-path="strand" />
        </g>
      </g>
    </svg>
  );
}
