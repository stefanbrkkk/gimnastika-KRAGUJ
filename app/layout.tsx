import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Sprite } from "@/components/brand/Sprite";
import { HeadingLandings } from "@/components/ui/HeadingLandings";
import { SKIP_LINK } from "@/content/copy";
import { siteMetadata } from "@/lib/seo";
import { doto, mona } from "./fonts";
import "./globals.css";

export const metadata: Metadata = siteMetadata;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#112d5f",
};

/**
 * Runs before first paint. Adds "js" always, and "js-motion" only when motion
 * is allowed (no prefers-reduced-motion, no Save-Data). Only html.js-motion
 * hides the DECORATIVE hero layer. Failsafe (pages with the hero only): if the
 * intro has not started 2.5s after load (html[data-intro] unset), drop js-motion
 * → final state.
 */
const MOTION_SCRIPT = `(function(){var d=document.documentElement;d.classList.add("js");try{var r=matchMedia("(prefers-reduced-motion: reduce)").matches,c=navigator.connection,s=!!(c&&c.saveData);if(!r&&!s){d.classList.add("js-motion");addEventListener("load",function(){if(!document.getElementById("top"))return;setTimeout(function(){if(!d.hasAttribute("data-intro")){d.classList.remove("js-motion");d.setAttribute("data-intro","skipped")}},2500)})}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sr-Latn" className={`${mona.variable} ${doto.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#sadrzaj">
          {SKIP_LINK}
        </a>
        <Sprite />
        {children}
        <HeadingLandings />
      </body>
    </html>
  );
}
