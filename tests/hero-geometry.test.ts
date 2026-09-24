import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { describe, expect, it } from "vitest";
import { ALIGN_ORIGIN, GHOST_P, LEAP_BOX, LEAP_IN_LOGO } from "@/components/sections/hero/constants";
import { COMPACT, COMPACT_SPEC, WIDE, WIDE_SPEC, positionAt } from "@/components/sections/hero/geometry";

/** Where gsap's MotionPathPlugin resolves `end: p` on a path string (its own utilities). */
function gsapPointAt(d: string, p: number) {
  const raw = MotionPathPlugin.stringToRawPath(d);
  const sliced = MotionPathPlugin.sliceRawPath(raw, 0, p);
  MotionPathPlugin.cacheRawPathMeasurements(sliced);
  return MotionPathPlugin.getPositionOnPath(sliced, 1) as { x: number; y: number };
}

describe.each([
  ["compact", COMPACT, COMPACT_SPEC],
  ["wide", WIDE, WIDE_SPEC],
] as const)("hero art geometry — %s", (_name, variant, spec) => {
  const ox = ALIGN_ORIGIN[0] * LEAP_BOX.width;
  const oy = ALIGN_ORIGIN[1] * LEAP_BOX.height;

  it("places every ghost frame exactly where gsap.set(motionPath {end: p}) puts it", () => {
    GHOST_P.forEach((p, i) => {
      const g = gsapPointAt(variant.d, p);
      const [tx, ty] = variant.ghosts[i]!;
      expect(Math.abs(tx + ox - g.x)).toBeLessThan(0.01);
      expect(Math.abs(ty + oy - g.y)).toBeLessThan(0.01);
    });
  });

  it("lands the silhouette exactly at its position inside the logo (p = 1)", () => {
    const end = gsapPointAt(variant.d, 1);
    expect(variant.landed).toEqual([spec.logo[0] + LEAP_IN_LOGO.x, spec.logo[1] + LEAP_IN_LOGO.y]);
    expect(end.x - ox).toBeCloseTo(variant.landed[0], 2);
    expect(end.y - oy).toBeCloseTo(variant.landed[1], 2);
  });

  it("takes off from the mat line and keeps the logo standing on it", () => {
    const [x0, y0] = positionAt([...variant.d.replace(/[MC]/g, " ").trim().split(/\s+/).map(Number)], 0);
    expect(x0).toBe(spec.takeoffX);
    // the silhouette's lowest ink (146.7 units below its box top) touches the mat
    expect(y0 - oy + 146.7).toBeCloseTo(spec.mat, 1);
    // the logo's lowest ink (194.7) sits 1.3 units above the mat
    expect(spec.logo[1] + 194.7).toBeLessThanOrEqual(spec.mat);
  });

  it("rises through the ghost frames without touching the wordmark", () => {
    const ys = variant.ghostPoints.map(([, y]) => y);
    ys.slice(1).forEach((y, i) => expect(y).toBeLessThan(ys[i]!));
    // ink boxes (measured with getBBox): silhouette 2.05..226.09 × 2.22..146.72 in its box,
    // wordmark 10.77..335.4 × 19.09..194.72 in the logo
    const [lx, ly] = spec.logo;
    const word = { x0: lx + 10.77, x1: lx + 335.4, y0: ly + 19.09, y1: ly + 194.72 };
    variant.ghosts.forEach(([x, y]) => {
      const ink = { x0: x + 2.05, x1: x + 226.09, y0: y + 2.22, y1: y + 146.72 };
      const overlaps = ink.x0 < word.x1 && ink.x1 > word.x0 && ink.y0 < word.y1 && ink.y1 > word.y0;
      expect(overlaps).toBe(false);
      // at most half a frame may leave the art box on the left (the viewport edge)
      expect(x).toBeGreaterThan(-LEAP_BOX.width / 2);
    });
  });
});
