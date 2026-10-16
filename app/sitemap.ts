import type { MetadataRoute } from "next";
import { FLAGS } from "@/content/site";
import { buildSitemap } from "@/lib/seo";

/** out/sitemap.xml — lists all published canonical pages when INDEXABLE. */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap({ indexable: FLAGS.INDEXABLE });
}
