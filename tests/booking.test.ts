import { describe, expect, it } from "vitest";
import { BOOKING } from "@/content/copy";
import {
  BOOKING_ERRORS,
  BOOKING_GROUPS,
  BOOKING_INTRO,
  EMPTY_BOOKING,
  GROUP_UNDECIDED,
  applyGroupPrefill,
  belgradeYear,
  birthYearOptions,
  birthYearRange,
  bookingHrefs,
  buildBookingMessage,
  clean,
  composeBookingMessage,
  groupMessageText,
  hasErrors,
  isPlausiblePhone,
  matchGroup,
  primaryChannel,
  sendOrder,
  validateBooking,
  type BookingValues,
} from "@/lib/booking";
import { buildFlight, flightTiming, progressAt, saltoClock, timeAt } from "@/components/sections/contact/doskok-path";

const FULL: BookingValues = {
  parent: "Ana Petrović",
  phone: "060 123 4567",
  child: "Mila",
  birthYear: "2018",
  group: "Mlađa početna grupa",
  note: "Dolazimo posle škole",
};

describe("buildBookingMessage — exact §5 format", () => {
  it("renders every part in the specified order and punctuation", () => {
    expect(buildBookingMessage(FULL)).toBe(
      "Dobar dan, želim da prijavim dete na probni trening. Roditelj: Ana Petrović, tel: 060 123 4567; dete: Mila, godište 2018; grupa: Mlađa početna grupa; napomena: Dolazimo posle škole",
    );
  });

  it("omits the child's name (and its comma) but keeps the 'dete:' label when the name is empty", () => {
    expect(buildBookingMessage({ ...FULL, child: "" })).toBe(
      "Dobar dan, želim da prijavim dete na probni trening. Roditelj: Ana Petrović, tel: 060 123 4567; dete: godište 2018; grupa: Mlađa početna grupa; napomena: Dolazimo posle škole",
    );
  });

  it("omits '; napomena: …' entirely when the note is empty", () => {
    expect(buildBookingMessage({ ...FULL, note: "" })).toBe(
      "Dobar dan, želim da prijavim dete na probni trening. Roditelj: Ana Petrović, tel: 060 123 4567; dete: Mila, godište 2018; grupa: Mlađa početna grupa",
    );
  });

  it("omits both optional parts at once", () => {
    expect(buildBookingMessage({ ...FULL, child: "", note: "" })).toBe(
      "Dobar dan, želim da prijavim dete na probni trening. Roditelj: Ana Petrović, tel: 060 123 4567; dete: godište 2018; grupa: Mlađa početna grupa",
    );
  });

  it("treats whitespace-only optional fields as empty", () => {
    expect(buildBookingMessage({ ...FULL, child: "   ", note: "\n\t " })).toBe(
      buildBookingMessage({ ...FULL, child: "", note: "" }),
    );
  });

  it("trims values and collapses inner whitespace and newlines", () => {
    const msg = buildBookingMessage({
      parent: "  Ana   Petrović ",
      phone: " 060  123 4567 ",
      child: " Mila ",
      birthYear: " 2018 ",
      group: "  Aerobna   gimnastika ",
      note: "Prvi red\nDrugi   red  ",
    });
    expect(msg).toBe(
      "Dobar dan, želim da prijavim dete na probni trening. Roditelj: Ana Petrović, tel: 060 123 4567; dete: Mila, godište 2018; grupa: Aerobna gimnastika; napomena: Prvi red Drugi red",
    );
  });

  it("never renders an empty label or a dangling separator", () => {
    const msg = buildBookingMessage({ parent: "Ana", phone: "0601234567", birthYear: "2019" });
    expect(msg).toBe(`${BOOKING_INTRO} Roditelj: Ana, tel: 0601234567; dete: godište 2019`);
    expect(msg).not.toMatch(/: ?[;,]|; ;|, ,|: $/);
    expect(buildBookingMessage({})).toBe(BOOKING_INTRO);
  });

  it("SMS without a phone number: the message simply has no 'tel: …'", () => {
    expect(composeBookingMessage({ ...FULL, phone: "" })).toBe(
      "Dobar dan, želim da prijavim dete na probni trening. Roditelj: Ana Petrović; dete: Mila, godište 2018; grupa: Mlađa početna grupa; napomena: Dolazimo posle škole",
    );
    expect(composeBookingMessage({ ...FULL, phone: "", child: "", note: "", group: "" })).toBe(
      "Dobar dan, želim da prijavim dete na probni trening. Roditelj: Ana Petrović; dete: godište 2018; grupa: neka trenerica predloži",
    );
  });

  it("every word of the message comes from content (BOOKING.message)", () => {
    expect(BOOKING_INTRO).toBe(BOOKING.message.intro);
    const msg = buildBookingMessage(FULL);
    for (const word of [BOOKING.message.parent, BOOKING.message.phone, BOOKING.message.child, BOOKING.message.birthYear, BOOKING.message.group, BOOKING.message.note]) {
      expect(msg).toContain(word);
    }
  });

  it("keeps č ć đ š ž and symbols verbatim (encoding happens only in the hrefs)", () => {
    const msg = buildBookingMessage({ ...FULL, parent: "Đorđe Ćirić & Šćepanović + Žana" });
    expect(msg).toContain("Roditelj: Đorđe Ćirić & Šćepanović + Žana, tel:");
  });
});

describe("group text", () => {
  it("an empty group is sent as the undecided wording", () => {
    expect(groupMessageText("")).toBe(GROUP_UNDECIDED.message);
    expect(groupMessageText("  ")).toBe(GROUP_UNDECIDED.message);
    expect(groupMessageText(" Aerobna gimnastika ")).toBe("Aerobna gimnastika");
    expect(composeBookingMessage({ ...FULL, group: "" })).toContain("; grupa: neka trenerica predloži; napomena:");
  });

  it("offers the visible programs (Trampolina hidden by default)", () => {
    expect(BOOKING_GROUPS).toEqual([
      "Mlađa početna grupa",
      "Starija početna grupa",
      "Takmičarke — C program",
      "Takmičarke — A i B program",
      "Aerobna gimnastika",
    ]);
  });

  it("matches prefill labels ignoring case, spacing and dash style", () => {
    expect(matchGroup("Mlađa početna grupa", BOOKING_GROUPS)).toBe("Mlađa početna grupa");
    expect(matchGroup("  mlađa   POČETNA grupa ", BOOKING_GROUPS)).toBe("Mlađa početna grupa");
    expect(matchGroup("Takmičarke - C program", BOOKING_GROUPS)).toBe("Takmičarke — C program");
    expect(matchGroup("Takmičarke–A i B program", BOOKING_GROUPS)).toBe("Takmičarke — A i B program");
  });

  it("returns '' for an empty prefill and null for an unknown label", () => {
    expect(matchGroup("", BOOKING_GROUPS)).toBe("");
    expect(matchGroup("   ", BOOKING_GROUPS)).toBe("");
    expect(matchGroup("Takmičarske grupe (A, B i C program)", BOOKING_GROUPS)).toBeNull();
  });
});

describe("Grupa prefill — no stale options", () => {
  const START = { extraGroups: [] as readonly string[], group: "" };

  it("a program title selects that program and adds no extra option", () => {
    expect(applyGroupPrefill("Starija početna grupa", START)).toEqual({ extraGroups: [], group: "Starija početna grupa" });
    expect(applyGroupPrefill("takmičarke - c program", START)).toEqual({ extraGroups: [], group: "Takmičarke — C program" });
  });

  it("an unknown label (quiz result) becomes the one extra option and is selected", () => {
    expect(applyGroupPrefill("Takmičarske grupe (A, B i C program)", START)).toEqual({
      extraGroups: ["Takmičarske grupe (A, B i C program)"],
      group: "Takmičarske grupe (A, B i C program)",
    });
  });

  it("quiz → quiz → program: earlier extras are dropped, the latest choice wins", () => {
    let state = applyGroupPrefill("Takmičarske grupe (A, B i C program)", START);
    state = applyGroupPrefill("Mlađa ili starija početna grupa", state);
    expect(state).toEqual({ extraGroups: ["Mlađa ili starija početna grupa"], group: "Mlađa ili starija početna grupa" });
    state = applyGroupPrefill("Starija početna grupa", state);
    expect(state).toEqual({ extraGroups: [], group: "Starija početna grupa" });
  });

  it("an empty prefill (hero CTA) keeps the parent's current choice and extras", () => {
    const current = { extraGroups: ["Takmičarske grupe (A, B i C program)"], group: "Aerobna gimnastika" };
    expect(applyGroupPrefill("", current)).toBe(current);
    expect(applyGroupPrefill("   ", current)).toBe(current);
  });
});

describe("bookingHrefs — action links", () => {
  const message = buildBookingMessage(FULL);
  const hrefs = bookingHrefs(message);
  const encoded = encodeURIComponent(message);

  it("SMS goes to the primary number with the ?&body= form", () => {
    expect(hrefs.sms).toBe(`sms:+381600287631?&body=${encoded}`);
  });

  it("email goes to the club address with the fixed subject", () => {
    expect(hrefs.email).toBe(`mailto:sladjanakovacevickg@gmail.com?subject=Probni%20trening&body=${encoded}`);
  });

  it("call and Viber use the primary number", () => {
    expect(hrefs.tel).toBe("tel:+381600287631");
    expect(hrefs.viber).toBe("viber://chat?number=%2B381600287631");
  });

  it("bodies are encodeURIComponent (%20, never +) and decode back to the message", () => {
    const body = hrefs.sms.split("?&body=")[1] ?? "";
    expect(body).not.toContain("+");
    expect(body).not.toContain(" ");
    expect(body).toContain("%20");
    expect(decodeURIComponent(body)).toBe(message);
    const mailBody = hrefs.email.split("&body=")[1] ?? "";
    expect(decodeURIComponent(mailBody)).toBe(message);
  });
});

describe("validateBooking — on send, per channel", () => {
  const YEAR = 2026;

  it("accepts a complete form on every channel", () => {
    for (const channel of ["sms", "email", "viber"] as const) {
      expect(validateBooking(FULL, YEAR, channel)).toEqual({});
      expect(hasErrors(validateBooking(FULL, YEAR, channel))).toBe(false);
    }
  });

  it("email requires parent, phone and birth year — optional fields may stay empty", () => {
    expect(validateBooking(EMPTY_BOOKING, YEAR, "email")).toEqual({
      parent: BOOKING_ERRORS.parent,
      phone: BOOKING_ERRORS.phoneMissing,
      birthYear: BOOKING_ERRORS.birthYearMissing,
    });
    expect(validateBooking({ ...FULL, child: "", note: "", group: "" }, YEAR, "email")).toEqual({});
  });

  it("SMS and Viber do not need the phone (the app sends the number) but still need parent and year", () => {
    for (const channel of ["sms", "viber"] as const) {
      expect(validateBooking(EMPTY_BOOKING, YEAR, channel)).toEqual({
        parent: BOOKING_ERRORS.parent,
        birthYear: BOOKING_ERRORS.birthYearMissing,
      });
      expect(validateBooking({ ...FULL, phone: "" }, YEAR, channel)).toEqual({});
      expect(validateBooking({ ...FULL, phone: "  " }, YEAR, channel)).toEqual({});
    }
    expect(validateBooking({ ...FULL, phone: "" }, YEAR, "email")).toEqual({ phone: BOOKING_ERRORS.phoneMissing });
  });

  it("a phone that is filled in must look like one, on every channel", () => {
    for (const channel of ["sms", "email", "viber"] as const) {
      expect(validateBooking({ ...FULL, phone: "abc" }, YEAR, channel).phone).toBe(BOOKING_ERRORS.phoneInvalid);
    }
  });

  it("whitespace-only required fields count as empty", () => {
    const errors = validateBooking({ ...FULL, parent: "   ", phone: " \n " }, YEAR, "email");
    expect(errors.parent).toBe(BOOKING_ERRORS.parent);
    expect(errors.phone).toBe(BOOKING_ERRORS.phoneMissing);
  });

  it("birth year: one of the select's years, (year − 18) … (year − 2)", () => {
    expect(birthYearRange(YEAR)).toEqual({ min: 2008, max: 2024 });
    for (const ok of ["2008", "2015", "2024", " 2020 "]) {
      expect(validateBooking({ ...FULL, birthYear: ok }, YEAR, "sms").birthYear).toBeUndefined();
    }
    for (const bad of ["", "2007", "2025", "18", "20188", "20a8", "dve hiljade"]) {
      expect(validateBooking({ ...FULL, birthYear: bad }, YEAR, "sms").birthYear).toBe(BOOKING_ERRORS.birthYearMissing);
    }
    expect(BOOKING_ERRORS.birthYearMissing).toBe("Izaberite godište deteta.");
  });

  it("phone: Serbian and international formats pass, junk fails", () => {
    for (const ok of ["060 123 4567", "0601234567", "+381 60 123 4567", "+381601234567", "060/123-45-67", "(060) 123 4567"]) {
      expect(isPlausiblePhone(ok)).toBe(true);
    }
    for (const bad of ["12345", "060 abc 4567", "0601234567+", "++381601234567", "1234567890123456"]) {
      expect(isPlausiblePhone(bad)).toBe(false);
    }
  });
});

describe("birth-year select", () => {
  it("offers (year − 2) down to (year − 18), newest first", () => {
    const years = birthYearOptions(2026);
    expect(years).toHaveLength(17);
    expect(years[0]).toBe("2024");
    expect(years.at(-1)).toBe("2008");
    expect(years).toEqual([...years].sort((a, b) => Number(b) - Number(a)));
  });

  it("follows the Europe/Belgrade year across New Year (UTC is still in the old year)", () => {
    const eve = new Date("2026-12-31T22:59:00Z"); // 23:59 in Belgrade — still 2026
    const newYear = new Date("2026-12-31T23:30:00Z"); // 00:30 in Belgrade — already 2027
    expect(birthYearOptions(belgradeYear(eve))).toEqual(birthYearOptions(2026));
    expect(birthYearOptions(belgradeYear(newYear))[0]).toBe("2025");
    expect(birthYearOptions(belgradeYear(newYear)).at(-1)).toBe("2009");
    // A year picked before midnight that fell out of the range is caught on send.
    expect(validateBooking({ ...FULL, birthYear: "2008" }, belgradeYear(newYear), "sms").birthYear).toBe(BOOKING_ERRORS.birthYearMissing);
  });
});

describe("device-dependent primary action", () => {
  it("touch-first devices lead with SMS", () => {
    expect(primaryChannel({ coarsePointer: true, canHover: false })).toBe("sms"); // phone, tablet
    expect(primaryChannel({ coarsePointer: true, canHover: true })).toBe("sms");
    expect(primaryChannel({ coarsePointer: false, canHover: false })).toBe("sms"); // no hover = touch-first
  });

  it("desktops (fine pointer that hovers, touch laptops included) lead with email", () => {
    expect(primaryChannel({ coarsePointer: false, canHover: true })).toBe("email");
  });

  it("the primary comes first, the other channel second — never two primaries", () => {
    expect(sendOrder("sms")).toEqual(["sms", "email"]);
    expect(sendOrder("email")).toEqual(["email", "sms"]);
  });
});

describe("helpers", () => {
  it("clean() trims and collapses whitespace", () => {
    expect(clean("  a \n\t b  ")).toBe("a b");
    expect(clean(undefined)).toBe("");
  });

  it("belgradeYear() uses Europe/Belgrade (New Year's Eve 23:30 UTC is already next year)", () => {
    expect(belgradeYear(new Date("2026-12-31T23:30:00Z"))).toBe(2027);
    expect(belgradeYear(new Date("2026-06-15T10:00:00Z"))).toBe(2026);
  });
});

/**
 * The S11 finale's flight clock (components/sections/contact/doskok-path.ts): the salto's tuck
 * is timed by its turn, not by its arc length (CV3-02). Geometry of the 390×844 flight
 * (px relative to the landing): take-off on the title mark, a 24 px hop, the drop point
 * under the mark, the three ghost frames and the landing.
 */
describe("doskok salto clock (CV3-02)", () => {
  const P0 = { x: 170, y: -197 };
  const drop = { x: 163, y: -147 };
  const through = [
    { x: 110, y: -92 },
    { x: 73, y: -53 },
    { x: 35, y: -22 },
    { x: 0, y: 0 },
  ];
  const path = buildFlight(P0, 24, drop, through);
  const timing = flightTiming(path, 1, 197, 24, 0.75);
  const [, , sDrop = 0, sG1 = 0] = path.anchors;
  const land = timing.rise + timing.fall;

  const samples = (f: (t: number) => number, t1: number) => Array.from({ length: 751 }, (_, i) => f((t1 * i) / 750));

  it("on the ballistic clock this tuck is a whip (< 200 ms for the 290° turn)", () => {
    expect(timeAt(timing, sG1) - timeAt(timing, sDrop)).toBeLessThan(0.2);
  });

  it("gives the tuck its minimum from the hop and the drop; ghost 1, the landing and the total stay", () => {
    const c = saltoClock(timing, sDrop, sG1, 0.26);
    expect(c.g1 - c.drop).toBeGreaterThanOrEqual(0.26 - 1e-9);
    expect(c.g1).toBeCloseTo(timeAt(timing, sG1), 9);
    expect(c.land).toBeCloseTo(land, 9);
    expect(c.drop).toBeLessThan(timeAt(timing, sDrop));
    expect(c.apex).toBeLessThan(timing.rise); // a quicker spring: same shape, one pace
    expect(c.apex / timing.rise).toBeCloseTo(c.drop / timeAt(timing, sDrop), 9);
  });

  it("passes every anchor at its time, is monotone and continuous, and lands at the end", () => {
    const c = saltoClock(timing, sDrop, sG1, 0.26);
    expect(c.progress(0)).toBe(0);
    expect(c.progress(c.drop)).toBeCloseTo(sDrop, 6);
    expect(c.progress(c.g1)).toBeCloseTo(sG1, 6);
    expect(c.progress(land)).toBeCloseTo(path.length, 6);
    const s = samples((t) => c.progress(t), land);
    for (let i = 1; i < s.length; i++) {
      expect(s[i]!).toBeGreaterThanOrEqual(s[i - 1]! - 1e-9); // never backwards
      expect(s[i]! - s[i - 1]!).toBeLessThan(2); // no jump: < 2 px per ms
    }
    // C1 at the drop point and at ghost 1: the speed on both sides agrees within 2%.
    const v = (t: number, dt: number) => (c.progress(t + dt) - c.progress(t)) / dt;
    for (const t of [c.drop, c.g1]) {
      const left = v(t - 1e-5, 1e-5);
      const right = v(t, 1e-5);
      expect(Math.abs(right - left) / left).toBeLessThan(0.02);
    }
  });

  it("slows through the tuck and is fastest at the landing (never a dart beside the title)", () => {
    const c = saltoClock(timing, sDrop, sG1, 0.26);
    const speed = (t: number) => (c.progress(t + 0.002) - c.progress(t - 0.002)) / 0.004;
    const tuckMin = Math.min(...Array.from({ length: 50 }, (_, i) => speed(c.drop + ((c.g1 - c.drop) * (i + 0.5)) / 50)));
    const dropMax = Math.max(...Array.from({ length: 50 }, (_, i) => speed(c.apex + ((c.drop - c.apex) * (i + 0.5)) / 50)));
    expect(tuckMin).toBeLessThan(dropMax);
    expect(dropMax).toBeLessThan(speed(land - 0.003));
  });

  it("is exactly the ballistic clock when the tuck already has the time", () => {
    const c = saltoClock(timing, sDrop, sG1, 0.1);
    for (const t of [0, 0.05, 0.2, 0.4, 0.6, land]) expect(c.progress(t)).toBe(progressAt(timing, t));
    expect(c.map(0.6)).toBe(0.6);
  });

  it("moves ghost 1 later only when the drop cannot give the time, and still lands on time", () => {
    const c = saltoClock(timing, sDrop, sG1, 0.33, 0.8);
    expect(c.drop).toBeCloseTo(0.8 * timeAt(timing, sDrop), 9); // the pace floor
    expect(c.g1).toBeGreaterThan(timeAt(timing, sG1));
    expect(c.g1 - c.drop).toBeCloseTo(0.33, 9);
    expect(c.map(land)).toBeCloseTo(land, 9);
    expect(c.progress(land)).toBeCloseTo(path.length, 6);
    const s = samples((t) => c.progress(t), land);
    for (let i = 1; i < s.length; i++) expect(s[i]!).toBeGreaterThanOrEqual(s[i - 1]! - 1e-9);
    // The open-out never loses more than half its time, even for an impossible tuck.
    const g = timeAt(timing, sG1);
    expect(saltoClock(timing, sDrop, sG1, 0.6, 0.8).g1).toBeCloseTo(g + (land - g) / 2, 9);
  });
});
