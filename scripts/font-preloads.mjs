// postbuild: font preloads for the exported 404 page (DECISIONS.md, MD3-02).
//
// Next 16 + Turbopack writes next-font-manifest.json keyed by route entry
// ("[project]/app/_not-found/page") but looks fonts up by the page module
// ("[project]/app/not-found"), so out/404.html never gets the
// <link rel="preload" as="font"> that the home page has. The 404 then first paints in the
// fallback face and swaps when Mona Sans arrives (its h1 keeps its lines, see
// components/notfound/title.ts, but the glyphs still pop), and the judges' board shows
// „10.00“ in a system font. This copies the home page's font preloads into the 404
// documents, at the same place (before the inlined stylesheet), and adds one for Doto,
// whose board is above the fold there (on the home page Doto is not preloaded on
// purpose, D-38). Idempotent. Anything unexpected (no font preload on the home page, no
// Doto face in the 404's CSS) fails the build, so a Next upgrade cannot change this silently.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = process.argv[2] ?? "out";
const TARGETS = ["404.html", "_not-found.html"];
const PRELOAD = /<link rel="preload" href="([^"]+\.woff2)" as="font" crossorigin="" type="font\/woff2"\/>/g;
const DOTO = /@font-face\{[^}]*?font-family:\s*"?doto"?\s*;[^}]*?src:url\(([^)]+\.woff2)\)/;
const tag = (href) => `<link rel="preload" href="${href}" as="font" crossorigin="" type="font/woff2"/>`;
const headOf = (html) => {
  const end = html.indexOf("</head>");
  if (end < 0) throw new Error("font-preloads: no </head>");
  return html.slice(0, end);
};

const home = await readFile(path.join(OUT, "index.html"), "utf8");
const homeFonts = [...headOf(home).matchAll(PRELOAD)].map((m) => m[1]);
if (homeFonts.length === 0) throw new Error("font-preloads: out/index.html has no font preload (Next output changed)");

let changed = 0;
for (const name of TARGETS) {
  const file = path.join(OUT, name);
  let html;
  try {
    html = await readFile(file, "utf8");
  } catch (err) {
    if (name === "404.html") throw err;
    continue; // _not-found.html is a copy some Next versions do not write
  }
  const head = headOf(html);
  const doto = head.match(DOTO)?.[1];
  if (!doto) throw new Error(`font-preloads: no Doto @font-face in ${name} (Next output changed)`);
  const present = new Set([...head.matchAll(PRELOAD)].map((m) => m[1]));
  const missing = [...homeFonts, doto].filter((href, i, all) => !present.has(href) && all.indexOf(href) === i);
  if (missing.length === 0) continue;
  // Where Next puts its own font preloads: before the first stylesheet/link in <head>.
  const at = head.search(/<(style|link)\b/);
  if (at < 0) throw new Error(`font-preloads: no <style>/<link> in the head of ${name}`);
  html = html.slice(0, at) + missing.map(tag).join("") + html.slice(at);
  await writeFile(file, html);
  changed++;
}
console.log(`font-preloads: ${changed} file(s), ${homeFonts.length} home preload(s) + Doto`);
