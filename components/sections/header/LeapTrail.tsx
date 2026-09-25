import { LEAP_VIEWBOX } from "@/components/brand/sprite-paths.generated";

const { x: LX, y: LY, width: LW, height: LH } = LEAP_VIEWBOX;

/**
 * Menu sheet „you are here“: the club silhouette landed on the current section's
 * row, with the two chronophotograph frames of its hop behind it — take-off and
 * apex (design review C-22). Leap-box units; at the 44px mark the frames sit
 * 56px and 28px to the left. The row's hop (M-05) is CSS in header.css:
 * .here-fly (x, linear) › .here-arc (y, parabola) › .here-pitch (torso pitch,
 * then a stuck landing). Static final state without motion.
 */
export const HERE_FRAMES = [
  { x: -292, y: 0 },
  { x: -146, y: -44 },
] as const;
const HERE_TOP = -48;

export function HereMark({ className }: { className?: string }) {
  const left = HERE_FRAMES[0].x;
  const box = { href: "#leap", width: LW, height: LH };
  return (
    <svg
      className={className}
      viewBox={`${left} ${HERE_TOP} ${LW - left} ${LH - HERE_TOP}`}
      aria-hidden="true"
      focusable="false"
    >
      {HERE_FRAMES.map((f, i) => (
        <use key={f.x} {...box} x={f.x} y={f.y} className={`here-ghost here-ghost--${i + 1}`} />
      ))}
      <g className="here-fly">
        <g className="here-arc">
          <g className="here-pitch">
            <use {...box} className="here-solid" />
          </g>
        </g>
      </g>
    </svg>
  );
}

/**
 * Footer mark: the full white logo, and the leap carrying on past it — ghost
 * frames rising to the right of the landed silhouette, fading out along the
 * leotard steps (violet → lavender → ice, shared --ghost tokens). The flight
 * that landed in the hero takes off again at the end of the roll; the take-off
 * itself plays once when the footer comes into view (MO-05, chrome-motion.ts).
 */
const TAKEOFF = [
  { dx: 128, dy: -26, token: 3 },
  { dx: 256, dy: -44, token: 2 },
  { dx: 384, dy: -38, token: 1 },
] as const;

export function FooterMark({ className, title }: { className?: string; title: string }) {
  const top = Math.min(0, ...TAKEOFF.map((t) => LY + t.dy)) - 4;
  const right = LX + TAKEOFF[TAKEOFF.length - 1]!.dx + LW + 4;
  return (
    <svg
      className={className}
      viewBox={`0 ${top} ${right} ${213 - top}`}
      role="img"
      aria-label={title}
      focusable="false"
      data-footer-mark=""
    >
      {TAKEOFF.map((t, i) => (
        <use
          key={t.dx}
          href="#leap"
          className={`leap-ghost leap-ghost--${t.token}`}
          style={{ ["--i" as string]: i }}
          x={LX + t.dx}
          y={LY + t.dy}
          width={LW}
          height={LH}
        />
      ))}
      <use href="#wordmark" className="leap-solid" width="490" height="213" />
      <use href="#leap" className="leap-solid leap-push" x={LX} y={LY} width={LW} height={LH} />
    </svg>
  );
}
