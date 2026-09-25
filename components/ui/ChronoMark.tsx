import { LEAP_VIEWBOX } from "@/components/brand/sprite-paths.generated";

const W = LEAP_VIEWBOX.width;
const H = LEAP_VIEWBOX.height;

/** Ghost frames along one leap arc (takeoff → apex → descent), in leap-box units. */
const GHOSTS = [
  { x: 0, y: 52, o: 0.16 },
  { x: 118, y: 6, o: 0.24 },
  { x: 236, y: 18, o: 0.34 },
] as const;
const LANDED = { x: 340, y: 58 } as const;

/**
 * Chronophotograph mark: ghost frames of the club silhouette along a leap arc,
 * landing as the solid silhouette on the section title. Static by default;
 * components/ui/HeadingLandings.tsx plays the landing once on enter: the flier
 * takes off from the first ghost, peaks over the second and lands (600 ms), and
 * each ghost appears as it passes. `land={false}` renders the landed state only
 * (a section whose own motion is its landing, e.g. the S11 doskok).
 */
export function ChronoMark({ className, land = true }: { className?: string; land?: boolean }) {
  return (
    <svg
      className={["chrono-mark", className].filter(Boolean).join(" ")}
      viewBox={`0 0 ${LANDED.x + W} ${LANDED.y + H}`}
      aria-hidden="true"
      focusable="false"
      {...(land ? { "data-land": "" } : { "data-landed": "" })}
    >
      {GHOSTS.map((g, i) => (
        <use
          key={i}
          href="#leap"
          className="chrono-ghost"
          x={g.x}
          y={g.y}
          width={W}
          height={H}
          style={{ ["--o" as string]: g.o, ["--i" as string]: i }}
        />
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
