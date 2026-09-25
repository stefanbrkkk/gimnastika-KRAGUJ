// postbuild: drop the duplicate CSS text from the inline RSC payload (DECISIONS.md D-32).
//
// With experimental.inlineCss (D-24) Next writes the whole stylesheet into the HTML three
// times: once as the <style data-href=…> in <head> (what the browser paints with) and twice
// more as text rows of the inline RSC payload (self.__next_f), for the page tree and for the
// root not-found boundary. Those rows only feed client-side navigation to a new stylesheet.
// On hydration React adopts the existing <style> by its data-href and never reads the text,
// and this one-page export has no client navigation. gzip's 32 KB window cannot see that the
// copies repeat, so they cost ~75 KB gz of every page (and Lighthouse LCP, which counts the
// whole document).
//
// The rewrite: parse the payload rows, turn every large text row that is only referenced as
// the children of a <style precedence href="….css"> into an empty-string row, and emit the
// payload again in the first push. Anything unexpected (unknown row shape, a reference used
// elsewhere) → the file is left untouched and the build fails, so a Next upgrade cannot
// silently ship a broken payload.
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = process.argv[2] ?? "out";
const MIN_BYTES = 4096;
const PUSH = /<script>self\.__next_f\.push\((\[1,"(?:[^"\\]|\\.)*"\])\)<\/script>/g;

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

/** Splits the payload into rows: { id, text: Buffer } for T rows, { id, line: Buffer } otherwise. */
function parseRows(buf) {
  const rows = [];
  let i = 0;
  while (i < buf.length) {
    const colon = buf.indexOf(0x3a, i); // ":"
    if (colon < 0) throw new Error(`row without id at byte ${i}`);
    const id = buf.subarray(i, colon).toString("latin1");
    // Hint rows (":HL[…]") have an empty id.
    if (!/^[0-9a-f]*$/.test(id)) throw new Error(`unexpected row id "${id.slice(0, 20)}" at byte ${i}`);
    if (id !== "" && buf[colon + 1] === 0x54) {
      // "T" + hex byte length + "," + exactly that many bytes (no terminator)
      const comma = buf.indexOf(0x2c, colon + 2);
      const len = parseInt(buf.subarray(colon + 2, comma).toString("latin1"), 16);
      if (!Number.isFinite(len)) throw new Error(`bad text row length for ${id}`);
      rows.push({ id, text: buf.subarray(comma + 1, comma + 1 + len) });
      i = comma + 1 + len;
    } else {
      const nl = buf.indexOf(0x0a, colon);
      const end = nl < 0 ? buf.length : nl + 1;
      rows.push({ id, line: buf.subarray(i, end) });
      i = end;
    }
  }
  return rows;
}

const escapeForScript = (s) =>
  s.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

let saved = 0;
for (const file of await htmlFiles(OUT)) {
  const html = await readFile(file, "utf8");
  const pushes = [...html.matchAll(PUSH)];
  if (pushes.length === 0) continue;
  const payload = Buffer.from(pushes.map((m) => JSON.parse(m[1])[1]).join(""), "utf8");
  const rows = parseRows(payload);
  const all = payload.toString("utf8");

  const stripped = new Set();
  for (const row of rows) {
    if (!row.text || row.text.length < MIN_BYTES) continue;
    const ref = `"$${row.id}"`;
    const styleRef = new RegExp(`\\["\\$","style","[^"]*",\\{[^{}]*"precedence":"[^"]+","href":"[^"]+\\.css","children":"\\$${row.id}"\\}\\]`, "g");
    const uses = all.split(ref).length - 1;
    const styleUses = (all.match(styleRef) ?? []).length;
    if (uses > 0 && uses === styleUses && /^\s*[@.:*#\[a-z]/i.test(row.text.subarray(0, 64).toString("utf8"))) stripped.add(row.id);
  }
  if (stripped.size === 0) continue;

  const out = Buffer.concat(
    rows.map((row) => {
      if (row.line) return row.line;
      if (stripped.has(row.id)) return Buffer.from(`${row.id}:""\n`, "utf8");
      return Buffer.concat([Buffer.from(`${row.id}:T${row.text.length.toString(16)},`, "utf8"), row.text]);
    }),
  );
  // Round-trip check: re-parsing the result must give the same rows minus the stripped text.
  const check = parseRows(out);
  if (check.length !== rows.length || check.some((r, k) => r.id !== rows[k].id)) throw new Error(`${file}: payload round-trip failed`);

  const first = `<script>self.__next_f.push(${escapeForScript(JSON.stringify([1, out.toString("utf8")]))})</script>`;
  let n = 0;
  const next = html.replace(PUSH, () => (n++ === 0 ? first : ""));
  saved += Buffer.byteLength(html) - Buffer.byteLength(next);
  await writeFile(file, next);
  console.log(`slim-flight: ${path.relative(OUT, file)} — ${stripped.size} CSS text row(s) emptied, ${pushes.length} pushes → 1`);
}
console.log(`slim-flight: ${Math.round(saved / 1024)} KB removed in total`);
