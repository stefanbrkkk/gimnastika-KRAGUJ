import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Chromium ignores var() in a keyframe's animation-timing-function and plays that
 * segment linear, so the wobble/swing/spring/land vocabulary silently disappears on
 * Chrome and Android (design review round 2, MD2-01/02). Inside @keyframes, easings
 * must be literal values (copy them from styles/motion-tokens.css / globals.css).
 */
const ROOTS = ["app", "styles"];

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return cssFiles(p);
    return e.name.endsWith(".css") ? [p] : [];
  });
}

/** Every @keyframes block with its source text (brace-matched). */
function keyframeBlocks(css: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /@keyframes\s+([\w-]+)\s*\{/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    let depth = 1;
    let i = re.lastIndex;
    while (depth > 0 && i < css.length) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    out.push({ name: m[1] ?? "", body: css.slice(m.index, i) });
  }
  return out;
}

describe("CSS keyframes", () => {
  const files = ROOTS.flatMap((r) => cssFiles(r));

  it("finds the stylesheets", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files)("%s: no var() easing inside @keyframes", (file) => {
    const offenders = keyframeBlocks(readFileSync(file, "utf8"))
      .filter((k) => /animation-timing-function\s*:\s*var\(/.test(k.body))
      .map((k) => k.name);
    expect(offenders).toEqual([]);
  });
});
