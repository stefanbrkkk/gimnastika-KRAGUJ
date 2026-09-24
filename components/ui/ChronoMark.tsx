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
 * components/ui/HeadingLandings.tsx plays the landing once on enter.
 */
export function ChronoMark({ className }: { className?: string }) {
  return (
    <svg
      className={["chrono-mark", className].filter(Boolean).join(" ")}
      viewBox={`0 0 ${LANDED.x + W} ${LANDED.y + H}`}
      aria-hidden="true"
      focusable="false"
      data-land=""
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
      <use href="#leap" className="chrono-solid" x={LANDED.x} y={LANDED.y} width={W} height={H} />
    </svg>
  );
}
