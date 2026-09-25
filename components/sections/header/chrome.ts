/**
 * Pure visibility logic for the page chrome (floating header + mobile sticky
 * bottom bar). No DOM access here, so it is unit-tested in tests/chrome.test.ts;
 * the client islands feed it measurements.
 */

/**
 * id of the footer's page index (NAV links + trial CTA + call). The header's
 * "Meni" is a link to it until hydration (and without JS); then it opens the sheet.
 */
export const MENU_INDEX_ID = "meni";

/** The header may hide only after the page is scrolled past this many px (§5 HEADER). */
export const HEADER_HIDE_AFTER = 120;
/** Scroll travel in one direction needed before the header flips state (debounces jitter). */
export const HEADER_TRAVEL = 12;
/** On-screen keyboard: the visual viewport is at least this much shorter than the layout viewport. */
export const KEYBOARD_MIN_DELTA = 150;

export interface HeaderScrollState {
  /** Last seen scroll position (clamped ≥ 0). */
  y: number;
  /** Accumulated travel in the current direction (+ down, − up). */
  travel: number;
  hidden: boolean;
}

export const initialHeaderState = (y: number): HeaderScrollState => ({ y: Math.max(0, y), travel: 0, hidden: false });

/**
 * Hide on scroll-down once past HEADER_HIDE_AFTER; show again on scroll-up.
 * Travel is accumulated per direction so a slow scroll (1–2 px per event)
 * still flips the state, while tiny jitters and iOS rubber-banding do not.
 */
export function nextHeaderState(
  prev: HeaderScrollState,
  rawY: number,
  hideAfter: number = HEADER_HIDE_AFTER,
  minTravel: number = HEADER_TRAVEL,
): HeaderScrollState {
  const y = Math.max(0, rawY);
  if (y <= hideAfter) return { y, travel: 0, hidden: false };
  const dy = y - prev.y;
  if (dy === 0) return prev;
  const travel = Math.sign(dy) === Math.sign(prev.travel) ? prev.travel + dy : dy;
  let hidden = prev.hidden;
  if (travel >= minTravel) hidden = true;
  else if (travel <= -minTravel) hidden = false;
  return { y, travel, hidden };
}

export type Tone = "light" | "dark";

/** Section theme → header tone: white logo over dark sections, navy logo over light ones. */
export const toneOf = (theme: string | null | undefined): Tone => (theme === "dark" || theme === "darker" ? "dark" : "light");

export interface BandCandidate<T> {
  item: T;
  top: number;
  bottom: number;
}

/**
 * Which of the elements currently crossing a thin horizontal band at `bandY`
 * owns it. Stacked sections can both touch a 1 px band at their shared edge;
 * the one whose box actually contains the line wins, otherwise the last one.
 */
export function pickInBand<T>(candidates: readonly BandCandidate<T>[], bandY: number): T | null {
  if (candidates.length === 0) return null;
  const containing = candidates.filter((c) => c.top <= bandY && c.bottom > bandY);
  const pool = containing.length > 0 ? containing : candidates;
  return pool[pool.length - 1]?.item ?? null;
}

/** Viewports at most this tall (landscape phones, 400% zoom) never show header and bar together. */
export const SHORT_VIEWPORT_MAX = 480;

export interface StickyBarInputs {
  /** Viewport below 1024 px (the bar is mobile-only). */
  mobile: boolean;
  /** The hero CTA group has scrolled out ABOVE the viewport. */
  heroCtasPassed: boolean;
  /**
   * Any part of the S11 contact block ([data-contact-block]: heading, CTA panel
   * and contact rows — not the venue card) is in the viewport.
   */
  contactVisible: boolean;
  /** The on-screen keyboard is open (visualViewport). */
  keyboardOpen: boolean;
  /** Focus is inside a text-entry form field. */
  fieldFocused: boolean;
  /** The viewport is at most SHORT_VIEWPORT_MAX px tall. */
  shortViewport?: boolean;
  /** The floating header is currently shown (data-hidden="false"). */
  headerShown?: boolean;
}

/**
 * The bar is mobile-only, appears once the hero CTAs are passed, and steps
 * aside over the contact block, for the keyboard and for form fields. On short
 * viewports it also yields to the header, so the two fixed bars never cover
 * the same screen together (they swap on scroll direction).
 */
export const stickyBarVisible = (s: StickyBarInputs): boolean =>
  s.mobile &&
  s.heroCtasPassed &&
  !s.contactVisible &&
  !s.keyboardOpen &&
  !s.fieldFocused &&
  !(s.shortViewport && s.headerShown);

/**
 * The on-screen keyboard shrinks the visual viewport but not the layout
 * viewport (Chrome ≥108 "resizes-visual", iOS Safari). Pinch-zoom also shrinks
 * visualViewport.height, so the height is scaled back before comparing.
 */
export function isKeyboardOpen(
  layoutHeight: number,
  visualHeight: number,
  visualScale = 1,
  minDelta: number = KEYBOARD_MIN_DELTA,
): boolean {
  return layoutHeight - visualHeight * visualScale > minDelta;
}

const NON_TEXT_INPUTS = new Set(["button", "submit", "reset", "checkbox", "radio", "range", "color", "file", "image", "hidden"]);

/** Minimal element shape so the check is testable without a DOM. */
export interface FieldLike {
  tagName: string;
  type?: string;
  isContentEditable?: boolean;
}

/** True for form fields that take typed input (and so may open the keyboard). */
export function isTextEntry(el: FieldLike | null | undefined): boolean {
  if (!el) return false;
  const tag = el.tagName.toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return !NON_TEXT_INPUTS.has((el.type ?? "text").toLowerCase());
  return Boolean(el.isContentEditable);
}

/**
 * WCAG 2.4.11: how far to scroll so a focused box clears a fixed bar.
 * Returns 0 when nothing overlaps. `edge` is the bar's inner edge in viewport px
 * (header: its bottom, bottom bar: its top); `gap` keeps some air around focus.
 */
export function obscuredBy(
  box: { top: number; bottom: number },
  bar: { side: "top" | "bottom"; edge: number },
  gap = 12,
): number {
  if (bar.side === "top") {
    const limit = bar.edge + gap;
    return box.top < limit ? box.top - limit : 0;
  }
  const limit = bar.edge - gap;
  return box.bottom > limit ? box.bottom - limit : 0;
}
