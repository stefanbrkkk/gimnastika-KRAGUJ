#!/usr/bin/env node
// The full §10 sequence (npm run qa):
//   npm run lint → npm test → build variants (MINOR_PHOTOS=false, INDEXABLE=true)
//   → npm run build (default, last, so out/ ends up as the default build)
//   → serve out/ on QA_PORT (4173) → bundle, content, shots (+ MINOR_PHOTOS=false
//   variant), trace, behavior, axe, lighthouse (+ SEO on the INDEXABLE=true variant)
//   → content checks on both variants → qa/report.json (+ printed summary, also in
//   qa/trace/summary.md). Exit code 1 when anything failed.
//
// Variants are built with NEXT_PUBLIC_* env overrides (DECISIONS D-07) and moved
// out of out/ into <variants dir>/<name>/out. The variants dir is qa/variants when
// both .gitignore and eslint.config.mjs ignore it (so Tailwind's source scan and
// `eslint .` never see built files), otherwise <os tmp>/gsu-kraguj-qa-variants.
// A pre-existing out/ is kept aside and restored if the default build fails.
//
// Env: QA_PORT (4173; variant servers use +1 and +2), QA_SKIP=lint,test,build,
//      variants,bundle,content,shots,trace,behavior,axe,lighthouse (comma list),
//      QA_VARIANTS_DIR, QA_LH_RUNS (3). Never run it while another process serves
//      out/ on QA_PORT (the run stops early and says so).
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { ROOT, abs } from "./lib/env.mjs";
import { isPortFree, startStatic } from "./lib/server.mjs";

const PORT = Number(process.env.QA_PORT || 4173);
const VARIANT_PORT = PORT + 1;
const SEO_PORT = PORT + 2;
const SKIP = new Set((process.env.QA_SKIP || "").split(",").map((s) => s.trim()).filter(Boolean));
const OUT = join(ROOT, "out");
const RESULTS_DIR = join(ROOT, "qa/trace/results");
const TRACE_DIR = join(ROOT, "qa/trace");

function variantsDir() {
  if (process.env.QA_VARIANTS_DIR) return abs(process.env.QA_VARIANTS_DIR);
  const read = (f) => (existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f), "utf8") : "");
  const ignored = /(^|\n)\/?qa\/variants\/?(\*\*)?\s*(\n|$)/.test(read(".gitignore")) && read("eslint.config.mjs").includes("qa/variants");
  return ignored ? join(ROOT, "qa/variants") : join(tmpdir(), "gsu-kraguj-qa-variants");
}

const VARIANTS = [
  { name: "minor-photos-off", env: { NEXT_PUBLIC_MINOR_PHOTOS: "false" } },
  { name: "indexable", env: { NEXT_PUBLIC_INDEXABLE: "true" } },
];

const steps = [];
const started = Date.now();

function run(cmd, args, env = {}) {
  return new Promise((resolve) => {
    const t = Date.now();
    const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: "inherit" });
    child.on("exit", (code) => resolve({ code: code ?? 1, ms: Date.now() - t }));
    child.on("error", () => resolve({ code: 1, ms: Date.now() - t }));
  });
}

async function command(id, cmd, args, env) {
  if (SKIP.has(id.split(":")[0])) {
    steps.push({ id, kind: "command", status: "skip" });
    return true;
  }
  console.log(`\n━━ ${id}: ${cmd} ${args.join(" ")}${env ? ` (${Object.entries(env).map(([k, v]) => `${k}=${v}`).join(" ")})` : ""}`);
  const { code, ms } = await run(cmd, args, env);
  steps.push({ id, kind: "command", status: code === 0 ? "pass" : "fail", exitCode: code, durationMs: ms });
  return code === 0;
}

async function check(id, script, env = {}) {
  const base = id.split(":")[0];
  if (SKIP.has(base)) {
    steps.push({ id, kind: "check", status: "skip" });
    return;
  }
  const suffix = id.includes(":") ? `.${id.split(":")[1]}` : "";
  const resultFile = join(RESULTS_DIR, `${base}${suffix}.json`);
  rmSync(resultFile, { force: true });
  const { code, ms } = await run(process.execPath, [join(ROOT, "qa", script)], { ...env, QA_REPORT_SUFFIX: suffix, QA_RESULTS_DIR: RESULTS_DIR });
  const result = existsSync(resultFile) ? JSON.parse(readFileSync(resultFile, "utf8")) : null;
  steps.push({
    id,
    kind: "check",
    status: code === 0 && result?.ok ? "pass" : "fail",
    exitCode: code,
    durationMs: ms,
    counts: result?.counts,
    failures: result?.checks.filter((c) => c.status === "fail").map((c) => `${c.id}: ${c.message}`),
    warnings: result?.checks.filter((c) => c.status === "warn").map((c) => `${c.id}: ${c.message}`),
    result,
  });
}

function move(from, to) {
  rmSync(to, { recursive: true, force: true });
  mkdirSync(join(to, ".."), { recursive: true });
  try {
    renameSync(from, to);
  } catch {
    cpSync(from, to, { recursive: true });
    rmSync(from, { recursive: true, force: true });
  }
}

function summarise(vdir) {
  const get = (id) => steps.find((s) => s.id === id)?.result?.data;
  const lines = [];
  const bundle = get("bundle");
  const lh = get("lighthouse");
  const axeSteps = steps.find((s) => s.id === "axe")?.result?.checks ?? [];
  lines.push(`# QA report — ${new Date(started).toISOString()}`, "");
  lines.push("| step | status | time | notes |", "|---|---|---|---|");
  for (const s of steps) {
    const notes = s.counts ? `${s.counts.pass} pass, ${s.counts.fail} fail, ${s.counts.warn} warn, ${s.counts.skip} skip` : s.exitCode !== undefined ? `exit ${s.exitCode}` : "";
    lines.push(`| ${s.id} | ${s.status.toUpperCase()} | ${s.durationMs ? `${(s.durationMs / 1000).toFixed(1)} s` : "—"} | ${notes} |`);
  }
  lines.push("");
  if (bundle) {
    lines.push(`- First-load JS (module scripts): ${bundle.firstLoad?.moduleKB} KB gz (budget 160) · noModule polyfills: ${bundle.firstLoad?.noModuleKB} KB gz`);
    const anim = bundle.animationRuntime?.animationKB ?? bundle.animationStatic?.gzKB;
    lines.push(`- Initial animation chunk: ${anim} KB gz (budget 45) · hero SVG: ${bundle.heroSvg?.gzKB} KB gz (budget 22)`);
  }
  if (lh?.scores) lines.push(`- Lighthouse mobile: Performance ${lh.scores.performance} · Accessibility ${lh.scores.accessibility} · Best Practices ${lh.scores["best-practices"]} · SEO ${lh.seoIndexable ?? `${lh.scores.seo} (noindex build)`}${lh.seoIndexable !== undefined ? " (INDEXABLE=true build)" : ""}`);
  if (lh?.metrics) lines.push(`- LCP ${Math.round(lh.metrics.lcp)} ms · CLS ${lh.metrics.cls?.toFixed(3)} · TBT ${Math.round(lh.metrics.tbt)} ms`);
  if (axeSteps.length) lines.push(`- axe: ${axeSteps.filter((c) => c.id.startsWith("axe.") && !c.id.endsWith(".minor") && !c.id.endsWith(".review")).map((c) => `${c.id.slice(4)} ${c.status.toUpperCase()}`).join(" · ")}`);
  lines.push(`- Screenshots: qa/shots/ · filmstrips: qa/trace/ · Lighthouse: qa/lh.report.html · variants: ${relative(ROOT, vdir) || vdir}`);
  const failures = steps.flatMap((s) => (s.status === "fail" ? (s.failures?.length ? s.failures.map((f) => `${s.id} → ${f}`) : [`${s.id} → exit ${s.exitCode}`]) : []));
  const warnings = steps.flatMap((s) => (s.warnings ?? []).map((w) => `${s.id} → ${w}`));
  if (failures.length) lines.push("", "## Failures", ...failures.map((f) => `- ${f}`));
  if (warnings.length) lines.push("", "## Warnings", ...warnings.map((w) => `- ${w}`));
  return lines.join("\n");
}

async function main() {
  for (const p of [PORT, VARIANT_PORT, SEO_PORT]) {
    if (!(await isPortFree(p))) {
      console.error(`Port ${p} is in use. Stop the server on it (run-all serves out/ on ${PORT} itself) or set QA_PORT.`);
      process.exit(2);
    }
  }
  const vdir = variantsDir();
  console.log(`QA run in ${ROOT}\n  serving on ${PORT} (variants ${VARIANT_PORT}, SEO ${SEO_PORT}); variants → ${vdir}`);
  mkdirSync(TRACE_DIR, { recursive: true });
  rmSync(RESULTS_DIR, { recursive: true, force: true });
  let server = null;
  const backup = join(vdir, "_previous-out");
  let defaultBuilt = false;

  try {
    await command("lint", "npm", ["run", "lint"]);
    await command("test", "npm", ["test"]);

    if (!SKIP.has("build")) {
      if (existsSync(OUT)) move(OUT, backup);
      if (!SKIP.has("variants")) {
        for (const v of VARIANTS) {
          const ok = await command(`build:${v.name}`, "npm", ["run", "build"], v.env);
          if (ok && existsSync(OUT)) move(OUT, join(vdir, v.name, "out"));
          else rmSync(join(vdir, v.name, "out"), { recursive: true, force: true });
        }
      }
      defaultBuilt = await command("build", "npm", ["run", "build"]);
      if (!defaultBuilt) throw new Error("default build failed — checks need out/");
      rmSync(backup, { recursive: true, force: true });
    } else {
      defaultBuilt = existsSync(join(OUT, "index.html"));
      steps.push({ id: "build", kind: "command", status: "skip" });
      if (!defaultBuilt) throw new Error("QA_SKIP=build but out/index.html does not exist");
    }

    server = await startStatic(OUT, PORT);
    const base = { QA_OUT: OUT, QA_BASE_URL: server.url, QA_AUTOSERVE: "0" };
    const minorOut = join(vdir, "minor-photos-off", "out");
    const indexOut = join(vdir, "indexable", "out");
    const hasMinor = existsSync(join(minorOut, "index.html"));
    const hasIndex = existsSync(join(indexOut, "index.html"));

    await check("bundle", "bundle.mjs", base);
    await check("content", "content.mjs", base);
    await check("shots", "shots.mjs", { ...base, ...(hasMinor ? { QA_VARIANT_OUT: minorOut, QA_VARIANT_PORT: String(VARIANT_PORT) } : {}) });
    await check("trace", "trace.mjs", base);
    await check("behavior", "behavior.mjs", base);
    await check("axe", "axe.mjs", base);
    await check("lighthouse", "lighthouse.mjs", { ...base, ...(hasIndex ? { QA_LH_SEO_OUT: indexOut, QA_LH_SEO_PORT: String(SEO_PORT) } : {}) });
    if (!SKIP.has("variants")) {
      if (hasMinor) await check("content:minor-photos-off", "content.mjs", { QA_OUT: minorOut, ...VARIANTS[0].env });
      else steps.push({ id: "content:minor-photos-off", kind: "check", status: "fail", failures: ["variant build missing"] });
      if (hasIndex) await check("content:indexable", "content.mjs", { QA_OUT: indexOut, ...VARIANTS[1].env });
      else steps.push({ id: "content:indexable", kind: "check", status: "fail", failures: ["variant build missing"] });
    }
  } catch (err) {
    steps.push({ id: "run-all", kind: "command", status: "fail", failures: [err instanceof Error ? err.message : String(err)] });
  } finally {
    await server?.stop();
    if (!defaultBuilt && existsSync(backup)) {
      rmSync(OUT, { recursive: true, force: true });
      move(backup, OUT);
      console.log("Restored the previous out/ (the default build did not complete).");
    }
  }

  const ok = steps.every((s) => s.status !== "fail");
  const summary = summarise(vdir);
  const report = {
    ok,
    startedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started,
    root: ROOT,
    port: PORT,
    variantsDir: vdir,
    steps: steps.map((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== "result"))),
    results: Object.fromEntries(steps.filter((s) => s.result).map((s) => [s.id, s.result])),
    summary,
  };
  writeFileSync(join(ROOT, "qa/report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(TRACE_DIR, "summary.md"), `${summary}\n`);
  console.log(`\n${summary}\n\n${ok ? "QA PASSED" : "QA FAILED"} in ${((Date.now() - started) / 60000).toFixed(1)} min → qa/report.json`);
  process.exit(ok ? 0 : 1);
}

await main();
