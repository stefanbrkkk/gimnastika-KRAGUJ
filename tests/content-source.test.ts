/**
 * SOURCE RULE (§2, §7 "every source URL in the UI also appears in docs/dosije.md"):
 * every URL in content/*.ts — SOURCES, results, stat tiles, timeline, trust row,
 * GSS, social — must appear in docs/dosije.md as an exact URL token (not merely
 * as a substring of a longer URL).
 *
 * Deliberate exemptions (justified):
 *  - VENUE.mapsUrl: a navigation link built from §5 (a Google Maps search for the
 *    venue), not evidence for a fact. Its exact value is pinned in links.test.ts.
 *  - GSS.url ("https://www.gssrb.rs"): the federation's homepage, required verbatim by
 *    §5 for JSON-LD memberOf.url. It proves nothing by itself; the dossier cites pages
 *    on that host (e.g. /kragujevac/), which this test asserts instead.
 *  - "https://gimnastikakraguj.rs": the site's own origin (SITE_URL default, §0), not a source.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RESULTS, STATS, TRUST_ROW } from "@/content/results";
import { GSS, SOCIAL, SOURCES, VENUE } from "@/content/site";
import { TIMELINE } from "@/content/timeline";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const dosije = readFileSync(join(ROOT, "docs/dosije.md"), "utf8");

/** URL tokens: stop at whitespace, quotes, brackets, pipes (markdown tables) and backticks. */
const URL_RE = /https?:\/\/[^\s"'`<>()[\]{}|*]+/g;
const clean = (url: string) => url.replace(/[.,;:!?]+$/, "");

const DOSIJE_URLS = new Set((dosije.match(URL_RE) ?? []).map(clean));

const EXEMPT: ReadonlyMap<string, string> = new Map([
  [VENUE.mapsUrl, "navigation link (Google Maps search), pinned in links.test.ts"],
  [GSS.url, "federation homepage for JSON-LD memberOf.url; dossier cites pages on this host"],
  ["https://gimnastikakraguj.rs", "the site's own canonical origin (SITE_URL default), not a source"],
]);

const structured: [string, string][] = [
  ...Object.entries(SOURCES).map(([key, url]): [string, string] => [`SOURCES.${key}`, url]),
  ...RESULTS.map((r): [string, string] => [`RESULTS „${r.text}“`, r.sourceUrl]),
  ...STATS.map((s): [string, string] => [`STATS ${s.prefix ? `${s.prefix} ` : ""}${s.value}`, s.sourceUrl]),
  ...TIMELINE.flatMap((t) => (t.sources ?? []).map((url): [string, string] => [`TIMELINE ${t.year} „${t.title}“`, url])),
  ...TRUST_ROW.map((t): [string, string] => [`TRUST_ROW „${t.text}“`, t.href]),
  ["GSS.clubPage", GSS.clubPage],
  ["SOCIAL.instagram", SOCIAL.instagram],
  ["SOCIAL.facebook", SOCIAL.facebook],
];

describe("docs/dosije.md URL index (sanity)", () => {
  it("parses the dossier's URLs", () => {
    expect(DOSIJE_URLS.size).toBeGreaterThan(15);
    expect(DOSIJE_URLS.has("https://www.gssrb.rs/kragujevac/")).toBe(true);
  });
});

describe("structured source URLs in content/ appear verbatim in docs/dosije.md", () => {
  it.each(structured)("%s → %s", (_label, url) => {
    expect(EXEMPT.has(url), `${url} must be a real source, not an exempt link`).toBe(false);
    expect(DOSIJE_URLS.has(url), `${url} is not listed in docs/dosije.md`).toBe(true);
  });

  it("GSS.url is the host of a cited GSS page (exemption holds)", () => {
    expect(GSS.url).toBe("https://www.gssrb.rs");
    expect([...DOSIJE_URLS].some((u) => u.startsWith(`${GSS.url}/`))).toBe(true);
  });
});

describe("every URL literal in content/*.ts appears in docs/dosije.md", () => {
  const files = readdirSync(join(ROOT, "content")).filter((f) => f.endsWith(".ts"));
  const found: [string, string][] = [];
  for (const file of files) {
    const text = readFileSync(join(ROOT, "content", file), "utf8");
    for (const raw of text.match(URL_RE) ?? []) found.push([clean(raw), file]);
  }

  it("scans the content files", () => {
    expect(files).toContain("site.ts");
    expect(found.length).toBeGreaterThanOrEqual(Object.keys(SOURCES).length);
  });

  it.each(found)("%s (content/%s)", (url) => {
    if (EXEMPT.has(url)) return;
    expect(DOSIJE_URLS.has(url), `${url} is not listed in docs/dosije.md`).toBe(true);
  });
});
