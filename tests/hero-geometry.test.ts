import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { describe, expect, it } from "vitest";
import { ALIGN_ORIGIN, GHOST_P, LEAP_BOX, LEAP_IN_LOGO } from "@/components/sections/hero/constants";
import { COMPACT, COMPACT_SPEC, WIDE, WIDE_SPEC, positionAt } from "@/components/sections/hero/geometry";
import { SPINE_SLOPE, spinePath, type SpineRect } from "@/components/sections/hero/spine";

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

/**
 * The desktop scrub's floor diagonal (spine.ts). Fixtures are the hero's real
 * text boxes (Range client rects of eyebrow, H1, sub and trust items + the CTA
 * buttons), section-relative, measured in Chromium at 1440×900 and 1024×768
 * (H1 „Sportska / gimnastika / za decu / u Kragujevcu“, capped at 126.9 / 90.5px).
 */
const SPINE_FIXTURES = {
  "1440x900": {
    matY: 341, matEnd: 1380, w: 1440, h: 900, left: 60,
    boxes: [[60, 359, 433, 377], [433, 359, 438, 377], [438, 359, 545, 377], [545, 359, 549, 377], [549, 359, 615, 377], [60, 355, 666, 534], [60, 467, 808, 646], [60, 578, 579, 757], [60, 690, 930, 869], [956, 403, 1370, 427], [956, 429, 1357, 453], [956, 455, 1345, 479], [956, 653, 972, 669], [980, 651, 1215, 672], [956, 686, 972, 702], [980, 683, 1165, 704], [956, 718, 972, 734], [980, 716, 1147, 737], [956, 509, 1380, 561], [956, 573, 1380, 625]],
  },
  "1024x768": {
    matY: 269, matEnd: 976, w: 1024, h: 768, left: 48,
    boxes: [[48, 287, 421, 305], [421, 287, 426, 305], [426, 287, 533, 305], [533, 287, 537, 305], [537, 287, 603, 305], [48, 292, 472, 420], [48, 371, 572, 499], [48, 451, 411, 579], [48, 530, 657, 658], [683, 327, 924, 351], [683, 353, 950, 377], [683, 379, 934, 403], [683, 406, 938, 430], [683, 432, 862, 456], [683, 630, 699, 646], [707, 627, 942, 648], [683, 663, 699, 679], [707, 660, 892, 681], [683, 695, 699, 711], [707, 692, 874, 713], [683, 485, 976, 537], [683, 549, 976, 601]],
  },
} as const;

const PAD = 16;
const inflate = ([l, t, r, b]: readonly number[]): SpineRect => ({ left: l! - PAD, top: t! - PAD, right: r! + PAD, bottom: b! + PAD });

/** "M x y H turn V y0 L x1 y1" (or "… V bottom") → numbers. */
function parseSpine(d: string) {
  const m = /^M([\d.]+) ([\d.]+)H([\d.]+)V([\d.]+)(?:L([\d.]+) ([\d.]+))?$/.exec(d);
  if (!m) throw new Error(`unexpected spine path ${d}`);
  const [, x0, y, turn, drop, x1, y1] = m.map(Number);
  return { x0: x0!, y: y!, turn: turn!, drop: drop!, end: m[5] ? { x: x1!, y: y1! } : null };
}

const inside = (x: number, y: number, r: SpineRect) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

describe.each(Object.entries(SPINE_FIXTURES))("hero floor diagonal — %s", (_size, f) => {
  const obstacles = f.boxes.map(inflate);
  const turn = f.matEnd + Math.min(32, (f.w - f.matEnd) / 2);
  const d = spinePath({ matY: f.matY, matEnd: f.matEnd, turn, bottom: f.h, left: f.left, obstacles });
  const p = parseSpine(d);

  it("extends the mat line to the right margin and drops down it", () => {
    expect(p.x0).toBe(f.matEnd);
    expect(p.y).toBe(f.matY);
    expect(p.turn).toBeGreaterThan(f.matEnd);
    expect(p.turn).toBeLessThanOrEqual(f.w);
    expect(p.drop).toBeGreaterThan(f.matY);
  });

  it("turns into a 28° diagonal that leaves through the hero's bottom edge", () => {
    expect(p.end).not.toBeNull();
    const end = p.end!;
    expect(end.y).toBeGreaterThanOrEqual(f.h);
    expect(end.x).toBeGreaterThanOrEqual(f.left);
    expect((end.y - p.drop) / (p.turn - end.x)).toBeCloseTo(SPINE_SLOPE, 2);
  });

  it("never crosses the eyebrow, the H1, the sub, the CTAs or the trust strip", () => {
    const end = p.end!;
    for (let y = f.matY; y <= p.drop; y += 1) obstacles.forEach((r) => expect(inside(p.turn, y, r)).toBe(false));
    for (let y = p.drop; y <= Math.min(end.y, f.h); y += 0.5) {
      const x = p.turn - (y - p.drop) / SPINE_SLOPE;
      obstacles.forEach((r) => expect(inside(x, y, r)).toBe(false));
    }
  });
});

describe("hero floor diagonal — edge cases", () => {
  it("starts right at the mat when nothing is in the way", () => {
    const p = parseSpine(spinePath({ matY: 300, matEnd: 1380, turn: 1410, bottom: 900, left: 60, obstacles: [] }));
    expect(p.drop).toBe(300);
    expect(p.end!.y).toBeGreaterThanOrEqual(900);
  });

  it("stops at the container's left edge instead of leaving the content box", () => {
    const p = parseSpine(spinePath({ matY: 100, matEnd: 1000, turn: 1020, bottom: 2000, left: 48, obstacles: [] }));
    expect(p.end!.x).toBe(48);
    expect(p.end!.y).toBeLessThan(2000);
  });

  it("only drops (no diagonal) when the text leaves no room above the bottom edge", () => {
    const d = spinePath({
      matY: 300,
      matEnd: 1380,
      turn: 1410,
      bottom: 900,
      left: 60,
      obstacles: [{ left: 60, top: 320, right: 1395, bottom: 890 }],
    });
    expect(d).toBe("M1380 300H1410V901");
  });
});
