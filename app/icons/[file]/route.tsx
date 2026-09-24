/**
 * Favicon, app icons and the raster logo, generated at build from the sprite's
 * silhouette → out/icons/<file> (real extensions, so static hosts send the
 * right Content-Type). The <link> tags are declared in lib/seo.ts; the web
 * manifest (app/manifest.ts) lists the 192/512 icons.
 */
import { ImageResponse } from "next/og";
import { ICON_SPECS, svgDataUri } from "@/components/seo/art";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): { file: string }[] {
  return ICON_SPECS.map(({ file }) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await params;
  const spec = ICON_SPECS.find((s) => s.file === file);
  if (!spec) return new Response("Not found", { status: 404 });

  if (file.endsWith(".svg")) {
    return new Response(spec.svg(), { headers: { "Content-Type": "image/svg+xml; charset=utf-8" } });
  }
  return new ImageResponse(
    (
      <div style={{ width: spec.width, height: spec.height, display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori at build, not in a page */}
        <img src={svgDataUri(spec.svg())} width={spec.width} height={spec.height} alt="" />
      </div>
    ),
    { width: spec.width, height: spec.height },
  );
}
