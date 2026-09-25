"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { BOOKING_ATTR, openBooking } from "@/lib/events";
import { MENU_INDEX_ID } from "./chrome";
import { HEADER_COPY } from "./header-copy";
import { CloseIcon, MenuIcon } from "./icons";

const DIALOG_ID = "site-menu";
const WIDE = "(min-width: 1024px)";
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** false for the server HTML and the hydration render, true right after (no mismatch). */
const noSubscribe = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );

/**
 * Mobile (<1024px) menu sheet: native <dialog> + showModal() (the rest of the
 * page becomes inert; Esc closes; focus returns to "Meni"; Tab wraps).
 *
 * Progressive enhancement: "Meni" is server-rendered as a real link to the
 * footer's page index (#meni: the same links, the trial CTA and the call), so
 * it works without JS and in the gap before hydration. Once hydrated it
 * becomes a button (role, Space key) that opens the sheet instead.
 *
 * Activating any link in the sheet closes it FIRST — in a window capture
 * listener, before the browser follows the #anchor — so the anchor scroll
 * happens on the un-blocked page. The sheet's CTA opens the booking sheet via
 * openBooking(), so closing the booking sheet returns focus to "Meni".
 */
interface MobileMenuProps {
  /** Logo shown in the sheet's top row (server-rendered). */
  logo: ReactNode;
  /** Sheet body: nav list, CTA + call link, decoration (server-rendered, see Header.tsx). */
  children: ReactNode;
}

export function MobileMenu({ logo, children }: MobileMenuProps) {
  const openerRef = useRef<HTMLAnchorElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const enhanced = useHydrated();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    let closingForLink = false;
    const onClose = () => {
      setOpen(false);
      // Safety net: close() restores focus natively; make sure it did (Esc / close button).
      if (!closingForLink && (document.activeElement === document.body || document.activeElement === null)) openerRef.current?.focus();
      closingForLink = false;
    };

    // Capture on window = the earliest point of the click, ahead of any
    // document-level delegate (booking) and of the anchor's default action.
    const onClickCapture = (event: MouseEvent) => {
      if (!dialog.open) return;
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest("a[href]");
      if (!link || !dialog.contains(link)) return;
      closingForLink = true;
      dialog.close(); // focus returns to "Meni" (synchronously)
      const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
      if (plain && link.hasAttribute(BOOKING_ATTR)) {
        // Open the booking sheet ourselves so its focus-return target is the
        // menu button, not this link inside the now-closed sheet.
        event.preventDefault();
        event.stopImmediatePropagation();
        openBooking({ group: link.getAttribute(BOOKING_ATTR) ?? "" });
      } else if (link.getAttribute("href")?.startsWith("#") && document.activeElement === openerRef.current) {
        // In-page link: drop the restored focus so the fragment navigation that
        // follows sets the sequential-focus starting point — the next Tab goes
        // into the target section (as with a native in-page link), not back to the top.
        openerRef.current?.blur();
      }
    };

    // Explicit focus wrap (the native modal already makes the page inert).
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const wide = window.matchMedia(WIDE);
    const onWide = () => {
      if (wide.matches && dialog.open) dialog.close();
    };

    dialog.addEventListener("close", onClose);
    dialog.addEventListener("keydown", onKeyDown);
    window.addEventListener("click", onClickCapture, true);
    wide.addEventListener("change", onWide);
    return () => {
      dialog.removeEventListener("close", onClose);
      dialog.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("click", onClickCapture, true);
      wide.removeEventListener("change", onWide);
    };
  }, []);

  const openMenu = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    setOpen(true);
  };

  const onOpenerClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    // Modified clicks keep the link behaviour (the footer index in a new tab/window).
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openMenu();
  };

  // role="button" after hydration: Space activates on key-up, as on a native button
  // (key-down only stops the page from scrolling).
  const onOpenerKeyDown = (event: ReactKeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === " ") event.preventDefault();
  };
  const onOpenerKeyUp = (event: ReactKeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === " ") openMenu();
  };

  return (
    <>
      <a
        ref={openerRef}
        href={`#${MENU_INDEX_ID}`}
        className="menu-btn"
        // Plain link in the server HTML; a disclosure button for the sheet once hydrated.
        role={enhanced ? "button" : undefined}
        aria-haspopup={enhanced ? "dialog" : undefined}
        aria-expanded={enhanced ? open : undefined}
        aria-controls={enhanced ? DIALOG_ID : undefined}
        onClick={onOpenerClick}
        onKeyDown={enhanced ? onOpenerKeyDown : undefined}
        onKeyUp={enhanced ? onOpenerKeyUp : undefined}
      >
        <span>{HEADER_COPY.menu}</span>
        <MenuIcon />
      </a>

      <dialog ref={dialogRef} id={DIALOG_ID} className="menu-sheet" data-theme="dark" aria-label={HEADER_COPY.menu}>
        <div className="menu-sheet__inner">
          <div className="menu-sheet__top">
            {logo}
            <button type="button" className="menu-btn" onClick={() => dialogRef.current?.close()}>
              <span>{HEADER_COPY.close}</span>
              <CloseIcon />
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
