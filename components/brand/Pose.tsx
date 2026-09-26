import { POSES, type PoseId } from "./poses.generated";

interface PoseProps {
  id: PoseId;
  className?: string;
  /** Accessible name. Omit it when the pose is decoration (the default: aria-hidden). */
  title?: string;
}

/**
 * One pose of the figure family (docs/plan-figure-system.md §4) as an inline SVG in currentColor.
 * Poses are not part of the global sprite: a page inlines only the poses it shows. The viewBox is
 * in logo units at the logo figure's body scale, so a pose sized at (viewBox.height / 150) × the
 * #leap box height has the logo figure's body size.
 */
export function Pose({ id, className, title }: PoseProps) {
  const { d, viewBox } = POSES[id];
  const a11y = title ? { role: "img" as const } : { "aria-hidden": true as const };
  return (
    <svg
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      className={className}
      data-figure={`pose:${id}`}
      {...a11y}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d={d} fill="currentColor" />
    </svg>
  );
}
