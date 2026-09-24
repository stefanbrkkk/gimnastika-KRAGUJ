/**
 * „Licenca GSS“ stamp badge: a round rubber-stamp mark (double ring, „LICENCA“
 * set on the upper arc, „GSS“ in the centre). The visual text lives in the SVG;
 * assistive tech reads the plain-text label once.
 */
export function LicenceStamp({ uid, label }: { uid: string; label: string }) {
  const arcId = `licenca-arc-${uid}`;
  const [word = label, mark = ""] = label.split(" ");
  return (
    <span className="licence-stamp" data-coach-stamp="">
      <svg viewBox="0 0 100 100" className="licence-stamp__svg" aria-hidden="true" focusable="false">
        <defs>
          <path id={arcId} d="M 21.5 50 A 28.5 28.5 0 0 1 78.5 50" />
        </defs>
        <circle className="licence-stamp__disc" cx="50" cy="50" r="47" />
        <circle className="licence-stamp__ring" cx="50" cy="50" r="47" strokeWidth="2.5" />
        <circle className="licence-stamp__ring" cx="50" cy="50" r="41" strokeWidth="1" />
        <text className="licence-stamp__arc">
          <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
            {word.toUpperCase()}
          </textPath>
        </text>
        <text className="licence-stamp__mark" x="50" y="63" textAnchor="middle">
          {mark.toUpperCase()}
        </text>
        <g className="licence-stamp__dots">
          <circle cx="41" cy="75.5" r="1.7" />
          <circle cx="50" cy="77" r="1.7" />
          <circle cx="59" cy="75.5" r="1.7" />
        </g>
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
