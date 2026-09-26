/**
 * Page-chrome motion — a lazy chunk (HeaderBehavior imports it on idle, only when
 * motion is allowed), so none of this is first-load JS. CSS does the animating;
 * this file only measures and sets attributes. No rAF loop, no scroll handler.
 *
 * Nav spy (≥1024 with hover): one „you are here“ line under the desktop links
 * that hops from link to link on an arc — x linear, y a small parabola, then a
 * stuck landing (header.css .site-header__spy*). It replaces the per-link line
 * while it runs. Under the hidden header it moves without a hop.
 * (The footer logo is static: its take-off ghost stream is gone, plan §5.11.)
 */

const WIDE = "(min-width: 1024px) and (hover: hover)";

function navSpy(): () => void {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  const spy = header?.querySelector<HTMLElement>("[data-nav-spy]");
  const links = Array.from(header?.querySelectorAll<HTMLAnchorElement>(".site-header__nav a[data-nav-link]") ?? []);
  if (!header || !spy || links.length === 0) return () => {};

  const wide = window.matchMedia(WIDE);
  let current: HTMLAnchorElement | null = null;
  let hop = false;

  const measure = (a: HTMLAnchorElement) => {
    const pad = parseFloat(getComputedStyle(a).paddingLeft) || 0;
    return { x: a.offsetLeft + pad, y: a.offsetTop + a.offsetHeight, w: Math.max(0, a.offsetWidth - 2 * pad) };
  };

  /** animate = hop from the last position; otherwise jump there (resize, hidden header, first show). */
  const place = (to: HTMLAnchorElement | null, animate: boolean) => {
    if (!to) {
      spy.dataset.on = "false";
      return;
    }
    const m = measure(to);
    const moving = animate && spy.dataset.on !== undefined && header.dataset.hidden !== "true";
    spy.dataset.jump = moving ? "false" : "true";
    spy.style.setProperty("--spy-x", `${m.x}px`);
    spy.style.setProperty("--spy-y", `${m.y}px`);
    spy.style.setProperty("--spy-w", `${m.w}`);
    if (moving) {
      hop = !hop;
      spy.dataset.hop = hop ? "a" : "b";
    }
    spy.dataset.on = "true";
  };

  const sync = (animate: boolean) => {
    const next = links.find((a) => a.hasAttribute("aria-current")) ?? null;
    if (next === current && animate) return;
    current = next;
    place(current, animate);
  };

  const mo = new MutationObserver(() => sync(true));
  let timer = 0;
  const onResize = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => sync(false), 120);
  };

  const start = () => {
    header.dataset.spy = "";
    mo.observe(header, { subtree: true, attributes: true, attributeFilter: ["aria-current"] });
    window.addEventListener("resize", onResize);
    sync(false);
    // Mona Sans swaps in after first paint: re-measure once the fonts are ready.
    void document.fonts?.ready.then(() => sync(false));
  };
  const stop = () => {
    mo.disconnect();
    window.removeEventListener("resize", onResize);
    window.clearTimeout(timer);
    delete header.dataset.spy;
    delete spy.dataset.on;
    current = null;
  };
  const onWide = () => (wide.matches ? start() : stop());

  onWide();
  wide.addEventListener("change", onWide);
  return () => {
    wide.removeEventListener("change", onWide);
    stop();
  };
}

export function startChromeMotion(): () => void {
  return navSpy();
}
