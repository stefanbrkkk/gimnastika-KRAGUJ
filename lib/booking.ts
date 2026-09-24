/**
 * Booking sheet logic — pure (no DOM, no React), unit-tested in tests/booking.test.ts.
 *
 * The site never stores anything: the sheet composes one message and hands it to
 * the parent's own SMS / email / Viber app. Bodies are encoded by lib/links.ts
 * (encodeURIComponent, never URLSearchParams).
 *
 * Message format (§5 BOOKING):
 *   "Dobar dan, želim da prijavim dete na probni trening. Roditelj: …, tel: …; dete: …, godište …; grupa: …; napomena: …"
 * Empty optional parts are omitted together with their label and separator:
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

export const BOOKING_INTRO = "Dobar dan, želim da prijavim dete na probni trening.";

/**
 * "Undecided" option of the Grupa select (value ""), and how it reads in the message.
 * TODO(shared): move both strings into BOOKING in content/copy.ts (sharedChangeRequest).
 */
export const GROUP_UNDECIDED = {
  label: BOOKING.groupUndecided,
  message: BOOKING.groupUndecidedMessage,
} as const;

/** Inline validation messages (mechanical UI copy, listed in newCopy). */
export const BOOKING_ERRORS = {
  ...BOOKING.errors,
  birthYearRange: (min: number, max: number) => `Upišite godište od četiri cifre, između ${min}. i ${max}.`,
} as const;

/** Trims and collapses inner whitespace (spaces, tabs, newlines) to single spaces. */
export const clean = (value: string | undefined | null): string => (value ?? "").replace(/\s+/g, " ").trim();

/** The group text that goes into the message: the selected label, or the undecided wording. */
export const groupMessageText = (group: string): string => clean(group) || GROUP_UNDECIDED.message;

/** Builds the exact §5 message. Empty optional parts are omitted (see file header). */
export function buildBookingMessage(values: Partial<BookingValues>): string {
  const parent = clean(values.parent);
  const phone = clean(values.phone);
  const child = clean(values.child);
  const year = clean(values.birthYear);
  const group = clean(values.group);
  const note = clean(values.note);

  const who = [parent && `Roditelj: ${parent}`, phone && `tel: ${phone}`].filter(Boolean).join(", ");
  const kid = [child, year && `godište ${year}`].filter(Boolean).join(", ");
  const parts = [who, kid && `dete: ${kid}`, group && `grupa: ${group}`, note && `napomena: ${note}`].filter(Boolean);
  return parts.length ? `${BOOKING_INTRO} ${parts.join("; ")}` : BOOKING_INTRO;
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

// --- Validation ------------------------------------------------------------

export type BookingField = "parent" | "phone" | "birthYear";
export type BookingErrors = Partial<Record<BookingField, string>>;

/** Field order for "focus the first invalid field". */
export const BOOKING_REQUIRED: readonly BookingField[] = ["parent", "phone", "birthYear"];

/** Children 3–18 train here: accept birth years from (year − 18) to (year − 2). */
export const birthYearRange = (currentYear: number): { min: number; max: number } => ({
  min: currentYear - 18,
  max: currentYear - 2,
});

/** Digits, spaces, ( ) . / - and an optional leading "+"; 6–15 digits (E.164 max is 15). */
export function isPlausiblePhone(value: string): boolean {
  const v = clean(value);
  if (!/^\+?[\d\s()./-]+$/.test(v)) return false;
  const digits = v.replace(/\D/g, "").length;
  return digits >= 6 && digits <= 15;
}

export function validateBooking(values: BookingValues, currentYear: number): BookingErrors {
  const errors: BookingErrors = {};
  if (!clean(values.parent)) errors.parent = BOOKING_ERRORS.parent;

  const phone = clean(values.phone);
  if (!phone) errors.phone = BOOKING_ERRORS.phoneMissing;
  else if (!isPlausiblePhone(phone)) errors.phone = BOOKING_ERRORS.phoneInvalid;

  const year = clean(values.birthYear);
  const { min, max } = birthYearRange(currentYear);
  if (!year) errors.birthYear = BOOKING_ERRORS.birthYearMissing;
  else if (!/^\d{4}$/.test(year) || Number(year) < min || Number(year) > max) {
    errors.birthYear = BOOKING_ERRORS.birthYearRange(min, max);
  }
  return errors;
}

export const hasErrors = (errors: BookingErrors): boolean => Object.keys(errors).length > 0;

/** Current year in Europe/Belgrade. */
export const belgradeYear = (date: Date = new Date()): number => Number(belgradeNow(date).ymd.slice(0, 4));

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
