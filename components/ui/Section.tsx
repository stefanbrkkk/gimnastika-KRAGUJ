import type { ReactNode } from "react";

export type SectionTheme = "light" | "ice" | "dark" | "darker";

interface SectionProps {
  id: string;
  theme: SectionTheme;
  /** id of the section's heading element. */
  labelledBy: string;
  className?: string;
  /** Dark sections: cut the top edge on the floor diagonal ("up" = rising left → right). */
  edge?: "up" | "down";
  children: ReactNode;
}

/** A page section: sets the theme tokens (data-theme) and the vertical rhythm. */
export function Section({ id, theme, labelledBy, className, edge, children }: SectionProps) {
  return (
    <section
      id={id}
      data-theme={theme}
      aria-labelledby={labelledBy}
      className={["relative section-y", edge ? "edge-cut" : "", className].filter(Boolean).join(" ")}
      {...(edge ? { "data-edge": edge } : {})}
    >
      {edge ? (
        <svg className="edge-line" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {edge === "up" ? <line x1="0" y1="10" x2="100" y2="0" /> : <line x1="0" y1="0" x2="100" y2="10" />}
        </svg>
      ) : null}
      {children}
    </section>
  );
}
