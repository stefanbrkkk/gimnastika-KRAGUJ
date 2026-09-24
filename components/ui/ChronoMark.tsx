import { LEAP_VIEWBOX } from "@/components/brand/sprite-paths.generated";

const W = LEAP_VIEWBOX.width;
const H = LEAP_VIEWBOX.height;

/**
 * Chronophotograph mark: three ghost frames of the leap along a short
 * descending arc, landing as the solid silhouette. Sits on section titles.
 * Static by default; components/ui/HeadingLandings.tsx animates the landing.
 */
export function ChronoMark({ className }: { className?: string }) {
  // Frame offsets in leap-box units along a small parabola.
  const frames = [
    { dx: 0, dy: 34, o: 0.14 },
    { dx: 70, dy: 6, o: 0.22 },
    { dx: 140, dy: 0, o: 0.32 },
  ];
  return (
    <svg
      className={["chrono-mark", className].filter(Boolean).join(" ")}
      viewBox={`0 -10 ${W + 230} ${H + 50}`}
      aria-hidden="true"
      focusable="false"
      data-land=""
    >
      {frames.map((f, i) => (
        <use
          key={i}
          href="#leap"
          className="chrono-ghost"
          x={f.dx}
          y={f.dy}
          width={W}
          height={H}
          style={{ ["--o" as string]: f.o, ["--i" as string]: i }}
        />
      ))}
      <use href="#leap" className="chrono-solid" x={230} y={30} width={W} height={H} />
    </svg>
  );
}
