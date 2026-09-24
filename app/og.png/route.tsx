/**
 * Share image (Open Graph + Twitter), generated at build → out/og.png.
 * A route handler with a real .png name instead of the opengraph-image file
 * convention: under output:"export" that convention writes an extensionless
 * out/opengraph-image, which static hosts (Cloudflare Pages) serve as
 * application/octet-stream. lib/seo.ts declares /og.png in the metadata.
 *
 * Text uses static Mona Sans instances (Satori reads TTF, not woff2), made from
 * fonts/source/MonaSansVF-wdth-opsz-wght.woff2 with fontTools:
 *   instancer wght=600|760 wdth=108|112 opsz=0 → pyftsubset (ASCII + čćšžđČĆŠŽĐ„“·—–▸)
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { ART, OG_SIZE, ogArtSvg, svgDataUri } from "@/components/seo/art";
import { HERO } from "@/content/copy";

export const dynamic = "force-static";

const font = (file: string) => readFile(join(process.cwd(), "components/seo/fonts", file));

export async function GET(): Promise<Response> {
  const [semibold, bold] = await Promise.all([font("mona-sans-og-600.ttf"), font("mona-sans-og-760.ttf")]);
  return new ImageResponse(
    (
      <div style={{ width: OG_SIZE.width, height: OG_SIZE.height, display: "flex", position: "relative", background: ART.navy900 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori at build, not in a page */}
        <img src={svgDataUri(ogArtSvg())} width={OG_SIZE.width} height={OG_SIZE.height} alt="" style={{ position: "absolute", left: 0, top: 0 }} />
        <div
          style={{
            position: "absolute",
            left: 64,
            top: 50,
            display: "flex",
            fontFamily: "Mona Sans OG",
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: ART.steel300,
          }}
        >
          {HERO.eyebrow}
        </div>
        <div
          style={{
            position: "absolute",
            left: 64,
            right: 64,
            bottom: 38,
            display: "flex",
            fontFamily: "Mona Sans OG",
            fontWeight: 700,
            fontSize: 38,
            letterSpacing: "-0.01em",
            color: ART.ice50,
          }}
        >
          {HERO.h1}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Mona Sans OG", data: semibold, weight: 600, style: "normal" },
        { name: "Mona Sans OG", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
