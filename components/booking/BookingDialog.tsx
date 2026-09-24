"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type SyntheticEvent,
} from "react";
import { flushSync } from "react-dom";
import { BOOKING } from "@/content/copy";
import { FLAGS, PRIMARY_PHONE } from "@/content/site";
import {
  BOOKING_GROUPS,
  BOOKING_REQUIRED,
  EMPTY_BOOKING,
  GROUP_UNDECIDED,
  belgradeYear,
  bookingHrefs,
  clean,
  composeBookingMessage,
  hasErrors,
  matchGroup,
  validateBooking,
  type BookingErrors,
  type BookingField,
  type BookingValues,
} from "@/lib/booking";
import { prefersLessMotion } from "@/lib/motion-env";
import type { BookingRequest } from "./types";

/** Viber: if the page is still visible this long after the tap, the app did not open. */
const VIBER_CHECK_MS = 1500;
/** Must match the exit animation in styles/sections/booking.css (exits ≤200 ms). */
const CLOSE_MS = 180;

const COARSE = "(pointer: coarse)";
const subscribeCoarse = (onChange: () => void) => {
  const mq = window.matchMedia(COARSE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const isCoarse = () => window.matchMedia(COARSE).matches;
const isCoarseOnServer = () => true;

type TextField = Exclude<keyof BookingValues, "group">;

/** The phone number inside status copy never breaks across lines. */
const keepNumberTogether = (text: string) =>
  text.split(PRIMARY_PHONE.display).flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <span key={i} className="whitespace-nowrap">
            {PRIMARY_PHONE.display}
          </span>,
          part,
        ],
  );

/**
 * The booking sheet: native <dialog> + showModal() (focus trap, inert page, Esc).
 * Bottom sheet on mobile, centered dialog ≥768px (styles/sections/booking.css).
 * Composes one message and hands it to SMS / email (/ Viber); nothing is stored.
 */
export function BookingDialog({ request }: { request: BookingRequest }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const pressedOnBackdrop = useRef(false);
  const viberTimer = useRef(0);
  const fields = useRef<Partial<Record<BookingField, HTMLInputElement | null>>>({});

  const [values, setValues] = useState<BookingValues>(EMPTY_BOOKING);
  const [extraGroups, setExtraGroups] = useState<readonly string[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState("");
  const [year] = useState(() => belgradeYear());
  const [seenRequest, setSeenRequest] = useState(0);
  const coarse = useSyncExternalStore(subscribeCoarse, isCoarse, isCoarseOnServer);
  const uid = useId();

  // A new open request: reset the status line and prefill the group (derived state,
  // adjusted during render). An unknown label (e.g. the quiz's combined result) becomes its own option.
  if (request.id !== seenRequest) {
    setSeenRequest(request.id);
    setStatus("");
    const prefill = clean(request.group);
    if (prefill) {
      const match = matchGroup(prefill, [...BOOKING_GROUPS, ...extraGroups]);
      if (match === null) setExtraGroups((groups) => [prefill, ...groups]);
      setValues((v) => ({ ...v, group: match ?? prefill }));
    }
  }

  // Open (or re-target) the dialog for each request.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    openerRef.current = request.opener;
    if (!dialog.open) {
      dialog.removeAttribute("data-closing");
      dialog.showModal();
      if (panelRef.current) panelRef.current.scrollTop = 0;
    }
    document.documentElement.setAttribute("data-booking-open", ""); // body scroll lock
    // Touch: focus the title so the keyboard does not cover the sheet on open.
    // Mouse/keyboard: straight into the first field.
    const target = isCoarse() ? titleRef.current : fields.current.parent;
    target?.focus({ preventScroll: true });
  }, [request]);

  useEffect(
    () => () => {
      window.clearTimeout(viberTimer.current);
      document.documentElement.removeAttribute("data-booking-open");
    },
    [],
  );

  // Keep the "after" / Viber status in view — on a phone it sits below the actions.
  useEffect(() => {
    if (status) statusRef.current?.scrollIntoView({ block: "nearest", behavior: prefersLessMotion() ? "auto" : "smooth" });
  }, [status]);

  const requestClose = () => {
    const dialog = dialogRef.current;
    if (!dialog?.open || dialog.hasAttribute("data-closing")) return;
    if (prefersLessMotion()) {
      dialog.close();
      return;
    }
    dialog.setAttribute("data-closing", "");
    window.setTimeout(() => {
      dialog.removeAttribute("data-closing");
      if (dialog.open) dialog.close();
    }, CLOSE_MS);
  };

  const onClosed = () => {
    window.clearTimeout(viberTimer.current);
    document.documentElement.removeAttribute("data-booking-open");
    const opener = openerRef.current;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  };

  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault(); // Esc → animated close
    requestClose();
  };

  // Strict focus trap: Tab wraps inside the sheet instead of escaping to the browser UI.
  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])"),
    ).filter((el) => el.offsetParent !== null);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === titleRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // Backdrop tap closes — only when the press also started on the backdrop (not a text-selection drag).
  const onPointerDown = (event: PointerEvent<HTMLDialogElement>) => {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  };
  const onDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget && pressedOnBackdrop.current) requestClose();
    pressedOnBackdrop.current = false;
  };

  const update = (field: keyof BookingValues) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { value } = event.target;
    setValues((v) => ({ ...v, [field]: value }));
    setStatus("");
  };

  const errors: BookingErrors = attempted ? validateBooking(values, year) : {};
  const message = composeBookingMessage(values);
  const hrefs = bookingHrefs(message);

  /** Validates before a message action; on errors shows them inline and focuses the first invalid field. */
  const ready = (): boolean => {
    const found = validateBooking(values, year);
    if (!hasErrors(found)) return true;
    flushSync(() => setAttempted(true));
    const first = BOOKING_REQUIRED.find((f) => found[f]);
    if (first) fields.current[first]?.focus();
    return false;
  };

  const onSend = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!ready()) {
      event.preventDefault();
      return;
    }
    setStatus(BOOKING.after); // the link itself opens the SMS / email app
  };

  const onViber = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!ready()) {
      event.preventDefault();
      return;
    }
    // Clipboard first, synchronously inside the tap (user activation), then the link navigates.
    try {
      navigator.clipboard?.writeText(message).catch(() => {});
    } catch {
      /* clipboard unavailable — the message is still shown via SMS/email */
    }
    setStatus(BOOKING.after);
    window.clearTimeout(viberTimer.current);
    viberTimer.current = window.setTimeout(() => {
      if (document.visibilityState === "visible") setStatus(BOOKING.viberFailed);
    }, VIBER_CHECK_MS);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Enter in a field: validate, then move to the send actions
    if (ready()) document.getElementById(`${uid}-sms`)?.focus();
  };

  const fieldProps = (field: TextField) => {
    const error = field === "parent" || field === "phone" || field === "birthYear" ? errors[field] : undefined;
    return {
      id: `${uid}-${field}`,
      name: field,
      value: values[field],
      onChange: update(field),
      className: "booking-field__control",
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${uid}-${field}-error` : undefined,
    } as const;
  };

  const errorLine = (field: BookingField) =>
    errors[field] ? (
      <p id={`${uid}-${field}-error`} className="booking-field__error">
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
          <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 5.5v5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="10" cy="14.25" r="1.1" fill="currentColor" />
        </svg>
        <span>{errors[field]}</span>
      </p>
    ) : null;

  return (
    <dialog
      ref={dialogRef}
      className="booking"
      data-theme="light"
      aria-labelledby={`${uid}-title`}
      aria-describedby={`${uid}-privacy`}
      onCancel={onCancel}
      onClose={onClosed}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onClick={onDialogClick}
    >
      <div ref={panelRef} className="booking__panel">
        <div className="booking__head">
          <svg className="booking__leap" viewBox="0 0 230 150" aria-hidden="true" focusable="false">
            <use href="#leap" width="230" height="150" />
          </svg>
          <h2 ref={titleRef} id={`${uid}-title`} className="booking__title" tabIndex={-1}>
            {BOOKING.title}
          </h2>
          <button type="button" className="booking__close" aria-label={BOOKING.close} onClick={requestClose}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form className="booking__form" noValidate onSubmit={onSubmit}>
          <div className="booking__grid">
            <div className="booking-field">
              <label htmlFor={`${uid}-parent`}>{BOOKING.fields.parent}</label>
              <input
                ref={(el) => {
                  fields.current.parent = el;
                }}
                type="text"
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                required
                maxLength={80}
                {...fieldProps("parent")}
              />
              {errorLine("parent")}
            </div>

            <div className="booking-field">
              <label htmlFor={`${uid}-phone`}>{BOOKING.fields.phone}</label>
              <input
                ref={(el) => {
                  fields.current.phone = el;
                }}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="next"
                placeholder={BOOKING.fields.phoneHint}
                required
                maxLength={24}
                {...fieldProps("phone")}
              />
              {errorLine("phone")}
            </div>

            <div className="booking-field">
              <label htmlFor={`${uid}-child`}>{BOOKING.fields.child}</label>
              <input type="text" autoComplete="off" autoCapitalize="words" enterKeyHint="next" maxLength={80} {...fieldProps("child")} />
            </div>

            <div className="booking-field">
              <label htmlFor={`${uid}-birthYear`}>{BOOKING.fields.birthYear}</label>
              <input
                ref={(el) => {
                  fields.current.birthYear = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                enterKeyHint="next"
                required
                maxLength={4}
                {...fieldProps("birthYear")}
                className="booking-field__control booking-field__control--year tabular"
              />
              {errorLine("birthYear")}
            </div>

            <div className="booking-field booking-field--wide">
              <label htmlFor={`${uid}-group`}>{BOOKING.fields.group}</label>
              <div className="booking-select">
                <select id={`${uid}-group`} name="group" className="booking-field__control" value={values.group} onChange={update("group")}>
                  <option value="">{GROUP_UNDECIDED.label}</option>
                  {extraGroups.map((g) => (
                    <option key={`x-${g}`} value={g}>
                      {g}
                    </option>
                  ))}
                  {BOOKING_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <svg className="booking-select__chevron" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
                  <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            <div className="booking-field booking-field--wide">
              <label htmlFor={`${uid}-note`}>{BOOKING.fields.note}</label>
              <textarea
                id={`${uid}-note`}
                name="note"
                className="booking-field__control booking-field__control--note"
                rows={2}
                maxLength={400}
                value={values.note}
                onChange={update("note")}
              />
            </div>
          </div>

          <p id={`${uid}-privacy`} className="booking__privacy">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
              <rect x="4" y="9" width="12" height="8.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6.75 9V6.75a3.25 3.25 0 0 1 6.5 0V9" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span>{BOOKING.privacy}</span>
          </p>

          <div className="booking__actions">
            <a id={`${uid}-sms`} className="btn btn-primary booking__action" href={hrefs.sms} onClick={onSend}>
              {BOOKING.actions.sms}
            </a>
            {FLAGS.SHOW_VIBER ? (
              coarse ? (
                <a className="btn btn-secondary booking__action" href={hrefs.viber} onClick={onViber}>
                  {BOOKING.actions.viber}
                </a>
              ) : (
                <p className="booking__viber-number">
                  {BOOKING.actions.viber}: <span className="tabular">{PRIMARY_PHONE.display}</span>
                </p>
              )
            ) : null}
            <a className="btn btn-secondary booking__action" href={hrefs.email} onClick={onSend}>
              {BOOKING.actions.email}
            </a>
            <a className="booking__call" href={hrefs.tel}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                <path
                  d="M6.6 3.5h2.6l1.4 4-2 1.4a11.5 11.5 0 0 0 6.5 6.5l1.4-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.6 16.6 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{BOOKING.actions.call}</span>
              <span className="booking__call-number tabular">{PRIMARY_PHONE.display}</span>
            </a>
          </div>

          <p ref={statusRef} className="booking__status" role="status" aria-live="polite">
            {keepNumberTogether(status)}
          </p>
        </form>
      </div>
    </dialog>
  );
}
