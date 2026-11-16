import { describe, expect, it } from "vitest";
import { ARTICLES, getArticle, type Article } from "@/content/articles";
import { articleWordCount, buildArticleJsonLd, buildBlogJsonLd, buildEditorialMetadata, buildRss } from "@/lib/editorial";
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
  it("every article is internally consistent: unique ids, resolvable related links, unique sources", () => {
    for (const a of ARTICLES) {
      expect(new Set(a.sections.map(s => s.id)).size, a.slug).toBe(a.sections.length);
      expect(a.sections.every(s => s.id !== "pitanja" && s.id !== "o-izdavacu"), a.slug).toBe(true);
      expect(new Set(a.sources.map(s => s.url)).size, a.slug).toBe(a.sources.length);
      expect(a.sources.length, a.slug).toBeGreaterThan(0);
      expect(a.relatedSlugs.includes(a.slug), a.slug).toBe(false);
      for (const slug of a.relatedSlugs) expect(getArticle(slug), `${a.slug} → ${slug}`).toBeDefined();
      expect(a.title.length, a.slug).toBeLessThanOrEqual(62);
      expect(a.description.length, a.slug).toBeGreaterThanOrEqual(110);
      expect(a.description.length, a.slug).toBeLessThanOrEqual(160);
    }
  });
  it("article schema: a typed Blog parent, section, word count and the visible FAQ", () => {
    for (const a of ARTICLES) {
      const graph = buildArticleJsonLd(a)["@graph"] as Record<string,unknown>[];
      const post = graph.find(n=>n["@type"]==="BlogPosting")!;
      expect(post.isPartOf).toEqual({"@type":"Blog","@id":`${SITE}/blog#blog`,name:"Gimnastika — vodiči za roditelje | Kraguj",url:`${SITE}/blog`});
      expect(post.articleSection).toBe(a.category);
      expect(post.wordCount).toBe(articleWordCount(a));
      expect(articleWordCount(a), a.slug).toBeGreaterThan(300);
      const faq = graph.find(n=>n["@type"]==="FAQPage") as {"@id":string;mainEntity:{name:string;acceptedAnswer:{text:string}}[]};
      expect(faq["@id"]).toBe(`${SITE}/blog/${a.slug}#pitanja`);
      expect(faq.mainEntity.map(q=>[q.name,q.acceptedAnswer.text])).toEqual(a.faq.map(q=>[q.question,q.answer]));
    }
  });
  it("no article claims an expert review until one is recorded — and then names the reviewer", () => {
    for (const a of ARTICLES) {
      expect(a.reviewedBy, `${a.slug}: set reviewedBy only after a real review`).toBeUndefined();
      expect(JSON.stringify(buildArticleJsonLd(a))).not.toMatch(/reviewedBy|lastReviewed/);
    }
    const reviewed: Article = {...ARTICLES[0]!, reviewedBy: {name:"Slađana Kovačević", role:"licencirana trenerica sportske gimnastike (GSS)", date:"2026-12-01"}};
    const post = (buildArticleJsonLd(reviewed)["@graph"] as Record<string,unknown>[]).find(n=>n["@type"]==="BlogPosting")!;
    expect(post.mainEntityOfPage).toMatchObject({
      "@type":"WebPage", lastReviewed:"2026-12-01",
      reviewedBy:{"@type":"Person","@id":`${SITE}/#sladjana-kovacevic`,name:"Slađana Kovačević"},
    });
  });
  it("the club news article states only what its sources state", () => {
    const a = getArticle("novi-dvovisinski-razboj-podrska-grada-kragujevca")!;
    const text = JSON.stringify(a);
    expect(a.sources.map(s=>s.url)).toContain("https://www.kragujevac.ls.gov.rs/vest/sr/135460/podrska-mladim-talentima-grad-nabavio-novi-dvovisinski-razboj-za-gimnasticki-klub-kraguj.php");
    expect(text).toContain("oko 800.000 dinara");
    expect(text).toContain("oko 130 mladih članova");
    expect(text).toContain("22. septembra 2026.");
    // support, not ownership or full financing; and exactly one short direct quote
    expect(text).not.toMatch(/Grad (je )?(kupio|finansirao|poklonio)/);
    expect(text.match(/„Nova sprava nam izuzetno znači“/g)).toHaveLength(1);
  });
  it("blog index schema lists every article and a breadcrumb", () => {
    const graph = buildBlogJsonLd()["@graph"] as Record<string,unknown>[];
    const blog = graph.find(n=>n["@type"]==="Blog") as {blogPost:{url:string}[]};
    expect(blog.blogPost.map(p=>p.url)).toEqual(ARTICLES.map(a=>`${SITE}/blog/${a.slug}`));
    expect(graph.some(n=>n["@type"]==="BreadcrumbList")).toBe(true);
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
    const { buildJsonLd } = await import("@/lib/seo");
    const { buildArticleJsonLd: articleLd } = await import("@/lib/editorial");
    expect(JSON.stringify(withoutFreeTrial)).not.toMatch(/besplat/i);
    expect(SEO.description).not.toMatch(/besplat/i);
    // structured data: no free-trial Offer, FAQ answer or description left behind
    expect(JSON.stringify(buildJsonLd())).not.toMatch(/besplat|makesOffer/i);
    for (const article of withoutFreeTrial) expect(JSON.stringify(articleLd(article))).not.toMatch(/besplat|makesOffer/i);
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
});
