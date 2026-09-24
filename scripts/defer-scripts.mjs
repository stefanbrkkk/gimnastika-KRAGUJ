// postbuild: load Next's client scripts only AFTER the first paint.
//
// Next 16 puts every first-load chunk in <head> as <script async> (+ a low-priority
// preload). On a slow phone those ~150 KB gz compete with HTML/CSS/font for the
// network and — once they arrive — for the main thread before the hero H1 is painted.
// This rewrite removes those tags from every exported HTML page and injects the same
// scripts from a tiny inline loader right after the first contentful paint (paint
// timing entry; rAF fallback; 1.5 s safety timer for background tabs). Nothing else changes: the
// inline RSC payload (self.__next_f) stays in place, the scripts are the same files,
// and without JS the page is complete anyway (DECISIONS.md D-23).
//
// The list is kept machine-readable in <script id="kraguj-deferred-scripts"
// type="application/json"> so qa/bundle.mjs still measures the real first-load JS.
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = process.argv[2] ?? "out";
const CHUNK = /^\/_next\/static\/chunks\/[\w.-]+\.js$/;

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === "_next" ? [] : htmlFiles(p);
      return e.name.endsWith(".html") ? [p] : [];
    }),
  );
  return files.flat();
}

// Waits for the browser's real first-contentful-paint entry (the frame is presented),
// then loads the scripts in the next task. Fallbacks: rAF → setTimeout where paint
// timing is unsupported, and a 1.5 s timer (background tabs, no contentful paint).
const LOADER = `(function(){var d=document,l=JSON.parse(d.getElementById("kraguj-deferred-scripts").textContent),done=0;function go(){if(done)return;done=1;for(var i=0;i<l.length;i++){var s=d.createElement("script");s.src=l[i].src;if(l[i].id)s.id=l[i].id;s.async=true;d.body.appendChild(s)}}function soon(){setTimeout(go,0)}try{if(performance.getEntriesByName("first-contentful-paint").length)soon();else new PerformanceObserver(function(e,o){if(e.getEntriesByName("first-contentful-paint").length){o.disconnect();soon()}}).observe({type:"paint",buffered:true})}catch(x){requestAnimationFrame(soon)}setTimeout(go,1500)})();`;

let changed = 0;
for (const file of await htmlFiles(OUT)) {
  let html = await readFile(file, "utf8");
  if (html.includes('id="kraguj-deferred-scripts"')) continue;
  const scripts = [];
  // <script src="/_next/static/chunks/…js" [id="…"] async=""></script> — module scripts only (noModule stays).
  html = html.replace(/<script\b([^>]*)><\/script>/g, (tag, attrs) => {
    if (/\bnoModule\b/i.test(attrs)) return tag;
    const src = attrs.match(/\bsrc="([^"]+)"/)?.[1];
    if (!src || !CHUNK.test(src) || !/\basync\b/.test(attrs)) return tag;
    const id = attrs.match(/\bid="([^"]+)"/)?.[1];
    scripts.push(id ? { src, id } : { src });
    return "";
  });
  if (scripts.length === 0) continue;
  // The matching low-priority script preloads would still fetch the files early.
  html = html.replace(/<link rel="preload" as="script"[^>]*href="([^"]+)"[^>]*\/?>/g, (tag, href) =>
    scripts.some((s) => s.src === href) ? "" : tag,
  );
  const json = JSON.stringify(scripts).replace(/</g, "\\u003c");
  const inject = `<script id="kraguj-deferred-scripts" type="application/json">${json}</script><script>${LOADER}</script>`;
  if (!html.includes("</body>")) throw new Error(`${file}: no </body>`);
  html = html.replace("</body>", `${inject}</body>`);
  await writeFile(file, html);
  changed++;
  console.log(`defer-scripts: ${path.relative(OUT, file)} — ${scripts.length} scripts load after first paint`);
}
if (changed === 0) console.log("defer-scripts: nothing to rewrite");
