/**
 * White hand-drawn brush annotation over photo 05 (one of the page's max two, §3):
 * a loose grease-pencil loop — the way an editor marks the chosen frame on a
 * contact sheet — drawn as a dry brush (three strands, like the white strokes on
 * the club-jacket sleeves). Static and fully visible without JS / with reduced
 * motion; coaches-motion.ts draws it once with DrawSVG.
 *
 * Geometry: the loop is drawn in the 600×400 space of the mobile 3:2 print. The SVG
 * box always equals the photo box and its viewBox is the WHOLE photo (1200×1600) with
 * `xMaxYMid slice` — exactly what the image does with object-fit: cover. coaches.css
 * then places the loop group on the photo per layout (CSS transform on .brush__art):
 *   3:2 print (object-position 50% 29%)  → translate(0, 400) scale(2)
 *   desktop column print (100% 50%)       → translate(0, 232) scale(2)
 * so the loop stays around the two coaches at every crop.
 */
const LEAD = "M536 100C545 108 551 115 556 123";
const BODY =
  "C586 176 584 236 560 292C534 352 470 384 390 392C318 399 232 388 196 340C168 300 166 248 180 198C190 160 200 126 238 94C282 58 360 40 446 52C506 60 548 90 570 128";
const TAIL = "C578 142 583 156 585 172";
/** The loaded core of the stroke. */
const CORE = `M556 123${BODY}`;
/** Dry bristles: they start a little earlier and run on past the core — the taper. */
const BRISTLES = `${LEAD}${BODY}${TAIL}`;

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
      <g className="brush__art" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Soft navy under-stroke keeps the white legible over the pale hall walls. */}
        <path className="brush__shadow" d={CORE} transform="translate(1.5 2.5)" strokeWidth="9" data-brush-path="" />
        <path className="brush__strand" d={CORE} strokeWidth="7.5" data-brush-path="" />
        <path className="brush__strand brush__strand--mid" d={BRISTLES} transform="translate(3 -4) rotate(-1.2 370 220)" strokeWidth="3" data-brush-path="" />
        <path className="brush__strand brush__strand--thin" d={BRISTLES} transform="translate(-4 4) rotate(1 370 220)" strokeWidth="1.8" data-brush-path="" />
      </g>
    </svg>
  );
}
