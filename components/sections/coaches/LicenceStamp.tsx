/**
 * „Licenca GSS“ stamp: a round rubber-stamp impression (double ring, „LICENCA“ set on the
 * upper arc, „GSS“ in the centre), inked rather than badged — no drop shadow, a faint
 * surface-tinted disc the print shows through (AC2-07: 20 %, so it never frosts the photo),
 * the ink multiplied into the paper on light sections and a static speckle mask for uneven
 * coverage (a different impression per card). Layers, so the motion can press them together
 * while the ink keeps blending with the print: `__base` (the disc) and `__ink` (rings +
 * letters + the one-off ink ring of the press).
 *
 * `onPlate` (the KR-07 plate, no portrait yet): ink cannot lighten a dark print, and a pale disc over it
 * turns grey. So that card has no disc, and where the impression crosses the navy plate it
 * shows in the plate's own dark-theme accent (lav-200, ≥7:1 on navy) — the same impression,
 * clipped to the plate by a static wrapper (coaches.css), so „GSS“ stays legible across the
 * edge while the rest stays blue ink on paper.
 * The visual text lives in the SVG; assistive tech reads the plain-text label once.
 * No club or GSS logo, so it can never pass as an official GSS seal.
 */

/** Deterministic speckle (mulberry32 seeded by the card), so SSR output is stable. */
function speckle(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const dots = Array.from({ length: 54 }, () => {
    const angle = rand() * Math.PI * 2;
    const dist = Math.sqrt(rand()) * 48;
    return {
      cx: r1(50 + Math.cos(angle) * dist),
      cy: r1(50 + Math.sin(angle) * dist),
      r: r1(0.35 + rand() * rand() * 1.4),
      o: r1(0.55 + rand() * 0.45),
    };
  });
  // Lighter pressure on one side of the impression (a hand-inked stamp is never even).
  const side = rand() * Math.PI * 2;
  const soft = { cx: r1(50 + Math.cos(side) * 38), cy: r1(50 + Math.sin(side) * 38), r: r1(20 + rand() * 8) };
  return { dots, soft };
}

export function LicenceStamp({ uid, label, onPlate = false }: { uid: string; label: string; onPlate?: boolean }) {
  const arcId = `licenca-arc-${uid}`;
  const maskId = `licenca-ink-${uid}`;
  const [word = label, mark = ""] = label.split(" ");
  const { dots, soft } = speckle(`kraguj-stamp-${uid}`);
  const impression = (
    <>
      <circle className="licence-stamp__ring" cx="50" cy="50" r="46.5" strokeWidth="2.6" />
      <circle className="licence-stamp__ring" cx="50" cy="50" r="41" strokeWidth="1.1" />
      <text className="licence-stamp__arc">
        <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
          {word.toUpperCase()}
        </textPath>
      </text>
      <text className="licence-stamp__mark" x="50" y="65" textAnchor="middle">
        {mark.toUpperCase()}
      </text>
    </>
  );
  return (
    <span className={onPlate ? "licence-stamp licence-stamp--plate" : "licence-stamp"} data-coach-stamp="">
      {onPlate ? null : (
        <svg viewBox="0 0 100 100" className="licence-stamp__layer licence-stamp__base" aria-hidden="true" focusable="false">
          <circle className="licence-stamp__disc" cx="50" cy="50" r="47" />
        </svg>
      )}
      <svg viewBox="0 0 100 100" className="licence-stamp__layer licence-stamp__ink" aria-hidden="true" focusable="false">
        <defs>
          <path id={arcId} d="M 21.5 50 A 28.5 28.5 0 0 1 78.5 50" />
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <rect width="100" height="100" fill="#fff" />
            <circle cx={soft.cx} cy={soft.cy} r={soft.r} fill="#000" opacity="0.28" />
            {dots.map((d, i) => (
              <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="#000" opacity={d.o} />
            ))}
          </mask>
        </defs>
        <g className="licence-stamp__print" mask={`url(#${maskId})`}>
          {impression}
        </g>
        {/* The press: a one-off ink ring spreading from the rim (motion only, invisible at rest). */}
        <circle className="licence-stamp__splash" cx="50" cy="50" r="47" data-stamp-splash="" />
      </svg>
      {onPlate ? (
        <span className="licence-stamp__over-plate" aria-hidden="true">
          <svg viewBox="0 0 100 100" className="licence-stamp__layer licence-stamp__ink" focusable="false">
            <g className="licence-stamp__print" mask={`url(#${maskId})`}>
              {impression}
            </g>
          </svg>
        </span>
      ) : null}
      <span className="sr-only">{label}</span>
    </span>
  );
}
