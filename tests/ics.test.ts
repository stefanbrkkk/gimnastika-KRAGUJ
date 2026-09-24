/**
 * §7: "Every generated .ics parses with ical.js and contains a VTIMEZONE.
 * Google Calendar links are well-formed."
 */
import ICAL from "ical.js";
import { describe, expect, it } from "vitest";
import { generateStaticParams, GET } from "@/app/kalendar/[file]/route";
import { isFixed, SCHEDULE, type ScheduleGroup } from "@/content/schedule";
import { GCAL_BASE, googleCalendarUrl } from "@/lib/gcal";
import { buildGroupIcs, eventLocation, eventTitle, fixedBlocks, foldLine, hasFixedSlot, icsFileName, icsHref } from "@/lib/ics";

const NOW = new Date("2026-09-24T12:34:56Z"); // Thursday → Ut/Če blocks start today, Po/Sr/Pe tomorrow
const WITH_FIXED = SCHEDULE.filter(hasFixedSlot);
const group = (id: ScheduleGroup["id"]) => SCHEDULE.find((g) => g.id === id)!;

/** Hard-coded expectation from §5 S4 (fixed slots only). */
const EXPECTED: Record<string, { byday: string; start: string; end: string; firstDate: string }[]> = {
  ab: [{ byday: "TU,TH", start: "173000", end: "193000", firstDate: "20260924" }],
  "c-mladje": [{ byday: "TU,TH", start: "193000", end: "213000", firstDate: "20260924" }],
  mladja: [{ byday: "MO,WE,FR", start: "180000", end: "190000", firstDate: "20260925" }],
  starija: [{ byday: "MO,WE,FR", start: "190000", end: "200000", firstDate: "20260925" }],
  aerobik: [{ byday: "MO,WE,FR", start: "200000", end: "213000", firstDate: "20260925" }],
};

const octets = (s: string) => Buffer.byteLength(s, "utf8");

function parse(ics: string) {
  const comp = new ICAL.Component(ICAL.parse(ics));
  const vtz = comp.getFirstSubcomponent("vtimezone");
  if (vtz) ICAL.TimezoneService.register(new ICAL.Timezone(vtz));
  return { comp, vtz, events: comp.getAllSubcomponents("vevent") };
}

describe(".ics files", () => {
  it("exist exactly for the groups with a fixed slot (not „C program, starije“)", () => {
    expect(WITH_FIXED.map((g) => g.id).sort()).toEqual(Object.keys(EXPECTED).sort());
    expect(generateStaticParams()).toEqual(WITH_FIXED.map((g) => ({ file: icsFileName(g) })));
    expect(() => buildGroupIcs(group("c-starije"), { now: NOW })).toThrow();
    expect(icsHref(group("mladja"))).toBe("/kalendar/kraguj-mladja.ics");
  });

  for (const g of WITH_FIXED) {
    describe(icsFileName(g), () => {
      const ics = buildGroupIcs(g, { now: NOW });

      it("parses with ical.js and contains a Europe/Belgrade VTIMEZONE (CET/CEST)", () => {
        const { comp, vtz } = parse(ics);
        expect(comp.name).toBe("vcalendar");
        expect(comp.getFirstPropertyValue("version")).toBe("2.0");
        expect(comp.getFirstPropertyValue("prodid")).toBeTruthy();
        expect(vtz).not.toBeNull();
        expect(vtz!.getFirstPropertyValue("tzid")).toBe("Europe/Belgrade");
        const names = vtz!.getAllSubcomponents().map((c) => `${c.name}:${c.getFirstPropertyValue("tzname")}`);
        expect(names).toEqual(["daylight:CEST", "standard:CET"]);
      });

      it("has one VEVENT per fixed block with UID, DTSTAMP, TZID DTSTART/DTEND and RRULE FREQ=WEEKLY;BYDAY", () => {
        const { events } = parse(ics);
        const expected = EXPECTED[g.id]!;
        expect(events).toHaveLength(fixedBlocks(g).length);
        expect(events).toHaveLength(expected.length);
        events.forEach((ev, i) => {
          const exp = expected[i]!;
          expect(ev.getFirstPropertyValue("uid")).toMatch(/^kraguj-.+@.+$/);
          expect(ev.getFirstPropertyValue("dtstamp")?.toString()).toBe("2026-09-24T12:34:56Z");
          const start = ev.getFirstProperty("dtstart")!;
          expect(start.getParameter("tzid")).toBe("Europe/Belgrade");
          expect(ev.getFirstProperty("dtend")!.getParameter("tzid")).toBe("Europe/Belgrade");
          expect(ics).toContain(`DTSTART;TZID=Europe/Belgrade:${exp.firstDate}T${exp.start}\r\n`);
          expect(ics).toContain(`DTEND;TZID=Europe/Belgrade:${exp.firstDate}T${exp.end}\r\n`);
          const rrule = ev.getFirstPropertyValue("rrule") as InstanceType<typeof ICAL.Recur>;
          expect(rrule.freq).toBe("WEEKLY");
          expect(rrule.toString()).toBe(`FREQ=WEEKLY;BYDAY=${exp.byday}`);
          expect(ics).toContain(`\r\nRRULE:FREQ=WEEKLY;BYDAY=${exp.byday}\r\n`);
          expect(ev.getFirstPropertyValue("summary")).toBe(eventTitle(g));
          expect(ev.getFirstPropertyValue("location")).toBe(eventLocation());
        });
      });

      it("uses CRLF line endings only", () => {
        expect(ics.endsWith("\r\n")).toBe(true);
        expect(/[^\r]\n/.test(ics)).toBe(false);
        expect(/\r(?!\n)/.test(ics)).toBe(false);
        expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
      });

      it("folds every line to ≤ 75 octets (UTF-8), without breaking characters", () => {
        const lines = ics.split("\r\n");
        for (const line of lines) expect(octets(line)).toBeLessThanOrEqual(75);
        expect(lines.some((l) => l.startsWith(" "))).toBe(true); // long LOCATION/DESCRIPTION lines were folded
        expect(ics).not.toContain("�");
      });
    });
  }

  it("recurs weekly in the right local time across the DST change (18:00 CEST → 18:00 CET)", () => {
    const { events } = parse(buildGroupIcs(group("mladja"), { now: NOW }));
    const ev = new ICAL.Event(events[0]!);
    expect(ev.startDate.toJSDate().toISOString()).toBe("2026-09-25T16:00:00.000Z"); // Fri 18:00 CEST
    const it = ev.iterator();
    const occurrences: string[] = [];
    for (let next = it.next(); next && occurrences.length < 16; next = it.next()) {
      occurrences.push(next.toJSDate().toISOString());
    }
    expect(occurrences).toContain("2026-10-23T16:00:00.000Z"); // Fri before the change: CEST
    expect(occurrences).toContain("2026-10-26T17:00:00.000Z"); // Mon after the change: CET
    expect(occurrences).not.toContain("2026-10-24T16:00:00.000Z"); // never on Saturday
  });

  it("UIDs are unique across all files", () => {
    const uids = WITH_FIXED.flatMap((g) => parse(buildGroupIcs(g, { now: NOW })).events.map((e) => e.getFirstPropertyValue("uid")));
    expect(new Set(uids).size).toBe(uids.length);
  });

  it("the static route serves text/calendar", async () => {
    const res = await GET(new Request("http://localhost/kalendar/kraguj-mladja.ics"), {
      params: Promise.resolve({ file: "kraguj-mladja.ics" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(parse(await res.text()).vtz).not.toBeNull();
    const missing = await GET(new Request("http://localhost/kalendar/x.ics"), { params: Promise.resolve({ file: "kraguj-c-starije.ics" }) });
    expect(missing.status).toBe(404);
  });
});

describe("foldLine", () => {
  it("counts UTF-8 octets, not UTF-16 units, and unfolds back to the original", () => {
    const line = `SUMMARY:${"Mlađa početna grupa „Kraguj“ — Kovačević ".repeat(6)}`;
    const folded = foldLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(2);
    for (const p of parts) expect(octets(p)).toBeLessThanOrEqual(75);
    parts.slice(1).forEach((p) => expect(p.startsWith(" ")).toBe(true));
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("leaves short lines alone", () => {
    expect(foldLine("VERSION:2.0")).toBe("VERSION:2.0");
    expect(foldLine("x".repeat(75))).toBe("x".repeat(75));
    expect(foldLine("x".repeat(76)).split("\r\n")).toHaveLength(2);
  });
});

describe("Google Kalendar links", () => {
  for (const g of WITH_FIXED) {
    for (const block of g.blocks.filter(isFixed)) {
      it(`${g.id}: well-formed TEMPLATE link with dates, recur RRULE and ctz`, () => {
        const href = googleCalendarUrl(g, block, NOW);
        const exp = EXPECTED[g.id]![0]!;
        const url = new URL(href);
        expect(`${url.origin}${url.pathname}`).toBe(GCAL_BASE);
        expect(url.searchParams.get("action")).toBe("TEMPLATE");
        expect(url.searchParams.get("text")).toBe(eventTitle(g));
        expect(url.searchParams.get("dates")).toBe(`${exp.firstDate}T${exp.start}/${exp.firstDate}T${exp.end}`);
        expect(url.searchParams.get("ctz")).toBe("Europe/Belgrade");
        expect(url.searchParams.get("recur")).toBe(`RRULE:FREQ=WEEKLY;BYDAY=${exp.byday}`);
        expect(url.searchParams.get("location")).toBe(eventLocation());
        expect(url.searchParams.get("details")).toContain("Save Kovačevića 25");
        // encodeURIComponent, never URLSearchParams: no raw spaces and no "+" for spaces.
        expect(href).not.toMatch(/[ +]/);
        expect(href).toContain("recur=RRULE%3AFREQ%3DWEEKLY%3BBYDAY%3D");
        expect(href).toContain("&ctz=Europe/Belgrade&");
      });
    }
  }
});
