"use client";

import { useEffect } from "react";
import { ERROR_COPY, FALLBACK_FACTS } from "@/components/notfound/fallback";

/** Legible even without the site's CSS (normally it stays: React keeps precedence styles). */
const CRITICAL_CSS = "body{margin:0;background:#112d5f;color:#eef3fa}";
const reload = () => window.location.reload();

/**
 * The Serbian error screen: any uncaught client exception (a section island, a
 * hydration error, the root layout) shows this instead of Next's English screen.
 * It REPLACES the root layout, so it renders its own document — lang="sr-Latn",
 * viewport, title. The site's inlined CSS survives (React keeps precedence
 * styles), so it uses the 404's visual system (styles/sections/notfound.css,
 * dark theme); the layout's sprite and font classes do not, so the club's name
 * stands in for the logo and .nf--error names the font itself.
 * No app/error.tsx on purpose: it would add ~1 KB gz to every page's first load
 * for the logo alone (DECISIONS.md). Optional enhancements never get here: they
 * sit in a QuietBoundary.
 */
export default function GlobalError() {
  useEffect(() => {
    // The page it replaced is gone: show the screen from the top and keep focus in it.
    const main = document.getElementById("sadrzaj");
    window.scrollTo({ top: 0, behavior: "instant" });
    if (main && !main.contains(document.activeElement)) main.focus({ preventScroll: true });
  }, []);

  return (
    <html lang="sr-Latn">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{`${ERROR_COPY.title.slice(0, -1)} | ${FALLBACK_FACTS.brandName}`}</title>
        <style>{CRITICAL_CSS}</style>
      </head>
      <body>
        <main id="sadrzaj" tabIndex={-1} className="nf nf--error" data-theme="dark">
          <div className="container-site nf__inner">
            {/* A hard navigation on purpose: after a crash the visitor needs a fresh document. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="nf__brand nf__brand-name" href="/">
              {FALLBACK_FACTS.brandName}
            </a>
            <div className="nf__body">
              <div className="nf__copy">
                <h1 className="nf__title">{ERROR_COPY.title}</h1>
                <p className="nf__lead">{ERROR_COPY.lead}</p>
                <div className="nf__actions">
                  <button type="button" className="btn btn-primary" onClick={reload}>
                    {ERROR_COPY.reload}
                  </button>
                  <a className="btn btn-secondary" href={FALLBACK_FACTS.tel}>
                    {FALLBACK_FACTS.call}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
