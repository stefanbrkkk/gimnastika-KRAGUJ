import { describe, expect, it } from "vitest";
import { ARTICLES, getArticle } from "@/content/articles";
import { buildArticleJsonLd, buildEditorialMetadata, buildRss } from "@/lib/editorial";
import { buildSitemap } from "@/lib/seo";

const SITE = "https://www.gimnastikakraguj.rs";
describe("discoverable self-hosted editorial content", () => {
  it("retains the published article and returns undefined for unknown slugs", () => {
    expect(getArticle("sportska-gimnastika")?.title).toBeTruthy();
    expect(getArticle("unknown-post")).toBeUndefined();
    expect(new Set(ARTICLES.map(a => a.slug)).size).toBe(ARTICLES.length);
  });
  it("lists the homepage, blog and every actual article exactly once in the sitemap", () => {
    const urls = buildSitemap({ indexable: true, siteUrl: SITE }).map(p => p.url);
    expect(urls).toContain(`${SITE}/blog`);
    expect(urls).toContain(`${SITE}/`);
    for (const a of ARTICLES) expect(urls).toContain(`${SITE}/blog/${a.slug}`);
    expect(new Set(urls).size).toBe(urls.length);
    expect(buildSitemap({ indexable: false })).toEqual([]);
  });
  it("does not inherit the homepage canonical or sharing title", () => {
    const meta = buildEditorialMetadata({title: "Prvi trening", description: "Praktični odgovori za roditelje.", path: "/blog/prvi-trening"});
    expect(meta.alternates?.canonical).toBe(`${SITE}/blog/prvi-trening`);
    expect(meta.openGraph).toMatchObject({url: `${SITE}/blog/prvi-trening`,title:"Prvi trening | Kraguj"});
    expect(meta.twitter).toMatchObject({title:"Prvi trening | Kraguj"});
  });
  it("article schema references its real URL, dates, publisher and breadcrumb", () => {
    const a = ARTICLES[0]!;
    const graph = buildArticleJsonLd(a)["@graph"] as Record<string,unknown>[];
    expect(graph.find(n=>n["@type"]==="BlogPosting")).toMatchObject({headline:a.title,url:`${SITE}/blog/${a.slug}`,inLanguage:"sr-Latn",datePublished:a.published,dateModified:a.updated});
    expect(graph.some(n=>n["@type"]==="BreadcrumbList")).toBe(true);
    expect(JSON.stringify(graph)).not.toMatch(/outrank|ratingValue|reviewedBy/);
  });
  it("publishes timezone-qualified article dates and valid RSS dates", () => {
    for (const article of ARTICLES) {
      for (const date of [article.published, article.updated]) {
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
        expect(Number.isFinite(Date.parse(date))).toBe(true);
      }
      expect(Date.parse(article.updated)).toBeGreaterThanOrEqual(Date.parse(article.published));
    }
    const pubDates = [...buildRss().matchAll(/<pubDate>(.*?)<\/pubDate>/g)].map(match=>match[1]!);
    expect(pubDates).toHaveLength(ARTICLES.length);
    expect(pubDates.every(date=>Number.isFinite(Date.parse(date)))).toBe(true);
  });
  it("RSS includes every real article and escapes XML-sensitive text", () => {
    const rss = buildRss();
    for (const a of ARTICLES) expect(rss).toContain(`${SITE}/blog/${a.slug}`);
    expect(rss.match(/<item>/g)).toHaveLength(ARTICLES.length);
    expect(rss).not.toContain("undefined");
    expect(rss).toContain('encoding="UTF-8"');
  });
});

it("free-trial opt-out also suppresses claims inside editorial content", async () => {
  const { vi } = await import("vitest");
  vi.stubEnv("NEXT_PUBLIC_FREE_TRIAL", "false");
  vi.resetModules();
  try {
    const { ARTICLES: withoutFreeTrial } = await import("@/content/articles");
    const { SEO } = await import("@/content/site");
    expect(JSON.stringify(withoutFreeTrial)).not.toMatch(/besplat/i);
    expect(SEO.description).not.toMatch(/besplat/i);
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
});
