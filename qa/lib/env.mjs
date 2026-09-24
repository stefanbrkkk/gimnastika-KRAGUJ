// Shared QA configuration. Every script reads its paths/URLs from here so the
// whole toolchain can be pointed at another build (a variant, a scratch copy).
//
//   QA_OUT          static export to check            (default "out")
//   QA_BASE_URL     where that export is served       (default http://localhost:4173)
//   QA_SHOTS_DIR    screenshots                       (default qa/shots)
//   QA_TRACE_DIR    filmstrip / trace artefacts       (default qa/trace)
//   QA_RESULTS_DIR  per-script JSON results           (default qa/trace/results)
//   QA_VARIANT_OUT  MINOR_PHOTOS=false export (shots.mjs variant check; optional)
//   QA_VARIANT_PORT port for serving QA_VARIANT_OUT   (default 4174)
//   QA_AUTOSERVE    "0" = never start a static server when QA_BASE_URL is down
//   QA_REPORT_SUFFIX appended to the result name (e.g. ".minor-photos-off")
// Generated files stay in git-ignored paths (qa/shots, qa/trace, qa/lh*,
// qa/report.json) so Tailwind's source scan and ESLint never see them.
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Project root = the directory that contains qa/. */
export const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export const abs = (p) => (isAbsolute(p) ? p : join(ROOT, p));

export const OUT = abs(process.env.QA_OUT || "out");
export const BASE_URL = (process.env.QA_BASE_URL || "http://localhost:4173").replace(/\/+$/, "");
export const SHOTS_DIR = abs(process.env.QA_SHOTS_DIR || "qa/shots");
export const TRACE_DIR = abs(process.env.QA_TRACE_DIR || "qa/trace");
export const RESULTS_DIR = abs(process.env.QA_RESULTS_DIR || "qa/trace/results");
export const VARIANT_OUT = process.env.QA_VARIANT_OUT ? abs(process.env.QA_VARIANT_OUT) : null;
export const VARIANT_PORT = Number(process.env.QA_VARIANT_PORT || 4174);
export const AUTOSERVE = process.env.QA_AUTOSERVE !== "0";

/** Port of a base URL (explicit or the protocol default). */
export const portOf = (url) => {
  const u = new URL(url);
  return Number(u.port || (u.protocol === "https:" ? 443 : 80));
};

/**
 * content/site.ts and content/photos.ts have no imports, so Node's built-in
 * type stripping (Node >= 22.18) can load them directly. FLAGS are evaluated
 * with THIS process's env: pass the same NEXT_PUBLIC_* vars the build used.
 */
export async function loadSite() {
  return import(pathToFileURL(join(ROOT, "content/site.ts")).href);
}

export async function loadPhotos() {
  const { PHOTOS } = await import(pathToFileURL(join(ROOT, "content/photos.ts")).href);
  return PHOTOS;
}

export function requireOut(dir = OUT) {
  if (!existsSync(join(dir, "index.html"))) {
    throw new Error(`${dir}/index.html not found — run "npm run build" first (or set QA_OUT).`);
  }
  return dir;
}
