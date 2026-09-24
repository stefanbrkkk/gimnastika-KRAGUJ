"use client";

import { useEffect } from "react";
import { isKeyboardOpen, isTextEntry, stickyBarVisible, type StickyBarInputs } from "./chrome";
import { clearFocusFromBar } from "./focus-guard";

const MOBILE = "(max-width: 1023.98px)";

/**
 * Sticky bar visibility (renders nothing). Two IntersectionObservers (hero CTAs,
 * contact block), visualViewport for the on-screen keyboard, focusin/out for
 * form fields. No scroll handler.
 */
export function StickyBarBehavior() {
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>("[data-sticky-bar]");
    if (!bar) return;

    const mobile = window.matchMedia(MOBILE);
    const vv = window.visualViewport;
    const s: StickyBarInputs = {
      mobile: mobile.matches,
      heroCtasPassed: false,
      contactVisible: false,
      keyboardOpen: false,
      fieldFocused: isTextEntry(document.activeElement as HTMLElement | null),
    };
    const render = () => {
      const visible = stickyBarVisible(s) ? "true" : "false";
      if (bar.dataset.visible === visible) return;
      bar.dataset.visible = visible;
      if (visible === "true") clearFocusFromBar(bar);
    };

    // Hero CTAs: "passed" only once they are ABOVE the viewport (not before we reach them).
    // Falls back to the hero section if [data-hero-ctas] is ever missing.
    const hero = document.querySelector("[data-hero-ctas]") ?? document.getElementById("top");
    const heroIO = new IntersectionObserver(([e]) => {
      if (!e) return;
      s.heroCtasPassed = !e.isIntersecting && e.boundingClientRect.bottom <= 0;
      render();
    });
    if (hero) heroIO.observe(hero);
    else s.heroCtasPassed = true;

    // Falls back to #kontakt if [data-contact-block] is ever missing.
    const contact = document.querySelector("[data-contact-block]") ?? document.getElementById("kontakt");
    const contactIO = new IntersectionObserver(([e]) => {
      if (!e) return;
      s.contactVisible = e.isIntersecting;
      render();
    });
    if (contact) contactIO.observe(contact);

    const onViewport = () => {
      if (!vv) return;
      s.keyboardOpen = isKeyboardOpen(window.innerHeight, vv.height, vv.scale);
      render();
    };
    const onMobile = () => {
      s.mobile = mobile.matches;
      render();
    };
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
    vv?.addEventListener("resize", onViewport);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    onViewport();
    render();

    return () => {
      heroIO.disconnect();
      contactIO.disconnect();
      mobile.removeEventListener("change", onMobile);
      vv?.removeEventListener("resize", onViewport);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return null;
}
