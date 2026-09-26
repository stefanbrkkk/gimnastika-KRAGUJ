import { gzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Pose } from "@/components/brand/Pose";
import { POSES, type PoseData, type PoseId } from "@/components/brand/poses.generated";

/** The pose family (docs/plan-figure-system.md §3 R7, §4, §7 Phase 1). */
const IDS = Object.keys(POSES) as PoseId[];
const pose = (id: PoseId): PoseData => POSES[id];

/** Poses that stand on the floor or on an apparatus (their lowest ink is the floor line). */
const STANDING: PoseId[] = ["beamHandstand", "cart1", "cart2", "cart3", "cartwheel", "highKick", "salute", "scale"];
/** Poses composed on an apparatus: hand/foot anchors the scene places on the rail, table or beam. */
const ANCHORED: Record<string, string[]> = {
  barHandstand: ["hand"], // P3: palms on the high rail's top
  vault: ["hand"], // P4: palms on the vault table's top
  scale: ["foot"], // P7: the flat support foot
  beamHandstand: ["hand"], // P8: palms on the beam's top
};
const TOL = 0.5;
const GZ_MAX = 600;

type Pt = readonly [number, number];

/** Tokens of an SVG path: commands and numbers. */
const tokens = (d: string) => d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];

/** Subpaths of a path as absolute polylines (curves sampled), each with whether it was closed by Z. */
function subpaths(d: string): { pts: Pt[]; closed: boolean }[] {
  const t = tokens(d);
  const out: { pts: [number, number][]; closed: boolean }[] = [];
  let cur: { pts: [number, number][]; closed: boolean } | null = null;
  let i = 0;
  let cmd = "";
  let [x, y, sx, sy, cx, cy] = [0, 0, 0, 0, 0, 0];
  let prev = "";
  const n = () => parseFloat(t[i++] ?? "NaN");
  while (i < t.length) {
    if (/[a-zA-Z]/.test(t[i] ?? "")) cmd = t[i++] ?? "";
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const [ox, oy] = rel ? [x, y] : [0, 0];
    if (C === "M") {
      [x, y] = [ox + n(), oy + n()];
      [sx, sy] = [x, y];
      cur = { pts: [[x, y]], closed: false };
      out.push(cur);
      cmd = rel ? "l" : "L";
      prev = "M";
      continue;
    }
    if (!cur) throw new Error("path must start with M");
    if (C === "Z") {
      cur.closed = true;
      [x, y] = [sx, sy];
      prev = "Z";
      continue;
    }
    if (cur.closed) {
      // drawing on after Z without a new M starts a new subpath at the start point
      cur = { pts: [[x, y]], closed: false };
      out.push(cur);
    }
    if (C === "L") [x, y] = [ox + n(), oy + n()];
    else if (C === "H") x = ox + n();
    else if (C === "V") y = oy + n();
    else if (C === "C" || C === "S") {
      const [x1, y1] = C === "C" ? [ox + n(), oy + n()] : prev === "C" || prev === "S" ? [2 * x - cx, 2 * y - cy] : [x, y];
      const [x2, y2, ex, ey] = [ox + n(), oy + n(), ox + n(), oy + n()];
      for (let k = 1; k < 12; k++) {
        const s = k / 12;
        const u = 1 - s;
        cur.pts.push([u * u * u * x + 3 * u * u * s * x1 + 3 * u * s * s * x2 + s * s * s * ex, u * u * u * y + 3 * u * u * s * y1 + 3 * u * s * s * y2 + s * s * s * ey]);
      }
      [cx, cy, x, y] = [x2, y2, ex, ey];
    } else throw new Error(`unexpected path command ${cmd} (poses are polylines after svgo)`);
    cur.pts.push([x, y]);
    prev = C;
  }
  return out;
}

const outline = (id: PoseId) => subpaths(pose(id).d).flatMap((s) => s.pts);

/** Distance from p to the closed polylines of the pose outline. */
function distToOutline(id: PoseId, p: Pt): number {
  let best = Infinity;
  for (const { pts } of subpaths(pose(id).d)) {
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

describe("poses: the family is complete (plan §4)", () => {
  it("has P1–P8 and the three cartwheel phases", () => {
    expect(IDS.slice().sort()).toEqual(
      ["barHandstand", "beamHandstand", "cart1", "cart2", "cart3", "cartwheel", "highKick", "salute", "scale", "star", "vault"].sort(),
    );
  });
});

describe.each(IDS)("pose %s", (id) => {
  const { viewBox } = pose(id);

  it("is one path of closed subpaths", () => {
    const subs = subpaths(pose(id).d);
    expect(subs.length).toBeGreaterThan(0);
    for (const s of subs) {
      expect(s.closed).toBe(true);
      expect(s.pts.length).toBeGreaterThan(3);
    }
  });

  it("lies inside its viewBox", () => {
    for (const [x, y] of outline(id)) {
      expect(x).toBeGreaterThanOrEqual(viewBox.x);
      expect(y).toBeGreaterThanOrEqual(viewBox.y);
      expect(x).toBeLessThanOrEqual(viewBox.x + viewBox.width);
      expect(y).toBeLessThanOrEqual(viewBox.y + viewBox.height);
    }
  });

  it(`is at most ${GZ_MAX} B gzipped as inlined`, () => {
    const svg = `<svg viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}"><path d="${pose(id).d}" fill="currentColor"/></svg>`;
    expect(gzipSync(Buffer.from(svg)).length).toBeLessThanOrEqual(GZ_MAX);
  });

  if (STANDING.includes(id)) {
    it("stands with its lowest ink on the floor line (±0.5 unit)", () => {
      const { floor } = pose(id);
      expect(floor).toBeTypeOf("number");
      const lowest = Math.max(...outline(id).map((p) => p[1]));
      expect(Math.abs(lowest - (floor ?? NaN))).toBeLessThanOrEqual(TOL);
    });
  }

  const contacts = Object.entries(pose(id).contacts ?? {});
  if (contacts.length) {
    it("touches every stored contact anchor (±0.5 unit of the ink edge)", () => {
      for (const [name, p] of contacts) expect(distToOutline(id, p), name).toBeLessThanOrEqual(TOL);
    });
  }
});

describe("poses: apparatus anchors (P3, P4, P7, P8)", () => {
  it.each(Object.entries(ANCHORED))("%s stores its anchors and touches them", (id, names) => {
    const stored = pose(id as PoseId).contacts ?? {};
    for (const name of names) {
      const p = stored[name];
      expect(p, `${id}.${name}`).toBeDefined();
      expect(distToOutline(id as PoseId, p!)).toBeLessThanOrEqual(TOL);
    }
  });

  it("support contacts are the lowest ink around them (hands/feet rest on the surface)", () => {
    for (const id of ["vault", "scale", "beamHandstand", "barHandstand"] as PoseId[]) {
      for (const [name, [cx, cy]] of Object.entries(pose(id).contacts ?? {})) {
        const near = outline(id).filter(([x]) => Math.abs(x - cx) <= 3);
        const lowest = Math.max(...near.map((p) => p[1]));
        // the rail grip hooks its fingers over the far side of the rail; the palm rests on its top
        const slack = id === "barHandstand" ? 6 : TOL;
        expect(lowest - cy, `${id}.${name}`).toBeLessThanOrEqual(slack);
        expect(lowest - cy, `${id}.${name}`).toBeGreaterThanOrEqual(-TOL);
      }
    }
  });
});

describe("poses: <Pose> renders the contract", () => {
  it("is decoration by default: aria-hidden, focusable=false, data-figure, one currentColor path", () => {
    const html = renderToStaticMarkup(createElement(Pose, { id: "salute", className: "x" }));
    const { viewBox, d } = pose("salute");
    expect(html).toContain(`viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}"`);
    expect(html).toContain('class="x"');
    expect(html).toContain('data-figure="pose:salute"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).not.toContain("role=");
    expect(html).not.toContain("<title>");
    expect(html.match(/<path /g)?.length).toBe(1);
    expect(html).toContain(`d="${d}"`);
    expect(html).toContain('fill="currentColor"');
  });

  it("with a title it is an image named by <title>, not hidden", () => {
    const html = renderToStaticMarkup(createElement(Pose, { id: "scale", title: "Vaga" }));
    expect(html).toContain('role="img"');
    expect(html).toContain("<title>Vaga</title>");
    expect(html).not.toContain("aria-hidden");
  });
});

describe("poses: the enrollment band (plan §5.9: cartwheel → salute)", async () => {
  const { buildBand, NARROW, WIDE } = await import("@/components/sections/enrollment/leap-band");
  type FigureId = import("@/components/sections/enrollment/leap-band").FigureId;

  describe.each([
    ["wide", WIDE],
    ["narrow", NARROW],
  ] as const)("%s band", (_, spec) => {
    const band = buildBand(spec);
    const { s, mat, w, h, ticks } = spec;
    const fig = (id: FigureId) => band.figures.find((f) => f.id === id)!;
    /** A pose point (pose units) in band units. */
    const at = (id: FigureId, [px, py]: readonly [number, number]) => {
      const f = fig(id);
      const vb = pose(id).viewBox;
      return [f.x + (px - vb.x) * s, f.y + (py - vb.y) * s] as const;
    };
    const contact = (id: FigureId, name: string) => at(id, pose(id).contacts![name]!);

    it("shows the four figures in the order of the movement", () => {
      expect(band.figures.map((f) => f.id)).toEqual(["cart1", "cart2", "cart3", "salute"]);
    });

    it("keeps every figure inside the band and standing on the mat", () => {
      for (const f of band.figures) {
        expect(f.x).toBeGreaterThanOrEqual(0);
        expect(f.y).toBeGreaterThanOrEqual(0);
        expect(f.x + f.width).toBeLessThanOrEqual(w);
        const lowest = Math.max(...outline(f.id).map(([x, y]) => at(f.id, [x, y])[1]));
        expect(Math.abs(lowest - mat), f.id).toBeLessThanOrEqual(TOL);
        expect(lowest).toBeLessThanOrEqual(h);
      }
    });

    it("stands cart1's foot, cart2's hands and the salute's feet on the step ticks (GE2-09)", () => {
      expect(contact("cart1", "foot")[0]).toBeCloseTo(ticks[0], 1);
      const [l, r] = [contact("cart2", "handL")[0], contact("cart2", "handR")[0]];
      expect((l + r) / 2).toBeCloseTo(ticks[1], 1);
      const salute = fig("salute");
      expect(salute.x + salute.width / 2).toBeCloseTo(ticks[2], 1);
      expect(salute.support).toEqual({ x: ticks[2], y: mat });
    });

    it("lands every support ahead of the previous one", () => {
      const salute = fig("salute");
      const xs = [
        contact("cart1", "foot")[0],
        contact("cart2", "handL")[0],
        contact("cart2", "handR")[0],
        contact("cart3", "toe")[0],
        contact("cart3", "foot")[0],
        salute.x + salute.width / 2,
      ];
      for (let k = 1; k < xs.length; k++) expect(xs[k]!, `support ${k}`).toBeGreaterThan(xs[k - 1]!);
    });

    it("never puts two figures closer than 70% of the wider one", () => {
      for (let k = 1; k < band.figures.length; k++) {
        const [a, b] = [band.figures[k - 1]!, band.figures[k]!];
        const gap = b.x + b.width / 2 - (a.x + a.width / 2);
        expect(gap / Math.max(a.width, b.width), `${a.id} → ${b.id}`).toBeGreaterThanOrEqual(0.7);
      }
    });
  });
});
