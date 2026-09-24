import type { MetadataRoute } from "next";
import { CLUB, SEO } from "@/content/site";
import { ICON_FILES, iconPath } from "@/lib/seo";

/** out/manifest.webmanifest (static): lets parents add the site to the home screen. */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: CLUB.brandName,
    short_name: "Kraguj",
    description: SEO.description,
    lang: "sr-Latn",
    start_url: "/",
    scope: "/",
    display: "browser",
    background_color: "#112d5f",
    theme_color: "#112d5f",
    icons: [
      { src: iconPath(ICON_FILES.png192), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: iconPath(ICON_FILES.png512), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: iconPath(ICON_FILES.maskable512), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
