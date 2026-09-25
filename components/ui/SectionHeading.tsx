import type { ReactNode } from "react";
import { ChronoMark } from "./ChronoMark";

interface SectionHeadingProps {
  /** id for the <h2> (referenced by the section's aria-labelledby). */
  id: string;
  title: string;
  /** Optional short line under the title. */
  intro?: ReactNode;
  /** The floor-exercise diagonal: titles alternate left/right on desktop. */
  align?: "left" | "right";
  /** false → the title mark is static (landed); the section's own motion is its landing. */
  land?: boolean;
  /** "section" (default): the section-title step; "h2": the smaller step for titles in narrow columns. */
  size?: "section" | "h2";
  className?: string;
}

/**
 * Section title. The chronophotograph mark (ghost frames → solid silhouette)
 * lands on the end of the title — "the silhouette lands on section titles" (§1).
 * On desktop, titles alternate left/right along the page's diagonal spine.
 */
export function SectionHeading({ id, title, intro, align = "left", land = true, size = "section", className }: SectionHeadingProps) {
  // The last word and the mark never separate across lines.
  const cut = title.lastIndexOf(" ");
  const head = cut > 0 ? title.slice(0, cut + 1) : "";
  const last = cut > 0 ? title.slice(cut + 1) : title;
  return (
    <header className={["section-heading", className].filter(Boolean).join(" ")} data-align={align}>
      <h2 id={id} className={`section-heading__title ${size === "h2" ? "text-h2" : "text-section"}`} data-size={size}>
        {head}
        <span className="whitespace-nowrap">
          {last}
          <ChronoMark className="section-heading__mark" land={land} />
        </span>
      </h2>
      {intro ? <div className="section-heading__intro text-muted measure">{intro}</div> : null}
    </header>
  );
}
