import { buildRss } from "@/lib/editorial";
export const dynamic = "force-static";
export function GET() {
  return new Response(buildRss(), { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
