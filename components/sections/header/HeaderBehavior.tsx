"use client";

import { useEffect } from "react";
import { motionAllowed } from "@/lib/motion-env";
import {
  headerCapBandOn,
  headerCapOn,
  initialHeaderState,
  nextHeaderState,
  pickInBand,
  pickUnder,
  toneOf,
  type BandCandidate,
} from "./chrome";
import { installFocusGuard } from "./focus-guard";
import { HEADER_TONE_OWNED, headerYKey } from "./header-tone";

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
 *    IntersectionObserver whose root margin leaves a 1px band at that line. A
 *    nested full-bleed band marked [data-header-band] wins over its section.
 * 3. aria-current on the nav links (scroll-spy, second 1px band at 30%).
 * 3b. data-cap / data-cap-tone: the page-coloured cap over the gap above the bar
 *    (SC3-05), in the colour of the section under that gap (a third 1px band, at
 *    its middle); off at the top of the page and while a diagonal edge crosses it.
 *    data-cap-band: its solid band behind the bar's top corners (SC4-02), only while
 *    the gap and the bar's centre line are over the same tone (headerCapBandOn).
 * 4. WCAG 2.4.11: keyboard focus that lands under the visible header or the
 *    sticky bottom bar is scrolled clear of it (focus-guard.ts).
 * 5. Chrome motion (nav spy hop) is a lazy chunk, fetched on
 *    idle and only when motion is allowed (chrome-motion.ts).
 * 6. MD4-02 (header-tone.ts): on mount it tells the inline tone script that the
 *    observers own the tone now (HEADER_TONE_OWNED). On pagehide the scroll position
 *    (and viewport width) goes to sessionStorage under this history entry's key, so
 *    the footer's script knows where a reload or history arrival lands in browsers
 *    that restore it only after parsing (WebKit).
 */
export function HeaderBehavior() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-site-header]");
    const bar = root?.querySelector<HTMLElement>("[data-header-bar]");
    if (!root || !bar) return;

    // 1 — hide / show
    let scroll = initialHeaderState(window.scrollY);
    let keyboardInside = false;
    // 3b — the cap's inputs (filled by capIO below)
    let capTheme: string | null = null;
    let capOnEdge = false;
    // 2 — the raw data-theme under the bar's centre line (filled by themeIO below)
    let barTheme: string | null = null;
    const render = () => {
      const hidden = scroll.hidden && !keyboardInside ? "true" : "false";
      if (root.dataset.hidden !== hidden) root.dataset.hidden = hidden;
      const cap = headerCapOn({ scrollY: scroll.y, theme: capTheme, onEdge: capOnEdge }) ? "on" : "off";
      if (root.dataset.cap !== cap) root.dataset.cap = cap;
      // Independent of data-cap, so when the cap fades out its band fades with it.
      const band = headerCapBandOn({ capTheme, barTheme }) ? "on" : "off";
      if (root.dataset.capBand !== band) root.dataset.capBand = band;
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
    const headerBands = Array.from(document.querySelectorAll<HTMLElement>("main [data-header-band][data-theme]"));
    const edges = Array.from(document.querySelectorAll<Element>("main .edge-line"));
    const isBand = (el: HTMLElement) => el.hasAttribute("data-header-band");
    const themeBand = new Map<HTMLElement, BandCandidate<HTMLElement>>();
    const spyBand = new Map<HTMLElement, BandCandidate<HTMLElement>>();
    const capBand = new Map<HTMLElement, BandCandidate<HTMLElement>>();
    const edgesOnCap = new Set<Element>();
    let bandY = 0;
    let themeIO: IntersectionObserver | null = null;
    let capIO: IntersectionObserver | null = null;

    const track = (band: Map<HTMLElement, BandCandidate<HTMLElement>>, entries: IntersectionObserverEntry[]) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) band.set(el, { item: el, top: e.boundingClientRect.top, bottom: e.boundingClientRect.bottom });
        else band.delete(el);
      }
    };

    const buildBands = () => {
      themeIO?.disconnect();
      themeBand.clear();
      // offsetTop/offsetHeight ignore the hide transform: the band stays at the bar's resting centre.
      bandY = Math.round(bar.offsetTop + bar.offsetHeight / 2);
      const below = Math.max(0, window.innerHeight - bandY - 1);
      themeIO = new IntersectionObserver(
        (entries) => {
          track(themeBand, entries);
          // A full-bleed band inside a section ([data-header-band], e.g. S5 „Hronologija“) wins over its parent.
          const under = pickUnder([...themeBand.values()], bandY, isBand);
          if (!under) return;
          // light | dark | darker: "darker" sections (navy-950) get a navy-900 bar so it still reads as a surface.
          const sectionTheme = under.getAttribute("data-theme");
          const theme = toneOf(sectionTheme) === "light" ? "light" : sectionTheme === "darker" ? "darker" : "dark";
          if (root.dataset.theme !== theme) root.dataset.theme = theme;
          barTheme = sectionTheme;
          render();
        },
        { rootMargin: `-${bandY}px 0px -${below}px 0px` },
      );
      sections.forEach((s) => themeIO?.observe(s));
      headerBands.forEach((b) => themeIO?.observe(b));

      // 3b — the gap above the bar: which section's colour is behind it, and whether a
      // diagonal edge (.edge-line spans a section's cut) crosses it.
      capIO?.disconnect();
      capBand.clear();
      edgesOnCap.clear();
      const capY = Math.round(bar.offsetTop / 2);
      capIO = new IntersectionObserver(
        (entries) => {
          const areas: IntersectionObserverEntry[] = [];
          for (const e of entries) {
            if (!edges.includes(e.target)) areas.push(e);
            else if (e.isIntersecting) edgesOnCap.add(e.target);
            else edgesOnCap.delete(e.target);
          }
          track(capBand, areas);
          capTheme = pickUnder([...capBand.values()], capY, isBand)?.getAttribute("data-theme") ?? capTheme;
          if (capTheme && root.dataset.capTone !== capTheme) root.dataset.capTone = capTheme;
          capOnEdge = edgesOnCap.size > 0;
          render();
        },
        { rootMargin: `-${capY}px 0px -${Math.max(0, window.innerHeight - capY - 1)}px 0px` },
      );
      sections.forEach((s) => capIO?.observe(s));
      headerBands.forEach((b) => capIO?.observe(b));
      edges.forEach((l) => capIO?.observe(l));
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
    buildBands();

    // Rebuild the theme and cap bands only when the viewport really changes size (debounced).
    let size = `${window.innerWidth}x${window.innerHeight}`;
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const next = `${window.innerWidth}x${window.innerHeight}`;
        if (next !== size) {
          size = next;
          buildBands();
        }
      }, 180);
    };

    // 4 — focus not obscured by the header or the sticky bar
    const removeFocusGuard = installFocusGuard(root, bar);

    // 6 — the observers own the tone from here; the landing position of the next reload / history arrival
    root.dispatchEvent(new Event(HEADER_TONE_OWNED));
    const onPageHide = () => {
      try {
        const nav = (window as Window & { navigation?: { currentEntry?: { key?: string } | null } }).navigation;
        sessionStorage.setItem(headerYKey(nav?.currentEntry?.key), `${Math.round(window.scrollY)} ${window.innerWidth}`);
      } catch {
        // storage blocked (private mode, site data off): the observer corrects the tone after hydration
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("pagehide", onPageHide);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    render();

    // 5 — decorative chrome motion, off the critical path
    let live = true;
    let stopMotion: (() => void) | undefined;
    let cancelLoad = () => {};
    if (motionAllowed()) {
      const load = () =>
        void import("./chrome-motion").then(
          (m) => {
            if (live) stopMotion = m.startChromeMotion();
          },
          () => {}, // a failed chunk leaves the static chrome
        );
      if (window.requestIdleCallback) {
        const id = window.requestIdleCallback(load, { timeout: 2500 });
        cancelLoad = () => window.cancelIdleCallback(id);
      } else {
        const id = window.setTimeout(load, 600);
        cancelLoad = () => window.clearTimeout(id);
      }
    }

    return () => {
      live = false;
      cancelLoad();
      stopMotion?.();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pagehide", onPageHide);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      removeFocusGuard();
      window.clearTimeout(resizeTimer);
      themeIO?.disconnect();
      capIO?.disconnect();
      spyIO.disconnect();
    };
  }, []);

  return null;
}
