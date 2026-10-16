import type { Metadata } from "next";
import { ARTICLES, type Article } from "@/content/articles";
import { CLUB, FLAGS } from "@/content/site";
import { absoluteUrl, buildSportsClub, homeUrl, OG_IMAGE, robotsMeta } from "@/lib/seo";

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
      ...(article ? { type: "article" as const, publishedTime: article.published, modifiedTime: article.updated, authors: [homeUrl()] } : { type: "website" as const }),
    },
    twitter: { card: "summary_large_image", title: pageTitle, description, images: [image] },
  };
}

export function buildArticleJsonLd(article: Article): Record<string, unknown> {
  const url = absoluteUrl(`/blog/${article.slug}`);
  const publisher = { "@id": absoluteUrl("/#klub") };
  return { "@context": "https://schema.org", "@graph": [
    buildSportsClub(),
    { "@type": "BlogPosting", "@id": `${url}#clanak`, url, mainEntityOfPage: { "@type": "WebPage", "@id": url }, headline: article.title,
      description: article.description, inLanguage: "sr-Latn", datePublished: article.published, dateModified: article.updated,
      author: publisher, publisher, image: absoluteUrl(OG_IMAGE.path), isPartOf: { "@id": absoluteUrl("/blog#blog") },
      citation: article.sources.map(source => source.url),
    },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Početna", item: homeUrl() },
      { "@type": "ListItem", position: 2, name: "Vodiči za roditelje", item: absoluteUrl("/blog") },
      { "@type": "ListItem", position: 3, name: article.title, item: url },
    ] },
  ] };
}

export function buildBlogJsonLd(): Record<string, unknown> {
  return { "@context": "https://schema.org", "@graph": [buildSportsClub(), {
    "@type": "Blog", "@id": absoluteUrl("/blog#blog"), url: absoluteUrl("/blog"), name: "Gimnastika — vodiči za roditelje | Kraguj",
    inLanguage: "sr-Latn", publisher: { "@id": absoluteUrl("/#klub") },
    blogPost: ARTICLES.map(a => ({ "@type": "BlogPosting", headline: a.title, url: absoluteUrl(`/blog/${a.slug}`), datePublished: a.published })),
  }] };
}

const escapeXml = (text: string): string => text.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
export function buildRss(): string {
  const items = ARTICLES.map(a => `<item><title>${escapeXml(a.title)}</title><link>${absoluteUrl(`/blog/${a.slug}`)}</link><guid isPermaLink="true">${absoluteUrl(`/blog/${a.slug}`)}</guid><description>${escapeXml(a.description)}</description><pubDate>${new Date(`${a.published}T12:00:00+02:00`).toUTCString()}</pubDate></item>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Gimnastika — vodiči za roditelje | Kraguj</title><link>${absoluteUrl("/blog")}</link><description>Praktični odgovori o gimnastici za decu, programima i prvom treningu u Kragujevcu.</description><language>sr-Latn</language><atom:link href="${absoluteUrl("/blog/rss.xml")}" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
}
