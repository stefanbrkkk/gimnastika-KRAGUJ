#!/usr/bin/env node
// §6/§7 bundle budgets, measured on the static export (gzip level 9):
//   1. First-load JS for "/" = every <script src> in <out>/index.html.
//      Module scripts are budgeted (≤160 KB gz, DECISIONS D-08); the noModule
//      polyfill chunk is reported separately (module browsers never fetch it).
//   2. Initial animation chunk (≤45 KB gz, D-09): the lazily loaded chunks that
//      carry GSAP core / MotionPathPlugin / CustomEase / the hero intro.
//      Static: identified by content signature. Runtime (when QA_BASE_URL is up
//      or can be served): chunks with GSAP code requested before
//      performance.mark("kraguj:intro-start") at 1440×900.
//   3. Hero SVG (≤22 KB gz): every <svg> inside section#top + the inline sprite.
// Env: QA_OUT, QA_BASE_URL, QA_BUNDLE_RUNTIME=0 (skip the browser measurement).
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { BASE_URL, OUT, requireOut } from "./lib/env.mjs";
import { extractAll, extractElement, gz, kb, scriptTags, tags, walk } from "./lib/html.mjs";
import { runScript } from "./lib/report.mjs";

const BUDGET = { moduleJs: 160, animation: 45, heroSvg: 22 };

/** Content signatures (the minifier keeps these strings). */
const SIGNATURES = {
  gsapCore: /GreenSockGlobals|GSAP target /,
  motionPath: /name:\s*"motionPath"/,
  customEase: /\bCustomEase\b/,
  scrollTrigger: /\bScrollTrigger\b/,
  heroIntro: /kraguj:intro-start/,
  gsapAny: /\b_gsap\b/,
};

const fileForSrc = (src) => join(OUT, decodeURIComponent(new URL(src, "http://x/").pathname));

function sizeOf(file) {
  const buf = readFileSync(file);
  return { raw: buf.length, gz: gz(buf) };
}

async function runtimeAnimationSet(report, initialFiles, chunkInfo) {
  const { ensureServed } = await import("./lib/server.mjs");
  const { launch } = await import("./lib/browser.mjs");
  const server = await ensureServed(BASE_URL, OUT);
  if (server.matchesOut === false) throw new Error(`${BASE_URL} serves a different build than ${OUT} — stop that server or set QA_BASE_URL to a free port`);
  const browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${server.url}/`, { waitUntil: "load" });
    const introStart = await page
      .waitForFunction(() => performance.getEntriesByName("kraguj:intro-start")[0]?.startTime ?? null, null, { timeout: 6000 })
      .then((h) => h.jsonValue())
      .catch(() => null);
    await page.waitForTimeout(2500);
    const entries = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((e) => new URL(e.name).pathname.endsWith(".js"))
        .map((e) => ({ path: new URL(e.name).pathname, start: e.startTime })),
    );
    await context.close();
    const lazy = entries.filter((e) => !initialFiles.has(e.path));
    const before = introStart === null ? [] : lazy.filter((e) => e.start <= introStart);
    const animation = before.filter((e) => {
      const info = chunkInfo.get(e.path);
      return info && (info.sig.gsapAny || info.sig.gsapCore || info.sig.heroIntro);
    });
    return {
      introStart,
      lazyBeforeIntro: before.map((e) => e.path),
      lazyAfterIntro: lazy.filter((e) => introStart === null || e.start > introStart).map((e) => e.path),
      animation: animation.map((e) => ({ path: e.path, gzKB: kb(chunkInfo.get(e.path)?.gz ?? 0) })),
      animationGz: animation.reduce((n, e) => n + (chunkInfo.get(e.path)?.gz ?? 0), 0),
    };
  } finally {
    await browser.close();
    await server.stop();
  }
}

await runScript("bundle", { target: OUT }, async (report) => {
  requireOut();
  const html = readFileSync(join(OUT, "index.html"), "utf8");

  // 1 ─ first-load JS ─────────────────────────────────────────────────────────
  const scripts = scriptTags(html).filter((s) => s.attrs.src);
  const rows = scripts.map((s) => {
    const file = fileForSrc(s.attrs.src);
    const nomodule = "nomodule" in s.attrs;
    return { src: s.attrs.src, nomodule, exists: existsSync(file), ...(existsSync(file) ? sizeOf(file) : { raw: 0, gz: 0 }) };
  });
  for (const r of rows.filter((x) => !x.exists)) report.fail("scripts.exist", `${r.src} is referenced by index.html but missing from ${relative(process.cwd(), OUT)}`);
  const modules = rows.filter((r) => !r.nomodule);
  const legacy = rows.filter((r) => r.nomodule);
  const moduleGz = modules.reduce((n, r) => n + r.gz, 0);
  const legacyGz = legacy.reduce((n, r) => n + r.gz, 0);
  report.data.firstLoad = {
    moduleKB: kb(moduleGz),
    noModuleKB: kb(legacyGz),
    totalKB: kb(moduleGz + legacyGz),
    scripts: rows.map((r) => ({ src: r.src, nomodule: r.nomodule, rawKB: kb(r.raw), gzKB: kb(r.gz) })),
  };
  for (const r of rows) report.info("script", `${r.nomodule ? "nomodule" : "module  "} ${kb(r.gz).toFixed(1).padStart(6)} KB gz  ${r.src}`);
  report.check("firstLoad.module", moduleGz <= BUDGET.moduleJs * 1024, `module scripts ${kb(moduleGz)} KB gz (budget ≤${BUDGET.moduleJs} KB)`, report.data.firstLoad);
  report.info("firstLoad.noModule", `noModule polyfills ${kb(legacyGz)} KB gz (not budgeted, D-08); with them: ${kb(moduleGz + legacyGz)} KB`);
  const preloads = tags(html, "link").filter((l) => (l.rel === "preload" || l.rel === "modulepreload") && /\.js($|\?)/.test(l.href ?? ""));
  const extraPreloads = preloads.filter((l) => !rows.some((r) => r.src === l.href));
  if (extraPreloads.length) report.info("preloads", `${extraPreloads.length} preloaded script(s) not in <script src>`, extraPreloads.map((l) => l.href));

  const css = tags(html, "link").filter((l) => l.rel === "stylesheet" && l.href);
  const cssGz = css.reduce((n, l) => n + (existsSync(fileForSrc(l.href)) ? sizeOf(fileForSrc(l.href)).gz : 0), 0);
  report.data.cssKB = kb(cssGz);
  report.info("css", `render-blocking CSS ${kb(cssGz)} KB gz (${css.length} file(s))`);

  // 2 ─ animation chunk ───────────────────────────────────────────────────────
  const chunkDir = join(OUT, "_next/static/chunks");
  const initialFiles = new Set(rows.map((r) => new URL(r.src, "http://x/").pathname));
  const chunkInfo = new Map();
  for (const file of walk(chunkDir).filter((f) => f.endsWith(".js"))) {
    const text = readFileSync(file, "utf8");
    const path = `/${relative(OUT, file).split("\\").join("/")}`;
    const sig = Object.fromEntries(Object.entries(SIGNATURES).map(([k, re]) => [k, re.test(text)]));
    chunkInfo.set(path, { path, gz: gz(Buffer.from(text)), raw: statSync(file).size, sig, initial: initialFiles.has(path) });
  }
  const gsapInInitial = [...chunkInfo.values()].filter((c) => c.initial && (c.sig.gsapCore || c.sig.gsapAny));
  report.check("gsap.notInFirstLoad", gsapInInitial.length === 0, "GSAP is not part of the first-load scripts (D-09)", gsapInInitial.map((c) => c.path));

  const staticSet = [...chunkInfo.values()].filter((c) => !c.initial && (c.sig.gsapCore || c.sig.motionPath || c.sig.heroIntro));
  const core = [...chunkInfo.values()].filter((c) => c.sig.gsapCore).sort((a, b) => b.gz - a.gz);
  report.data.gsapChunks = [...chunkInfo.values()]
    .filter((c) => c.sig.gsapAny || c.sig.gsapCore)
    .sort((a, b) => b.gz - a.gz)
    .map((c) => ({ path: c.path, gzKB: kb(c.gz), signatures: Object.keys(c.sig).filter((k) => c.sig[k]) }));
  if (core[0]) report.info("gsap.core", `largest lazy chunk with GSAP core: ${core[0].path} ${kb(core[0].gz)} KB gz`, core[0].sig);
  else report.warn("gsap.core", "no chunk with a GSAP core signature found (GreenSockGlobals / \"GSAP target \")");
  const staticGz = staticSet.reduce((n, c) => n + c.gz, 0);
  report.data.animationStatic = { gzKB: kb(staticGz), chunks: staticSet.map((c) => ({ path: c.path, gzKB: kb(c.gz), signatures: Object.keys(c.sig).filter((k) => c.sig[k]) })) };
  report.info("animation.static", `GSAP core + MotionPath + hero intro chunks (signature scan): ${kb(staticGz)} KB gz in ${staticSet.length} chunk(s)`, report.data.animationStatic.chunks);

  let runtime = null;
  if (process.env.QA_BUNDLE_RUNTIME !== "0") {
    try {
      runtime = await runtimeAnimationSet(report, initialFiles, chunkInfo);
      report.data.animationRuntime = { ...runtime, animationKB: kb(runtime.animationGz) };
      if (runtime.introStart === null) report.warn("animation.runtime", "no kraguj:intro-start mark within 6 s at 1440×900 — runtime set unavailable");
      else report.info("animation.runtime", `GSAP/hero chunks requested before intro-start: ${kb(runtime.animationGz)} KB gz`, runtime.animation);
    } catch (err) {
      report.skip("animation.runtime", `runtime measurement skipped: ${err instanceof Error ? err.message : err}`);
    }
  }
  const measured = runtime && runtime.introStart !== null ? runtime.animationGz : staticGz;
  report.check(
    "animation.budget",
    measured <= BUDGET.animation * 1024,
    `initial animation chunk ${kb(measured)} KB gz (${runtime && runtime.introStart !== null ? "runtime" : "static"}; budget ≤${BUDGET.animation} KB)`,
    runtime?.animation ?? report.data.animationStatic.chunks,
  );

  // 3 ─ hero SVG ──────────────────────────────────────────────────────────────
  const hero = extractElement(html, "section", /\bid="top"/);
  const sprite = extractAll(html, "svg").find((s) => /<symbol\b[^>]*\bid="leap"/.test(s));
  if (!hero) report.fail("heroSvg.section", 'section#top not found in index.html');
  if (!sprite) report.fail("heroSvg.sprite", 'inline sprite with <symbol id="leap"> not found in index.html');
  if (hero && sprite) {
    const heroSvgs = extractAll(hero, "svg");
    const joined = [sprite, ...heroSvgs].join("");
    const svgGz = gz(Buffer.from(joined));
    report.data.heroSvg = { gzKB: kb(svgGz), rawKB: kb(Buffer.byteLength(joined)), heroSvgCount: heroSvgs.length, spriteGzKB: kb(gz(Buffer.from(sprite))) };
    report.check("heroSvg.budget", svgGz <= BUDGET.heroSvg * 1024, `hero SVG ${kb(svgGz)} KB gz (sprite ${report.data.heroSvg.spriteGzKB} KB + ${heroSvgs.length} svg in #top; budget ≤${BUDGET.heroSvg} KB)`);
  }
});
