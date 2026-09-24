"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { BOOKING_ATTR, BOOKING_EVENT, type BookingDetail } from "@/lib/events";
import type { BookingRequest } from "./types";

/**
 * Booking entry point (mounted once from app/page.tsx). Tiny on purpose: it only
 * listens for booking intents and lazy-loads the dialog.
 *
 * - Delegated clicks on any [data-booking] link (preventDefault; the attribute
 *   value prefills „Grupa“). Without JS nothing intercepts → the link jumps to #kontakt.
 * - window BOOKING_EVENT (openBooking({ group }) from lib/events).
 * The dialog chunk is warmed on idle and on the first pointer/focus intent, so the
 * first open does not wait for the network.
 */
const loadDialog = () => import("./BookingDialog");
const BookingDialog = dynamic(() => loadDialog().then((m) => m.BookingDialog), { ssr: false });

export function BookingSheet() {
  const [request, setRequest] = useState<BookingRequest | null>(null);

  useEffect(() => {
    let seq = 0;
    const open = (group: string, opener: HTMLElement | null) => setRequest({ id: ++seq, group, opener });

    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest(`[${BOOKING_ATTR}]`) : null;
      if (!(target instanceof HTMLElement)) return;
      event.preventDefault();
      open(target.getAttribute(BOOKING_ATTR) ?? "", target);
    };

    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<BookingDetail>).detail;
      const active = document.activeElement;
      open(detail?.group ?? "", active instanceof HTMLElement && active !== document.body ? active : null);
    };

    let warmed = false;
    const warm = () => {
      if (warmed) return;
      warmed = true;
      loadDialog().catch(() => {
        warmed = false;
      });
    };
    const onIntent = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(`[${BOOKING_ATTR}]`)) warm();
    };

    // Capture phase: runs before any island that stops propagation.
    window.addEventListener("click", onClick, { capture: true });
    window.addEventListener(BOOKING_EVENT, onEvent);
    window.addEventListener("pointerdown", onIntent, { capture: true, passive: true });
    window.addEventListener("focusin", onIntent);

    // Safari has no requestIdleCallback.
    const hasIdle = typeof window.requestIdleCallback === "function";
    const idle = hasIdle ? window.requestIdleCallback(warm, { timeout: 5000 }) : window.setTimeout(warm, 3000);

    return () => {
      window.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener(BOOKING_EVENT, onEvent);
      window.removeEventListener("pointerdown", onIntent, { capture: true });
      window.removeEventListener("focusin", onIntent);
      if (hasIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);

  return request ? <BookingDialog request={request} /> : null;
}
