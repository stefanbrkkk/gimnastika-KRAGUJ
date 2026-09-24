// Result collector shared by every qa/*.mjs script.
//
// A check has a severity: "fail" (breaks the run), "warn" (printed, never breaks
// the run), "info" (numbers/lists for the report), "skip" (could not run, with a
// reason). Each script writes <RESULTS_DIR>/<name>.json and sets the exit code.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { RESULTS_DIR, ROOT } from "./env.mjs";

const TTY = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (TTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const LABEL = {
  pass: paint(32, "PASS"),
  fail: paint(31, "FAIL"),
  warn: paint(33, "WARN"),
  info: paint(36, "INFO"),
  skip: paint(90, "SKIP"),
};

const short = (value, max = 600) => {
  if (value === undefined) return undefined;
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

export function createReport(baseName, meta = {}) {
  const name = `${baseName}${process.env.QA_REPORT_SUFFIX ?? ""}`;
  const started = Date.now();
  const checks = [];
  const artifacts = [];
  const data = {};

  const add = (status, id, message, details) => {
    checks.push({ id, status, message, ...(details === undefined ? {} : { details }) });
    const line = `  ${LABEL[status]}  ${id}${message ? ` — ${message}` : ""}`;
    console.log(line);
    if (details !== undefined && (status === "fail" || status === "warn" || process.env.QA_VERBOSE)) {
      console.log(`        ${short(details)}`);
    }
  };

  console.log(`\n[qa:${name}]${meta.target ? ` ${meta.target}` : ""}`);

  const report = {
    name,
    data,
    pass: (id, message, details) => add("pass", id, message, details),
    fail: (id, message, details) => add("fail", id, message, details),
    warn: (id, message, details) => add("warn", id, message, details),
    info: (id, message, details) => add("info", id, message, details),
    skip: (id, message, details) => add("skip", id, message, details),
    /** ok → pass, else fail (or warn with {severity:"warn"}). Returns ok. */
    check(id, ok, message, details, { severity = "fail" } = {}) {
      add(ok ? "pass" : severity, id, message, ok ? undefined : details);
      return ok;
    },
    artifact(path) {
      artifacts.push(relative(ROOT, path));
    },
    get failed() {
      return checks.some((c) => c.status === "fail");
    },
    finish() {
      const counts = Object.fromEntries(["pass", "fail", "warn", "skip", "info"].map((s) => [s, checks.filter((c) => c.status === s).length]));
      const result = {
        name,
        ok: counts.fail === 0,
        startedAt: new Date(started).toISOString(),
        durationMs: Date.now() - started,
        meta,
        counts,
        checks,
        data,
        artifacts,
      };
      mkdirSync(RESULTS_DIR, { recursive: true });
      const file = join(RESULTS_DIR, `${name}.json`);
      writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
      const verdict = result.ok ? paint(32, "OK") : paint(31, "FAILED");
      console.log(
        `[qa:${name}] ${verdict} — ${counts.pass} pass, ${counts.fail} fail, ${counts.warn} warn, ${counts.skip} skip (${(result.durationMs / 1000).toFixed(1)} s) → ${relative(ROOT, file)}`,
      );
      if (!result.ok) {
        console.log("  Failures:");
        for (const c of checks.filter((x) => x.status === "fail")) console.log(`   - ${c.id}: ${c.message ?? ""}`);
      }
      process.exitCode = result.ok ? 0 : 1;
      return result;
    },
  };
  return report;
}

/**
 * Runs a script body with a report; any thrown error becomes a "crash" failure
 * (the script still writes its JSON and exits non-zero).
 */
export async function runScript(name, meta, body) {
  const report = createReport(name, meta);
  try {
    await body(report);
  } catch (err) {
    report.fail("crash", err instanceof Error ? err.message : String(err), err instanceof Error ? err.stack : undefined);
  }
  return report.finish();
}
