import { describe, expect, it } from "vitest";
import {
  BOOKING_ERRORS,
  BOOKING_GROUPS,
  BOOKING_INTRO,
  EMPTY_BOOKING,
  GROUP_UNDECIDED,
  belgradeYear,
  birthYearRange,
  bookingHrefs,
  buildBookingMessage,
  clean,
  composeBookingMessage,
  groupMessageText,
  hasErrors,
  isPlausiblePhone,
  matchGroup,
  validateBooking,
  type BookingValues,
} from "@/lib/booking";

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

describe("validateBooking", () => {
  const YEAR = 2026;

  it("accepts a complete form", () => {
    expect(validateBooking(FULL, YEAR)).toEqual({});
    expect(hasErrors(validateBooking(FULL, YEAR))).toBe(false);
  });

  it("requires parent, phone and birth year — optional fields may stay empty", () => {
    expect(validateBooking(EMPTY_BOOKING, YEAR)).toEqual({
      parent: BOOKING_ERRORS.parent,
      phone: BOOKING_ERRORS.phoneMissing,
      birthYear: BOOKING_ERRORS.birthYearMissing,
    });
    expect(validateBooking({ ...FULL, child: "", note: "", group: "" }, YEAR)).toEqual({});
  });

  it("whitespace-only required fields count as empty", () => {
    const errors = validateBooking({ ...FULL, parent: "   ", phone: " \n " }, YEAR);
    expect(errors.parent).toBe(BOOKING_ERRORS.parent);
    expect(errors.phone).toBe(BOOKING_ERRORS.phoneMissing);
  });

  it("birth year: four digits between (year − 18) and (year − 2)", () => {
    expect(birthYearRange(YEAR)).toEqual({ min: 2008, max: 2024 });
    for (const ok of ["2008", "2015", "2024", " 2020 "]) {
      expect(validateBooking({ ...FULL, birthYear: ok }, YEAR).birthYear).toBeUndefined();
    }
    for (const bad of ["2007", "2025", "18", "20188", "20a8", "dve hiljade"]) {
      expect(validateBooking({ ...FULL, birthYear: bad }, YEAR).birthYear).toBe(BOOKING_ERRORS.birthYearRange(2008, 2024));
    }
    expect(BOOKING_ERRORS.birthYearRange(2008, 2024)).toBe("Upišite godište od četiri cifre, između 2008. i 2024.");
  });

  it("phone: Serbian and international formats pass, junk fails", () => {
    for (const ok of ["060 123 4567", "0601234567", "+381 60 123 4567", "+381601234567", "060/123-45-67", "(060) 123 4567"]) {
      expect(isPlausiblePhone(ok)).toBe(true);
    }
    for (const bad of ["12345", "060 abc 4567", "0601234567+", "++381601234567", "1234567890123456"]) {
      expect(isPlausiblePhone(bad)).toBe(false);
    }
    expect(validateBooking({ ...FULL, phone: "abc" }, YEAR).phone).toBe(BOOKING_ERRORS.phoneInvalid);
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
