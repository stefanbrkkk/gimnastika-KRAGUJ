"use client";

import { useEffect } from "react";
import { initialHeaderState, nextHeaderState, pickInBand, toneOf, type BandCandidate } from "./chrome";
import { installFocusGuard } from "./focus-guard";

/** Scroll-spy band for aria-current: a 1%-tall line at 30% of the viewport. */
const SPY_MARGIN = "-30% 0px -69% 0px";

const isKeyboardFocus = (el: EventTarget | null): boolean => {
  if (!(el instanceof Element)) return false;
  try {
    return el.matches(":focus-visible");
  } catch {
    return true; // no :focus-visible support → treat all focus as keyboard focus
  }
};

/** Top-level themed blocks of the page (sections + footer), not nested cards or chrome. */
const pageSections = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>("main [data-theme], footer[data-theme]")).filter(
    (el) => !el.parentElement?.closest("[data-theme]"),
  );

/**
 * Header behaviour (renders nothing; the header markup is server-rendered):
 * 1. data-hidden: hides on scroll-down after 120px, shows on scroll-up and
 *    whenever keyboard focus is inside it. The scroll handler only reads scrollY.
 * 2. data-theme: tone of the section under the header's centre line, via an
 *    IntersectionObserver whose root margin leaves a 1px band at that line.
 * 3. aria-current on the nav links (scroll-spy, second 1px band at 30%).
 * 4. WCAG 2.4.11: keyboard focus that lands under the visible header or the
 *    sticky bottom bar is scrolled clear of it (focus-guard.ts).
 */
export function HeaderBehavior() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-site-header]");
    const bar = root?.querySelector<HTMLElement>("[data-header-bar]");
    if (!root || !bar) return;

    // 1 — hide / show
    let scroll = initialHeaderState(window.scrollY);
    let keyboardInside = false;
    const render = () => {
      const hidden = scroll.hidden && !keyboardInside ? "true" : "false";
      if (root.dataset.hidden !== hidden) root.dataset.hidden = hidden;
    };
    const onScroll = () => {
      scroll = nextHeaderState(scroll, window.scrollY);
      render();
    };
    const onFocusIn = (e: FocusEvent) => {
      keyboardInside = isKeyboardFocus(e.target);
      render();
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!(e.relatedTarget instanceof Node) || !root.contains(e.relatedTarget)) {
        keyboardInside = false;
        render();
      }
    };

    // 2 + 3 — themes and scroll-spy
    const sections = pageSections();
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[data-nav-link]"));
    const themeBand = new Map<HTMLElement, BandCandidate<HTMLElement>>();
    const spyBand = new Map<HTMLElement, BandCandidate<HTMLElement>>();
    let bandY = 0;
    let themeIO: IntersectionObserver | null = null;

    const track = (band: Map<HTMLElement, BandCandidate<HTMLElement>>, entries: IntersectionObserverEntry[]) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) band.set(el, { item: el, top: e.boundingClientRect.top, bottom: e.boundingClientRect.bottom });
        else band.delete(el);
      }
    };

    const buildThemeIO = () => {
      themeIO?.disconnect();
      themeBand.clear();
      // offsetTop/offsetHeight ignore the hide transform: the band stays at the bar's resting centre.
      bandY = Math.round(bar.offsetTop + bar.offsetHeight / 2);
      const below = Math.max(0, window.innerHeight - bandY - 1);
      themeIO = new IntersectionObserver(
        (entries) => {
          track(themeBand, entries);
          const under = pickInBand([...themeBand.values()], bandY);
          if (!under) return;
          // light | dark | darker: "darker" sections (navy-950) get a navy-900 bar so it still reads as a surface.
          const sectionTheme = under.getAttribute("data-theme");
          const theme = toneOf(sectionTheme) === "light" ? "light" : sectionTheme === "darker" ? "darker" : "dark";
          if (root.dataset.theme !== theme) root.dataset.theme = theme;
        },
        { rootMargin: `-${bandY}px 0px -${below}px 0px` },
      );
      sections.forEach((s) => themeIO?.observe(s));
    };

    const spyIO = new IntersectionObserver(
      (entries) => {
        track(spyBand, entries);
        const current = pickInBand([...spyBand.values()], window.innerHeight * 0.3);
        if (!current) return;
        const hash = `#${current.id}`;
        for (const a of links) {
          if (a.getAttribute("href") === hash) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        }
      },
      { rootMargin: SPY_MARGIN },
    );
    sections.forEach((s) => spyIO.observe(s));
    buildThemeIO();

    // Rebuild the theme band only when the viewport really changes size (debounced).
    let size = `${window.innerWidth}x${window.innerHeight}`;
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const next = `${window.innerWidth}x${window.innerHeight}`;
        if (next !== size) {
          size = next;
          buildThemeIO();
        }
      }, 180);
    };

    // 4 — focus not obscured by the header or the sticky bar
    const removeFocusGuard = installFocusGuard(root, bar);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    render();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      removeFocusGuard();
      window.clearTimeout(resizeTimer);
      themeIO?.disconnect();
      spyIO.disconnect();
    };
  }, []);

  return null;
}
