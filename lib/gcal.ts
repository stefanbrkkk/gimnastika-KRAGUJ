/**
 * "Google Kalendar" template links (§5 S4 calendar b) — Android cannot import
 * .ics files, so every fixed block also gets a Google Calendar link:
 *   https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…
 *     &ctz=Europe/Belgrade&recur=RRULE:…&location=…&details=…
 * Values are encoded with encodeURIComponent (never URLSearchParams, which
 * turns spaces into "+"). `dates` are local wall-clock times in `ctz`.
 * Built on the server at build time (no-JS fallback: first occurrence on/after
 * the build date); the schedule island rewrites `dates` after mount with
 * occurrenceDates(…, belgradeNow(), strict) so an old build never opens Google
 * Calendar on a past date (links carry data-gcal="<days>|<start>|<end>").
 */
import type { ScheduleBlock, ScheduleGroup } from "@/content/schedule";
import { blockDates, eventDetails, eventLocation, eventTitle, ICS_TZID, rrule } from "./ics";

export const GCAL_BASE = "https://calendar.google.com/calendar/render";

/** data-gcal value for the island's after-mount date rewrite: "po,sr,pe|18:00|19:00". */
export const gcalData = (block: ScheduleBlock): string => {
  const t = block.times[0];
  return t ? `${block.days.join(",")}|${t.start}|${t.end}` : "";
};

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
