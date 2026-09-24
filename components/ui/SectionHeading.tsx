import type { ReactNode } from "react";
import { ChronoMark } from "./ChronoMark";

interface SectionHeadingProps {
  /** id for the <h2> (referenced by the section's aria-labelledby). */
  id: string;
  /** Section frame number (S1…S11) → "KR·03". */
  n: number;
  title: string;
  /** Optional short line under the title. */
  intro?: ReactNode;
  /** The floor-exercise diagonal: titles alternate left/right on desktop. */
  align?: "left" | "right";
  className?: string;
}

/**
 * Section title with the chronophotograph "landing" mark. On desktop, titles
 * alternate left/right along the page's diagonal spine; mobile is always left.
 */
export function SectionHeading({ id, n, title, intro, align = "left", className }: SectionHeadingProps) {
  const frame = `KR·${String(n).padStart(2, "0")}`;
  return (
    <header className={["section-heading", className].filter(Boolean).join(" ")} data-align={align}>
      <div className="section-heading__row">
        <p className="label-caps text-muted tabular" aria-hidden="true">
          {frame}
        </p>
        <ChronoMark className="section-heading__mark" />
      </div>
      <h2 id={id} className="text-h2 measure">
        {title}
      </h2>
      {intro ? <div className="section-heading__intro mt-4 text-muted measure">{intro}</div> : null}
    </header>
  );
}
