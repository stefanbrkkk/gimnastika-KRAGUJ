/**
 * Static .ics files, one per schedule group with a fixed slot:
 *   /kalendar/kraguj-<group>.ics  →  out/kalendar/kraguj-<group>.ics
 * Prerendered at build (output: "export" requires force-static), so the
 * "Dodajte u kalendar (.ics)" link works without JavaScript.
 * DTSTAMP = build time; DTSTART = the first occurrence on/after the build date.
 */
import { SCHEDULE } from "@/content/schedule";
import { buildGroupIcs, hasFixedSlot, icsFileName } from "@/lib/ics";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): { file: string }[] {
  return SCHEDULE.filter(hasFixedSlot).map((group) => ({ file: icsFileName(group) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await params;
  const group = SCHEDULE.find((g) => hasFixedSlot(g) && icsFileName(g) === file);
  if (!group) return new Response("Not found", { status: 404 });
  return new Response(buildGroupIcs(group), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${file}"`,
    },
  });
}
