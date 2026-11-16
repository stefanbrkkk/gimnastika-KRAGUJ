import type { Metadata } from "next";
import { ARTICLES, type Article } from "@/content/articles";
import { COACHES } from "@/content/copy";
import { CLUB, FLAGS } from "@/content/site";
import { absoluteUrl, buildSportsClub, coachId, homeUrl, OG_IMAGE, robotsMeta } from "@/lib/seo";

/** The blog's name in JSON-LD and RSS. */
export const BLOG_NAME = "Gimnastika — vodiči za roditelje | Kraguj";
/** Breadcrumb / navigation label of the blog index. */
export const BLOG_LABEL = "Vodiči za roditelje";

export function buildEditorialMetadata({ title, description, path, article }: {
  title: string; description: string; path: string; article?: Article;
}): Metadata {
  const pageTitle = `${title} | Kraguj`;
  const url = absoluteUrl(path);
  const image = { url: absoluteUrl(OG_IMAGE.path), width: OG_IMAGE.width, height: OG_IMAGE.height, alt: OG_IMAGE.alt };
  return {
    title: pageTitle, description, alternates: { canonical: url, types: { "application/rss+xml": absoluteUrl("/blog/rss.xml") } },
    robots: robotsMeta(FLAGS.INDEXABLE),
    openGraph: {
      title: pageTitle, description, url, siteName: CLUB.brandName, locale: "sr_RS", images: [image],
      ...(article ? { type: "article" as const, publishedTime: article.published, modifiedTime: article.updated, authors: [homeUrl()], section: article.category } : { type: "website" as const }),
    },
    twitter: { card: "summary_large_image", title: pageTitle, description, images: [image] },
  };
}

const blogId = (): string => absoluteUrl("/blog#blog");
/** A full (typed, named) reference to the blog, so `isPartOf` never resolves to an anonymous stub. */
const blogRef = (): Record<string, unknown> => ({ "@type": "Blog", "@id": blogId(), name: BLOG_NAME, url: absoluteUrl("/blog") });

const breadcrumbs = (trail: readonly { name: string; item: string }[]): Record<string, unknown> => ({
  "@type": "BreadcrumbList",
  itemListElement: trail.map((crumb, i) => ({ "@type": "ListItem", position: i + 1, name: crumb.name, item: crumb.item })),
});

/** Words a reader actually sees in the article body (intro, sections, lists, questions and answers). */
export function articleWordCount(article: Article): number {
  const text = [
    article.intro,
    ...article.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...(section.bullets ?? [])]),
    ...article.faq.flatMap((item) => [item.question, item.answer]),
  ].join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * The reviewer, only when content/articles.ts names one (set after a coach has really read
 * and approved the text). A name from COACHES reuses that coach's Person @id from the home page.
 */
function reviewNodes(article: Article): Record<string, unknown> {
  const review = article.reviewedBy;
  if (!review) return {};
  const coach = COACHES.find((c) => c.name === review.name);
  return {
    reviewedBy: { "@type": "Person", ...(coach ? { "@id": coachId(coach) } : {}), name: review.name, jobTitle: review.role },
    lastReviewed: review.date,
  };
}

export function buildArticleJsonLd(article: Article): Record<string, unknown> {
  const url = absoluteUrl(`/blog/${article.slug}`);
  const publisher = { "@id": absoluteUrl("/#klub") };
  return { "@context": "https://schema.org", "@graph": [
    buildSportsClub(),
    { "@type": "BlogPosting", "@id": `${url}#clanak`, url, mainEntityOfPage: { "@type": "WebPage", "@id": url, ...reviewNodes(article) }, headline: article.title,
      description: article.description, inLanguage: "sr-Latn", datePublished: article.published, dateModified: article.updated,
      author: publisher, publisher, image: absoluteUrl(OG_IMAGE.path), isPartOf: blogRef(),
      articleSection: article.category, wordCount: articleWordCount(article),
      citation: article.sources.map(source => source.url),
    },
    breadcrumbs([
      { name: "Početna", item: homeUrl() },
      { name: BLOG_LABEL, item: absoluteUrl("/blog") },
      { name: article.title, item: url },
    ]),
    // The article's own „Česta pitanja“ block (visible on the page, same wording).
    ...(article.faq.length > 0 ? [{
      "@type": "FAQPage", "@id": `${url}#pitanja`, inLanguage: "sr-Latn",
      mainEntity: article.faq.map(item => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
    }] : []),
  ] };
}

export function buildBlogJsonLd(): Record<string, unknown> {
  return { "@context": "https://schema.org", "@graph": [buildSportsClub(), {
    ...blogRef(),
    inLanguage: "sr-Latn", publisher: { "@id": absoluteUrl("/#klub") },
    blogPost: ARTICLES.map(a => ({ "@type": "BlogPosting", headline: a.title, url: absoluteUrl(`/blog/${a.slug}`), datePublished: a.published, dateModified: a.updated })),
  }, breadcrumbs([
    { name: "Početna", item: homeUrl() },
    { name: BLOG_LABEL, item: absoluteUrl("/blog") },
  ])] };
}

const escapeXml = (text: string): string => text.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
export function buildRss(): string {
  const items = ARTICLES.map(a => `<item><title>${escapeXml(a.title)}</title><link>${absoluteUrl(`/blog/${a.slug}`)}</link><guid isPermaLink="true">${absoluteUrl(`/blog/${a.slug}`)}</guid><description>${escapeXml(a.description)}</description><pubDate>${new Date(a.published).toUTCString()}</pubDate></item>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeXml(BLOG_NAME)}</title><link>${absoluteUrl("/blog")}</link><description>Praktični odgovori o gimnastici za decu, programima i prvom treningu u Kragujevcu.</description><language>sr-Latn</language><atom:link href="${absoluteUrl("/blog/rss.xml")}" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
}
