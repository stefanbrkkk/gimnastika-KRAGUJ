// Exercises: assets-source/exercises/<id>.json → components/brand/exercises/<id>.generated.ts
// Each source is authored by tools/figure-rig/exercises.py: the frames of ONE continuous movement
// that ends exactly in an approved pose, every frame in that pose's own viewBox coordinates (earlier
// frames may lie outside the box). Every frame gets the pose family's svgo normalisation, so the
// last frame is byte-for-byte POSES[pose].d. One module per exercise, so a lazy chunk imports only
// its own. Checked here (the build fails otherwise): keys ascend and end on the last frame, ghosts
// are frames, every subpath is closed, the bounds hold every frame, placed key poses are the
// approved paths (keyOrigins), and the gzip budget. Deterministic. Run: npm run svg
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { optimize } from "svgo";
import { gzipSync } from "node:zlib";
import { svgoConfig } from "./svgo-config.mjs";

const SRC = "assets-source/exercises";
const POSE_SRC = "assets-source/poses";
const OUT = "components/brand/exercises";
/** gzip budget per module (bytes): the card exercises and the enrollment band's longer cartwheel. */
const GZ_MAX = 6 * 1024;
const GZ_MAX_BY_ID = { enrollCartwheel: 9 * 1024 };

const fail = (id, msg) => {
  throw new Error(`exercise ${id}: ${msg}`);
};

/** The path data of one <path> after the shared svgo pass (the pose family's normalisation). */
function normalise(d, viewBox, file) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path fill="currentColor" d="${d}"/></svg>`;
  const out = optimize(svg, { ...svgoConfig, path: file }).data;
  const m = out.match(/<path[^>]*\sd="([^"]+)"/);
  if (!m) throw new Error(`${file}: svgo dropped the path`);
  return m[1];
}

/** Absolute vertices of each subpath of a polyline path (M L H V Z, absolute or relative). */
function subpaths(d) {
  const t = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const out = [];
  let cur = null;
  let cmd = "";
  let x = 0;
  let y = 0;
  let i = 0;
  const n = () => parseFloat(t[i++]);
  while (i < t.length) {
    if (/[a-zA-Z]/.test(t[i])) cmd = t[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === "M") {
      [x, y] = rel ? [x + n(), y + n()] : [n(), n()];
      cur = { pts: [[x, y]], closed: false, start: [x, y] };
      out.push(cur);
      cmd = rel ? "l" : "L";
    } else if (C === "Z") {
      cur.closed = true;
      [x, y] = cur.start;
    } else if (C === "L") {
      [x, y] = rel ? [x + n(), y + n()] : [n(), n()];
      cur.pts.push([x, y]);
    } else if (C === "H") {
      x = rel ? x + n() : n();
      cur.pts.push([x, y]);
    } else if (C === "V") {
      y = rel ? y + n() : n();
      cur.pts.push([x, y]);
    } else throw new Error(`unexpected path command ${cmd}`);
  }
  return out;
}

const r1 = (v) => Math.round(v * 10) / 10;
const constName = (id) => `EXERCISE_${id.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}`;

async function poseSvg(pose) {
  const raw = await readFile(`${POSE_SRC}/${pose}.svg`, "utf8").catch(() => null);
  if (raw === null) return null;
  const svg = optimize(raw, { ...svgoConfig, path: `${pose}.svg` }).data;
  const d = svg.match(/<path[^>]*\sd="([^"]+)"/)?.[1];
  const vb = svg.match(/<svg[^>]*\sviewBox="([^"]*)"/)?.[1];
  return { d, vb };
}

const files = (await readdir(SRC).catch(() => [])).filter((f) => f.endsWith(".json")).sort();
await mkdir(OUT, { recursive: true });

for (const file of files) {
  const id = file.replace(/\.json$/, "");
  if (!/^[a-z][a-zA-Z0-9]*$/.test(id)) fail(id, "ids are camelCase identifiers");
  const src = JSON.parse(await readFile(`${SRC}/${file}`, "utf8"));
  if (src.id !== id) fail(id, `the file's id is "${src.id}"`);
  const pose = await poseSvg(src.pose);
  if (!pose) fail(id, `no approved pose "${src.pose}"`);

  const frames = src.frames.map((d, k) => normalise(d, pose.vb, `${id}#${k}`));
  const last = frames.length - 1;
  if (frames[last] !== pose.d) fail(id, `the last frame is not POSES.${src.pose}.d`);

  const { keys, ghosts } = src;
  if (!keys.length || keys.some((k, j) => !Number.isInteger(k) || k < 0 || (j && k <= keys[j - 1]))) fail(id, "keys must ascend");
  if (keys[keys.length - 1] !== last) fail(id, "the last key is the last frame");
  if (ghosts.some((g, j) => !Number.isInteger(g) || g < 0 || g >= last || (j && g <= ghosts[j - 1]))) fail(id, "ghosts must be earlier frames, ascending");

  // bounds: authored in the source; every normalised frame must lie inside them
  const [bx0, by0, bx1, by1] = src.bounds;
  frames.forEach((d, k) => {
    for (const s of subpaths(d)) {
      if (!s.closed || s.pts.length < 4) fail(id, `frame ${k} has an open or degenerate subpath`);
      for (const [x, y] of s.pts) {
        if (x < bx0 - 1e-6 || y < by0 - 1e-6 || x > bx1 + 1e-6 || y > by1 + 1e-6) fail(id, `frame ${k} leaves the bounds at ${x},${y}`);
      }
    }
  });

  // key poses placed in the exercise (keyOrigins): the approved drawing, only moved
  if (src.keyOrigins) {
    if (src.keyOrigins.length !== keys.length) fail(id, "one key origin per key");
    for (const [j, name] of (src.keyNames ?? []).entries()) {
      const approved = await poseSvg(name);
      if (!approved) continue;
      const [ox, oy] = src.keyOrigins[j];
      const a = subpaths(frames[keys[j]]).flatMap((s) => s.pts);
      const b = subpaths(approved.d).flatMap((s) => s.pts);
      const same = a.length === b.length && a.every(([x, y], q) => Math.abs(x - ox - b[q][0]) < 1e-6 && Math.abs(y - oy - b[q][1]) < 1e-6);
      if (!same) fail(id, `key ${name} is not the approved ${name} placed at ${ox},${oy}`);
    }
  }

  const entry = [
    `  pose: ${JSON.stringify(src.pose)},`,
    "  frames: [",
    ...frames.map((d) => `    ${JSON.stringify(d)},`),
    "  ],",
    `  keys: [${keys.join(", ")}],`,
    `  ghosts: [${ghosts.join(", ")}],`,
  ];
  if (src.keyOrigins) entry.push(`  keyOrigins: [${src.keyOrigins.map(([x, y]) => `[${r1(x)}, ${r1(y)}]`).join(", ")}],`);
  entry.push(`  bounds: [${src.bounds.map(r1).join(", ")}],`);
  const names = src.keyNames ? `\n// Keys: ${src.keyNames.map((n, j) => `${keys[j]} ${n}`).join(" · ")}.` : "";
  const out = `// GENERATED by scripts/exercises.mjs — do not edit by hand.
// Source: assets-source/exercises/${file} (tools/figure-rig/exercises.py), svgo floatPrecision 1.
// ${src.note ?? `${id} → POSES.${src.pose}`}${names}

import type { ExerciseData } from "./types";

export const ${constName(id)} = {
${entry.join("\n")}
} as const satisfies ExerciseData;
`;
  const gz = gzipSync(Buffer.from(out), { level: 9 }).length;
  const budget = GZ_MAX_BY_ID[id] ?? GZ_MAX;
  if (gz > budget) fail(id, `${gz} B gzipped (budget ${budget} B)`);
  await writeFile(`${OUT}/${id}.generated.ts`, out);
  console.log(`exercise ${id}: ${frames.length} frames, keys ${keys.join(",")}, ghosts ${ghosts.join(",") || "-"} · ${out.length} B (${gz} B gz)`);
}
