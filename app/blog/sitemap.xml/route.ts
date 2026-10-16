import { ARTICLES } from "@/content/articles";
import { FLAGS } from "@/content/site";
import { absoluteUrl } from "@/lib/seo";
export const dynamic = "force-static";
export function GET() {
  const urls = FLAGS.INDEXABLE ? [absoluteUrl("/blog"), ...ARTICLES.map(a => absoluteUrl(`/blog/${a.slug}`))] : [];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${url}</loc></url>`).join("")}</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
