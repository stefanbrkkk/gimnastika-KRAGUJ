import { readFileSync } from "node:fs";
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { describe, expect, it } from "vitest";
import { ALIGN_ORIGIN, GHOST_P, LEAP_BOX, LEAP_IN_LOGO } from "@/components/sections/hero/constants";
import { buildVariant, positionAt } from "@/components/sections/hero/geometry";
import {
  BACK_WEDGE,
  COM,
  COMPACT,
  COMPACT_PASS,
  FRONT_WEDGE,
  HIP_BACK,
  HIP_FRONT,
  PASS,
  PASS_END,
  RIG,
  STICK,
  TOE_BACK,
  TOE_FRONT,
  WIDE,
  WIDE_PASS,
  WORDMARK_INK,
  apply,
  landEase,
  legAttr,
  makePass,
  matrixAttr,
  turn,
  type Pose,
  type Pt,
} from "@/components/sections/hero/pass";
import { SPINE_SLOPE, measure, nextLeg, roundRoute, routeClear, spinePath, spineRoute, type SpineRect } from "@/components/sections/hero/spine";
import { OG_SPEC } from "@/components/seo/art";

/**
 * The silhouette's outline (box coordinates, every 8th of 585 points sampled
 * with getPointAtLength in Chromium, plus the extremes).
 */
const OUTLINE: readonly Pt[] = [
  [220, 147], [208, 145], [196, 142], [184, 140], [173, 139], [161, 139], [149, 138], [137, 136],
  [125, 135], [114, 138], [102, 137], [90, 135], [78, 132], [67, 129], [55, 129], [43, 127],
  [32, 122], [21, 122], [13, 116], [2, 110], [2, 108], [11, 106], [23, 109], [34, 113],
  [46, 115], [58, 117], [70, 117], [82, 117], [94, 117], [99, 111], [97, 100], [97, 88],
  [95, 76], [99, 65], [91, 56], [84, 46], [77, 36], [72, 26], [65, 16], [68, 9], [68, 3],
  [74, 3], [77, 12], [78, 23], [85, 33], [92, 42], [99, 46], [105, 36], [115, 30], [123, 37],
  [125, 49], [121, 60], [132, 63], [143, 61], [155, 59], [167, 58], [178, 53], [185, 54],
  [178, 63], [167, 65], [155, 68], [143, 71], [132, 74], [124, 81], [122, 93], [124, 105],
  [132, 114], [143, 119], [154, 124], [165, 126], [177, 128], [189, 131], [200, 135],
  [212, 137], [223, 140], [226, 145], [223, 147], [221, 147],
];

/** Point in polygon (even-odd ray cast). */
function inside([x, y]: Pt, poly: readonly Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const partOf = (p: Pt): 0 | 1 | 2 => (inside(p, BACK_WEDGE) ? 1 : inside(p, FRONT_WEDGE) ? 2 : 0);

/**
 * The wordmark's ink per 10-unit column of the logo, rasterised in Chromium at
 * 8 px/unit: [x, top, bottom] (logo units). The „g“ and „j“ descenders reach
 * the mat line; the „K“ stands on it at x 10–30.
 */
const WORDMARK_PROFILE: readonly (readonly [number, number, number])[] = [
  [10, 120, 160], [20, 77, 159], [30, 34, 145], [40, 31, 130], [50, 32, 152], [60, 75, 159], [70, 65, 160],
  [80, 53, 159], [90, 43, 155], [100, 34, 150], [110, 26, 150], [120, 21, 148], [130, 19, 150], [140, 19, 150],
  [150, 70, 149], [160, 71, 150], [170, 70, 150], [180, 70, 190], [190, 70, 192], [200, 70, 191], [210, 66, 179],
  [220, 70, 161], [230, 70, 153], [240, 71, 149], [250, 70, 150], [260, 70, 149], [270, 70, 195], [280, 70, 194],
  [290, 70, 184], [300, 72, 161], [310, 73, 161], [320, 73, 148], [330, 121, 133],
];

/** The outline of a pose, in art units. */
const outline = (p: Pose): Pt[] =>
  OUTLINE.map((pt) => {
    const part = partOf(pt);
    const q: Pt = part === 1 ? turn(pt, HIP_BACK, p.back) : part === 2 ? turn(pt, HIP_FRONT, p.front) : pt;
    return apply(p.m, q);
  });

/** How far a point clears the wordmark (above its ink; +∞ when not over it). */
function clearance([x, y]: Pt, logo: Pt): number {
  const lx = x - logo[0];
  let c = Infinity;
  for (const [col, top] of WORDMARK_PROFILE) if (lx >= col - 10 && lx < col + 20) c = Math.min(c, top + logo[1] - y);
  return c;
}

const COM_OF = (p: Pose) => apply(p.m, COM);

describe("the rig", () => {
  it("cuts the logo into torso and legs along the joint discs, and the legs keep their feet", () => {
    // the regions do not overlap, and every outline point belongs to exactly one piece
    BACK_WEDGE.forEach((p) => expect(inside(p, FRONT_WEDGE)).toBe(false));
    FRONT_WEDGE.forEach((p) => expect(inside(p, BACK_WEDGE)).toBe(false));
    expect(partOf(TOE_BACK)).toBe(1);
    expect(partOf(TOE_FRONT)).toBe(2);
    // head, hands and the forward arm stay with the torso
    for (const p of [[115, 30], [68, 3], [185, 54], [99, 65], [124, 81]] as Pt[]) expect(partOf(p)).toBe(0);
    // the torso clip is the complement of both leg regions (even-odd)
    expect(RIG.torso).toContain(RIG.back);
    expect(RIG.torso).toContain(RIG.front);
  });

  it("turns each leg about the centre of its joint disc, so the cut stays under the disc", () => {
    const [[bx, by, br], [fx, fy, fr]] = RIG.joints;
    expect([bx, by]).toEqual(HIP_BACK);
    expect([fx, fy]).toEqual(HIP_FRONT);
    // the two radii of each wedge (to where the disc touches the thigh) are about one disc radius long
    // inside the ink, i.e. the cut edges lie under the disc at any angle
    expect(br).toBeGreaterThan(8);
    expect(fr).toBeGreaterThan(8);
    // the joints sit in the thighs, just off the pelvis
    expect(HIP_BACK[0]).toBeLessThan(COM[0]);
    expect(HIP_FRONT[0]).toBeGreaterThan(COM[0]);
  });
});

describe.each([
  ["compact", COMPACT, COMPACT_PASS],
  ["wide", WIDE, WIDE_PASS],
] as const)("floor pass — %s", (name, variant, spec) => {
  const pass = makePass(spec);
  const settle = spec.land + PASS.stickIn + PASS.stickOut;
  const launch = spec.launch;

  it("lands exactly in the logo and rests there (the logo's own pose)", () => {
    expect(variant.landed).toEqual([spec.logo[0] + LEAP_IN_LOGO.x, spec.logo[1] + LEAP_IN_LOGO.y]);
    for (const t of [settle, pass.end, 5]) {
      const p = pass.pose(t);
      expect(p.back).toBe(0);
      expect(p.front).toBe(0);
      const [a, b, c, d, e, f] = p.m;
      expect([a, b, c, d]).toEqual([1, 0, 0, 1]);
      expect(e).toBeCloseTo(variant.landed[0], 9);
      expect(f).toBeCloseTo(variant.landed[1], 9);
    }
  });

  it("touches down on the front toe, on the mat, inside the logo — and sticks (compress about the toe, hold)", () => {
    const toe = apply(pass.pose(spec.land).m, TOE_FRONT);
    expect(toe[0]).toBeCloseTo(pass.touchdown[0], 6);
    expect(toe[1]).toBeCloseTo(pass.touchdown[1], 6);
    // the logo's lowest ink (194.7) sits 1.3 units above the mat
    expect(spec.mat - pass.touchdown[1]).toBeGreaterThanOrEqual(0);
    expect(spec.mat - pass.touchdown[1]).toBeLessThan(1.5);
    // the toe never leaves its spot during the stick
    for (let t = spec.land; t <= settle; t += 0.01) {
      const q = apply(pass.pose(t).m, TOE_FRONT);
      expect(Math.hypot(q[0] - toe[0], q[1] - toe[1])).toBeLessThan(1e-6);
    }
    // the brand squash at its deepest (scale y .94 / x 1.03), then back to rest without rebounding past it
    let minY = 1;
    let maxX = 1;
    for (let t = spec.land; t <= settle; t += 0.002) {
      const m = pass.pose(t).m;
      minY = Math.min(minY, Math.hypot(m[2], m[3]));
      maxX = Math.max(maxX, Math.hypot(m[0], m[1]));
    }
    expect(minY).toBeCloseTo(STICK.sy, 2);
    expect(maxX).toBeCloseTo(STICK.sx, 2);
  });

  it("moves continuously — no jump anywhere in the pass", () => {
    let prev = pass.pose(0);
    for (let t = 0.001; t <= pass.end; t += 0.001) {
      const p = pass.pose(t);
      const [x0, y0] = COM_OF(prev);
      const [x1, y1] = COM_OF(p);
      // ≤ 3 units per ms ≈ 2.4 px per ms on desktop
      expect(Math.hypot(x1 - x0, y1 - y0)).toBeLessThan(3);
      expect(Math.abs(p.back - prev.back)).toBeLessThan(2.5);
      expect(Math.abs(p.front - prev.front)).toBeLessThan(2.5);
      prev = p;
    }
  });

  it("keeps her speed through the plant: one smooth horizontal speed from the entry to the takeoff and on into the flight", () => {
    const f = 1 / 60;
    const vx: number[] = [];
    for (let t = spec.enter + f; t <= launch + 6 * f; t += f) vx.push((COM_OF(pass.pose(t))[0] - COM_OF(pass.pose(t - f))[0]) / f);
    const top = Math.max(...vx);
    // never below 60 % of the run's top speed …
    vx.forEach((v) => expect(v).toBeGreaterThan(0.6 * top));
    // … and no frame changes it by more than a fifth of it (the dip is spread over the plant)
    vx.slice(1).forEach((v, i) => expect(Math.abs(v - vx[i]!)).toBeLessThan(0.2 * top));
  });

  it("plants the push foot: it never slides and stays on the mat, while the body compresses over it", () => {
    const toe0 = apply(pass.pose(spec.plant).m, turn(TOE_BACK, HIP_BACK, pass.pose(spec.plant).back));
    expect(toe0[1]).toBeCloseTo(spec.mat, 1);
    for (let t = spec.plant; t <= launch; t += 0.002) {
      const p = pass.pose(t);
      const toe = apply(p.m, turn(TOE_BACK, HIP_BACK, p.back));
      expect(Math.abs(toe[0] - toe0[0])).toBeLessThan(0.5);
      expect(Math.abs(toe[1] - spec.mat)).toBeLessThan(0.5);
      // a believable squash (≤ 10 %)
      const ratio = Math.hypot(p.m[2], p.m[3]) / Math.hypot(p.m[0], p.m[1]);
      expect(ratio).toBeGreaterThan(0.9);
      // the kick leg brushes through clear of the floor
      const kick = apply(p.m, turn(TOE_FRONT, HIP_FRONT, p.front));
      expect(kick[1]).toBeLessThan(spec.mat);
    }
  });

  it("enters whole, inside the frame, and flies above the mat", () => {
    const lowest = (t: number) => Math.max(...outline(pass.pose(t)).map(([, y]) => y));
    for (let t = spec.enter; t < spec.plant; t += 0.005) {
      // the bound: in the air, low
      expect(lowest(t)).toBeLessThan(spec.mat);
      // never a fragment at the viewport edge: the whole figure inside the art (phones: from the container's edge on)
      expect(Math.min(...outline(pass.pose(t)).map(([x]) => x))).toBeGreaterThan(name === "compact" ? 0 : -40);
    }
    for (let t = launch + 0.02; t < spec.land - 0.02; t += 0.005) expect(lowest(t)).toBeLessThan(spec.mat);
  });

  it("keeps the raised hands clear of the floating header at the apex", () => {
    // compact: ≥ 37 units (≥ 16 px at 390 px) below the art's top edge
    for (let t = spec.enter; t <= pass.end; t += 0.005) {
      const top = Math.min(...outline(pass.pose(t)).map(([, y]) => y));
      expect(top).toBeGreaterThan(name === "compact" ? 37 : 12);
    }
  });

  it("server-renders each ghost frame as the gymnast at its shutter time", () => {
    // six on the wide plate; five on the phones' plate (three in flight, so the apex never knots)
    expect(variant.ghosts).toHaveLength(name === "compact" ? 5 : 6);
    expect(variant.ghosts).toHaveLength(spec.ghosts.length);
    variant.ghosts.forEach((g, i) => {
      const p = pass.pose(spec.ghosts[i]!);
      expect(g.transform).toBe(matrixAttr(p.m));
      expect(g.back).toBe(legAttr(p.back, HIP_BACK));
      expect(g.front).toBe(legAttr(p.front, HIP_FRONT));
      expect(g.x).toBeCloseTo(COM_OF(p)[0], 2);
    });
  });

  it("frames distinct phases: the bound in the air, the takeoff on the mat, then the split opening in flight", () => {
    const frames = spec.ghosts.map((t) => ({ t, p: pass.pose(t) }));
    const low = (p: Pose) => Math.max(...outline(p).map(([, y]) => y));
    // the first frame is the chassé bound (airborne), one frame stands on the mat for the takeoff
    expect(frames[0]!.t).toBeLessThan(spec.plant);
    expect(spec.mat - low(frames[0]!.p)).toBeGreaterThan(1);
    const onMat = frames.filter(({ t }) => t >= spec.plant && t <= launch);
    expect(onMat).toHaveLength(1);
    expect(Math.abs(spec.mat - low(onMat[0]!.p))).toBeLessThan(1);
    const air = frames.filter(({ t }) => t > launch);
    expect(air.length).toBeGreaterThanOrEqual(3);
    air.forEach(({ p }) => expect(spec.mat - low(p)).toBeGreaterThan(40));
    // left to right, evenly enough to read one by one (the torsos never overlap)
    const xs = frames.map(({ p }) => COM_OF(p)[0]);
    xs.slice(1).forEach((x, i) => expect(x - xs[i]!).toBeGreaterThan(name === "compact" ? 70 : 100));
    if (name === "compact") {
      // phones: from the takeoff on, each exposure stands ≥ .7 of the figure's width from the next
      // (the wider of the two, measured on the rigged outline), so the apex frames never knot together
      const width = (p: Pose) => {
        const x = outline(p).map(([px]) => px);
        return Math.max(...x) - Math.min(...x);
      };
      const from = frames.indexOf(onMat[0]!);
      for (let i = from + 1; i < frames.length; i++) {
        expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(0.7 * Math.max(width(frames[i]!.p), width(frames[i - 1]!.p)));
      }
      expect(air).toHaveLength(3);
    }
    // the legs open to the full split by the last frame
    expect(Math.abs(air.at(-1)!.p.back)).toBeLessThan(2);
  });

  it("keeps every ghost frame clear of the wordmark (by a margin) and of the landed gymnast", () => {
    const landed = outline(pass.pose(5));
    const landedLeft = Math.min(...landed.map(([x]) => x));
    spec.ghosts.forEach((t) => {
      const pts = outline(pass.pose(t));
      pts.forEach((pt) => expect(clearance(pt, spec.logo)).toBeGreaterThan(8));
      // left of the landed gymnast, or above her raised hand
      pts.forEach(([x, y]) => expect(x < landedLeft - 4 || y < variant.landed[1]).toBe(true));
    });
  });

  it("stands the frame marks on free mat — never through the „g“ or „j“ descender (rasterised profile)", () => {
    const tick = name === "wide" ? 9 : 18;
    variant.ghosts.forEach((g) => {
      const lx = g.x - spec.logo[0];
      for (const [col, , bottom] of WORDMARK_PROFILE) {
        if (lx >= col - 4 && lx < col + 14) expect(bottom + spec.logo[1]).toBeLessThan(spec.mat - tick - 2);
      }
    });
  });

  it("develops the wordmark in her wake: nothing while she is high, the whole „K“ first, the whole name by the end", () => {
    let prev = -Infinity;
    for (let t = 0; t <= pass.end + 1e-9; t += 0.004) {
      const e = pass.edge(t);
      expect(e).toBeGreaterThanOrEqual(prev);
      prev = e;
    }
    expect(pass.edge(pass.end)).toBe(Infinity);
    expect(pass.edge((launch + spec.land) / 2)).toBe(-Infinity);
    // the first frame that shows anything already shows the whole „K“ (its ink ends at x ≈ 140 at the top)
    let first = -Infinity;
    for (let t = 0; t <= pass.end && first === -Infinity; t += 0.001) first = pass.edge(t);
    expect(first).toBeGreaterThanOrEqual(95);
    // it trails her back toe: the name never shows ahead of her
    for (let t = launch; t < spec.land; t += 0.004) {
      const e = pass.edge(t);
      if (e > -Infinity) expect(e + spec.logo[0]).toBeLessThanOrEqual(pass.backToe(t)[0] + 1e-6);
    }
    expect(WORDMARK_INK.x1).toBeGreaterThan(WORDMARK_INK.x0);
  });
});

describe("the stick's ease", () => {
  it("is EASE.land exactly (the CustomEase lib/motion.ts registers): compress and hold, no rebound", () => {
    gsap.registerPlugin(CustomEase);
    // the curve as lib/motion.ts registers it, read from its source
    const curve = /CustomEase\.create\(EASE\.land,\s*"([^"]+)"\)/.exec(readFileSync("lib/motion.ts", "utf8"))?.[1];
    expect(curve).toBeTruthy();
    const land = CustomEase.create("hero-test-land", curve!);
    for (let x = 0; x <= 1; x += 0.02) expect(landEase(x)).toBeCloseTo(land(x), 2);
    for (let x = 0; x <= 1; x += 0.01) expect(landEase(x)).toBeLessThan(1.03);
  });
});

describe("floor pass — timing", () => {
  it("completes within the §7 budget, with time to spare for frame latency", () => {
    expect(PASS_END).toBeLessThanOrEqual(1.75);
    for (const spec of [COMPACT_PASS, WIDE_PASS]) {
      expect(spec.land + PASS.flex).toBeLessThanOrEqual(PASS_END);
      // every ghost has developed and settled before the end
      expect(spec.ghosts.at(-1)! + PASS.developRise + PASS.developSettle).toBeLessThanOrEqual(spec.land + PASS.wipeAfter);
    }
  });
});

/** Where gsap's MotionPathPlugin resolves `end: p` on a path string (its own utilities). */
function gsapPointAt(d: string, p: number) {
  const raw = MotionPathPlugin.stringToRawPath(d);
  const sliced = MotionPathPlugin.sliceRawPath(raw, 0, p);
  MotionPathPlugin.cacheRawPathMeasurements(sliced);
  return MotionPathPlugin.getPositionOnPath(sliced, 1) as { x: number; y: number };
}

describe("share image parabola (geometry.ts, components/seo/art.ts)", () => {
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
 * buttons), section-relative, and the next section's title („Koji program /
 * je za vaše / dete?“ — its first line is the widest), its mark and its cards
 * (the quiz card beside the title, the band card under it) as they sit right
 * under the hero after the pin, measured in Chromium at the four desktop sizes
 * (fine pointer). artK = px per art unit of the wide plate (the landed size).
 */
const SPINE_FIXTURES = {
  "1024x768": {
    matY: 269, matEnd: 976, w: 1024, h: 768, left: 48, artK: 0.5624,
    boxes: [[48, 287, 421, 305], [426, 287, 533, 305], [537, 287, 603, 305], [48, 292, 472, 420], [48, 371, 572, 499], [48, 451, 411, 579], [48, 530, 657, 658], [683, 327, 924, 351], [683, 353, 950, 377], [683, 379, 934, 403], [683, 406, 938, 430], [683, 432, 862, 456], [737, 500, 922, 522], [739, 564, 919, 586], [707, 627, 942, 648], [707, 660, 892, 681], [707, 692, 874, 713], [683, 485, 976, 537], [683, 549, 976, 601]],
    mark: [206, 1008, 337, 1055], cards: [[48, 1091, 421, 1257], [453, 912, 976, 1301]],
    title: [[48, 900, 388, 971], [48, 948, 309, 1019], [48, 999, 196, 1070]],
  },
  "1280x800": {
    matY: 304, matEnd: 1232, w: 1280, h: 800, left: 48, artK: 0.7175,
    boxes: [[48, 322, 421, 340], [426, 322, 533, 340], [537, 322, 603, 340], [48, 321, 591, 481], [48, 422, 718, 582], [48, 522, 513, 682], [48, 622, 828, 782], [853, 364, 1187, 388], [853, 390, 1223, 414], [853, 417, 1214, 441], [853, 443, 989, 467], [950, 511, 1135, 533], [953, 575, 1133, 597], [877, 638, 1113, 659], [877, 671, 1063, 692], [877, 703, 1045, 724], [853, 496, 1232, 548], [853, 560, 1232, 612]],
    mark: [232, 1055, 384, 1111], cards: [[48, 1147, 528, 1344], [560, 944, 1232, 1344]],
    title: [[48, 930, 443, 1013], [48, 986, 352, 1069], [48, 1046, 220, 1129]],
  },
  "1440x900": {
    matY: 341, matEnd: 1380, w: 1440, h: 900, left: 60, artK: 0.8,
    boxes: [[60, 359, 433, 377], [438, 359, 545, 377], [549, 359, 615, 377], [60, 355, 666, 534], [60, 467, 808, 646], [60, 578, 579, 757], [60, 690, 930, 869], [956, 403, 1370, 427], [956, 429, 1357, 453], [956, 455, 1345, 479], [1075, 523, 1261, 545], [1078, 587, 1258, 609], [980, 651, 1215, 672], [980, 683, 1165, 704], [980, 716, 1147, 737], [956, 509, 1380, 561], [956, 573, 1380, 625]],
    mark: [260, 1165, 426, 1225], cards: [[60, 1263, 597, 1476], [629, 1044, 1380, 1476]],
    title: [[60, 1029, 490, 1118], [60, 1090, 391, 1179], [60, 1155, 247, 1244]],
  },
  "1920x1080": {
    matY: 431, matEnd: 1620, w: 1920, h: 1080, left: 300, artK: 0.8,
    boxes: [[300, 449, 673, 467], [678, 449, 785, 467], [789, 449, 855, 467], [300, 445, 906, 624], [300, 557, 1048, 736], [300, 668, 819, 847], [300, 780, 1170, 959], [1196, 493, 1610, 517], [1196, 519, 1597, 543], [1196, 545, 1585, 569], [1315, 613, 1501, 635], [1318, 677, 1498, 699], [1220, 741, 1455, 762], [1220, 773, 1405, 794], [1220, 806, 1387, 827], [1196, 599, 1620, 651], [1196, 663, 1620, 715]],
    mark: [514, 1353, 690, 1418], cards: [[300, 1455, 837, 1668], [869, 1224, 1620, 1668]],
    title: [[300, 1208, 759, 1304], [300, 1273, 653, 1369], [300, 1342, 500, 1438]],
  },
} as const;

const PAD = 16;
const inflate = ([l, t, r, b]: readonly number[], pad = PAD): SpineRect => ({ left: l! - pad, top: t! - pad, right: r! + pad, bottom: b! + pad });

/** "M x y H turn V y0 L x1 y1" (or "… V bottom") → numbers. */
function parseSpine(d: string) {
  const m = /^M([\d.]+) ([\d.]+)H([\d.]+)V([\d.]+)(?:L([\d.]+) ([\d.]+))?$/.exec(d);
  if (!m) throw new Error(`unexpected spine path ${d}`);
  const [, x0, y, turnX, drop, x1, y1] = m.map(Number);
  return { x0: x0!, y: y!, turn: turnX!, drop: drop!, end: m[5] ? { x: x1!, y: y1! } : null };
}

const inRect = (x: number, y: number, r: SpineRect) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
const rect = ([l, t, r, b]: readonly number[]): SpineRect => ({ left: l!, top: t!, right: r!, bottom: b! });

describe.each(Object.entries(SPINE_FIXTURES))("hero floor diagonal — %s", (_size, f) => {
  const obstacles = f.boxes.map((b) => inflate(b));
  const turnX = f.matEnd + Math.min(32, (f.w - f.matEnd) / 2);
  // the second exposure runs at ≥ .45 of the landed size (scrub.ts): her figure standing on the line
  const [ml, , mr, mb] = f.mark;
  const kMark = (mr - ml) / 570;
  const laneK = Math.max(0.12, (2 * Math.min(turnX - f.matEnd, f.w - turnX) - 8) / 230);
  const kRun = Math.max(Math.min(laneK, kMark), 0.45 * f.artK);
  const runner = { half: 114 * kRun, height: 160 * kRun };
  const base = { matY: f.matY, matEnd: f.matEnd, turn: turnX, bottom: f.h, left: f.left, obstacles, runner };
  const p = parseSpine(spinePath(base));

  it("extends the mat line to the right margin and drops down it", () => {
    expect(p.x0).toBe(f.matEnd);
    expect(p.y).toBe(f.matY);
    expect(p.turn).toBeGreaterThan(f.matEnd);
    expect(p.turn).toBeLessThanOrEqual(f.w - 8);
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
    for (let y = f.matY; y <= p.drop; y += 1) obstacles.forEach((r) => expect(inRect(p.turn, y, r)).toBe(false));
    for (let y = p.drop; y <= Math.min(end.y, f.h); y += 0.5) {
      const x = p.turn - (y - p.drop) / SPINE_SLOPE;
      obstacles.forEach((r) => expect(inRect(x, y, r)).toBe(false));
    }
  });

  it("starts the diagonal low enough that she runs it whole, clear of every text box", () => {
    // her figure standing on the diagonal: [x ± half] × [y − height, y], at ≥ .45 of the landed size
    expect(kRun).toBeGreaterThanOrEqual(0.45 * f.artK);
    const text = f.boxes.map((b) => inflate(b, 4));
    for (let y = p.drop; y <= f.h; y += 1) {
      const x = p.turn - (y - p.drop) / SPINE_SLOPE;
      const fig = { left: x - runner.half, right: x + runner.half, top: y - runner.height, bottom: y };
      text.forEach((r) => expect(fig.left < r.right && fig.right > r.left && fig.top < r.bottom && fig.bottom > r.top).toBe(false));
    }
  });

  it("runs on to the next section's title mark — level above its content, down beside the title, never through a title line or a card", () => {
    const title = f.title.map(rect);
    const cards = f.cards.map(rect);
    const next = nextLeg({ bottom: f.h, mark: rect(f.mark), endX: ml + 222.7 * kMark, lines: title, others: cards });
    const route = roundRoute(spineRoute({ ...base, next }), 14);
    const path = measure(route);
    expect(route.at(-1)).toEqual(next.end);
    // the lane passes right of every title line above the baseline (the first, widest one included) with air
    expect(next.dropX).toBeGreaterThanOrEqual(Math.max(...title.map((r) => r.right)) + 12);
    // … and left of the quiz card beside the title
    cards.filter((c) => c.left > ml).forEach((c) => expect(next.dropX).toBeLessThanOrEqual(c.left - 12));
    // the runtime guard agrees: the route stays out of every line (+2 px) and card
    expect(routeClear(route, [...title.map((r) => inflate([r.left, r.top, r.right, r.bottom], 2)), ...cards])).toBe(true);
    for (let s = 0; s <= path.length; s += 1) {
      const q = path.point(s);
      if (q.y <= f.h) obstacles.forEach((r) => expect(inRect(q.x, q.y, r)).toBe(false));
      else [...title, ...cards].forEach((r) => expect(inRect(q.x, q.y, r)).toBe(false));
    }
    // it reaches the title's baseline beside the mark and ends under the mark's first frame
    expect(Math.abs(next.end[1] - mb)).toBeLessThan(1);
  });
});

describe("hero floor diagonal — the lane beside a title whose first line is the widest", () => {
  // „Koji program / je za vaše / dete?“ + mark: line 1 reaches x 490, the mark's line only 426
  const lines: SpineRect[] = [
    { left: 60, top: 1029, right: 490, bottom: 1118 },
    { left: 60, top: 1090, right: 391, bottom: 1179 },
    { left: 60, top: 1155, right: 247, bottom: 1244 },
  ];
  const mark: SpineRect = { left: 260, top: 1165, right: 426, bottom: 1225 };
  const card: SpineRect = { left: 629, top: 1044, right: 1380, bottom: 1476 };
  const k = (mark.right - mark.left) / 570;
  const input = { matY: 341, matEnd: 1380, turn: 1410, bottom: 900, left: 60, obstacles: [] };
  const next = nextLeg({ bottom: 900, mark, endX: mark.left + 222.7 * k, lines, others: [card] });

  it("drops right of the widest line it passes, not just right of the mark", () => {
    expect(next.dropX).toBeGreaterThanOrEqual(490 + 12);
    expect(next.dropX).toBeLessThanOrEqual(490 + 32);
    expect(next.dropX).toBeLessThanOrEqual(card.left - 12);
  });

  it("never enters a title line, and the guard confirms it", () => {
    const route = roundRoute(spineRoute({ ...input, next }), 14);
    expect(routeClear(route, [...lines, card])).toBe(true);
  });

  it("the guard catches a lane beside the mark only (the old route through „program“)", () => {
    const old = { ...next, dropX: mark.right + 32 };
    const route = roundRoute(spineRoute({ ...input, next: old }), 14);
    expect(routeClear(route, lines)).toBe(false);
  });

  it("keeps air on both sides when the next box is close", () => {
    const tight = nextLeg({ bottom: 900, mark, endX: mark.left + 222.7 * k, lines, others: [{ ...card, left: 520 }] });
    expect(tight.dropX - 490).toBeGreaterThanOrEqual(12);
    expect(520 - tight.dropX).toBeGreaterThanOrEqual(12);
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

  it("rounds corners without leaving the corner's two segments", () => {
    const pts = roundRoute([[0, 0], [100, 0], [100, 100]], 14);
    const m = measure(pts);
    expect(m.length).toBeLessThan(200);
    expect(m.length).toBeGreaterThan(190);
    pts.forEach(([x, y]) => {
      expect(x).toBeLessThanOrEqual(100 + 1e-9);
      expect(y).toBeGreaterThanOrEqual(0);
    });
  });
});
