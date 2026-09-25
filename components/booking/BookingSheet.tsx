"use client";

import { useEffect, useState } from "react";
import { QuietBoundary } from "@/components/ui/QuietBoundary";
import { BOOKING_ATTR, BOOKING_EVENT, type BookingDetail } from "@/lib/events";
import { prefersLessMotion } from "@/lib/motion-env";
import type { BookingRequest } from "./types";

type DialogModule = typeof import("./BookingDialog");
type DialogComponent = DialogModule["BookingDialog"];

/**
 * One import() call site = one chunk, shared by the idle / intent warm-up and the
 * first tap. A failed load is forgotten, so the next tap retries the network.
 * No next/dynamic: its Suspense reveal held the first open back by ~300 ms.
 */
let dialogModule: Promise<DialogModule> | null = null;
const loadDialog = () =>
  (dialogModule ??= import("./BookingDialog").catch((error: unknown) => {
    dialogModule = null;
    throw error;
  }));

/**
 * The no-JS path, for when the dialog chunk cannot load (offline, blocked) or the
 * dialog crashes: do what the link does without JS — land on the S11 contact block.
 * Setting location.hash alone would do nothing when it already is #kontakt.
 */
function jumpToContact() {
  document.documentElement.removeAttribute("data-booking-open");
  const section = document.getElementById("kontakt");
  if (!section) return;
  if (location.hash !== "#kontakt") history.pushState(null, "", "#kontakt");
  section.scrollIntoView({ block: "start", behavior: prefersLessMotion() ? "auto" : "smooth" });
  const heading = section.querySelector<HTMLElement>("h2");
  if (!heading) return;
  if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

/** Error-boundary fallback: one jump per open request (keyed by the request id). */
function JumpToContact() {
  useEffect(() => jumpToContact(), []);
  return null;
}

/**
 * Booking entry point (mounted once from app/page.tsx). Tiny on purpose: it only
 * listens for booking intents and loads the dialog on demand.
 *
 * - Delegated clicks on any [data-booking] link (preventDefault; the attribute
 *   value prefills „Grupa“). Without JS nothing intercepts → the link's own href
 *   works (#kontakt everywhere; the S11 button's is an SMS link).
 * - window BOOKING_EVENT (openBooking({ group }) from lib/events).
 * The dialog chunk is warmed on idle and on the first pointer/focus intent, so the
 * first open is a plain render + showModal() (no network, no Suspense).
 */
export function BookingSheet() {
  const [Dialog, setDialog] = useState<DialogComponent | null>(null);
  const [request, setRequest] = useState<BookingRequest | null>(null);

  useEffect(() => {
    let alive = true;
    let seq = 0;
    let loaded: DialogComponent | null = null;
    const adopt = (m: DialogModule) => {
      if (loaded) return;
      loaded = m.BookingDialog;
      setDialog(() => m.BookingDialog);
    };

    const open = (group: string, opener: HTMLElement | null) => {
      const next: BookingRequest = { id: ++seq, group, opener };
      if (loaded) {
        setRequest(next);
        return;
      }
      loadDialog().then(
        (m) => {
          if (!alive || next.id !== seq) return; // a newer tap supersedes this one
          adopt(m);
          setRequest(next);
        },
        () => {
          if (alive && next.id === seq) jumpToContact();
        },
      );
    };

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

    let warming = false;
    const warm = () => {
      if (loaded || warming) return;
      warming = true;
      loadDialog()
        .then((m) => {
          if (alive) adopt(m);
        })
        .catch(() => {
          /* offline: the tap retries, and falls back to #kontakt if it fails again */
        })
        .finally(() => {
          warming = false;
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
      alive = false;
      window.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener(BOOKING_EVENT, onEvent);
      window.removeEventListener("pointerdown", onIntent, { capture: true });
      window.removeEventListener("focusin", onIntent);
      if (hasIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);

  if (!Dialog || !request) return null;
  return (
    <QuietBoundary fallback={<JumpToContact key={request.id} />}>
      <Dialog request={request} />
    </QuietBoundary>
  );
}
