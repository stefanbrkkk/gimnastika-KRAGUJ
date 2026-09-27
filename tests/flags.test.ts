/**
 * §0 ASSUMPTIONS = FLAGS: the defaults in content/site.ts are exactly the master
 * prompt's, and the NEXT_PUBLIC_<FLAG> overrides (DECISIONS D-07) that the QA
 * variants (qa/run-all.mjs) rely on actually flip them.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const FLAG_NAMES = [
  "FREE_TRIAL",
  "SHOW_SHIFT_NOTE",
  "SHOW_TRAMPOLINE",
  "SHOW_FEES",
  "SHOW_VIBER",
  "SHOW_FACEBOOK",
  "SHOW_EQUIPMENT_2026",
  "MINOR_PHOTOS",
  "CAMP_GROUP_PHOTOS",
  "INDEXABLE",
] as const;

async function loadSite(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const name of FLAG_NAMES) vi.stubEnv(`NEXT_PUBLIC_${name}`, env[`NEXT_PUBLIC_${name}`] ?? "");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", env.NEXT_PUBLIC_SITE_URL ?? "");
  vi.stubEnv("SITE_URL", env.SITE_URL ?? "");
  return import("@/content/site");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("§0 defaults", () => {
  it("every flag has the master prompt's default", async () => {
    const { FLAGS } = await loadSite();
    expect(FLAGS).toEqual({
      FREE_TRIAL: false,
      SHOW_SHIFT_NOTE: false,
      SHOW_TRAMPOLINE: false,
      SHOW_FEES: false,
      SHOW_VIBER: true,
      SHOW_FACEBOOK: false,
      SHOW_EQUIPMENT_2026: false,
      MINOR_PHOTOS: true,
      CAMP_GROUP_PHOTOS: true,
      INDEXABLE: false,
    });
  });

  it("camp note cutoff, site URL and credit", async () => {
    const site = await loadSite();
    expect(site.CAMP_NOTE_UNTIL).toBe("2027-06-30");
    expect(site.SITE_URL).toBe("https://gimnastikakraguj.rs");
    expect(site.CREDIT_NAME).toBe("Stefan Brkljačić");
    expect(site.CREDIT_URL).toBe("");
  });
});

describe("NEXT_PUBLIC_* overrides (used by the QA variant builds)", () => {
  it.each(FLAG_NAMES)("NEXT_PUBLIC_%s flips the flag", async (name) => {
    const { FLAGS: defaults } = await loadSite();
    const flipped = String(!defaults[name]);
    const { FLAGS } = await loadSite({ [`NEXT_PUBLIC_${name}`]: flipped });
    expect(FLAGS[name]).toBe(!defaults[name]);
    for (const other of FLAG_NAMES.filter((n) => n !== name)) expect(FLAGS[other]).toBe(defaults[other]);
  });

  it("SITE_URL can be overridden (trailing slash removed)", async () => {
    const { SITE_URL } = await loadSite({ NEXT_PUBLIC_SITE_URL: "https://example.rs/" });
    expect(SITE_URL).toBe("https://example.rs");
  });
});
