/** One "open the booking sheet" intent. A new id re-opens the sheet even for the same group. */
export interface BookingRequest {
  id: number;
  /** Group label to prefill ("" = keep the current choice). */
  group: string;
  /** Age-context note prefill ("" = keep the current note). */
  note: string;
  /** Element to return focus to when the sheet closes. */
  opener: HTMLElement | null;
}
