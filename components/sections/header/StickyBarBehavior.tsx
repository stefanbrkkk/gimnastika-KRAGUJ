"use client";

import { useEffect } from "react";
import { SHORT_VIEWPORT_MAX, headerCtaHidden, isKeyboardOpen, isTextEntry, stickyBarVisible, type StickyBarInputs } from "./chrome";
import { clearFocusFromBar } from "./focus-guard";

const MOBILE = "(max-width: 1023.98px)";
const SHORT = `(max-height: ${SHORT_VIEWPORT_MAX}px)`;

/**
 * Sticky bar visibility (renders nothing). IntersectionObservers on the hero
 * CTAs, the S11 contact block and the S10 action row, visualViewport for the
 * on-screen keyboard, focusin/out for form fields, and — on short viewports —
 * the header's data-hidden (the bar yields while the header is shown). No
 * scroll handler.
 *
 * The same observers drive the header's data-cta: its „Zakažite probni trening“
 * pill steps aside while the hero CTAs or the S11 finale are on screen
 * (headerCtaHidden; the CSS in header.css plays the take-off and landing).
 */
export function StickyBarBehavior() {
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>("[data-sticky-bar]");
    if (!bar) return;

    const mobile = window.matchMedia(MOBILE);
    const short = window.matchMedia(SHORT);
    const header = document.querySelector<HTMLElement>("[data-site-header]");
    const vv = window.visualViewport;
    const s: StickyBarInputs = {
      mobile: mobile.matches,
      heroCtasPassed: false,
      contactVisible: false,
      keyboardOpen: false,
      fieldFocused: isTextEntry(document.activeElement as HTMLElement | null),
      shortViewport: short.matches,
      headerShown: header?.dataset.hidden !== "true",
    };
    let heroCtasInView = false;
    const renderCta = () => {
      if (!header) return;
      const cta = headerCtaHidden({ heroCtasInView, contactVisible: s.contactVisible }) ? "hidden" : "shown";
      if (header.dataset.cta !== cta) header.dataset.cta = cta;
    };
    const render = () => {
      renderCta();
      const visible = stickyBarVisible(s) ? "true" : "false";
      if (bar.dataset.visible === visible) return;
      bar.dataset.visible = visible;
      if (visible === "true") clearFocusFromBar();
    };

    // Hero CTAs: "passed" only once they are ABOVE the viewport (not before we reach them).
    // The observer's root box reaches far below the viewport, so "intersecting" means
    // "not yet scrolled past the top edge" and every crossing of that edge fires — also a
    // jump (menu/anchor link, restored scroll) straight over CTAs that start below the
    // fold on short screens, which a plain viewport observer would never report.
    // Falls back to the hero section if [data-hero-ctas] is ever missing.
    const hero = document.querySelector("[data-hero-ctas]") ?? document.getElementById("top");
    const heroIO = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        s.heroCtasPassed = !e.isIntersecting && e.boundingClientRect.bottom <= 0;
        render();
      },
      { rootMargin: "0px 0px 1000000px 0px" },
    );
    if (hero) heroIO.observe(hero);
    else s.heroCtasPassed = true;
    // …and whether any of them is on screen right now (the header CTA steps aside).
    const heroViewIO = new IntersectionObserver(([e]) => {
      if (!e) return;
      heroCtasInView = e.isIntersecting;
      render();
    });
    if (hero) heroViewIO.observe(hero);

    // The S11 contact block (heading, CTA panel, contact rows). Zero rootMargin: the bar
    // steps aside as soon as any of it reaches the viewport — i.e. passes under the bar —
    // and returns once all of it has left (over the venue card and the footer).
    // Falls back to #kontakt if [data-contact-block] is ever missing.
    const contact = document.querySelector("[data-contact-block]") ?? document.getElementById("kontakt");
    const contactIO = new IntersectionObserver(([e]) => {
      if (!e) return;
      s.contactVisible = e.isIntersecting;
      render();
    });
    if (contact) contactIO.observe(contact);

    // The S10 action row (trial CTA + call): with half of it on screen, its own two
    // buttons are right there, so the bar steps aside instead of stacking a third.
    const enrollActions = document.querySelector(".en-actions");
    const actionsIO = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        s.enrollActionsVisible = e.isIntersecting && e.intersectionRatio >= 0.5;
        render();
      },
      { threshold: [0, 0.5] },
    );
    if (enrollActions) actionsIO.observe(enrollActions);

    const onViewport = () => {
      if (!vv) return;
      s.keyboardOpen = isKeyboardOpen(window.innerHeight, vv.height, vv.scale);
      render();
    };
    const onMobile = () => {
      s.mobile = mobile.matches;
      s.shortViewport = short.matches;
      render();
    };
    // Header shown/hidden (HeaderBehavior owns data-hidden; we only read it).
    const headerMO = new MutationObserver(() => {
      s.headerShown = header?.dataset.hidden !== "true";
      render();
    });
    if (header) headerMO.observe(header, { attributes: true, attributeFilter: ["data-hidden"] });
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      s.fieldFocused = isTextEntry(t);
      render();
      // Keeping keyboard focus clear of the bar: focus-guard.ts (installed by HeaderBehavior).
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!e.relatedTarget) {
        s.fieldFocused = false;
        render();
      }
    };

    mobile.addEventListener("change", onMobile);
    short.addEventListener("change", onMobile);
    vv?.addEventListener("resize", onViewport);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    onViewport();
    render();

    return () => {
      heroIO.disconnect();
      heroViewIO.disconnect();
      contactIO.disconnect();
      actionsIO.disconnect();
      headerMO.disconnect();
      mobile.removeEventListener("change", onMobile);
      short.removeEventListener("change", onMobile);
      vv?.removeEventListener("resize", onViewport);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return null;
}
