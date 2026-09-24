/**
 * §7 "Link test": tel/sms/mailto/viber formats are exact; message bodies use
 * encodeURIComponent (%20, never "+"); every source URL shown in the UI also
 * appears in docs/dosije.md.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EMAIL, PHONES, PRIMARY_PHONE, SOCIAL, SOURCES, VENUE } from "@/content/site";
import { mailtoHref, smsHref, telHref, viberHref } from "@/lib/links";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

describe("contact constants", () => {
  it("phones are the two §5 numbers in E.164", () => {
    expect(PHONES.map((p) => [p.display, p.e164])).toEqual([
      ["060 028 7631", "+381600287631"],
      ["061 422 4386", "+381614224386"],
    ]);
    expect(PRIMARY_PHONE.e164).toBe("+381600287631");
    expect(EMAIL).toBe("sladjanakovacevickg@gmail.com");
    expect(SOCIAL.instagram).toBe("https://www.instagram.com/gimnasticki_klub_kraguj/");
    expect(SOCIAL.facebook).toBe("https://www.facebook.com/sportskagimnastika.kraguj/");
  });

  it("the maps link is exactly the §5 URL", () => {
    expect(VENUE.mapsUrl).toBe(
      "https://www.google.com/maps/search/?api=1&query=Trgovinsko-ugostiteljska+%C5%A1kola+Toza+Dragovi%C4%87%2C+Save+Kova%C4%8Devi%C4%87a+25%2C+Kragujevac",
    );
  });
});

describe("link formats", () => {
  it("tel", () => {
    expect(telHref("+381600287631")).toBe("tel:+381600287631");
    expect(telHref("+381614224386")).toBe("tel:+381614224386");
  });

  it("sms without and with a body (the ?& form works on iOS and Android)", () => {
    expect(smsHref("+381600287631")).toBe("sms:+381600287631");
    expect(smsHref("+381600287631", "Dobar dan")).toBe("sms:+381600287631?&body=Dobar%20dan");
  });

  it("mailto with subject and body", () => {
    expect(mailtoHref("sladjanakovacevickg@gmail.com")).toBe("mailto:sladjanakovacevickg@gmail.com");
    expect(mailtoHref("sladjanakovacevickg@gmail.com", "Probni trening")).toBe(
      "mailto:sladjanakovacevickg@gmail.com?subject=Probni%20trening",
    );
    expect(mailtoHref("sladjanakovacevickg@gmail.com", "Probni trening", "Dobar dan")).toBe(
      "mailto:sladjanakovacevickg@gmail.com?subject=Probni%20trening&body=Dobar%20dan",
    );
  });

  it("viber", () => {
    expect(viberHref("+381600287631")).toBe("viber://chat?number=%2B381600287631");
  });
});

describe("body encoding (encodeURIComponent, never URLSearchParams)", () => {
  const body = "Roditelj: Đorđe Ćirić & Šćepanović + Žana, tel: +381 60 123 4567; čas u 18:00?";

  it("encodes spaces as %20 and č ć đ š ž & + ; : ? as percent escapes", () => {
    const sms = smsHref("+381600287631", body);
    const encoded = sms.slice("sms:+381600287631?&body=".length);
    expect(encoded).toBe(encodeURIComponent(body));
    expect(encoded).not.toMatch(/[ +&;?]/);
    expect(encoded).toContain("%20");
    expect(encoded).toContain("%C4%90"); // Đ
    expect(encoded).toContain("%C4%91"); // đ
    expect(encoded).toContain("%C4%86"); // Ć
    expect(encoded).toContain("%C4%87"); // ć
    expect(encoded).toContain("%C4%8D"); // č
    expect(encoded).toContain("%C5%A0"); // Š
    expect(encoded).toContain("%C5%BD"); // Ž
    expect(encoded).toContain("%26"); // &
    expect(encoded).toContain("%2B"); // +
    expect(decodeURIComponent(encoded)).toBe(body);
  });

  it("differs from URLSearchParams, which would turn spaces into '+'", () => {
    const viaParams = new URLSearchParams({ body }).toString().slice("body=".length);
    expect(viaParams).toContain("+");
    expect(smsHref("+381600287631", body)).not.toContain(viaParams);
  });

  it("mailto bodies decode back exactly", () => {
    const href = mailtoHref(EMAIL, "Probni trening", body);
    const encoded = href.split("&body=")[1] ?? "";
    expect(encoded).toBe(encodeURIComponent(body));
    expect(decodeURIComponent(encoded)).toBe(body);
  });
});

// --- Source URLs ↔ docs/dosije.md ----------------------------------------------

/** Links that are navigation, not evidence (maps search, calendar template, own domain, XML namespaces). */
const NOT_A_SOURCE = [
  /^https:\/\/www\.google\.com\/maps\//,
  /^https:\/\/calendar\.google\.com\//,
  /^https?:\/\/(www\.)?gimnastikakraguj\.rs/,
  /^https?:\/\/www\.w3\.org\//,
  /^https?:\/\/schema\.org/,
];

function filesUnder(dir: string, exts: readonly string[]): string[] {
  let out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out = out.concat(filesUnder(path, exts));
    else if (exts.some((e) => name.endsWith(e)) && !name.endsWith(".generated.ts")) out.push(path);
  }
  return out;
}

const URL_RE = /https?:\/\/[^\s"'`)<>\]}]+/g;

describe("every source URL in the UI appears in docs/dosije.md", () => {
  const dosije = readFileSync(join(ROOT, "docs/dosije.md"), "utf8");
  const files = [
    ...filesUnder(join(ROOT, "content"), [".ts"]),
    ...filesUnder(join(ROOT, "components"), [".ts", ".tsx"]),
    ...filesUnder(join(ROOT, "app"), [".ts", ".tsx"]),
  ];
  const found = new Map<string, string>();
  for (const file of files) {
    for (const url of readFileSync(file, "utf8").match(URL_RE) ?? []) {
      if (!NOT_A_SOURCE.some((re) => re.test(url))) found.set(url, relative(ROOT, file));
    }
  }

  it("finds the known sources (sanity check of the scan)", () => {
    for (const url of Object.values(SOURCES)) expect([...found.keys()]).toContain(url);
    expect([...found.keys()]).toContain(SOCIAL.instagram);
  });

  it.each([...found.entries()])("%s (from %s)", (url) => {
    expect(dosije.includes(url)).toBe(true);
  });
});
