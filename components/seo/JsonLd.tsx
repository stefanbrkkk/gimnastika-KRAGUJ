import { buildJsonLd, serializeJsonLd } from "@/lib/seo";

/**
 * Structured data (§5 SEO): one @graph with WebSite, SportsClub and FAQPage.
 * Server component; the JSON is escaped by serializeJsonLd (no "<" in the output).
 */
export function JsonLd() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildJsonLd()) }} />;
}
