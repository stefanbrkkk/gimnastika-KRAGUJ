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

/**
 * pickInBand with nested full-bleed bands ([data-header-band], D-37): a band that
 * contains the line wins over its section; otherwise the section that owns it.
 */
export function pickUnder<T>(candidates: readonly BandCandidate<T>[], bandY: number, isBand: (item: T) => boolean): T | null {
  const band = candidates.find((c) => isBand(c.item) && c.top <= bandY && c.bottom > bandY);
  return band?.item ?? pickInBand(candidates.filter((c) => !isBand(c.item)), bandY);
}

export interface HeaderCapInputs {
  scrollY: number;
  /** data-theme of the section (or header band) under the middle of the gap above the bar. */
  theme: string | null | undefined;
  /** A diagonal section edge (.edge-line) crosses that line: two colours share the gap. */
  onEdge: boolean;
}

/**
 * The page-coloured cap over the gap above the floating bar (SC3-05): content that
 * scrolls behind the header shows there sliced by the bar (the S4 scoreboard's white
 * text after a day tap), so while the page is scrolled the gap is painted in the
 * colour of the section under it. Off at the very top (the hero's own first paint) and
 * while a diagonal edge crosses the gap (one colour would be wrong on one side of it).
 */
export const headerCapOn = (s: HeaderCapInputs): boolean => s.scrollY > 0 && !s.onEdge && !!s.theme;

export interface HeaderCapBandInputs {
  /** data-theme under the middle of the gap (the cap's colour). */
  capTheme: string | null | undefined;
  /** data-theme under the bar's centre line (the header band's pick, before toneOf). */
  barTheme: string | null | undefined;
}

/**
 * The cap's solid band behind the bar's top half (SC4-02): it paints the pill's top
 * corner cut-outs in the cap colour, so a dark element inside a light section (the S4
 * scoreboard after a day tap) does not smudge them. Only while the gap and the bar's
 * centre line are over the same tone: then no section boundary lies between them and
 * the page there is that colour. When a straight boundary is between them (dark above,
 * light below, for about 30px of scroll), a band in the gap's colour would wrap the
 * bar's top corners in navy „shoulders“ with a hard edge at its inline edge; without it
 * the corners show the page as it is, under the gutter fade.
 */
export const headerCapBandOn = (s: HeaderCapBandInputs): boolean => !!s.capTheme && s.capTheme === s.barTheme;

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
  /** At least half of the S10 action row (.en-actions: trial CTA + call) is in the viewport. */
  enrollActionsVisible?: boolean;
  /**
   * At least half of the S3 progress rail (.pg-rail: prev/next + dots, under the card
   * strip on phones and tablets) is in the viewport. The dock would cover it there.
   */
  programsRailVisible?: boolean;
}

/**
 * The bar is mobile-only, appears once the hero CTAs are passed, and steps
 * aside over the contact block and the S10 action row (their own call/booking
 * buttons are on screen), over the S3 progress rail (it would cover the pager
 * the thumb is using), for the keyboard and for form fields. On short
 * viewports it also yields to the header, so the two fixed bars never cover
 * the same screen together (they swap on scroll direction).
 */
export const stickyBarVisible = (s: StickyBarInputs): boolean =>
  s.mobile &&
  s.heroCtasPassed &&
  !s.contactVisible &&
  !s.enrollActionsVisible &&
  !s.programsRailVisible &&
  !s.keyboardOpen &&
  !s.fieldFocused &&
  !(s.shortViewport && s.headerShown);

export interface HeaderCtaInputs {
  /** Any part of the hero CTA group ([data-hero-ctas]) is in the viewport. */
  heroCtasInView: boolean;
  /** Any part of the S11 contact block (with the doskok CTA) is in the viewport. */
  contactVisible: boolean;
}

/**
 * The header's „Zakažite probni trening“ pill steps aside while the same CTA is
 * already on screen in the page — the hero CTA group or the S11 finale — so a
 * viewport never shows two identical primary buttons (design review ID-06, C-15).
 */
export const headerCtaHidden = (s: HeaderCtaInputs): boolean => s.heroCtasInView || s.contactVisible;

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

/**
 * How far to scroll so a focused box sits inside the free band between the
 * fixed bars (`top` = the header's bottom edge or 0, `bottom` = the sticky
 * bar's top edge or the viewport height), `gap` px clear of both. A box that
 * cannot fit the band gets its top edge pinned (the rest of it stays reachable
 * by scrolling). 0 = nothing to do.
 */
export function bandDelta(box: { top: number; bottom: number }, top: number, bottom: number, gap = 12): number {
  if (box.bottom - box.top + 2 * gap > bottom - top) return box.top - (top + gap);
  return obscuredBy(box, { side: "top", edge: top }, gap) || obscuredBy(box, { side: "bottom", edge: bottom }, gap);
}

export interface FocusChrome {
  scrollY: number;
  viewportHeight: number;
  /** The header is shown (data-hidden="false"). */
  headerShown: boolean;
  /** The header bar's bottom edge at rest, in viewport px. */
  headerBottom: number;
  /** The sticky bar's top edge at rest when it is visible, else null. */
  barTop: number | null;
}

/**
 * WCAG 2.4.11 for the page chrome: the scroll that keeps a focused box clear of
 * the header and the sticky bar. Scrolling up while the header is hidden brings
 * it back (nextHeaderState: ≥ HEADER_TRAVEL, or back within HEADER_HIDE_AFTER),
 * so that correction clears the header's resting edge as well — otherwise the
 * returning header would cover the element just moved under it. On short
 * viewports the bar then steps aside (stickyBarVisible), freeing the bottom.
 */
export function focusScrollDelta(box: { top: number; bottom: number }, c: FocusChrome, gap = 12): number {
  const bottom = c.barTop ?? c.viewportHeight;
  const dy = bandDelta(box, c.headerShown ? c.headerBottom : 0, bottom, gap);
  if (c.headerShown || dy >= 0 || (dy > -HEADER_TRAVEL && c.scrollY + dy > HEADER_HIDE_AFTER)) return dy;
  return bandDelta(box, c.headerBottom, c.viewportHeight <= SHORT_VIEWPORT_MAX ? c.viewportHeight : bottom, gap);
}
