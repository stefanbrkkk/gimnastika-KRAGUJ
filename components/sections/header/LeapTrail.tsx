import { LEAP_VIEWBOX } from "@/components/brand/sprite-paths.generated";

const { x: LX, y: LY, width: LW, height: LH } = LEAP_VIEWBOX;

/**
 * Chronophotograph ghost frames of the club silhouette (Marey-style overlap),
 * static and decorative. Frames are in leap-box units; `o` is the ghost opacity.
 */
const MENU_FRAMES = [
  { x: 0, y: 96, o: 0.12 },
  { x: 120, y: 30, o: 0.2 },
  { x: 240, y: 0, o: 0.3 },
] as const;
const MENU_LANDED = { x: 360, y: 40 } as const;

/** Menu sheet: three ghosts along a leap arc, landing as the solid silhouette. */
export function LeapTrail({ className }: { className?: string }) {
  const w = MENU_LANDED.x + LW;
  const h = MENU_FRAMES[0].y + LH;
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
      {MENU_FRAMES.map((f) => (
        <use key={f.x} href="#leap" className="leap-ghost" x={f.x} y={f.y} width={LW} height={LH} opacity={f.o} />
      ))}
      <use href="#leap" className="leap-solid" x={MENU_LANDED.x} y={MENU_LANDED.y} width={LW} height={LH} />
    </svg>
  );
}

/**
 * Footer mark: the full white logo, and the leap carrying on past it — ghost
 * frames rising to the right of the landed silhouette, fading out. The flight
 * that landed in the hero takes off again at the end of the roll.
 */
const TAKEOFF = [
  { dx: 128, dy: -26, o: 0.3 },
  { dx: 256, dy: -44, o: 0.18 },
  { dx: 384, dy: -38, o: 0.1 },
] as const;

export function FooterMark({ className, title }: { className?: string; title: string }) {
  const top = Math.min(0, ...TAKEOFF.map((t) => LY + t.dy)) - 4;
  const right = LX + TAKEOFF[TAKEOFF.length - 1]!.dx + LW + 4;
  return (
    <svg className={className} viewBox={`0 ${top} ${right} ${213 - top}`} role="img" aria-label={title} focusable="false">
      {TAKEOFF.map((t) => (
        <use key={t.dx} href="#leap" className="leap-ghost" x={LX + t.dx} y={LY + t.dy} width={LW} height={LH} opacity={t.o} />
      ))}
      <use href="#wordmark" className="leap-solid" width="490" height="213" />
      <use href="#leap" className="leap-solid" x={LX} y={LY} width={LW} height={LH} />
    </svg>
  );
}
