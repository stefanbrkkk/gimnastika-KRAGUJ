/**
 * "Google Kalendar" template links (§5 S4 calendar b) — Android cannot import
 * .ics files, so every fixed block also gets a Google Calendar link:
 *   https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…
 *     &ctz=Europe/Belgrade&recur=RRULE:…&location=…&details=…
 * Values are encoded with encodeURIComponent (never URLSearchParams, which
 * turns spaces into "+"). `dates` are local wall-clock times in `ctz`.
 * Server/build only (the dates depend on the build date).
 */
import type { ScheduleBlock, ScheduleGroup } from "@/content/schedule";
import { blockDates, eventDetails, eventLocation, eventTitle, ICS_TZID, rrule } from "./ics";

export const GCAL_BASE = "https://calendar.google.com/calendar/render";

export function googleCalendarUrl(group: ScheduleGroup, block: ScheduleBlock, anchor: Date = new Date()): string {
  const { start, end } = blockDates(block, anchor);
  const params = [
    "action=TEMPLATE",
    `text=${encodeURIComponent(eventTitle(group))}`,
    `dates=${start}/${end}`,
    `ctz=${ICS_TZID}`,
    `recur=${encodeURIComponent(rrule(block))}`,
    `location=${encodeURIComponent(eventLocation())}`,
    `details=${encodeURIComponent(eventDetails())}`,
  ];
  return `${GCAL_BASE}?${params.join("&")}`;
}
