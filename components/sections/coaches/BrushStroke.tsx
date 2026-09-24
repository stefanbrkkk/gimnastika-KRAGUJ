/**
 * White hand-drawn brush annotation over photo 05 (one of the page's max two, §3):
 * a loose grease-pencil loop — the way an editor marks the chosen frame on a
 * contact sheet — drawn as a dry brush (three strands, like the white strokes on
 * the club-jacket sleeves). viewBox = the photo's 3:2 box, so the loop keeps its
 * shape at every width. Static and fully visible without JS / with reduced motion;
 * coaches-motion.ts draws it once with DrawSVG.
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
    <svg className="brush" viewBox="0 0 600 400" aria-hidden="true" focusable="false" data-brush="">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Soft navy under-stroke keeps the white legible over the pale hall walls. */}
        <path className="brush__shadow" d={CORE} transform="translate(1.5 2.5)" strokeWidth="9" data-brush-path="" />
        <path className="brush__strand" d={CORE} strokeWidth="7.5" data-brush-path="" />
        <path className="brush__strand brush__strand--mid" d={BRISTLES} transform="translate(3 -4) rotate(-1.2 370 220)" strokeWidth="3" data-brush-path="" />
        <path className="brush__strand brush__strand--thin" d={BRISTLES} transform="translate(-4 4) rotate(1 370 220)" strokeWidth="1.8" data-brush-path="" />
      </g>
    </svg>
  );
}
