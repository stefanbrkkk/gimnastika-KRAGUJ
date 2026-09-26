import { LEAP_VIEWBOX } from "./sprite-paths.generated";

const { x, y, width, height } = LEAP_VIEWBOX;

interface LogoProps {
  className?: string;
  /** Accessible name; pass null when the logo is decorative next to visible text. */
  title?: string | null;
}

/** Full club logo (wordmark + silhouette) in currentColor: white on dark, navy on light. */
export function Logo({ className, title = "Gimnastički klub Kraguj" }: LogoProps) {
  const a11y = title ? { role: "img", "aria-label": title } : { "aria-hidden": true as const };
  return (
    <svg viewBox="0 0 490 213" className={className} data-figure="brand:logo" {...a11y} focusable="false">
      <use href="#wordmark" width="490" height="213" />
      <use href="#leap" x={x} y={y} width={width} height={height} />
    </svg>
  );
}

/** The silhouette alone, in its own box (viewBox of the leap symbol). */
export function Leap({ className, title = null }: LogoProps) {
  const a11y = title ? { role: "img", "aria-label": title } : { "aria-hidden": true as const };
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} {...a11y} focusable="false">
      <use href="#leap" width={width} height={height} />
    </svg>
  );
}
