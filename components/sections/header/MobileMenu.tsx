"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BOOKING_ATTR, openBooking } from "@/lib/events";
import { HEADER_COPY } from "./header-copy";
import { CloseIcon, MenuIcon } from "./icons";

const DIALOG_ID = "site-menu";
const WIDE = "(min-width: 1024px)";
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Mobile (<1024px) menu sheet: native <dialog> + showModal() (the rest of the
 * page becomes inert; Esc closes; focus returns to the menu button; Tab wraps).
 * Activating any link closes the sheet FIRST — in a window capture listener,
 * before the browser follows the #anchor — so the anchor scroll happens on the
 * un-blocked page. The sheet's CTA opens the booking sheet via openBooking(),
 * so closing the booking sheet returns focus to the menu button.
 */
interface MobileMenuProps {
  /** Logo shown in the sheet's top row (server-rendered). */
  logo: ReactNode;
  /** Sheet body: nav list, CTA + call link, decoration (server-rendered, see Header.tsx). */
  children: ReactNode;
}

export function MobileMenu({ logo, children }: MobileMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    let closingForLink = false;
    const onClose = () => {
      setOpen(false);
      // Safety net: close() restores focus natively; make sure it did (Esc / close button).
      if (!closingForLink && (document.activeElement === document.body || document.activeElement === null)) buttonRef.current?.focus();
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
      dialog.close(); // focus returns to the menu button (synchronously)
      const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
      if (plain && link.hasAttribute(BOOKING_ATTR)) {
        // Open the booking sheet ourselves so its focus-return target is the
        // menu button, not this link inside the now-closed sheet.
        event.preventDefault();
        event.stopImmediatePropagation();
        openBooking({ group: link.getAttribute(BOOKING_ATTR) ?? "" });
      } else if (link.getAttribute("href")?.startsWith("#") && document.activeElement === buttonRef.current) {
        // In-page link: drop the restored focus so the fragment navigation that
        // follows sets the sequential-focus starting point — the next Tab goes
        // into the target section (as with a native in-page link), not back to the top.
        buttonRef.current?.blur();
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

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="menu-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={DIALOG_ID}
        onClick={openMenu}
      >
        <span>{HEADER_COPY.menu}</span>
        <MenuIcon />
      </button>

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
