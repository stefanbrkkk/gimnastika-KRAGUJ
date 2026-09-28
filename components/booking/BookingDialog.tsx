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
import { FLAGS, PRIMARY_PHONE, VIBER_PHONE_E164 } from "@/content/site";
import {
  BOOKING_GROUPS,
  BOOKING_REQUIRED,
  EMPTY_BOOKING,
  GROUP_UNDECIDED,
  applyGroupPrefill,
  applyNotePrefill,
  belgradeYear,
  birthYearOptions,
  bookingHrefs,
  composeBookingMessage,
  hasErrors,
  landedScrollBy,
  primaryChannel,
  scrollEdgeFades,
  sendOrder,
  validateBooking,
  type BookingErrors,
  type BookingField,
  type BookingValues,
  type MessageChannel,
  type ScrollBox,
  type SendChannel,
} from "@/lib/booking";
import { prefersLessMotion } from "@/lib/motion-env";
import { typesetSr } from "@/lib/typeset";
import type { BookingRequest } from "./types";

/** Viber: if the page is still visible this long after the tap, the app did not open. */
const VIBER_CHECK_MS = 1500;
/** Must match the exit animation in styles/sections/booking.css (--dur-fast, exits ≤200 ms). */
const CLOSE_MS = 180;
/** Bottom-sheet layout (booking.css): below 768 px the head can be pulled down to close. */
const SHEET = "(max-width: 767.98px)";
/** Pull-down: close past 30% of the sheet's height or on a flick faster than .5 px/ms. */
const PULL_CLOSE_RATIO = 0.3;
const PULL_CLOSE_SPEED = 0.5;
/** Invalid fields that wobble on a send attempt (the first three, 40 ms apart). */
const WOBBLE_MAX = 3;
/** The fields' scroll-edge fade at most (px), where a line is cut (CV4-01). */
const FADE = 20;

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

/**
 * The fields' scroll view (CV4-01). Normally the body is the scroller. On short viewports
 * (≤480px tall, booking.css) the whole dialog scrolls instead, and the fields are seen
 * between the sheet's top edge and the sticky footer: the same box is then measured from
 * rects (scrollTop = how far that view's top is below the body's top, which is negative
 * while the head is in view).
 */
function fieldsView(dialog: HTMLElement, body: HTMLElement, foot: HTMLElement): { scroller: HTMLElement; box: ScrollBox } {
  const style = getComputedStyle(body);
  const paddingTop = Number.parseFloat(style.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
  if (style.overflowY !== "visible") {
    const { scrollTop, clientHeight, scrollHeight } = body;
    return { scroller: body, box: { scrollTop, clientHeight, scrollHeight, paddingTop, paddingBottom } };
  }
  const b = body.getBoundingClientRect();
  const viewTop = dialog.getBoundingClientRect().top + dialog.clientTop;
  const viewBottom = Math.min(foot.getBoundingClientRect().top, viewTop + dialog.clientHeight);
  return {
    scroller: dialog,
    box: { scrollTop: viewTop - b.top, clientHeight: viewBottom - viewTop, scrollHeight: b.height, paddingTop, paddingBottom },
  };
}

/**
 * The „landed“ card's figure is the pose family's salute (docs/plan-figure-system.md §5.13),
 * rendered by the brand Pose component. The pose data is its own chunk, fetched when the sheet
 * first mounts (long before a hand-off can happen), so the path data never weighs on this one.
 * One import() call site; a failed load is forgotten so the next mount retries.
 */
type PoseComponent = (typeof import("@/components/brand/Pose"))["Pose"];
let poseModule: Promise<PoseComponent> | null = null;
const loadPose = () =>
  (poseModule ??= import("@/components/brand/Pose").then(
    (m) => m.Pose,
    (error: unknown) => {
      poseModule = null;
      throw error;
    },
  ));

const withoutError = (errors: BookingErrors, field: keyof BookingValues): BookingErrors => {
  if (!(field in errors)) return errors;
  const next = { ...errors };
  delete next[field as BookingField];
  return next;
};

/** Error line under an invalid field: royal-600 text led by a filled „!“ disc (CSS ::before,
 *  decorative), so it never reads as the next field's label (CV2-03). */
function ErrorLine({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className="booking-field__error">
      <span>{typesetSr(text)}</span>
    </p>
  );
}

/** A FILLED accent disc with a white „!“ (solid = stop), inside an invalid control's right end. */
function StopMark() {
  return (
    <svg className="booking-stop ui-icon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="9.5" fill="currentColor" />
      <path className="booking-stop__mark" d="M10 5.25v5.75" fill="none" strokeWidth="2" strokeLinecap="round" />
      <circle className="booking-stop__dot" cx="10" cy="14.4" r="1.2" />
    </svg>
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
      {invalid ? <StopMark /> : null}
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
  const footRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const primaryRef = useRef<HTMLAnchorElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const pressedOnBackdrop = useRef(false);
  const viberTimer = useRef(0);
  const pull = useRef<{ id: number; y0: number; dy: number; moved: boolean; samples: { y: number; t: number }[] } | null>(null);
  const fields = useRef<Partial<Record<BookingField, Control | null>>>({});

  const [values, setValues] = useState<BookingValues>(EMPTY_BOOKING);
  const [extraGroups, setExtraGroups] = useState<readonly string[]>([]);
  const [errors, setErrors] = useState<BookingErrors>({});
  const [noteOpen, setNoteOpen] = useState(false);
  const [status, setStatus] = useState("");
  // Hand-offs so far: keys the „landed“ card, so its stamp plays once per hand-off.
  const [handoffs, setHandoffs] = useState(0);
  const [SentPose, setSentPose] = useState<PoseComponent | null>(null);
  const [year] = useState(() => belgradeYear());
  const [seenRequest, setSeenRequest] = useState(0);
  const primary = useSyncExternalStore(subscribeDevice, devicePrimary, serverPrimary);
  const touchFirst = primary === "sms";
  // The message went to the parent's app: the sheet shows the „landed“ card, and both send
  // actions step down to outlined, so the finished job no longer shouts „send“ (C-05).
  const landed = status === BOOKING.after;
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
    const nextNote = applyNotePrefill(request.note ?? "", values.note);
    if (nextNote !== values.note) {
      setValues((v) => ({ ...v, note: nextNote }));
      if (nextNote) setNoteOpen(true);
    }
  }

  // The salute for the „landed“ card, fetched once the sheet exists (see loadPose).
  useEffect(() => {
    let live = true;
    loadPose().then(
      (Pose) => live && setSentPose(() => Pose),
      () => {}, // no figure: the card still says the message is on its way
    );
    return () => {
      live = false;
    };
  }, []);

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

  // CV4-01 · While a line of the fields is cut by the view's lower edge, that edge fades out,
  // so it reads as „more below“ and is never guillotined at the footer's hairline; a line cut
  // at the upper edge (under the head, or under the sheet's top edge on short viewports) fades
  // the same way. Only content counts, not the body's padding, and each fade is as long as
  // what it hides (≤ FADE px), so it grows and shrinks with the scroll instead of popping. The
  // lengths go on the dialog (--fade-above / --fade-below): the body's mask reads them, and on
  // short viewports, where the dialog scrolls, the scrims on the sheet's top edge and above
  // the sticky footer do (booking.css). Checked on either scroll and whenever the sheet, the
  // body, its content or the footer changes size (errors, the note, the landed card, rotation).
  useEffect(() => {
    const dialog = dialogRef.current;
    const body = bodyRef.current;
    const foot = footRef.current;
    if (!dialog || !body || !foot) return;
    const check = () => {
      const { above, below } = scrollEdgeFades(fieldsView(dialog, body, foot).box, FADE);
      const fade = (name: string, attr: string, px: number) => {
        body.toggleAttribute(attr, px > 0);
        if (dialog.style.getPropertyValue(name) !== `${px}px`) dialog.style.setProperty(name, `${px}px`);
      };
      fade("--fade-below", "data-more", below);
      fade("--fade-above", "data-more-above", above);
    };
    check();
    body.addEventListener("scroll", check, { passive: true });
    dialog.addEventListener("scroll", check, { passive: true });
    const resize = new ResizeObserver(check);
    for (const el of [dialog, body, foot, ...Array.from(body.children)]) resize.observe(el);
    return () => {
      body.removeEventListener("scroll", check);
      dialog.removeEventListener("scroll", check);
      resize.disconnect();
    };
  }, []);

  // Back from the SMS / e-mail app: focus the „landed“ card (screen readers hear it again,
  // the keyboard continues from there), without scrolling the page.
  useEffect(() => {
    if (!landed) return;
    // CV4-01 · The landed card grows the footer and shortens the fields' view: scroll the fields
    // (the body, or the whole sheet on short viewports) until the privacy line stands whole
    // above the card — sharing the spare room above and below when everything fits (lib/booking
    // landedScrollBy; 390×844: 15 px, first label and privacy line both whole).
    const dialog = dialogRef.current;
    const body = bodyRef.current;
    const foot = footRef.current;
    if (dialog && body && foot) {
      const { scroller, box } = fieldsView(dialog, body, foot);
      const by = landedScrollBy(box);
      if (by > 0) scroller.scrollBy({ top: by, behavior: prefersLessMotion() ? "auto" : "smooth" });
    }
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onVisible);
      if (dialogRef.current?.open) statusRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [landed, handoffs]);

  const requestClose = () => {
    const dialog = dialogRef.current;
    if (!dialog?.open || dialog.hasAttribute("data-closing")) return;
    if (prefersLessMotion()) {
      dialog.close();
      return;
    }
    // After a pull on the head the enter animation is switched off inline; hand the sheet
    // back to the stylesheet's exit animation, which leaves from where the finger let go.
    dialog.style.removeProperty("animation");
    dialog.style.removeProperty("transition");
    dialog.setAttribute("data-closing", "");
    window.setTimeout(() => {
      dialog.removeAttribute("data-closing");
      if (dialog.open) dialog.close();
    }, CLOSE_MS);
  };

  const onClosed = () => {
    window.clearTimeout(viberTimer.current);
    pull.current = null;
    dialogRef.current?.style.removeProperty("transform");
    dialogRef.current?.style.removeProperty("animation");
    dialogRef.current?.style.removeProperty("transition");
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

  // Bottom sheet: pull the head down to close (C-09). Only the head, never the scrolling
  // fields; the close button keeps its own tap. Upward pulls rubber-band at 20%.
  const onHeadPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const dialog = dialogRef.current;
    if (event.button !== 0 || !dialog || dialog.hasAttribute("data-closing") || !window.matchMedia(SHEET).matches) return;
    if (event.target instanceof Element && event.target.closest("button, a")) return;
    pull.current = { id: event.pointerId, y0: event.clientY, dy: 0, moved: false, samples: [{ y: event.clientY, t: event.timeStamp }] };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onHeadPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const p = pull.current;
    const dialog = dialogRef.current;
    if (!p || !dialog || event.pointerId !== p.id) return;
    const raw = event.clientY - p.y0;
    if (!p.moved && Math.abs(raw) < 4) return;
    p.moved = true;
    p.dy = raw > 0 ? raw : raw * 0.2;
    p.samples.push({ y: event.clientY, t: event.timeStamp });
    if (p.samples.length > 6) p.samples.shift();
    dialog.style.animation = "none";
    dialog.style.transition = "none";
    dialog.style.transform = `translateY(${p.dy}px)`;
  };
  const onHeadPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const p = pull.current;
    const dialog = dialogRef.current;
    if (!p || event.pointerId !== p.id) return;
    pull.current = null;
    if (!dialog || !p.moved) return;
    const first = p.samples[0];
    const last = p.samples[p.samples.length - 1];
    const speed = first && last && last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0;
    const closing = event.type === "pointerup" && (p.dy > dialog.offsetHeight * PULL_CLOSE_RATIO || speed > PULL_CLOSE_SPEED);
    if (closing) {
      requestClose();
      return;
    }
    // Spring back onto the landing spot (instant under reduced motion).
    if (prefersLessMotion()) {
      dialog.style.removeProperty("transform");
      return;
    }
    dialog.style.transition = "transform var(--dur-base) var(--ease-stick)";
    dialog.style.transform = "translateY(0)";
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
    wobble(BOOKING_REQUIRED.filter((f) => found[f]));
    return false;
  };

  // M-03 „balance check“: each invalid field catches a wobble once per send attempt, like a
  // wobble on the beam, then holds still with the error styling. CSS only runs it when
  // motion is allowed (booking.css); the attribute is dropped on animationend.
  const wobble = (invalid: readonly BookingField[]) => {
    invalid.slice(0, WOBBLE_MAX).forEach((f, i) => {
      const field = fields.current[f]?.closest<HTMLElement>(".booking-field");
      if (!field) return;
      field.removeAttribute("data-wobble");
      void field.offsetWidth; // restart when the previous wobble is still running
      field.style.setProperty("--i", String(i));
      field.setAttribute("data-wobble", "");
      field.addEventListener("animationend", () => field.removeAttribute("data-wobble"), { once: true });
    });
  };

  const onSend = (channel: SendChannel) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!ready(channel)) {
      event.preventDefault();
      return;
    }
    setStatus(BOOKING.after); // the link itself opens the SMS / email app
    setHandoffs((n) => n + 1);
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
    setHandoffs((n) => n + 1);
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
      {/* Darkroom head band (the S11 slab carried into the sheet), with the grabber and the
          leotard hairline; pulling it down closes the sheet on phones. */}
      <div
        className="booking__head"
        data-theme="dark"
        onPointerDown={onHeadPointerDown}
        onPointerMove={onHeadPointerMove}
        onPointerUp={onHeadPointerEnd}
        onPointerCancel={onHeadPointerEnd}
      >
        <svg className="booking__leap" viewBox="0 0 230 150" data-figure="brand:booking" aria-hidden="true" focusable="false">
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
            <div className="booking-control">
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
              {errors.parent ? <StopMark /> : null}
            </div>
            {errorLine("parent")}
          </div>

          <div className="booking-field booking-field--phone">
            <label htmlFor={`${uid}-phone`}>{BOOKING.fields.phone}</label>
            <div className="booking-control">
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
              {errors.phone ? <StopMark /> : null}
            </div>
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

      <div ref={footRef} className="booking__foot">
        {/* The funnel's stuck landing (C-05, M-02): after a hand-off the status is a „landed“
            card — a gymnast drops in, sticks the landing and salutes (the pose family's
            finish, §5.13). tabIndex -1: focused on return from the messaging app. */}
        <p
          ref={statusRef}
          className="booking__status"
          role="status"
          aria-live="polite"
          tabIndex={-1}
          data-landed={landed ? "" : undefined}
        >
          {landed && SentPose ? <SentPose key={handoffs} id="salute" className="booking__status-pose" /> : null}
          {status ? <span>{typesetSr(status)}</span> : null}
        </p>
        {/* Sends + call: one row in the short-viewport footer (booking.css, CV2-05). */}
        <div className="booking__actions">
          <div className="booking__sends">
            {sendOrder(primary).map((channel, i) => (
              <a
                key={channel}
                ref={i === 0 ? primaryRef : undefined}
                className={`btn ${i === 0 && !landed ? "btn-primary" : "btn-secondary"} booking__send`}
                href={hrefs[channel]}
                onClick={onSend(channel)}
              >
                {BOOKING.actions[channel]}
              </a>
            ))}
            {FLAGS.SHOW_VIBER ? (
              touchFirst && hrefs.viber ? (
                <a className="btn btn-secondary booking__send booking__send--wide" href={hrefs.viber} onClick={onViber}>
                  {BOOKING.actions.viber}
                </a>
              ) : (
                <p className="booking__viber-number">
                  {hrefs.viber ? `${BOOKING.actions.viber}: ` : ""}<span>{typesetSr(hrefs.viber ? VIBER_PHONE_E164 ?? "" : BOOKING.viberPending)}</span>
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
      </div>
    </dialog>
  );
}
