import { obscuredBy } from "./chrome";

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
    const box = t.getBoundingClientRect();
    if (box.height > window.innerHeight / 2 || box.bottom < 0 || box.top > window.innerHeight) return;

    let dy = 0;
    if (header.dataset.hidden !== "true") {
      dy = obscuredBy(box, { side: "top", edge: headerBar.getBoundingClientRect().bottom });
    }
    const bar = document.querySelector<HTMLElement>("[data-sticky-bar]");
    // (offsetParent is always null for position:fixed, so test for a rendered box instead)
    if (dy === 0 && bar?.dataset.visible === "true" && bar.getClientRects().length > 0) {
      dy = obscuredBy(box, { side: "bottom", edge: bar.getBoundingClientRect().top });
    }
    if (dy !== 0) window.scrollBy({ top: dy, behavior: "instant" });
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
 * The sticky bar just appeared: if keyboard focus sits where the bar will
 * rest, scroll just enough that the focused element sits above the bar.
 * (offsetHeight ignores the bar's slide-in transform, so this is its final edge.)
 */
export function clearFocusFromBar(bar: HTMLElement): void {
  const t = document.activeElement;
  if (!(t instanceof HTMLElement) || t === document.body || t.closest("dialog, [data-site-header], [data-sticky-bar]")) return;
  if (!isKeyboardFocus(t)) return;
  const box = t.getBoundingClientRect();
  if (box.height > window.innerHeight / 2 || box.bottom < 0 || box.top > window.innerHeight) return;
  const dy = obscuredBy(box, { side: "bottom", edge: window.innerHeight - bar.offsetHeight });
  if (dy !== 0) window.scrollBy({ top: dy, behavior: "instant" });
}
