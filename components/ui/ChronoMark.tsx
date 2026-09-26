import { LEAP_VIEWBOX } from "@/components/brand/sprite-paths.generated";

const W = LEAP_VIEWBOX.width;
const H = LEAP_VIEWBOX.height;

/**
 * The hop's span (leap-box units): how far left of the landed figure it takes off. Short, so at
 * rest the figure sits about 0.4em after the title's last word (with the .chrono-mark margin);
 * styles/ui.css flies .chrono-fly over the same 60 and hero/scrub.ts (MARK) hands its runner
 * over to the first ghost.
 */
const HOP = 60;
/**
 * Ghost frames of the hop (takeoff → apex → descent): x where the linear flier is at 0, 180 and
 * 360 ms of its 520 ms (0, 35 and 69 % of HOP), y on its parabola. They overlap: motion, not
 * separate poses.
 */
const GHOSTS = [
  { x: 0, y: 52 },
  { x: 21, y: 6 },
  { x: 42, y: 18 },
] as const;
const LANDED = { x: HOP, y: 58 } as const;
const BOX_W = LANDED.x + W;
/** The viewBox width over the landed figure's box: the CSS width is --mark-solid × this. */
const MARK_BOX = (BOX_W / W).toFixed(4);

/**
 * Chronophotograph mark: the club silhouette landed on the section title. Static
 * by default; components/ui/HeadingLandings.tsx plays the landing once on enter:
 * the flier takes off from the first ghost, peaks over the second and lands
 * (520 ms), each ghost developing as it passes. The ghosts exist only in flight
 * (plan-figure-system §5.1, R3): they fade out 400 ms after the touchdown, so at
 * rest — and without JS or motion — the title carries ONE figure. They stay in
 * the markup so the box (and the title's line) never changes size.
 * `land={false}` renders the landed state only (a section whose own motion is
 * its landing, e.g. the S11 doskok).
 */
export function ChronoMark({ className, land = true }: { className?: string; land?: boolean }) {
  return (
    <svg
      className={["chrono-mark", className].filter(Boolean).join(" ")}
      viewBox={`0 0 ${BOX_W} ${LANDED.y + H}`}
      style={{ ["--mark-box" as string]: MARK_BOX }}
      aria-hidden="true"
      focusable="false"
      data-figure="brand:mark"
      {...(land ? { "data-land": "" } : { "data-landed": "" })}
    >
      {GHOSTS.map((g, i) => (
        <use key={i} href="#leap" className="chrono-ghost" x={g.x} y={g.y} width={W} height={H} style={{ ["--i" as string]: i }} />
      ))}
      {/* The flier: X travels linearly (.chrono-fly), Y follows the leap's parabola (.chrono-solid). */}
      <g className="chrono-fly">
        {/* .chrono-pitch: torso pitch in flight + the stuck-landing compression (design review v2). */}
        <g className="chrono-pitch">
          <use href="#leap" className="chrono-solid" x={LANDED.x} y={LANDED.y} width={W} height={H} />
        </g>
      </g>
    </svg>
  );
}
