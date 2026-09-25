import type { ReactNode } from "react";

export type ContactIconName = "phone" | "mail" | "instagram" | "facebook" | "pin" | "external";

/**
 * One stroke family (24px grid, round joins) for every contact glyph. Decorative only.
 * .ui-icon keeps strokes in CSS px (app/globals.css): pictograms 1.75, the action
 * glyph ↗ 2 — the same weights as the page-chrome icons.
 */
const PATHS: Record<ContactIconName, ReactNode> = {
  phone: (
    <path d="M6.6 3.5h2.6l1.4 4-2 1.4a11.5 11.5 0 0 0 6.5 6.5l1.4-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.6 16.6 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4.5 7 7.5 6 7.5-6" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="5" />
      <circle cx="12" cy="12" r="3.9" />
      <circle cx="17.1" cy="6.9" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  facebook: <path d="M14.5 20.5v-7h2.4l.4-2.8h-2.8V9c0-.8.3-1.4 1.4-1.4h1.5V5.1a19 19 0 0 0-2.2-.1c-2.2 0-3.6 1.3-3.6 3.7v2h-2.4v2.8h2.4v7" />,
  pin: (
    <>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  external: <path d="M8 16 16.5 7.5M9.5 7h7.5v7.5" />,
};

const ACTION_GLYPHS: ReadonlySet<ContactIconName> = new Set(["external"]);

export function ContactIcon({ name }: { name: ContactIconName }) {
  return (
    <svg
      className="ui-icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ACTION_GLYPHS.has(name) ? 2 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
