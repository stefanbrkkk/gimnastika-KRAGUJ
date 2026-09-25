/**
 * iCalendar (.ics, RFC 5545) export of the weekly schedule — server/build only.
 *
 * One file per group (fixed slots only; groups without a fixed slot get none),
 * one VEVENT per fixed time block with RRULE FREQ=WEEKLY;BYDAY=…, local times
 * with TZID=Europe/Belgrade AND a VTIMEZONE block (CET/CEST), UID, DTSTAMP,
 * CRLF line endings and 75-octet line folding (UTF-8 bytes, never splitting a
 * multi-byte character — „Mlađa“, „Kovačevića“, the „…“ quotes).
 *
 * Served as static files by app/kalendar/[file]/route.ts → out/kalendar/<file>.ics.
 */
import { HERO } from "@/content/copy";
import { dayByCode, isFixed, SCHEDULE_LOCATION, type ScheduleBlock, type ScheduleGroup } from "@/content/schedule";
import { CLUB, SITE_URL, VENUE } from "@/content/site";
import { localStamp, occurrenceDates } from "./schedule-logic";
import { belgradeNow, TIME_ZONE } from "./time";

export const ICS_TZID = TIME_ZONE;

/** Europe/Belgrade since 1996: CET (+01:00) / CEST (+02:00), EU rules (last Sunday of March / October). */
export const VTIMEZONE_BELGRADE: readonly string[] = [
  "BEGIN:VTIMEZONE",
  `TZID:${ICS_TZID}`,
  `X-LIC-LOCATION:${ICS_TZID}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Fixed time blocks of a group (the only ones exported to calendars). */
export const fixedBlocks = (group: ScheduleGroup): ScheduleBlock[] => group.blocks.filter(isFixed);

export const hasFixedSlot = (group: ScheduleGroup): boolean => group.blocks.some(isFixed);

/** "kraguj-mladja.ics" */
export const icsFileName = (group: ScheduleGroup): string => `kraguj-${group.id}.ics`;

/** Site-relative URL of the static file. */
export const icsHref = (group: ScheduleGroup): string => `/kalendar/${icsFileName(group)}`;

/** Event title: "GSU „Kraguj“ · Mlađa početna grupa (3–8 god.)" */
export const eventTitle = (group: ScheduleGroup): string => `${CLUB.shortName} · ${group.name}`;

/** "Trgovinsko-ugostiteljska škola „Toza Dragović“, Save Kovačevića 25, Kragujevac" */
export const eventLocation = (): string => `${VENUE.name}, ${VENUE.street}, ${VENUE.city}`;

/** Hall line (§5 S4 sub) + call line + link back to the schedule. */
export const eventDetails = (): string => `${SCHEDULE_LOCATION.sub}\n${HERO.ctaSecondary}\n${SITE_URL}/#raspored`;

/** "MO,WE,FR" */
export const byDay = (block: ScheduleBlock): string => block.days.map((d) => dayByCode(d).ical).join(",");

/** "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR" */
export const rrule = (block: ScheduleBlock): string => `RRULE:FREQ=WEEKLY;BYDAY=${byDay(block)}`;

/** Re-exported: the stamp helper lives in lib/schedule-logic.ts (client-safe, no content import). */
export { localStamp };

/** UTC "20260924T102030Z". */
export const utcStamp = (date: Date): string => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** RFC 5545 §3.3.11 TEXT escaping. */
export const escapeText = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const encoder = new TextEncoder();
const octets = (s: string): number => encoder.encode(s).length;

/**
 * RFC 5545 §3.1: lines longer than 75 octets are folded with CRLF + one space.
 * Counts UTF-8 bytes and never splits a code point.
 */
export function foldLine(line: string, limit = 75): string {
  if (octets(line) <= limit) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = octets(ch);
    // Continuation lines start with a space, which counts toward their 75 octets.
    const max = out.length === 0 ? limit : limit - 1;
    if (size + n > max) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join("\r\n ");
}

/** Start/end local stamps of a block's first occurrence on/after `anchor` (Belgrade date). */
export function blockDates(block: ScheduleBlock, anchor: Date): { start: string; end: string } {
  const t = block.times[0];
  if (!t) throw new Error("Empty schedule block");
  const [start = "", end = ""] = occurrenceDates(block.days, t.start, t.end, belgradeNow(anchor)).split("/");
  return { start, end };
}

const uidHost = (): string => {
  try {
    return new URL(SITE_URL).hostname;
  } catch {
    return "gimnastikakraguj.rs";
  }
};

export interface IcsOptions {
  /** DTSTAMP (creation time of the file). Default: now. */
  now?: Date;
  /** DTSTART = first occurrence on/after this date (Europe/Belgrade). Default: `now`. */
  anchor?: Date;
}

/** The complete .ics text for one group (CRLF line endings, folded). */
export function buildGroupIcs(group: ScheduleGroup, { now = new Date(), anchor = now }: IcsOptions = {}): string {
  const blocks = fixedBlocks(group);
  if (blocks.length === 0) throw new Error(`Group ${group.id} has no fixed slot`);
  const title = eventTitle(group);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GSU Kraguj//Raspored treninga//SR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(title)}`,
    `X-WR-TIMEZONE:${ICS_TZID}`,
    ...VTIMEZONE_BELGRADE,
  ];
  for (const block of blocks) {
    const t = block.times[0]!;
    const { start, end } = blockDates(block, anchor);
    lines.push(
      "BEGIN:VEVENT",
      `UID:kraguj-${group.id}-${block.days.join("-")}-${t.start.replace(":", "")}@${uidHost()}`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART;TZID=${ICS_TZID}:${start}`,
      `DTEND;TZID=${ICS_TZID}:${end}`,
      rrule(block),
      `SUMMARY:${escapeText(title)}`,
      `LOCATION:${escapeText(eventLocation())}`,
      `DESCRIPTION:${escapeText(eventDetails())}`,
      `URL:${SITE_URL}/#raspored`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map((l) => foldLine(l)).join("\r\n") + "\r\n";
}
