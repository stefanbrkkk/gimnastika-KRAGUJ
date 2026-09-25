"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type Ref,
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
  applyGroupPrefill,
  belgradeYear,
  birthYearOptions,
  bookingHrefs,
  composeBookingMessage,
  hasErrors,
  primaryChannel,
  sendOrder,
  validateBooking,
  type BookingErrors,
  type BookingField,
  type BookingValues,
  type MessageChannel,
  type SendChannel,
} from "@/lib/booking";
import { prefersLessMotion } from "@/lib/motion-env";
import { typesetSr } from "@/lib/typeset";
import type { BookingRequest } from "./types";

/** Viber: if the page is still visible this long after the tap, the app did not open. */
const VIBER_CHECK_MS = 1500;
/** Must match the exit animation in styles/sections/booking.css (--dur-fast, exits ≤200 ms). */
const CLOSE_MS = 180;

// Device → primary send action (lib/booking primaryChannel). Live: a tablet that
// gets a mouse, or DevTools device emulation, re-renders the actions.
const COARSE = "(pointer: coarse)";
const HOVER = "(hover: hover)";
const subscribeDevice = (onChange: () => void) => {
  const queries = [COARSE, HOVER].map((q) => window.matchMedia(q));
  queries.forEach((mq) => mq.addEventListener("change", onChange));
  return () => queries.forEach((mq) => mq.removeEventListener("change", onChange));
};
const devicePrimary = (): SendChannel =>
  primaryChannel({ coarsePointer: window.matchMedia(COARSE).matches, canHover: window.matchMedia(HOVER).matches });
const serverPrimary = (): SendChannel => "sms";

type TextField = "parent" | "phone" | "child";
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

// Visible sheet copy goes through typesetSr() (lib/typeset, display only): a spaced
// dash never starts a line, one-letter words hold on to the next word, and the phone
// number in the status / call line never breaks between its digit groups (D-BK-7).
// This chunk is lazy (never first-load); the message and hrefs stay raw.

const withoutError = (errors: BookingErrors, field: keyof BookingValues): BookingErrors => {
  if (!(field in errors)) return errors;
  const next = { ...errors };
  delete next[field as BookingField];
  return next;
};

/** Error line: a FILLED accent disc with a white „!“ (a solid „stop“ mark) + navy text. */
function ErrorLine({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className="booking-field__error">
      <svg className="ui-icon" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="9" fill="currentColor" />
        <path className="booking-field__error-mark" d="M10 5.25v5.75" fill="none" strokeWidth="2" strokeLinecap="round" />
        <circle className="booking-field__error-dot" cx="10" cy="14.4" r="1.2" />
      </svg>
      <span>{typesetSr(text)}</span>
    </p>
  );
}

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Native <select> (keyboard, screen readers and the phone's own picker all work)
 * laid transparently over a visible value box. The box wraps long labels — a
 * prefilled quiz group is never cut off with „…“ as a native select would.
 */
function SelectBox({
  id,
  name,
  value,
  options,
  onChange,
  selectRef,
  invalid,
  describedBy,
  required,
}: {
  id: string;
  name: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  selectRef?: Ref<HTMLSelectElement>;
  invalid?: boolean;
  describedBy?: string;
  required?: boolean;
}) {
  const selected = options.find((o) => o.value === value) ?? options[0];
  const placeholder = Boolean(selected?.disabled);
  return (
    <div className="booking-select" data-invalid={invalid ? "" : undefined} data-placeholder={placeholder ? "" : undefined}>
      <select
        ref={selectRef}
        id={id}
        name={name}
        className="booking-select__native"
        value={value}
        onChange={onChange}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        required={required}
      >
        {options.map((o) => (
          <option key={o.value || "empty"} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      {/* Display typesetting on the visible box only („B i C program“ holds together);
          the <option> labels and the message keep the raw text. */}
      <span className="booking-select__value" aria-hidden="true">
        {selected ? typesetSr(selected.label) : null}
      </span>
      <svg className="booking-select__chevron ui-icon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/**
 * The booking sheet: native <dialog> + showModal() (focus trap, inert page, Esc).
 * Bottom sheet on mobile, centered dialog ≥768px (styles/sections/booking.css).
 * Head · scrolling fields · a footer whose send actions are always in view.
 * Composes one message and hands it to SMS / email (/ Viber); nothing is stored.
 */
export function BookingDialog({ request }: { request: BookingRequest }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const primaryRef = useRef<HTMLAnchorElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const pressedOnBackdrop = useRef(false);
  const viberTimer = useRef(0);
  const fields = useRef<Partial<Record<BookingField, Control | null>>>({});

  const [values, setValues] = useState<BookingValues>(EMPTY_BOOKING);
  const [extraGroups, setExtraGroups] = useState<readonly string[]>([]);
  const [errors, setErrors] = useState<BookingErrors>({});
  const [noteOpen, setNoteOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [year] = useState(() => belgradeYear());
  const [seenRequest, setSeenRequest] = useState(0);
  const primary = useSyncExternalStore(subscribeDevice, devicePrimary, serverPrimary);
  const touchFirst = primary === "sms";
  const uid = useId();

  // A new open request (derived state, adjusted during render): clear the status and
  // old errors, prefill the group. An unknown label (the quiz's combined result)
  // becomes the one extra option; earlier extras are dropped (lib/booking applyGroupPrefill).
  if (request.id !== seenRequest) {
    setSeenRequest(request.id);
    setStatus("");
    setErrors({});
    const next = applyGroupPrefill(request.group, { extraGroups, group: values.group });
    if (next.extraGroups !== extraGroups) setExtraGroups(next.extraGroups);
    if (next.group !== values.group) setValues((v) => ({ ...v, group: next.group }));
  }

  // Open (or re-target) the dialog for each request.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    openerRef.current = request.opener;
    if (!dialog.open) {
      dialog.removeAttribute("data-closing");
      dialog.showModal();
      dialog.scrollTop = 0; // ≤480px tall the whole sheet is the scroller (booking.css)
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
    }
    document.documentElement.setAttribute("data-booking-open", ""); // body scroll lock
    // Touch: focus the title so the keyboard does not cover the sheet on open.
    // Mouse/keyboard: straight into the first field.
    const target = window.matchMedia(COARSE).matches ? titleRef.current : fields.current.parent;
    target?.focus({ preventScroll: true });
  }, [request]);

  useEffect(
    () => () => {
      window.clearTimeout(viberTimer.current);
      document.documentElement.removeAttribute("data-booking-open");
    },
    [],
  );

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
    ).filter((el) => el.getClientRects().length > 0);
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

  // Editing a field clears its own error at once; the form is validated again only on send.
  const update = (field: keyof BookingValues) => (event: ChangeEvent<Control>) => {
    const { value } = event.target;
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => withoutError(e, field));
    setStatus("");
  };

  // Enter in a text field moves on to the next field (the form has no submit button,
  // so browsers would otherwise do nothing); nothing is ever sent by Enter.
  const onFieldEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const controls = Array.from(event.currentTarget.form?.elements ?? []).filter(
      (el): el is Control => el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement,
    );
    const next = controls[controls.indexOf(event.currentTarget) + 1] ?? primaryRef.current;
    next?.focus();
  };

  const message = composeBookingMessage(values);
  const hrefs = bookingHrefs(message);

  /** Validates for this channel; on errors shows them inline and focuses the first invalid field. */
  const ready = (channel: MessageChannel): boolean => {
    const found = validateBooking(values, year, channel);
    if (!hasErrors(found)) {
      setErrors({});
      return true;
    }
    flushSync(() => {
      setErrors(found);
      setStatus("");
    });
    const first = BOOKING_REQUIRED.find((f) => found[f]);
    if (first) fields.current[first]?.focus();
    return false;
  };

  const onSend = (channel: SendChannel) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!ready(channel)) {
      event.preventDefault();
      return;
    }
    setStatus(BOOKING.after); // the link itself opens the SMS / email app
  };

  const onViber = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!ready("viber")) {
      event.preventDefault();
      return;
    }
    // Clipboard first, synchronously inside the tap (user activation), then the link navigates.
    try {
      navigator.clipboard?.writeText(message).catch(() => {});
    } catch {
      /* clipboard unavailable — the message is still offered via SMS/email */
    }
    setStatus(BOOKING.after);
    window.clearTimeout(viberTimer.current);
    viberTimer.current = window.setTimeout(() => {
      if (document.visibilityState === "visible") setStatus(BOOKING.viberFailed);
    }, VIBER_CHECK_MS);
  };

  const openNote = () => {
    flushSync(() => setNoteOpen(true));
    noteRef.current?.focus();
  };

  const errorId = (field: BookingField) => `${uid}-${field}-error`;
  const invalidProps = (field: BookingField) =>
    errors[field] ? ({ "aria-invalid": true, "aria-describedby": errorId(field) } as const) : {};
  const errorLine = (field: BookingField) => {
    const text = errors[field];
    return text ? <ErrorLine id={errorId(field)} text={text} /> : null;
  };

  const textProps = (field: TextField) =>
    ({
      id: `${uid}-${field}`,
      name: field,
      value: values[field],
      onChange: update(field),
      className: "booking-field__control",
      enterKeyHint: "next",
    }) as const;

  const yearOptions: SelectOption[] = [
    { value: "", label: BOOKING.fields.birthYearPlaceholder, disabled: true },
    ...birthYearOptions(year).map((y) => ({ value: y, label: y })),
  ];
  const groupOptions: SelectOption[] = [
    { value: "", label: GROUP_UNDECIDED.label },
    ...extraGroups.map((g) => ({ value: g, label: g })),
    ...BOOKING_GROUPS.map((g) => ({ value: g, label: g })),
  ];

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
      <div className="booking__head">
        <svg className="booking__leap" viewBox="0 0 230 150" aria-hidden="true" focusable="false">
          <use href="#leap" width="230" height="150" />
        </svg>
        <h2 ref={titleRef} id={`${uid}-title`} className="booking__title" tabIndex={-1}>
          {BOOKING.title}
        </h2>
        <button type="button" className="booking__close" aria-label={BOOKING.close} onClick={requestClose}>
          <svg className="ui-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div ref={bodyRef} className="booking__body">
        <form className="booking__form" noValidate onSubmit={(event) => event.preventDefault()}>
          <div className="booking-field booking-field--parent">
            <label htmlFor={`${uid}-parent`}>{BOOKING.fields.parent}</label>
            <input
              ref={(el) => {
                fields.current.parent = el;
              }}
              onKeyDown={onFieldEnter}
              type="text"
              autoComplete="name"
              autoCapitalize="words"
              required
              maxLength={80}
              {...textProps("parent")}
              {...invalidProps("parent")}
            />
            {errorLine("parent")}
          </div>

          <div className="booking-field booking-field--phone">
            <label htmlFor={`${uid}-phone`}>{BOOKING.fields.phone}</label>
            <input
              ref={(el) => {
                fields.current.phone = el;
              }}
              onKeyDown={onFieldEnter}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={BOOKING.fields.phoneHint}
              maxLength={24}
              {...textProps("phone")}
              {...invalidProps("phone")}
            />
            {errorLine("phone")}
          </div>

          <div className="booking-field booking-field--child">
            <label htmlFor={`${uid}-child`}>{BOOKING.fields.child}</label>
            <input type="text" autoComplete="off" autoCapitalize="words" maxLength={80} onKeyDown={onFieldEnter} {...textProps("child")} />
          </div>

          <div className="booking-field booking-field--year">
            <label htmlFor={`${uid}-birthYear`}>{BOOKING.fields.birthYear}</label>
            <SelectBox
              id={`${uid}-birthYear`}
              name="birthYear"
              selectRef={(el) => {
                fields.current.birthYear = el;
              }}
              value={values.birthYear}
              options={yearOptions}
              onChange={update("birthYear")}
              invalid={Boolean(errors.birthYear)}
              describedBy={errors.birthYear ? errorId("birthYear") : undefined}
              required
            />
            {errorLine("birthYear")}
          </div>

          <div className="booking-field booking-field--wide">
            <label htmlFor={`${uid}-group`}>{BOOKING.fields.group}</label>
            <SelectBox id={`${uid}-group`} name="group" value={values.group} options={groupOptions} onChange={update("group")} />
          </div>

          {noteOpen ? (
            <div className="booking-field booking-field--wide booking-field--note">
              <label htmlFor={`${uid}-note`}>{BOOKING.fields.note}</label>
              <textarea
                ref={noteRef}
                id={`${uid}-note`}
                name="note"
                className="booking-field__control booking-field__control--note"
                rows={3}
                maxLength={400}
                value={values.note}
                onChange={update("note")}
              />
            </div>
          ) : (
            <div className="booking-field--wide">
              <button type="button" className="booking-more" onClick={openNote}>
                <svg className="ui-icon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
                  <path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span>{BOOKING.addNote}</span>
              </button>
            </div>
          )}
        </form>

        <p id={`${uid}-privacy`} className="booking__privacy">
          <svg className="ui-icon" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
            <rect x="4" y="9" width="12" height="8.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.75" />
            <path d="M6.75 9V6.75a3.25 3.25 0 0 1 6.5 0V9" fill="none" stroke="currentColor" strokeWidth="1.75" />
          </svg>
          <span>{typesetSr(BOOKING.privacy)}</span>
        </p>
      </div>

      <div className="booking__foot">
        <p className="booking__status" role="status" aria-live="polite">
          {typesetSr(status)}
        </p>
        <div className="booking__sends">
          {sendOrder(primary).map((channel, i) => (
            <a
              key={channel}
              ref={i === 0 ? primaryRef : undefined}
              className={`btn ${i === 0 ? "btn-primary" : "btn-secondary"} booking__send`}
              href={hrefs[channel]}
              onClick={onSend(channel)}
            >
              {BOOKING.actions[channel]}
            </a>
          ))}
          {FLAGS.SHOW_VIBER ? (
            touchFirst ? (
              <a className="btn btn-secondary booking__send booking__send--wide" href={hrefs.viber} onClick={onViber}>
                {BOOKING.actions.viber}
              </a>
            ) : (
              <p className="booking__viber-number">
                {BOOKING.actions.viber}: <span>{typesetSr(PRIMARY_PHONE.display)}</span>
              </p>
            )
          ) : null}
        </div>
        <a className="booking__call" href={hrefs.tel}>
          <svg className="ui-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
            <path
              d="M6.6 3.5h2.6l1.4 4-2 1.4a11.5 11.5 0 0 0 6.5 6.5l1.4-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.6 16.6 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
          </svg>
          <span>{BOOKING.actions.call}</span>
          <span className="booking__call-number">{typesetSr(PRIMARY_PHONE.display)}</span>
        </a>
      </div>
    </dialog>
  );
}
