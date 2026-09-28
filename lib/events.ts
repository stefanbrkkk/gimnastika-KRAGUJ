/**
 * Cross-island communication without shared React state.
 *
 * Booking: any <a href="#kontakt" data-booking="…"> opens the booking sheet
 * when JS runs (the sheet island delegates clicks); without JS it jumps to
 * #kontakt. The attribute value is the group label to prefill ("" = none).
 * Exception: the S11 doskok button uses an sms: href with the §5 intro as its
 * own no-JS action; JS intercepts it the same way.
 *
 * Schedule: any link with data-schedule-program="<ProgramId>" scrolls to that
 * program's card in #programi (delegated by the programs island) and flashes
 * it once. The value is always a program id (beginner group ids match theirs).
 */
export const BOOKING_ATTR = "data-booking";
export const BOOKING_NOTE_ATTR = "data-booking-note";
export const SCHEDULE_PROGRAM_ATTR = "data-schedule-program";

export const BOOKING_EVENT = "kraguj:booking";

export interface BookingDetail {
  /** Group label to prefill in the sheet's "Grupa" field. */
  group?: string;
  /** Age context (e.g. "Anketa: 8 god.") to prefill "Napomena" only when empty. */
  note?: string;
}

export function openBooking(detail: BookingDetail = {}): void {
  window.dispatchEvent(new CustomEvent<BookingDetail>(BOOKING_EVENT, { detail }));
}
