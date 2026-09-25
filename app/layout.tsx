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
 * First paint (D-38): on a plain first visit (no #hash, not a reload or back/forward,
 * so no scroll position to restore) html.cv lets the sections below S2 skip layout
 * until the first contentful paint; the class goes in the frame after it.
 */
const MOTION_SCRIPT = `(function(){var d=document.documentElement;d.classList.add("js");try{var r=matchMedia("(prefers-reduced-motion: reduce)").matches,c=navigator.connection,s=!!(c&&c.saveData);if(!r&&!s){d.classList.add("js-motion");addEventListener("load",function(){if(!document.getElementById("top"))return;setTimeout(function(){if(!d.hasAttribute("data-intro")){d.classList.remove("js-motion");d.setAttribute("data-intro","skipped")}},2500)})}}catch(e){}try{var n=performance.getEntriesByType("navigation")[0];if(!location.hash&&(!n||n.type==="navigate")){d.classList.add("cv");var off=function(){d.classList.remove("cv")};try{new PerformanceObserver(function(l,o){if(l.getEntriesByName("first-contentful-paint").length){o.disconnect();requestAnimationFrame(off)}}).observe({type:"paint",buffered:true})}catch(e){}setTimeout(off,1500)}}catch(e){}})();`;

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
