import type { MetadataRoute } from "next";
import { FLAGS } from "@/content/site";
import { buildSitemap } from "@/lib/seo";

/** out/sitemap.xml — lists SITE_URL/ only when INDEXABLE; otherwise an empty <urlset>. */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap({ indexable: FLAGS.INDEXABLE });
}
