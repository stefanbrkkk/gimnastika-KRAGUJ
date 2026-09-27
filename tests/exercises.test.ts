import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { EXERCISE_AEROBIC_KICK } from "@/components/brand/exercises/aerobicKick.generated";
import { EXERCISE_BAR_CAST } from "@/components/brand/exercises/barCast.generated";
import { EXERCISE_BEAM_CARTWHEEL } from "@/components/brand/exercises/beamCartwheel.generated";
import { EXERCISE_COACH_SCALE } from "@/components/brand/exercises/coachScale.generated";
import { EXERCISE_ENROLL_CARTWHEEL } from "@/components/brand/exercises/enrollCartwheel.generated";
import { EXERCISE_STAR_JUMP } from "@/components/brand/exercises/starJump.generated";
import { EXERCISE_VAULT_HANDSPRING } from "@/components/brand/exercises/vaultHandspring.generated";
import type { ExerciseData } from "@/components/brand/exercises/types";
import { POSES, type PoseData, type PoseId } from "@/components/brand/poses.generated";
import { NARROW, WIDE } from "@/components/sections/enrollment/leap-band";
import { SW_REF, posePlacement } from "@/components/sections/programs/pose-scene";
import type { ApparatusIcon } from "@/content/programs";

/**
 * Scroll-scrubbed exercises (flipbooks): each is ONE continuous movement authored by
 * tools/figure-rig/exercises.py that ends exactly in its approved pose, every frame in that pose's
 * own viewBox coordinates. Checked here: the data contract, the final pose, the placed key poses of
 * the enrollment cartwheel, the size budget, and the fit of every frame in the scene the site draws
 * it in (floor / apparatus contacts, headroom, the plate's clipped edges).
 */
const EXERCISES = {
  starJump: EXERCISE_STAR_JUMP,
  beamCartwheel: EXERCISE_BEAM_CARTWHEEL,
  barCast: EXERCISE_BAR_CAST,
  vaultHandspring: EXERCISE_VAULT_HANDSPRING,
  aerobicKick: EXERCISE_AEROBIC_KICK,
  coachScale: EXERCISE_COACH_SCALE,
  enrollCartwheel: EXERCISE_ENROLL_CARTWHEEL,
} as const satisfies Record<string, ExerciseData>;
type ExerciseId = keyof typeof EXERCISES;
const IDS = Object.keys(EXERCISES) as ExerciseId[];
const ex = (id: ExerciseId): ExerciseData => EXERCISES[id];

/** Where each card exercise is drawn: its program plate's apparatus (pose-scene.ts). */
const CARD: Partial<Record<ExerciseId, ApparatusIcon>> = {
  starJump: "parter",
  beamCartwheel: "greda",
  barCast: "razboj",
  vaultHandspring: "preskok",
  aerobicKick: "aerobik",
};
/** gzip budget of each generated module (bytes). */
const GZ_MAX = (id: ExerciseId) => (id === "enrollCartwheel" ? 9 * 1024 : 6 * 1024);
/** Contact tolerance (pose units): key frames keep 0.1 precision; in-between frames are whole units. */
const TOL = 1;

type Pt = readonly [number, number];

/** Subpaths of a polyline path (M L H V Z, absolute or relative) as absolute points. */
function subpaths(d: string): { pts: Pt[]; closed: boolean }[] {
  const t = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const out: { pts: [number, number][]; closed: boolean }[] = [];
  let cur: { pts: [number, number][]; closed: boolean } | null = null;
  let [x, y, sx, sy] = [0, 0, 0, 0];
  let cmd = "";
  let i = 0;
  const n = () => parseFloat(t[i++] ?? "NaN");
  while (i < t.length) {
    if (/[a-zA-Z]/.test(t[i] ?? "")) cmd = t[i++] ?? "";
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === "M") {
      [x, y] = rel ? [x + n(), y + n()] : [n(), n()];
      [sx, sy] = [x, y];
      cur = { pts: [[x, y]], closed: false };
      out.push(cur);
      cmd = rel ? "l" : "L";
      continue;
    }
    if (!cur) throw new Error("path must start with M");
    if (C === "Z") {
      cur.closed = true;
      [x, y] = [sx, sy];
      continue;
    }
    if (C === "L") [x, y] = rel ? [x + n(), y + n()] : [n(), n()];
    else if (C === "H") x = rel ? x + n() : n();
    else if (C === "V") y = rel ? y + n() : n();
    else throw new Error(`unexpected path command ${cmd} (frames are polylines after svgo)`);
    cur.pts.push([x, y]);
  }
  return out;
}

const points = (d: string): Pt[] => subpaths(d).flatMap((s) => s.pts);
const lowest = (d: string) => Math.max(...points(d).map((p) => p[1]));

/** Whether p lies inside the filled path (even-odd over its subpaths). */
function inside(d: string, [px, py]: Pt): boolean {
  let odd = false;
  for (const { pts } of subpaths(d)) {
    for (let k = 0, j = pts.length - 1; k < pts.length; j = k++) {
      const [ax, ay] = pts[k]!;
      const [bx, by] = pts[j]!;
      if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) odd = !odd;
    }
  }
  return odd;
}

function distToOutline(d: string, p: Pt): number {
  let best = Infinity;
  for (const { pts } of subpaths(d)) {
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k]!;
      const b = pts[(k + 1) % pts.length]!;
      const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
      const L = dx * dx + dy * dy || 1e-12;
      const s = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
      best = Math.min(best, Math.hypot(p[0] - a[0] - s * dx, p[1] - a[1] - s * dy));
    }
  }
  return best;
}

/** A frame's points in the icon units of its program plate (the pose placement the card uses). */
const toIcon = (icon: ApparatusIcon, d: string): Pt[] => {
  const { ox, oy, k } = posePlacement(icon);
  return points(d).map(([x, y]) => [ox + x * k, oy + y * k] as const);
};

/** The plate's reserved headroom per apparatus (programs.css --head, icon units). */
const css = readFileSync("styles/sections/programs.css", "utf8");
const head = (icon: ApparatusIcon) =>
  Number(css.match(new RegExp(`\\.pc-plate\\[data-apparatus="${icon}"\\],\\s*\\.ps-plate\\[data-apparatus="${icon}"\\]\\s*\\{\\s*--head:\\s*(\\d+);`))?.[1] ?? 0);

describe.each(IDS)("exercise %s", (id) => {
  const e = ex(id);
  const last = e.frames.length - 1;

  it("ends exactly in its approved pose", () => {
    expect(e.frames[last]).toBe(POSES[e.pose].d);
  });

  it("has keys ascending from the first frame to the last, and ghosts that are earlier frames", () => {
    expect(e.keys[0]).toBe(0);
    expect(e.keys[e.keys.length - 1]).toBe(last);
    for (let k = 1; k < e.keys.length; k++) expect(e.keys[k]!).toBeGreaterThan(e.keys[k - 1]!);
    expect(e.ghosts.length).toBeLessThanOrEqual(3);
    for (let k = 0; k < e.ghosts.length; k++) {
      const g = e.ghosts[k]!;
      expect(Number.isInteger(g) && g >= 0 && g < last, `ghost ${g}`).toBe(true);
      if (k) expect(g).toBeGreaterThan(e.ghosts[k - 1]!);
    }
  });

  it("is a flipbook of distinct frames, each one path of closed subpaths", () => {
    expect(e.frames.length).toBeGreaterThanOrEqual(16);
    expect(e.frames.length).toBeLessThanOrEqual(36);
    expect(new Set(e.frames).size).toBe(e.frames.length);
    for (const [k, d] of e.frames.entries()) {
      const subs = subpaths(d);
      expect(subs.length, `frame ${k}`).toBeGreaterThan(0);
      for (const s of subs) {
        expect(s.closed, `frame ${k}`).toBe(true);
        expect(s.pts.length, `frame ${k}`).toBeGreaterThan(3);
      }
    }
  });

  it("has bounds that hold every frame (and are tight)", () => {
    const [x0, y0, x1, y1] = e.bounds;
    const all = e.frames.flatMap(points);
    const eps = 1e-6; // relative path data accumulates float error
    for (const [x, y] of all) {
      expect(x).toBeGreaterThanOrEqual(x0 - eps);
      expect(y).toBeGreaterThanOrEqual(y0 - eps);
      expect(x).toBeLessThanOrEqual(x1 + eps);
      expect(y).toBeLessThanOrEqual(y1 + eps);
    }
    expect(Math.min(...all.map((p) => p[0])) - x0).toBeLessThan(0.11);
    expect(y1 - Math.max(...all.map((p) => p[1]))).toBeLessThan(0.11);
  });

  it(`is within its gzip budget (${GZ_MAX(id)} B as generated)`, () => {
    const src = readFileSync(`components/brand/exercises/${id}.generated.ts`, "utf8");
    expect(gzipSync(Buffer.from(src), { level: 9 }).length).toBeLessThanOrEqual(GZ_MAX(id));
  });
});

describe("exercises: the card plates (programs, pose-scene.ts)", () => {
  // the plate clips its scene (overflow: hidden) 14 px left of the drawing at the largest, 176 px drawing
  const LEFT = (-48 * 14) / 176;

  it.each(Object.entries(CARD) as [ExerciseId, ApparatusIcon][])("%s stays inside its %s plate's left edge", (id, icon) => {
    for (const [k, d] of ex(id).frames.entries()) {
      expect(Math.min(...toIcon(icon, d).map((p) => p[0])), `frame ${k}`).toBeGreaterThanOrEqual(LEFT);
    }
  });

  /** Headroom beyond the plate's reservation, by design (reported for the integration): the beam
   *  cartwheel starts upright on the beam with arms up (cart1's stance), 11.6 units above the drawing
   *  where the static inverted star rises 7.5 — the greda plate needs --head: 12 for it. */
  const HEAD_NEED: Partial<Record<ExerciseId, number>> = { beamCartwheel: 12 };

  it.each(Object.entries(CARD) as [ExerciseId, ApparatusIcon][])("%s never rises above the %s plate's headroom", (id, icon) => {
    const allowed = Math.max(head(icon), HEAD_NEED[id] ?? 0);
    for (const [k, d] of ex(id).frames.entries()) {
      expect(-Math.min(...toIcon(icon, d).map((p) => p[1])), `frame ${k}`).toBeLessThanOrEqual(allowed);
    }
  });

  it("starJump stands on the carpet until she leaves it, then rises straight up into the star", () => {
    const e = ex("starJump");
    const carpet = lowest(e.frames[0]!);
    const takeoff = e.keys[2]!;
    for (const [k, d] of e.frames.entries()) {
      expect(lowest(d), `frame ${k}`).toBeLessThanOrEqual(carpet + 0.5);
      if (k <= takeoff) expect(Math.abs(lowest(d) - carpet), `frame ${k}`).toBeLessThanOrEqual(TOL);
    }
    // the standing point lies on the floor mat (the carpet parallelogram M1.5 42 L13 22 H46.5 L35 42)
    const feet = toIcon("parter", e.frames[0]!).filter(([, y]) => y > posePlacement("parter").oy + (carpet - 1) * posePlacement("parter").k);
    const [fx, fy] = [feet.reduce((s, p) => s + p[0], 0) / feet.length, feet[0]![1]];
    expect(fy).toBeGreaterThan(22);
    expect(fy).toBeLessThan(42);
    expect(fx).toBeGreaterThan(1.5 + ((42 - fy) / 20) * 11.5);
    expect(fx).toBeLessThan(35 + ((42 - fy) / 20) * 11.5);
    // straight up: the figure's axis never drifts
    const axis = (d: string) => (Math.min(...points(d).map((p) => p[0])) + Math.max(...points(d).map((p) => p[0]))) / 2;
    for (const d of e.frames) expect(Math.abs(axis(d) - axis(e.frames[last(e)]!))).toBeLessThanOrEqual(TOL);
  });

  it("beamCartwheel: every frame rests a foot or a hand on the beam top, never below it, over the beam", () => {
    const beam = POSES.cartwheel.floor!;
    for (const [k, d] of ex("beamCartwheel").frames.entries()) {
      expect(Math.abs(lowest(d) - beam), `frame ${k}`).toBeLessThanOrEqual(TOL);
      for (const [x, y] of toIcon("greda", d)) if (y > 21.5 - SW_REF / 2 + 0.2) expect(x < 3.5 || x > 44.5, `frame ${k} dips into the beam`).toBe(true);
    }
  });

  it("barCast: the hands never leave the rail contact; nothing touches the low rail or the floor", () => {
    const hand = POSES.barHandstand.contacts!.hand!;
    for (const [k, d] of ex("barCast").frames.entries()) {
      // on the ink's edge, or covered by it (in front support the grip overlaps the hips)
      expect(inside(d, hand) || distToOutline(d, hand) <= TOL, `frame ${k}`).toBe(true);
      for (const [x, y] of toIcon("razboj", d)) {
        const onLowRail = x <= 29.5 + SW_REF && Math.abs(y - 27.5) <= (SW_REF * 1.4) / 2 + 0.2;
        expect(onLowRail, `frame ${k} touches the low rail`).toBe(false);
        expect(y, `frame ${k}`).toBeLessThan(42);
      }
    }
  });

  it("vaultHandspring: on the run-up, the board and the table, never through them", () => {
    const e = ex("vaultHandspring");
    const runway = 42 - SW_REF / 2;
    // the springboard's top edge (its stroke's outer edge) from (11, 42) to (20.5, 37.5)
    const len = Math.hypot(9.5, 4.5);
    const [nx, ny] = [-4.5 / len, -9.5 / len];
    const board = (x: number) => 42 + ny * (SW_REF / 2) + ((x - 11 - nx * (SW_REF / 2)) * -4.5) / 9.5;
    const table = 14 - SW_REF / 2;
    const tol = TOL * posePlacement("preskok").k; // one pose unit in icon units
    for (const [k, d] of e.frames.entries()) {
      for (const [x, y] of toIcon("preskok", d)) {
        expect(y, `frame ${k} below the run-up`).toBeLessThanOrEqual(runway + tol);
        if (x >= 11 && x <= 20.5) expect(y, `frame ${k} in the board`).toBeLessThanOrEqual(board(x) + tol);
        if (x >= 25.5 && x <= 47) expect(y > table + tol && y < 20.5, `frame ${k} in the table`).toBe(false);
      }
    }
    // the run and the board touch their lines; from the hand contact on, the hand is on the table top
    const low = (d: string) => Math.max(...toIcon("preskok", d).map((p) => p[1]));
    expect(Math.abs(low(e.frames[0]!) - runway)).toBeLessThanOrEqual(tol);
    const boardKey = e.frames[e.keys[2]!]!;
    const dist = Math.min(...toIcon("preskok", boardKey).filter(([x]) => x >= 11 && x <= 20.5).map(([x, y]) => board(x) - y));
    expect(Math.abs(dist)).toBeLessThanOrEqual(tol);
    const hand = POSES.vault.contacts!.hand!;
    for (let k = e.keys[e.keys.length - 2]!; k <= last(e); k++) expect(distToOutline(e.frames[k]!, hand), `frame ${k}`).toBeLessThanOrEqual(2);
  });

  it("aerobicKick: the support foot stands on the mat in every frame, exactly where the pose has it", () => {
    const { floor, contacts } = POSES.highKick;
    for (const [k, d] of ex("aerobicKick").frames.entries()) {
      expect(Math.abs(lowest(d) - floor!), `frame ${k}`).toBeLessThanOrEqual(0.5);
      expect(distToOutline(d, contacts!.foot!), `frame ${k}`).toBeLessThanOrEqual(TOL);
    }
  });
});

describe("exercises: the coach plate (coaches.css: 4:5 plate, subject 86% wide from 7%, mat at 74%)", () => {
  it("coachScale keeps its support foot flat on the mat and stays inside the plate", () => {
    const { floor, contacts, viewBox } = POSES.scale;
    const s = 0.86 / viewBox.width; // plate widths per pose unit
    for (const [k, d] of ex("coachScale").frames.entries()) {
      expect(Math.abs(lowest(d) - floor!), `frame ${k}`).toBeLessThanOrEqual(0.5);
      expect(distToOutline(d, contacts!.foot!), `frame ${k}`).toBeLessThanOrEqual(TOL);
      for (const [x, y] of points(d)) {
        expect(0.07 + x * s, `frame ${k}`).toBeGreaterThanOrEqual(0);
        expect(0.07 + x * s, `frame ${k}`).toBeLessThanOrEqual(1);
        expect(0.74 * 1.25 - (floor! - y) * s, `frame ${k}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("exercises: the enrollment cartwheel (leap-band.ts)", () => {
  const e = ex("enrollCartwheel");
  const KEY_POSES: PoseId[] = ["cart1", "cart2", "cart3", "salute"];

  it("its keys are exactly the approved cart1 → cart2 → cart3 → salute, placed at keyOrigins", () => {
    expect(e.keys.length).toBe(KEY_POSES.length);
    expect(e.keyOrigins?.length).toBe(KEY_POSES.length);
    expect(e.keyOrigins![KEY_POSES.length - 1]).toEqual([0, 0]);
    KEY_POSES.forEach((pid, j) => {
      const [ox, oy] = e.keyOrigins![j]!;
      const got = points(e.frames[e.keys[j]!]!);
      const want = points(POSES[pid].d);
      expect(got.length, pid).toBe(want.length);
      got.forEach(([x, y], q) => {
        expect(x - ox, pid).toBeCloseTo(want[q]![0], 6);
        expect(y - oy, pid).toBeCloseTo(want[q]![1], 6);
      });
    });
  });

  it("leaves cart1, cart2 and cart3 as its ghosts", () => {
    expect(e.ghosts).toEqual(e.keys.slice(0, 3));
  });

  it("travels right, every key pose standing on the same mat", () => {
    const floor = POSES.salute.floor!;
    KEY_POSES.forEach((pid, j) => {
      expect(e.keyOrigins![j]![1] + (POSES[pid] as PoseData).floor!, pid).toBeCloseTo(floor, 6);
      if (j) expect(e.keyOrigins![j]![0]).toBeGreaterThan(e.keyOrigins![j - 1]![0]);
    });
  });

  it("touches the mat in every frame (a cartwheel always has a hand or a foot down) and fits the band's height", () => {
    const floor = POSES.salute.floor!;
    for (const [k, d] of e.frames.entries()) {
      expect(Math.abs(lowest(d) - floor), `frame ${k}`).toBeLessThanOrEqual(TOL);
      const rise = floor - Math.min(...points(d).map((p) => p[1]));
      for (const band of [WIDE, NARROW]) expect(rise * band.s, `frame ${k}`).toBeLessThanOrEqual(band.mat);
    }
  });
});

function last(e: ExerciseData) {
  return e.frames.length - 1;
}
