#!/usr/bin/env node
// §7 Lighthouse (mobile): Performance ≥ 90, Accessibility 100, Best Practices ≥ 95,
// SEO 100 — SEO measured on an INDEXABLE=true build (the default build is noindex,
// which fails Lighthouse's "is-crawlable" audit by design).
// Uses Playwright's Chromium via CHROME_PATH and the §10 flags:
//   --form-factor=mobile --chrome-flags="--headless=new --no-sandbox"
// Reports: qa/lh.report.html + qa/lh.report.json (the median-performance run),
// every run under qa/lh-runs/, SEO run under qa/lh-seo.report.*.
// Env: QA_LH_RUNS (default 3; the median Performance run is used),
//      QA_LH_SEO_URL (an already served INDEXABLE=true build) or
//      QA_LH_SEO_OUT (a directory with one; served on QA_LH_SEO_PORT, default 4175).
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { BASE_URL, OUT, ROOT, abs, requireOut } from "./lib/env.mjs";
import { runScript } from "./lib/report.mjs";
import { ensureServed, startStatic } from "./lib/server.mjs";

const RUNS = Math.max(1, Number(process.env.QA_LH_RUNS || 3));
const LH_DIR = join(ROOT, "qa");
const TARGET = { performance: 0.9, accessibility: 1, "best-practices": 0.95, seo: 1 };

function lighthouse(url, outBase, categories) {
  return new Promise((resolve, reject) => {
    const args = [
      url,
      "--form-factor=mobile",
      "--chrome-flags=--headless=new --no-sandbox",
      "--output=html",
      "--output=json",
      `--output-path=${outBase}`,
      `--only-categories=${categories.join(",")}`,
      "--quiet",
    ];
    const child = spawn(join(ROOT, "node_modules/.bin/lighthouse"), args, {
      env: { ...process.env, CHROME_PATH: chromium.executablePath() },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
    child.on("exit", (code) => {
      const json = `${outBase}.report.json`;
      if (code !== 0 || !existsSync(json)) return reject(new Error(`lighthouse exited ${code}: ${log.trim().slice(-600)}`));
      resolve({ json, html: `${outBase}.report.html`, lhr: JSON.parse(readFileSync(json, "utf8")) });
    });
  });
}

const score = (lhr, cat) => (lhr.categories[cat] ? Math.round(lhr.categories[cat].score * 100) : null);
const failingAudits = (lhr, cat) =>
  (lhr.categories[cat]?.auditRefs ?? [])
    .filter((ref) => ref.weight > 0 && lhr.audits[ref.id]?.score !== null && lhr.audits[ref.id]?.score < 1)
    .map((ref) => `${ref.id} (${lhr.audits[ref.id].score})`);

await runScript("lighthouse", { target: BASE_URL }, async (report) => {
  requireOut();
  mkdirSync(join(LH_DIR, "lh-runs"), { recursive: true });
  const server = await ensureServed(BASE_URL, OUT);
  if (server.matchesOut === false) throw new Error(`${BASE_URL} serves a different build than ${OUT} — stop that server or set QA_BASE_URL to a free port`);
  const runs = [];
  try {
    for (let i = 1; i <= RUNS; i++) {
      const r = await lighthouse(`${server.url}/`, join(LH_DIR, "lh-runs", `run-${i}`), ["performance", "accessibility", "best-practices", "seo"]);
      runs.push(r);
      report.info(`run.${i}`, ["performance", "accessibility", "best-practices", "seo"].map((c) => `${c} ${score(r.lhr, c)}`).join(" · "));
    }
  } finally {
    await server.stop();
  }
  const sorted = [...runs].sort((a, b) => score(a.lhr, "performance") - score(b.lhr, "performance"));
  const median = sorted[Math.floor((sorted.length - 1) / 2)];
  copyFileSync(median.json, join(LH_DIR, "lh.report.json"));
  copyFileSync(median.html, join(LH_DIR, "lh.report.html"));
  report.artifact(join(LH_DIR, "lh.report.html"));
  const lhr = median.lhr;
  const metric = (id) => lhr.audits[id]?.numericValue ?? null;
  const metrics = { lcp: metric("largest-contentful-paint"), cls: metric("cumulative-layout-shift"), tbt: metric("total-blocking-time"), fcp: metric("first-contentful-paint"), si: metric("speed-index") };
  report.data.scores = Object.fromEntries(Object.keys(TARGET).map((c) => [c, score(lhr, c)]));
  report.data.metrics = metrics;
  report.data.runs = runs.map((r) => Object.fromEntries(Object.keys(TARGET).map((c) => [c, score(r.lhr, c)])));

  for (const cat of ["performance", "accessibility", "best-practices"]) {
    const s = score(lhr, cat);
    report.check(`score.${cat}`, s !== null && s >= TARGET[cat] * 100, `${cat} ${s} (target ≥${TARGET[cat] * 100}${cat === "performance" ? `, median of ${runs.length}` : ""})`, failingAudits(lhr, cat));
  }
  report.check("metric.lcp", metrics.lcp !== null && metrics.lcp <= 2500, `LCP ${Math.round(metrics.lcp)} ms (hard ≤2500)`);
  if (metrics.lcp !== null && metrics.lcp > 2000 && metrics.lcp <= 2500) report.warn("metric.lcp.target", `LCP ${Math.round(metrics.lcp)} ms is above the 2000 ms target`);
  const lcpParts = lhr.audits["lcp-breakdown-insight"]?.details?.items ?? [];
  const lcpNode = lcpParts.find((i) => i.type === "node");
  const lcpTable = lcpParts.find((i) => i.type === "table")?.items ?? [];
  if (lcpNode) report.info("metric.lcp.element", `LCP element: ${lcpNode.selector} „${lcpNode.nodeLabel}“`, lcpTable.map((p) => `${p.label} ${Math.round(p.duration)} ms`));
  report.check("metric.cls", metrics.cls !== null && metrics.cls <= 0.05, `CLS ${metrics.cls?.toFixed(3)} (≤0.05)`);
  report.check("metric.tbt", metrics.tbt !== null && metrics.tbt <= 150, `TBT ${Math.round(metrics.tbt)} ms (≤150)`);

  // SEO: asserted on an INDEXABLE=true build only.
  const seoDefault = score(lhr, "seo");
  const seoFails = failingAudits(lhr, "seo");
  const unexpected = seoFails.filter((a) => !a.startsWith("is-crawlable"));
  report.check("seo.defaultBuild", unexpected.length === 0, `default (noindex) build SEO ${seoDefault}; failing audits other than is-crawlable: ${unexpected.length}`, seoFails);

  let seoUrl = process.env.QA_LH_SEO_URL || null;
  let seoServer = null;
  if (!seoUrl && process.env.QA_LH_SEO_OUT) {
    const dir = abs(process.env.QA_LH_SEO_OUT);
    seoServer = await startStatic(dir, Number(process.env.QA_LH_SEO_PORT || 4175));
    seoUrl = seoServer.url;
  }
  if (!seoUrl) {
    report.skip("score.seo", "SEO 100 is asserted on an INDEXABLE=true build: set QA_LH_SEO_OUT or QA_LH_SEO_URL (run-all.mjs does)");
    return;
  }
  try {
    const seo = await lighthouse(`${seoUrl.replace(/\/+$/, "")}/`, join(LH_DIR, "lh-seo"), ["seo"]);
    report.artifact(seo.html);
    report.data.seoIndexable = score(seo.lhr, "seo");
    report.check("score.seo", score(seo.lhr, "seo") === 100, `SEO ${score(seo.lhr, "seo")} on the INDEXABLE=true build (target 100)`, failingAudits(seo.lhr, "seo"));
  } finally {
    await seoServer?.stop();
  }
});
