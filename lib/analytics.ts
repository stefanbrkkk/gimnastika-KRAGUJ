/**
 * Vercel Web Analytics — the loader (page views only; the project is on Vercel's Hobby plan,
 * where custom events are not recorded, so no click or form tracking exists anywhere).
 *
 * Vercel's script is cookieless and is served from this site's own domain
 * (/_vercel/insights/*, added by Vercel once Web Analytics is enabled for the project).
 * This inline loader mirrors what the official `@vercel/analytics` package's `inject()` does
 * (queue stub + a deferred <script>), without a dependency or any hydration cost, and adds
 * three rules of this site's own:
 *  - production host only: local builds, `serve out`, QA runs and preview deployments never
 *    request the script (it does not exist there) and are never counted;
 *  - privacy signals win: a browser sending Do Not Track or Global Privacy Control is not counted;
 *  - after `load` only: the request never competes with the first paint (DECISIONS D-23).
 * The loader stores nothing on the device and sends nothing itself.
 */
import { SITE_URL } from "@/content/site";

/** The path Vercel serves its Web Analytics script from (same origin). */
export const ANALYTICS_SCRIPT_SRC = "/_vercel/insights/script.js";

/** The only hostname that is counted: the canonical one. */
export const analyticsHost = (siteUrl: string = SITE_URL): string => new URL(siteUrl).hostname;

/** A JS string literal that is also safe inside an inline <script> (no <, >, & or line separators). */
const UNSAFE_IN_SCRIPT = new RegExp("[<>&\\u2028\\u2029]", "g");
const jsString = (value: string): string =>
  JSON.stringify(value).replace(UNSAFE_IN_SCRIPT, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);

export function buildAnalyticsScript({ host }: { host: string }): string {
  return `(function(){try{if(location.hostname!==${jsString(host)})return;var n=navigator;if(n.globalPrivacyControl||n.doNotTrack==="1")return;window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};var go=function(){try{var s=document.createElement("script");s.defer=true;s.src=${jsString(ANALYTICS_SCRIPT_SRC)};document.head.appendChild(s)}catch(e){}};if(document.readyState==="complete")go();else addEventListener("load",go,{once:true})}catch(e){}})();`;
}

/** The loader for this build's canonical host. Rendered once, at the end of <body> (app/layout.tsx). */
export const ANALYTICS_SCRIPT: string = buildAnalyticsScript({ host: analyticsHost() });
