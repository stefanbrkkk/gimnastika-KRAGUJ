import type { ReactNode } from "react";

export type SectionTheme = "light" | "ice" | "dark" | "darker";

interface SectionProps {
  id: string;
  theme: SectionTheme;
  /** id of the section's heading element. */
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/** A page section: sets the theme tokens (data-theme) and the vertical rhythm. */
export function Section({ id, theme, labelledBy, className, children }: SectionProps) {
  return (
    <section id={id} data-theme={theme} aria-labelledby={labelledBy} className={["relative section-y", className].filter(Boolean).join(" ")}>
      {children}
    </section>
  );
}
