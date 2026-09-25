import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { describe, expect, it } from "vitest";
import { ALIGN_ORIGIN, GHOST_P, LEAP_BOX, LEAP_IN_LOGO } from "@/components/sections/hero/constants";
import { buildVariant, positionAt } from "@/components/sections/hero/geometry";
import {
  COM,
  COMPACT,
  COMPACT_PASS,
  HIP_BACK,
  HIP_FRONT,
  PASS,
  PASS_END,
  TOE_FRONT,
  WIDE,
  WIDE_PASS,
  apply,
  legAttr,
  makePass,
  matrixAttr,
  turn,
  type Pose,
  type Pt,
} from "@/components/sections/hero/pass";
import { SPINE_SLOPE, spinePath, type SpineRect } from "@/components/sections/hero/spine";
import { OG_SPEC } from "@/components/seo/art";

/**
 * The silhouette's outline (box coordinates, every 8th of 585 points sampled
 * with getPointAtLength in Chromium, plus the extremes), labelled by rig part:
 * 0 torso (and the joint discs), 1 back leg, 2 front leg.
 */
const OUTLINE: readonly (readonly [number, number, 0 | 1 | 2])[] = [
  [220, 147, 2], [208, 145, 2], [196, 142, 2], [184, 140, 2], [173, 139, 2], [161, 139, 2], [149, 138, 2], [137, 136, 2],
  [125, 135, 0], [114, 138, 0], [102, 137, 0], [90, 135, 1], [78, 132, 1], [67, 129, 1], [55, 129, 1], [43, 127, 1],
  [32, 122, 1], [21, 122, 1], [13, 116, 1], [2, 110, 1], [2, 108, 1], [11, 106, 1], [23, 109, 1], [34, 113, 1],
  [46, 115, 1], [58, 117, 1], [70, 117, 1], [82, 117, 1], [94, 117, 0], [99, 111, 0], [97, 100, 0], [97, 88, 0],
  [95, 76, 0], [99, 65, 0], [91, 56, 0], [84, 46, 0], [77, 36, 0], [72, 26, 0], [65, 16, 0], [68, 9, 0], [68, 3, 0],
  [74, 3, 0], [77, 12, 0], [78, 23, 0], [85, 33, 0], [92, 42, 0], [99, 46, 0], [105, 36, 0], [115, 30, 0], [123, 37, 0],
  [125, 49, 0], [121, 60, 0], [132, 63, 0], [143, 61, 0], [155, 59, 0], [167, 58, 0], [178, 53, 0], [185, 54, 0],
  [178, 63, 0], [167, 65, 0], [155, 68, 0], [143, 71, 0], [132, 74, 0], [124, 81, 0], [122, 93, 0], [124, 105, 0],
  [132, 114, 0], [143, 119, 2], [154, 124, 2], [165, 126, 2], [177, 128, 2], [189, 131, 2], [200, 135, 2],
  [212, 137, 2], [223, 140, 2], [226, 145, 2], [223, 147, 2], [221, 147, 2],
];

/** Top of the wordmark's ink per 10-unit column (logo units, measured in Chromium). */
const WORDMARK_SKYLINE: readonly (readonly [number, number])[] = [
  [10, 120], [20, 77], [30, 34], [40, 31], [50, 31], [60, 76], [70, 64], [80, 54], [90, 44], [100, 34], [110, 26],
  [120, 21], [130, 19], [140, 19], [150, 70], [160, 70], [170, 70], [180, 70], [190, 70], [200, 70], [210, 66],
  [220, 70], [230, 70], [240, 71], [250, 70], [260, 70], [270, 70], [280, 70], [290, 70], [300, 73], [310, 73],
  [320, 73], [330, 120],
];

/** The outline of a pose, in art units. */
const outline = (p: Pose): Pt[] =>
  OUTLINE.map(([x, y, part]) => {
    const pt: Pt = part === 1 ? turn([x, y], HIP_BACK, p.back) : part === 2 ? turn([x, y], HIP_FRONT, p.front) : [x, y];
    return apply(p.m, pt);
  });

/** How far a point clears the wordmark (above its ink; +∞ when not over it). */
function clearance([x, y]: Pt, logo: Pt): number {
  const lx = x - logo[0];
  let c = Infinity;
  for (const [col, top] of WORDMARK_SKYLINE) if (lx >= col - 10 && lx < col + 20) c = Math.min(c, top + logo[1] - y);
  return c;
}

describe.each([
  ["compact", COMPACT, COMPACT_PASS, 45],
  ["wide", WIDE, WIDE_PASS, 70],
] as const)("floor pass — %s", (_name, variant, spec, margin) => {
  const pass = makePass(spec);

  it("lands exactly in the logo and rests there (the logo's own pose)", () => {
    expect(variant.landed).toEqual([spec.logo[0] + LEAP_IN_LOGO.x, spec.logo[1] + LEAP_IN_LOGO.y]);
    for (const t of [PASS.settle, PASS_END, 5]) {
      const p = pass.pose(t);
      expect(p.back).toBe(0);
      expect(p.front).toBe(0);
      const [a, b, c, d, e, f] = p.m;
      expect([a, b, c, d]).toEqual([1, 0, 0, 1]);
      expect(e).toBeCloseTo(variant.landed[0], 9);
      expect(f).toBeCloseTo(variant.landed[1], 9);
    }
  });

  it("touches down on the front toe, on the mat, inside the logo", () => {
    const toe = apply(pass.pose(PASS.land).m, TOE_FRONT);
    expect(toe[0]).toBeCloseTo(pass.touchdown[0], 6);
    expect(toe[1]).toBeCloseTo(pass.touchdown[1], 6);
    // the logo's lowest ink (194.7) sits 1.3 units above the mat
    expect(spec.mat - pass.touchdown[1]).toBeGreaterThanOrEqual(0);
    expect(spec.mat - pass.touchdown[1]).toBeLessThan(1.5);
  });

  it("moves continuously — no jump anywhere in the pass", () => {
    let prev = pass.pose(0);
    for (let t = 0.001; t <= PASS_END; t += 0.001) {
      const p = pass.pose(t);
      const [x0, y0] = apply(prev.m, COM);
      const [x1, y1] = apply(p.m, COM);
      // ≤ 4 units per ms ≈ 3.2 px per ms on desktop, the run's top speed
      expect(Math.hypot(x1 - x0, y1 - y0)).toBeLessThan(4);
      expect(Math.abs(p.back - prev.back)).toBeLessThan(1.5);
      expect(Math.abs(p.front - prev.front)).toBeLessThan(1.5);
      prev = p;
    }
  });

  it("runs on the mat, takes off from it and flies above it", () => {
    const lowest = (t: number) => Math.max(...outline(pass.pose(t)).map(([, y]) => y));
    for (let t = PASS.enter; t < PASS.launch; t += 0.005) {
      // on the floor, or a low chassé hop above it — never through it
      expect(lowest(t)).toBeLessThanOrEqual(spec.mat + 1);
      expect(spec.mat - lowest(t)).toBeLessThanOrEqual(spec.hop + 1);
    }
    for (let t = PASS.launch + 0.02; t < PASS.land - 0.02; t += 0.005) expect(lowest(t)).toBeLessThan(spec.mat);
  });

  it("server-renders each ghost frame as the gymnast at its shutter time", () => {
    expect(variant.ghosts).toHaveLength(6);
    variant.ghosts.forEach((g, i) => {
      const p = pass.pose(spec.ghosts[i]!);
      expect(g.transform).toBe(matrixAttr(p.m));
      expect(g.back).toBe(legAttr(p.back, HIP_BACK));
      expect(g.front).toBe(legAttr(p.front, HIP_FRONT));
      expect(g.x).toBeCloseTo(apply(p.m, COM)[0], 2);
    });
  });

  it("frames the pass: low running steps and the takeoff on the mat, then the legs opening in the air", () => {
    const frames = spec.ghosts.map((t) => ({ t, p: pass.pose(t) }));
    const low = (p: Pose) => Math.max(...outline(p).map(([, y]) => y));
    const floor = frames.filter(({ t }) => t < PASS.launch);
    const air = frames.filter(({ t }) => t >= PASS.launch);
    // at least one running step and exactly one takeoff frame, then the flight
    expect(floor.length).toBeGreaterThanOrEqual(2);
    expect(floor.filter(({ t }) => t >= PASS.plant)).toHaveLength(1);
    floor.forEach(({ p }) => expect(spec.mat - low(p)).toBeLessThanOrEqual(spec.hop + 1));
    expect(Math.abs(spec.mat - low(floor.at(-1)!.p))).toBeLessThan(1);
    air.forEach(({ p }) => expect(spec.mat - low(p)).toBeGreaterThan(40));
    // left to right, at the shutter's pace
    const xs = frames.map(({ p }) => apply(p.m, COM)[0]);
    xs.slice(1).forEach((x, i) => expect(x).toBeGreaterThan(xs[i]! + 40));
    // the legs open to the full split by the last frame
    expect(Math.abs(air.at(-1)!.p.back)).toBeLessThan(1);
    expect(Math.abs(air.at(-1)!.p.front)).toBeLessThan(1);
  });

  it("keeps every ghost frame clear of the wordmark and on screen", () => {
    spec.ghosts.forEach((t) => {
      const pts = outline(pass.pose(t));
      pts.forEach((pt) => expect(clearance(pt, spec.logo)).toBeGreaterThan(2));
      // at most a sliver may run into the viewport margin on the left
      expect(Math.min(...pts.map(([x]) => x))).toBeGreaterThan(-margin);
      // and nothing climbs into the header above the art band
      expect(Math.min(...pts.map(([, y]) => y))).toBeGreaterThan(-12);
    });
  });

  it("wipes the wordmark in behind her, finished by the intro's end", () => {
    let prev = 0;
    expect(pass.wipe(0)).toBe(0);
    for (let t = 0; t <= PASS_END; t += 0.01) {
      const w = pass.wipe(t);
      expect(w).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = w;
    }
    expect(pass.wipe(PASS_END)).toBeCloseTo(1, 9);
    // nothing of the wordmark shows before she comes down toward it
    expect(pass.wipe((PASS.launch + PASS.land) / 2)).toBe(0);
  });
});

describe("floor pass — timing", () => {
  it("completes within the §7 budget", () => {
    expect(PASS_END).toBeLessThanOrEqual(1.9);
    expect(PASS.land + PASS.chalk).toBeLessThanOrEqual(PASS_END);
    expect(PASS.land + PASS.flex).toBeLessThanOrEqual(PASS_END);
    expect(PASS.chalk).toBeLessThanOrEqual(0.4);
  });
});

/** Where gsap's MotionPathPlugin resolves `end: p` on a path string (its own utilities). */
function gsapPointAt(d: string, p: number) {
  const raw = MotionPathPlugin.stringToRawPath(d);
  const sliced = MotionPathPlugin.sliceRawPath(raw, 0, p);
  MotionPathPlugin.cacheRawPathMeasurements(sliced);
  return MotionPathPlugin.getPositionOnPath(sliced, 1) as { x: number; y: number };
}

describe("share image parabola (OG still)", () => {
  const variant = buildVariant(OG_SPEC);
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

  it("lands the silhouette exactly at its position inside the logo and takes off from the mat", () => {
    const end = gsapPointAt(variant.d, 1);
    expect(end.x - ox).toBeCloseTo(variant.landed[0], 2);
    expect(end.y - oy).toBeCloseTo(variant.landed[1], 2);
    const [x0, y0] = positionAt([...variant.d.replace(/[MC]/g, " ").trim().split(/\s+/).map(Number)], 0);
    expect(x0).toBe(OG_SPEC.takeoffX);
    expect(y0 - oy + 146.7).toBeCloseTo(OG_SPEC.mat, 1);
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
  const [, x0, y, turnX, drop, x1, y1] = m.map(Number);
  return { x0: x0!, y: y!, turn: turnX!, drop: drop!, end: m[5] ? { x: x1!, y: y1! } : null };
}

const inside = (x: number, y: number, r: SpineRect) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

describe.each(Object.entries(SPINE_FIXTURES))("hero floor diagonal — %s", (_size, f) => {
  const obstacles = f.boxes.map(inflate);
  const turnX = f.matEnd + Math.min(32, (f.w - f.matEnd) / 2);
  const d = spinePath({ matY: f.matY, matEnd: f.matEnd, turn: turnX, bottom: f.h, left: f.left, obstacles });
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
