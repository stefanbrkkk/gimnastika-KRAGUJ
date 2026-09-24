// Tiny, dependency-free HTML helpers for scanning the static export.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

export const gz = (buf) => gzipSync(buf, { level: 9 }).length;
export const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;

/** Recursively lists files under dir (absolute paths). */
export function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else out.push(p);
  }
  return out;
}

const ATTR_RE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

export function parseAttrs(src) {
  const attrs = {};
  for (const m of src.matchAll(ATTR_RE)) attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  return attrs;
}

/** Every <script> start tag with its attributes (and inline body). */
export function scriptTags(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map((m) => ({ attrs: parseAttrs(m[1]), body: m[2] }));
}

export function jsonLdBlocks(html) {
  return scriptTags(html)
    .filter((s) => (s.attrs.type || "").toLowerCase() === "application/ld+json")
    .map((s) => s.body);
}

/** Start tags of <tag> with attributes. */
export function tags(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "gi"))].map((m) => parseAttrs(m[1]));
}

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return NAMED[e.toLowerCase()] ?? all;
  });
}

/**
 * outerHTML of the first <tag …> element at or after `from` whose start tag
 * matches `startRe`, honouring nesting of the same tag name.
 */
export function extractElement(html, tag, startRe, from = 0) {
  const re = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  re.lastIndex = from;
  let start = -1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (startRe.test(m[0])) {
      start = m.index;
      break;
    }
  }
  if (start < 0) return null;
  const any = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, "gi");
  any.lastIndex = start;
  let depth = 0;
  for (let m = any.exec(html); m; m = any.exec(html)) {
    if (m[1]) depth -= 1;
    else if (!m[2]) depth += 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  return null;
}

/** All top-level <tag> elements inside a chunk of HTML. */
export function extractAll(html, tag) {
  const out = [];
  const re = new RegExp(`<${tag}\\b`, "gi");
  let from = 0;
  for (;;) {
    re.lastIndex = from;
    const m = re.exec(html);
    if (!m) break;
    const el = extractElement(html, tag, /./, m.index);
    if (!el) break;
    out.push(el);
    from = m.index + el.length;
  }
  return out;
}

/** Visible-ish text: drops <script>/<style>/<template>, tags → spaces, decodes entities. */
export function textOf(html) {
  return decodeEntities(
    html
      .replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
}

export const readText = (p) => readFileSync(p, "utf8");
