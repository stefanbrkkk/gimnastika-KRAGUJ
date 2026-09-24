/**
 * Mechanical UI strings of the page chrome (not in the master prompt's copy;
 * listed as newCopy for the club). Everything else comes from content/*.ts.
 */
export const HEADER_COPY = {
  /** aria-label of the main navigation (header + menu sheet). */
  navLabel: "Glavni meni",
  /** Visible label of the mobile menu button + the sheet's accessible name. */
  menu: "Meni",
  /** Visible label of the sheet's close button. */
  close: "Zatvorite",
  /** aria-label of the mobile sticky bottom bar. */
  stickyLabel: "Brzi kontakt",
  /** Screen-reader suffix on links that open a new tab (same wording as SourceLink). */
  newTab: "(otvara se u novom prozoru)",
} as const;
