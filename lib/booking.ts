/**
 * Booking sheet logic — pure (no DOM, no React), unit-tested in tests/booking.test.ts.
 *
 * The site never stores anything: the sheet composes one message and hands it to
 * the parent's own SMS / email / Viber app. Bodies are encoded by lib/links.ts
 * (encodeURIComponent, never URLSearchParams). Every word of the message comes
 * from BOOKING.message in content/copy.ts.
 *
 * Message format (§5 BOOKING):
 *   "Dobar dan, želim da prijavim dete na probni trening. Roditelj: …, tel: …; dete: …, godište …; grupa: …; napomena: …"
 * Empty optional parts are omitted together with their label and separator:
 *   no phone      → "Roditelj: Ana; dete: …" (allowed for SMS/Viber only — the app sends the number itself)
 *   no child name → "; dete: godište 2018" (the "dete:" label stays, it says whose year it is)
 *   no note       → no "; napomena: …"
 *   no group      → "; grupa: neka trenerica predloži" (the sheet always sends a group; see groupMessageText)
 * Every value is trimmed and inner whitespace (including newlines) collapses to one space.
 */
import { BOOKING } from "@/content/copy";
import { visiblePrograms } from "@/content/programs";
import { EMAIL, FLAGS, PRIMARY_PHONE } from "@/content/site";
import { mailtoHref, smsHref, telHref, viberHref } from "@/lib/links";
import { belgradeNow } from "@/lib/time";

export interface BookingValues {
  parent: string;
  phone: string;
  child: string;
  /** "YYYY" from the year select; "" = not chosen yet. */
  birthYear: string;
  /** Selected group label; "" = undecided. */
  group: string;
  note: string;
}

export const EMPTY_BOOKING: BookingValues = {
  parent: "",
  phone: "",
  child: "",
  birthYear: "",
  group: "",
  note: "",
};

export const BOOKING_INTRO = BOOKING.message.intro;

/** "Undecided" option of the Grupa select (value ""), and how it reads in the message. */
export const GROUP_UNDECIDED = {
  label: BOOKING.groupUndecided,
  message: BOOKING.groupUndecidedMessage,
} as const;

/** Inline validation messages (content/copy.ts BOOKING.errors). */
export const BOOKING_ERRORS = BOOKING.errors;

/** Trims and collapses inner whitespace (spaces, tabs, newlines) to single spaces. */
export const clean = (value: string | undefined | null): string => (value ?? "").replace(/\s+/g, " ").trim();

/** The group text that goes into the message: the selected label, or the undecided wording. */
export const groupMessageText = (group: string): string => clean(group) || GROUP_UNDECIDED.message;

/** Builds the exact §5 message. Empty optional parts are omitted (see file header). */
export function buildBookingMessage(values: Partial<BookingValues>): string {
  const m = BOOKING.message;
  const parent = clean(values.parent);
  const phone = clean(values.phone);
  const child = clean(values.child);
  const year = clean(values.birthYear);
  const group = clean(values.group);
  const note = clean(values.note);

  const who = [parent && `${m.parent}: ${parent}`, phone && `${m.phone}: ${phone}`].filter(Boolean).join(", ");
  const kid = [child, year && `${m.birthYear} ${year}`].filter(Boolean).join(", ");
  const parts = [who, kid && `${m.child}: ${kid}`, group && `${m.group}: ${group}`, note && `${m.note}: ${note}`].filter(Boolean);
  return parts.length ? `${m.intro} ${parts.join("; ")}` : m.intro;
}

/** The message the sheet actually sends: an empty group becomes the undecided wording. */
export const composeBookingMessage = (values: BookingValues): string =>
  buildBookingMessage({ ...values, group: groupMessageText(values.group) });

export interface BookingHrefs {
  sms: string;
  email: string;
  tel: string;
  viber: string;
}

/** Action links for one message. SMS/Viber/tel go to the primary number (060 028 7631). */
export function bookingHrefs(message: string): BookingHrefs {
  return {
    sms: smsHref(PRIMARY_PHONE.e164, message),
    email: mailtoHref(EMAIL, BOOKING.emailSubject, message),
    tel: telHref(PRIMARY_PHONE.e164),
    viber: viberHref(PRIMARY_PHONE.e164),
  };
}

// --- Channels ----------------------------------------------------------------

/** The two send actions that always exist (Viber is an extra behind SHOW_VIBER). */
export type SendChannel = "sms" | "email";
/** Every action that hands a message off to another app. */
export type MessageChannel = SendChannel | "viber";

export interface DeviceInput {
  /** matchMedia("(pointer: coarse)") — the primary pointer is a finger. */
  coarsePointer: boolean;
  /** matchMedia("(hover: hover)") — the primary pointer can hover (mouse, trackpad). */
  canHover: boolean;
}

/**
 * The filled (primary) send action for this device. Touch-first devices (phones,
 * tablets: coarse primary pointer or no hover) can text, so SMS leads; a desktop
 * (fine pointer that hovers — touch laptops included, whose sms: rarely works)
 * leads with email. The other channel is the outlined secondary action.
 */
export const primaryChannel = ({ coarsePointer, canHover }: DeviceInput): SendChannel =>
  coarsePointer || !canHover ? "sms" : "email";

/** Visual order of the two send actions: primary (filled) first, then secondary (outlined). */
export const sendOrder = (primary: SendChannel): readonly [SendChannel, SendChannel] =>
  primary === "sms" ? ["sms", "email"] : ["email", "sms"];

// --- Birth year ----------------------------------------------------------------

/** Children 3–18 train here: the select offers (year − 2) down to (year − 18). */
export const birthYearRange = (currentYear: number): { min: number; max: number } => ({
  min: currentYear - 18,
  max: currentYear - 2,
});

/** Options of the „Godište deteta“ select, newest first ("2024", "2023", … "2008" in 2026). */
export function birthYearOptions(currentYear: number): string[] {
  const { min, max } = birthYearRange(currentYear);
  return Array.from({ length: max - min + 1 }, (_, i) => String(max - i));
}

/** Current year in Europe/Belgrade. */
export const belgradeYear = (date: Date = new Date()): number => Number(belgradeNow(date).ymd.slice(0, 4));

// --- Validation ------------------------------------------------------------

export type BookingField = "parent" | "phone" | "birthYear";
export type BookingErrors = Partial<Record<BookingField, string>>;

/** Field order for "focus the first invalid field". */
export const BOOKING_REQUIRED: readonly BookingField[] = ["parent", "phone", "birthYear"];

/** Digits, spaces, ( ) . / - and an optional leading "+"; 6–15 digits (E.164 max is 15). */
export function isPlausiblePhone(value: string): boolean {
  const v = clean(value);
  if (!/^\+?[\d\s()./-]+$/.test(v)) return false;
  const digits = v.replace(/\D/g, "").length;
  return digits >= 6 && digits <= 15;
}

/**
 * Runs when a send action is tapped (never while typing).
 * - Ime roditelja and Godište deteta: always required.
 * - Telefon: required for email only — an SMS / Viber message already carries the
 *   sender's number, so it may stay empty there (the message then has no "tel: …").
 *   A number that IS filled in must look like one, whatever the channel.
 */
export function validateBooking(values: BookingValues, currentYear: number, channel: MessageChannel): BookingErrors {
  const errors: BookingErrors = {};
  if (!clean(values.parent)) errors.parent = BOOKING_ERRORS.parent;

  const phone = clean(values.phone);
  if (!phone) {
    if (channel === "email") errors.phone = BOOKING_ERRORS.phoneMissing;
  } else if (!isPlausiblePhone(phone)) errors.phone = BOOKING_ERRORS.phoneInvalid;

  if (!birthYearOptions(currentYear).includes(clean(values.birthYear))) errors.birthYear = BOOKING_ERRORS.birthYearMissing;
  return errors;
}

export const hasErrors = (errors: BookingErrors): boolean => Object.keys(errors).length > 0;

// --- Groups ------------------------------------------------------------------

/** Program titles offered in the "Grupa" select (visible programs under the current flags). */
export const BOOKING_GROUPS: readonly string[] = visiblePrograms(FLAGS.SHOW_TRAMPOLINE).map((p) => p.title);

const normalizeGroup = (value: string): string =>
  clean(value)
    .toLocaleLowerCase("sr-Latn")
    .replace(/[‐-―−]/g, "-")
    .replace(/\s*-\s*/g, " - ");

/**
 * Maps a prefill label (from a [data-booking] attribute or openBooking({group}))
 * onto one of `options`, ignoring case, spacing and dash style.
 * Returns "" for an empty prefill and null when nothing matches (the sheet then
 * adds the prefill as its own option, so the quiz's combined labels survive).
 */
export function matchGroup(prefill: string, options: readonly string[]): string | null {
  const wanted = normalizeGroup(prefill);
  if (!wanted) return "";
  return options.find((o) => normalizeGroup(o) === wanted) ?? null;
}

export interface GroupPrefill {
  /** Unmatched prefill labels offered as their own options (at most one: the latest). */
  extraGroups: readonly string[];
  /** The Grupa value to select. */
  group: string;
}

/**
 * A new open request with a group label → the select's extra options and value.
 * Only the latest unmatched label is kept (no stale options from earlier prefills);
 * an empty prefill (hero CTA) keeps the parent's current choice and extras.
 */
export function applyGroupPrefill(prefill: string, current: GroupPrefill): GroupPrefill {
  const label = clean(prefill);
  if (!label) return current;
  const match = matchGroup(label, BOOKING_GROUPS);
  return match === null ? { extraGroups: [label], group: label } : { extraGroups: [], group: match };
}

export interface ScrollBox {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
  paddingTop: number;
  paddingBottom: number;
}

/**
 * The booking fields' scroll-edge fades (CV4-01), in whole px: each edge fades only where
 * content (not the scroller's padding) is cut there, and only as far as it is cut, up to
 * `max` — so the fade grows and shrinks with the scroll, and is 0 at either end.
 */
export function scrollEdgeFades(box: ScrollBox, max: number): { above: number; below: number } {
  const clamp = (hidden: number) => Math.round(Math.min(max, Math.max(0, hidden)));
  return {
    above: clamp(box.scrollTop - box.paddingTop),
    below: clamp(box.scrollHeight - box.clientHeight - box.scrollTop - box.paddingBottom),
  };
}

/**
 * How far (px, ≥ 0) to scroll the fields once the „landed“ card has grown the footer
 * (CV4-01): until the last line (the privacy note) stands whole above the footer. When all
 * the content fits the scroller, the spare room is shared evenly above and below it, so no
 * label is cut under the head either (390×844: 5.5 px each side); when it does not fit, to
 * the scroll's end (the bottom padding stays as air; the top edge fades). Never scrolls back
 * up: a parent already further down stays where they are. The same box describes the short-
 * viewport sheet, where the whole dialog scrolls (the view ends at the sticky footer).
 */
export function landedScrollBy(box: ScrollBox): number {
  const content = box.scrollHeight - box.paddingTop - box.paddingBottom;
  const slack = box.clientHeight - content;
  const gap = slack >= 0 ? Math.min(box.paddingBottom, slack / 2) : box.paddingBottom;
  const target = box.scrollHeight - box.paddingBottom + gap - box.clientHeight;
  return Math.max(0, Math.round(target - box.scrollTop));
}
