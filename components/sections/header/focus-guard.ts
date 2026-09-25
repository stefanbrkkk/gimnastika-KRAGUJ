import { focusScrollDelta } from "./chrome";

/** Scroll idle time that counts as "settled" (smooth focus scrolling included). */
const SETTLE_MS = 140;
/** Give up waiting for a settle after this long. */
const MAX_WAIT_MS = 1500;

const isKeyboardFocus = (el: Element): boolean => {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
};

/**
 * Scroll the focused element into the free band between the header and the
 * sticky bar (resting edges: the header is fixed at the top, the bar at the
 * bottom; offset* ignore their slide transforms). Tall elements are handled
 * too — one that cannot fit the band gets its top edge pinned under the header.
 */
function clearFocus(t: HTMLElement, header: HTMLElement | null, headerBar: HTMLElement | null): void {
  const box = t.getBoundingClientRect();
  const vh = window.innerHeight;
  if (box.bottom < 0 || box.top > vh) return;
  const bar = document.querySelector<HTMLElement>("[data-sticky-bar]");
  // (offsetParent is always null for position:fixed, so test for a rendered box instead)
  const barShown = bar?.dataset.visible === "true" && bar.getClientRects().length > 0;
  const dy = focusScrollDelta(box, {
    scrollY: window.scrollY,
    viewportHeight: vh,
    headerShown: Boolean(header && headerBar) && header?.dataset.hidden !== "true",
    headerBottom: headerBar ? headerBar.offsetTop + headerBar.offsetHeight : 0,
    barTop: bar && barShown ? vh - bar.offsetHeight : null,
  });
  if (dy !== 0) window.scrollBy({ top: dy, behavior: "instant" });
}

/**
 * WCAG 2.4.11 Focus Not Obscured: after keyboard focus moves, wait until any
 * scrolling (Chrome smooth-scrolls to the focused element, and does not
 * always honour scroll-padding when the element is already on screen) has
 * settled, then nudge the page so the focused element clears whichever fixed
 * bar is visible over it: the header (top) or the sticky bottom bar.
 * Returns a cleanup function.
 */
export function installFocusGuard(header: HTMLElement, headerBar: HTMLElement): () => void {
  let timer = 0;
  let deadline = 0;
  let target: HTMLElement | null = null;

  const check = () => {
    const t = target;
    target = null;
    window.removeEventListener("scroll", onScroll);
    if (!t || document.activeElement !== t) return;
    clearFocus(t, header, headerBar);
  };

  const arm = () => {
    window.clearTimeout(timer);
    const wait = Math.min(SETTLE_MS, Math.max(0, deadline - performance.now()));
    timer = window.setTimeout(check, wait);
  };

  function onScroll() {
    arm();
  }

  const onFocusIn = (e: FocusEvent) => {
    const t = e.target;
    if (!(t instanceof HTMLElement) || t.closest("dialog, [data-site-header], [data-sticky-bar], .skip-link")) return;
    if (!isKeyboardFocus(t)) return;
    target = t;
    deadline = performance.now() + MAX_WAIT_MS;
    window.addEventListener("scroll", onScroll, { passive: true });
    arm();
  };

  document.addEventListener("focusin", onFocusIn);
  return () => {
    document.removeEventListener("focusin", onFocusIn);
    window.removeEventListener("scroll", onScroll);
    window.clearTimeout(timer);
  };
}

/**
 * The sticky bar just appeared (data-visible="true" is already set; its resting
 * edge ignores the slide-in): if keyboard focus sits where the bar will rest,
 * scroll the focused element back into the free band.
 */
export function clearFocusFromBar(): void {
  const t = document.activeElement;
  if (!(t instanceof HTMLElement) || t === document.body || t.closest("dialog, [data-site-header], [data-sticky-bar]")) return;
  if (!isKeyboardFocus(t)) return;
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  clearFocus(t, header, header?.querySelector<HTMLElement>("[data-header-bar]") ?? null);
}
