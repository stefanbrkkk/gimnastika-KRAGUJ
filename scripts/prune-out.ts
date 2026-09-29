// postbuild: removes photo files from out/ that the current flags hide, so a
// hidden photo is not reachable at a guessable URL either (noindex ≠ consent).
// Runs with Node's built-in type stripping (Node ≥ 22.18).
import { readdir, rm } from "node:fs/promises";
import { FLAGS } from "../content/site.ts";
import { PHOTOS, mayPublishPhoto } from "../content/photos.ts";

const OUT = "out/img";
const hidden = Object.values(PHOTOS).filter(
  (p) => !mayPublishPhoto(p, FLAGS),
);
let files: string[];
try {
  files = await readdir(OUT);
} catch {
  throw new Error(`prune-out: ${OUT} is missing — the static export did not produce images; refusing to pass silently`);
}
let removed = 0;
for (const p of hidden) {
  for (const f of files.filter((f) => f.startsWith(`${p.slug}-`))) {
    await rm(`${OUT}/${f}`);
    removed++;
  }
}
console.log(`prune-out: ${hidden.length} hidden photos (${hidden.map((p) => p.id).join(", ") || "none"}), ${removed} files removed from ${OUT}`);
