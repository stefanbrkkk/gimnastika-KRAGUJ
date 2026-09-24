/**
 * SEO: JSON-LD (§5 SEO, §7 "JSON-LD parses and matches §5"), metadata, robots.txt
 * and sitemap.xml per INDEXABLE (§6 Indexing), generated icons, and the 404 tilt math.
 * Expected values are HARD-CODED from the master prompt, not read back from content/.
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { ICON_SPECS, ogArtSvg } from "@/components/seo/art";
import { MAX_TILT, balanceTarget, createBalance, gravityAngle, isSettled, stepBalance } from "@/components/notfound/tilt";
import { FAQ, visibleFaq, type FaqItem } from "@/content/faq";
import {
  ICON_FILES,
  OG_IMAGE,
  buildFaqPage,
  buildJsonLd,
  buildMetadata,
  buildRobots,
  buildSitemap,
  buildSportsClub,
  serializeJsonLd,
} from "@/lib/seo";

// Next's own serializers for app/robots.ts and app/sitemap.ts (what lands in out/).
const require = createRequire(import.meta.url);
const { resolveRobots, resolveSitemap } = require("next/dist/build/webpack/loaders/metadata/resolve-route-data.js") as {
  resolveRobots: (data: unknown) => string;
  resolveSitemap: (data: unknown) => string;
};

const SITE = "https://example.org";
const INSTAGRAM = "https://www.instagram.com/gimnasticki_klub_kraguj/";
const FACEBOOK = "https://www.facebook.com/sportskagimnastika.kraguj/";

type Node = Record<string, unknown>;
const graphOf = (ld: Node) => ld["@graph"] as Node[];
const byType = (ld: Node, type: string) => graphOf(ld).find((n) => n["@type"] === type)!;

/** Every key anywhere in a JSON value. */
function allKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, keys));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      keys.add(k);
      allKeys(v, keys);
    }
  }
  return keys;
}

describe("JSON-LD SportsClub (§5 SEO)", () => {
  const club = buildSportsClub({ siteUrl: SITE, showFacebook: false });

  it("has the exact names", () => {
    expect(club["@type"]).toBe("SportsClub");
    expect(club.name).toBe("Gimnastičko sportsko udruženje „Kraguj“");
    expect(club.alternateName).toEqual(["Gimnastički klub Kraguj", "Sportska Gimnastika Kraguj"]);
  });

  it("has url, logo and image as absolute URLs on SITE_URL", () => {
    expect(club.url).toBe(`${SITE}/`);
    expect(club.logo).toBe(`${SITE}/icons/logo.png`);
    expect(club.image).toBe(`${SITE}/og.png`);
  });

  it("has the contacts", () => {
    expect(club.telephone).toBe("+381600287631");
    expect(club.email).toBe("sladjanakovacevickg@gmail.com");
  });

  it("has the training hall address (PostalAddress) and a Place named after the school", () => {
    const address = {
      "@type": "PostalAddress",
      streetAddress: "Save Kovačevića 25",
      postalCode: "34000",
      addressLocality: "Kragujevac",
      addressCountry: "RS",
    };
    expect(club.address).toEqual(address);
    expect(club.location).toMatchObject({
      "@type": "Place",
      name: "Trgovinsko-ugostiteljska škola „Toza Dragović“",
      address,
    });
  });

  it("is a member of the Gymnastics Federation of Serbia", () => {
    expect(club.memberOf).toEqual({ "@type": "SportsOrganization", name: "Gimnastički savez Srbije", url: "https://www.gssrb.rs" });
  });

  it("names the sports", () => {
    expect(club.sport).toEqual(["Sportska gimnastika", "Aerobna gimnastika"]);
  });

  it("sameAs: Instagram only while SHOW_FACEBOOK=false", () => {
    expect(club.sameAs).toEqual([INSTAGRAM]);
    expect(JSON.stringify(club)).not.toContain("facebook");
  });

  it("sameAs: Instagram + Facebook when SHOW_FACEBOOK=true", () => {
    expect(buildSportsClub({ siteUrl: SITE, showFacebook: true }).sameAs).toEqual([INSTAGRAM, FACEBOOK]);
  });

  it("has NO foundingDate anywhere (either flag value)", () => {
    for (const showFacebook of [false, true]) {
      const keys = allKeys(buildJsonLd({ siteUrl: SITE, showFacebook }));
      expect(keys.has("foundingDate")).toBe(false);
      expect([...keys].some((k) => /founding/i.test(k))).toBe(false);
    }
  });
});

describe("JSON-LD FAQPage", () => {
  it("lists the seven visible FAQ items with their exact text (fees/free trial hidden by default)", () => {
    const faq = buildFaqPage(visibleFaq(), SITE);
    const main = faq.mainEntity as { "@type": string; name: string; acceptedAnswer: { "@type": string; text: string } }[];
    expect(faq["@type"]).toBe("FAQPage");
    expect(main).toHaveLength(7);
    expect(main[0]).toEqual({
      "@type": "Question",
      name: "Od koliko godina dete može da počne?",
      acceptedAnswer: { "@type": "Answer", text: "Već od 3. godine, u mlađoj početnoj grupi (3–8 godina)." },
    });
    expect(main.map((q) => q.name)).toEqual([
      "Od koliko godina dete može da počne?",
      "Kada može da se upiše?",
      "Kako izgleda prvi trening?",
      "Šta dete treba da ponese?",
      "Gde se održavaju treninzi?",
      "Da li su trenerice licencirane?",
      "Da li klub ide na takmičenja?",
    ]);
    expect(JSON.stringify(faq)).not.toMatch(/besplatn|članarin/i);
  });

  it("never emits a question without an answer (flagged items with no copy)", () => {
    const items: FaqItem[] = [...FAQ]; // includes the empty SHOW_FEES / FREE_TRIAL items
    const main = buildFaqPage(items, SITE).mainEntity as { acceptedAnswer: { text: string } }[];
    expect(main.every((q) => q.acceptedAnswer.text.length > 0)).toBe(true);
  });
});

describe("JSON-LD serialization", () => {
  it("round-trips through JSON.parse unchanged", () => {
    const ld = buildJsonLd({ siteUrl: SITE, showFacebook: false });
    expect(JSON.parse(serializeJsonLd(ld))).toEqual(ld);
  });

  it("is one @graph with WebSite, SportsClub and FAQPage", () => {
    const ld = buildJsonLd({ siteUrl: SITE });
    expect(ld["@context"]).toBe("https://schema.org");
    expect(graphOf(ld).map((n) => n["@type"])).toEqual(["WebSite", "SportsClub", "FAQPage"]);
    expect(byType(ld, "WebSite").name).toBe("Gimnastički klub Kraguj");
  });

  it("cannot break out of the <script> element", () => {
    const LS = String.fromCharCode(0x2028);
    const PS = String.fromCharCode(0x2029);
    const evil: FaqItem[] = [{ q: "</script><script>alert(1)</script>", a: `<!-- & ${LS} ${PS} >` }];
    const ld = buildJsonLd({ siteUrl: SITE, faq: evil });
    const out = serializeJsonLd(ld);
    for (const ch of ["<", ">", "&", LS, PS]) expect(out.includes(ch)).toBe(false);
    expect(JSON.parse(out)).toEqual(ld);
  });
});

describe("metadata (§5 SEO)", () => {
  const meta = buildMetadata({ indexable: false, siteUrl: SITE });

  it("uses the exact title and description", () => {
    expect(meta.title).toBe("Gimnastički klub Kraguj — sportska gimnastika za decu u Kragujevcu");
    expect(meta.description).toBe(
      "Sportska gimnastika za decu od 3. godine i aerobna gimnastika u Kragujevcu. Licencirane trenerice, član Gimnastičkog saveza Srbije, upis tokom cele godine. Zakažite probni trening.",
    );
  });

  it("canonical = SITE_URL", () => {
    expect(meta.metadataBase?.toString()).toBe(`${SITE}/`);
    expect(meta.alternates?.canonical).toBe("/");
  });

  it("Open Graph / Twitter: sr_RS and the 1200×630 image", () => {
    expect(meta.openGraph).toMatchObject({ type: "website", locale: "sr_RS", siteName: "Gimnastički klub Kraguj" });
    const og = (meta.openGraph as { images: { url: string; width: number; height: number }[] }).images[0]!;
    expect(og).toMatchObject({ url: "/og.png", width: 1200, height: 630 });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("robots meta follows INDEXABLE", () => {
    expect(meta.robots).toEqual({ index: false, follow: false, noimageindex: true });
    expect(buildMetadata({ indexable: true, siteUrl: SITE }).robots).toEqual({ index: true, follow: true });
  });
});

describe("robots.txt and sitemap.xml (§6 Indexing)", () => {
  it("INDEXABLE=false: HTML stays crawlable (so noindex is seen), photos disallowed, no Sitemap line", () => {
    const txt = resolveRobots(buildRobots({ indexable: false, siteUrl: SITE }));
    expect(txt).toBe("User-Agent: *\nAllow: /\nDisallow: /img/\n\n");
    expect(txt).not.toMatch(/Sitemap/i);
    expect(txt).not.toMatch(/^Disallow: \/$/m);
  });

  it("INDEXABLE=true: allow all + Sitemap on SITE_URL", () => {
    const txt = resolveRobots(buildRobots({ indexable: true, siteUrl: SITE }));
    expect(txt).toBe(`User-Agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  });

  it("sitemap: empty <urlset> when not indexable, SITE_URL/ when indexable", () => {
    expect(buildSitemap({ indexable: false, siteUrl: SITE })).toEqual([]);
    const off = resolveSitemap(buildSitemap({ indexable: false, siteUrl: SITE }));
    expect(off).toContain("<urlset");
    expect(off).not.toContain("<loc>");
    const on = resolveSitemap(buildSitemap({ indexable: true, siteUrl: SITE }));
    expect(on).toContain(`<loc>${SITE}/</loc>`);
    expect(on.match(/<url>/g)).toHaveLength(1);
  });
});

describe("generated share image and icons", () => {
  it("every icon referenced by lib/seo.ts is generated", () => {
    const files = new Set(ICON_SPECS.map((s) => s.file));
    for (const f of Object.values(ICON_FILES)) expect(files.has(f)).toBe(true);
  });

  it("icon sizes match their names", () => {
    for (const s of ICON_SPECS) {
      const m = s.file.match(/(\d+)\.png$/);
      if (m) expect([s.width, s.height]).toEqual([Number(m[1]), Number(m[1])]);
    }
    expect(ICON_SPECS.find((s) => s.file === "apple-touch-icon.png")).toMatchObject({ width: 180, height: 180 });
  });

  it("the share image is 1200×630 with six ghost frames of the silhouette", () => {
    const svg = ogArtSvg();
    expect(svg).toContain('width="1200" height="630"');
    expect(OG_IMAGE).toMatchObject({ width: 1200, height: 630 });
    expect(svg.match(/opacity="0\.\d+"><path/g)).toHaveLength(6);
  });
});

describe("404 tilt math", () => {
  it("phone upright in portrait → down is down", () => {
    expect(gravityAngle(90, 0, 0)).toBeCloseTo(0, 6);
  });

  it("right edge down → gravity leans right; the figure counter-rotates", () => {
    const down = gravityAngle(60, 25, 0)!;
    expect(down).toBeCloseTo(13.7, 1); // atan2(cos60·sin25, sin60)
    expect(balanceTarget(down)).toBeCloseTo(-13.7, 1);
  });

  it("landscape (screen angle 90, top edge to the left) held upright → down is down", () => {
    expect(gravityAngle(0, -90, 90)).toBeCloseTo(0, 6);
  });

  it("flat on a table or missing data → no tilt", () => {
    expect(gravityAngle(2, 3, 0)).toBeNull();
    expect(gravityAngle(null, 10, 0)).toBeNull();
    expect(balanceTarget(null)).toBe(0);
  });

  it("clamps the sway", () => {
    expect(balanceTarget(80)).toBe(-MAX_TILT);
    expect(balanceTarget(-80)).toBe(MAX_TILT);
  });

  it("the spring settles on the target and the ghosts catch up", () => {
    let s = createBalance(3, -60);
    let t = 0;
    while (!isSettled(s, 10) && t < 5) {
      s = stepBalance(s, 10, 1 / 60);
      t += 1 / 60;
    }
    expect(t).toBeLessThan(3);
    expect(s.angle).toBeCloseTo(10, 1);
    s.lags.forEach((l) => expect(l).toBeCloseTo(10, 1));
  });
});
