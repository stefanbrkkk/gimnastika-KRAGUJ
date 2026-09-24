import type { MetadataRoute } from "next";
import { FLAGS } from "@/content/site";
import { buildRobots } from "@/lib/seo";

/** out/robots.txt — policy per INDEXABLE is documented in lib/seo.ts. */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return buildRobots({ indexable: FLAGS.INDEXABLE });
}
