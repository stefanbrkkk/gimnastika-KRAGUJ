import { describe, expect, it } from "vitest";
import {
  blockParts,
  chipByKey,
  filterHint,
  filterStatus,
  glueDash,
  matchingIds,
  PROGRAM_BIB,
  PROGRAM_CHIPS,
  programDays,
  programSchedule,
  TIME_JOINER,
  usableChips,
} from "@/components/sections/programs/model";
import { QUIZ } from "@/content/copy";
import { PROGRAMS, programById, visiblePrograms } from "@/content/programs";
import { formatBlock, SCHEDULE, type ProgramId } from "@/content/schedule";

const VISIBLE: ProgramId[] = ["mladja", "starija", "c-program", "ab-program", "aerobik"];

describe("programs: visible cards", () => {
  it("shows the five §5 programs in card order while SHOW_TRAMPOLINE is false", () => {
    expect(visiblePrograms(false).map((p) => p.id)).toEqual(VISIBLE);
  });
});

describe("programs: schedule lines", () => {
  it("renders exactly formatBlock() for every block (both shift-note settings)", () => {
    for (const shift of [false, true]) {
      for (const group of SCHEDULE) {
        for (const block of group.blocks) {
          const parts = blockParts(block, shift);
          expect(`${parts.days} ${parts.times.join(TIME_JOINER)}`).toBe(formatBlock(block, shift));
          expect(parts.text).toBe(formatBlock(block, shift));
        }
      }
    }
  });

  it("matches the §5 S3 card lines (hard-coded)", () => {
    const lines = (id: ProgramId) =>
      programSchedule(programById(id), false).map((g) => ({ label: g.label, text: g.blocks.map((b) => b.text).join("; ") }));
    expect(lines("mladja")).toEqual([{ label: undefined, text: "Po, Sr, Pe 18:00–19:00" }]);
    expect(lines("starija")).toEqual([{ label: undefined, text: "Po, Sr, Pe 19:00–20:00" }]);
    expect(lines("c-program")).toEqual([
      { label: "Starije", text: "Po, Sr, Pe 08:30–10:30 ili 16:00–18:00" },
      { label: "Mlađe", text: "Ut, Če 19:30–21:30; Pe 08:30–10:30 ili 16:00–18:00" },
    ]);
    expect(lines("ab-program")).toEqual([
      { label: undefined, text: "Po, Sr, Pe 08:30–10:30 ili 16:00–18:00; Ut, Če 17:30–19:30" },
    ]);
    expect(lines("aerobik")).toEqual([{ label: undefined, text: "Po, Sr, Pe 20:00–21:30" }]);
  });

  it("gives screen readers full day names", () => {
    const [group] = programSchedule(programById("c-program"), false);
    expect(group?.blocks[0]?.daysFull).toBe("ponedeljak, sreda, petak");
  });
});

describe("programs: age chips", () => {
  const ids = (key: Parameters<typeof chipByKey>[0]) => matchingIds(chipByKey(key), VISIBLE);

  it("keeps every program under „Sve“ (the all-chip label shared with S4 and S9)", () => {
    expect(chipByKey("svi").label).toBe("Sve");
    expect(ids("svi")).toEqual(VISIBLE);
  });

  it("follows the §5 quiz rules: 3–8 → mlađa, 8+ → starija or competitive", () => {
    expect(ids("3-8")).toEqual(["mladja"]);
    expect(ids("8+")).toEqual(["starija", "c-program", "ab-program"]);
    expect(ids("takmicarke")).toEqual(["c-program", "ab-program"]);
  });

  it("never matches a program that is not visible (e.g. trampolina behind its flag)", () => {
    for (const chip of PROGRAM_CHIPS) {
      expect(matchingIds(chip, VISIBLE)).not.toContain("trampolina");
    }
  });

  it("drops chips that would produce an empty row", () => {
    expect(usableChips(VISIBLE).map((c) => c.key)).toEqual(["svi", "3-8", "8+", "takmicarke"]);
    expect(usableChips(["aerobik"]).map((c) => c.key)).toEqual(["svi"]);
  });

  it("announces what is shown and keeps aerobic gymnastics findable", () => {
    expect(filterStatus(chipByKey("svi"), VISIBLE)).toBe("");
    expect(filterStatus(chipByKey("3-8"), VISIBLE)).toBe(`Prikazano: 1 od 5 programa. ${QUIZ.aerobicHint}`);
    expect(filterStatus(chipByKey("takmicarke"), VISIBLE)).toBe(`Prikazano: 2 od 5 programa. ${QUIZ.aerobicHint}`);
  });

  it("keeps the aerobic hint separately for the phone line under the row", () => {
    expect(filterHint(chipByKey("svi"), VISIBLE)).toBe("");
    expect(filterHint(chipByKey("8+"), VISIBLE)).toBe(QUIZ.aerobicHint);
    expect(filterHint(chipByKey("3-8"), ["mladja", "starija"])).toBe("");
  });

  it("uses only program ids that exist", () => {
    const known = new Set(PROGRAMS.map((p) => p.id));
    for (const chip of PROGRAM_CHIPS) for (const id of chip.ids ?? []) expect(known.has(id)).toBe(true);
  });
});

describe("programs: typography", () => {
  it("glues a spaced dash to the word before it, text otherwise unchanged", () => {
    expect(glueDash("Takmičarke — C program")).toBe("Takmičarke\u00A0— C program");
    expect(glueDash("Mlađa početna grupa")).toBe("Mlađa početna grupa");
  });
});

describe("programs: plate print", () => {
  it("renders each bib from the program's own age line or title — no new fact", () => {
    for (const p of visiblePrograms(false)) {
      const bib = PROGRAM_BIB[p.id];
      if (bib === null) {
        expect(p.age).toBeNull(); // no age claim, no bib (aerobic gymnastics)
        expect(p.id).toBe("aerobik");
        continue;
      }
      const source = `${p.age ?? ""} ${p.title}`;
      for (const token of bib.split(/[·+]/).filter(Boolean)) expect(source).toContain(token);
    }
    expect(PROGRAM_BIB.mladja).toBe("3–8");
    expect(PROGRAM_BIB.starija).toBe("8+");
    expect(PROGRAM_BIB["c-program"]).toBe("C");
    expect(PROGRAM_BIB["ab-program"]).toBe("A·B");
  });

  it("gives the card one week row: the union of all its groups' days", () => {
    const days = (id: ProgramId) => [...programDays(programById(id))].sort();
    expect(days("mladja")).toEqual(["pe", "po", "sr"]);
    expect(days("c-program")).toEqual(["ce", "pe", "po", "sr", "ut"]); // starije Po Sr Pe + mlađe Ut Če Pe
    expect(days("ab-program")).toEqual(["ce", "pe", "po", "sr", "ut"]);
  });
});

/* --------------------------------------------------------------------------------------------
   Design review v2 (round 2)
   -------------------------------------------------------------------------------------------- */

describe("programs: phone row pager (QP2-01)", async () => {
  const { pagerTarget } = await import("@/components/sections/programs/pager");
  /** Snap starts as the island reads them: visible frames in DOM order (cards, then the KR-04
   *  photo, which CSS order −1 puts first on screen), offsetLeft − the row's padding. */
  const ROW_390 = { starts: [260, 590, 920, 1250, 1580, 0], max: 1548 }; // measured at 390×844
  const ROW_320 = { starts: [217, 489, 761, 1033, 1305, 0], max: 1285 }; // measured at 320×640
  const prev = (row: typeof ROW_390, x: number) => pagerTarget(row.starts, x, -1, row.max);
  const next = (row: typeof ROW_390, x: number) => pagerTarget(row.starts, x, 1, row.max);

  it("goes back one card, not to the photo: from the C card (920) to Starija (590)", () => {
    expect(prev(ROW_390, 920)).toBe(590);
    expect(prev(ROW_390, 590)).toBe(260);
    expect(prev(ROW_390, 260)).toBe(0); // Mlađa → the photo
    expect(prev(ROW_390, 0)).toBe(0);
  });

  it("from the end of the row goes back to the card before the last", () => {
    expect(prev(ROW_390, ROW_390.max)).toBe(1250);
    expect(prev(ROW_320, ROW_320.max)).toBe(1033);
  });

  it("forward stops at the end of the row (the last card cannot snap to its start)", () => {
    expect(next(ROW_390, 0)).toBe(260);
    expect(next(ROW_390, 920)).toBe(1250);
    expect(next(ROW_390, 1250)).toBe(ROW_390.max);
    expect(next(ROW_390, ROW_390.max)).toBe(ROW_390.max);
  });

  it("is symmetric: back then forward (and forward then back) returns to the same frame", () => {
    for (const row of [ROW_390, ROW_320]) {
      const stops = [...new Set([...row.starts].sort((a, b) => a - b).map((s) => Math.min(s, row.max)))];
      for (const [k, s] of stops.entries()) {
        if (k > 0) expect(next(row, prev(row, s))).toBe(s);
        if (k < stops.length - 1) expect(prev(row, next(row, s))).toBe(s);
      }
    }
  });

  it("tolerates a few px of sub-pixel snapping", () => {
    expect(prev(ROW_390, 922)).toBe(590);
    expect(next(ROW_390, 918)).toBe(1250);
  });
});

describe("programs: keyframe easings are literal (MD2-01)", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync("styles/sections/programs.css", "utf8");
  const tokens = readFileSync("styles/motion-tokens.css", "utf8");
  const token = (name: string) => tokens.match(new RegExp(`--ease-${name}:\\s*(linear\\([^)]*\\))`))?.[1];
  const keyframes = (name: string) => {
    const start = css.indexOf(`@keyframes ${name} {`);
    if (start < 0) return "";
    let depth = 0;
    for (let i = css.indexOf("{", start); i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
    }
    return "";
  };
  const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1] ?? "");

  it("never uses var() for an easing inside @keyframes (Chromium plays it linear)", () => {
    expect(names.length).toBeGreaterThan(10);
    for (const name of names) expect(keyframes(name), name).not.toMatch(/animation-timing-function\s*:\s*var\(/);
  });

  it("beam and bars carry the wobble / swing curves of styles/motion-tokens.css, after a rebound fallback", () => {
    const wobble = token("wobble");
    const swing = token("swing");
    expect(wobble).toMatch(/^linear\(0, /);
    expect(swing).toMatch(/^linear\(0, /);
    for (const [name, curve] of [
      ["pi-beam", wobble],
      ["pi-beam-legs", wobble],
      ["pi-bars", swing],
    ] as const) {
      const body = keyframes(name);
      expect(body, name).toContain(`animation-timing-function: ${curve};`);
      const fallback = body.indexOf("animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);");
      expect(fallback, name).toBeGreaterThan(-1);
      expect(fallback, name).toBeLessThan(body.indexOf(`animation-timing-function: ${curve}`));
    }
  });

  it("the beam flexes vertically, never rotates (QP2-11)", () => {
    expect(keyframes("pi-beam")).not.toMatch(/rotate/);
    expect(keyframes("pi-beam-legs")).toMatch(/scaleY/);
  });
});

describe("programs: aerobic silhouette plate (QP2-06)", async () => {
  const { LEAP_PATH, LEAP_VIEWBOX } = await import("@/components/brand/sprite-paths.generated");
  const { LEAP_ICON_BOX, LEAP_ICON_D } = await import("@/components/sections/programs/leap-icon");

  /** Absolute polyline of an SVG path (curves and arcs sampled). */
  function outline(d: string): [number, number][] {
    const t = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
    const pts: [number, number][] = [];
    let i = 0;
    let cmd = "";
    let prev = "";
    let [x, y, sx, sy, cx, cy, qx, qy] = [0, 0, 0, 0, 0, 0, 0, 0];
    const num = () => parseFloat(t[i++] ?? "0");
    while (i < t.length) {
      if (/[a-zA-Z]/.test(t[i] ?? "")) cmd = t[i++] ?? "";
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      const [ox, oy] = rel ? [x, y] : [0, 0];
      if (C === "M") {
        x = ox + num();
        y = oy + num();
        [sx, sy] = [x, y];
        pts.push([x, y]);
        cmd = rel ? "l" : "L";
        prev = "M";
        continue;
      }
      if (C === "Z") {
        [x, y] = [sx, sy];
        prev = "Z";
        continue;
      }
      if (C === "L") [x, y] = [ox + num(), oy + num()];
      else if (C === "H") x = ox + num();
      else if (C === "V") y = oy + num();
      else if (C === "C" || C === "S") {
        const [x1, y1] = C === "C" ? [ox + num(), oy + num()] : prev === "C" || prev === "S" ? [2 * x - cx, 2 * y - cy] : [x, y];
        const [x2, y2, ex, ey] = [ox + num(), oy + num(), ox + num(), oy + num()];
        for (let k = 1; k <= 12; k++) {
          const s = k / 12;
          const u = 1 - s;
          pts.push([u * u * u * x + 3 * u * u * s * x1 + 3 * u * s * s * x2 + s * s * s * ex, u * u * u * y + 3 * u * u * s * y1 + 3 * u * s * s * y2 + s * s * s * ey]);
        }
        [cx, cy, x, y] = [x2, y2, ex, ey];
      } else if (C === "Q" || C === "T") {
        const [x1, y1] = C === "Q" ? [ox + num(), oy + num()] : prev === "Q" || prev === "T" ? [2 * x - qx, 2 * y - qy] : [x, y];
        const [ex, ey] = [ox + num(), oy + num()];
        for (let k = 1; k <= 12; k++) {
          const s = k / 12;
          const u = 1 - s;
          pts.push([u * u * x + 2 * u * s * x1 + s * s * ex, u * u * y + 2 * u * s * y1 + s * s * ey]);
        }
        [qx, qy, x, y] = [x1, y1, ex, ey];
      } else if (C === "A") {
        // SVG arc: endpoint → centre parameterisation (SVG 2, F.6.5), then sampled.
        let [rx, ry] = [Math.abs(num()), Math.abs(num())];
        const phi = (num() * Math.PI) / 180;
        const [fa, fs] = [num(), num()];
        const [ex, ey] = [ox + num(), oy + num()];
        const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
        const [hx, hy] = [(x - ex) / 2, (y - ey) / 2];
        const [x1, y1] = [cos * hx + sin * hy, -sin * hx + cos * hy];
        const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
        if (lambda > 1) [rx, ry] = [rx * Math.sqrt(lambda), ry * Math.sqrt(lambda)];
        const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
        const co = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, (rx * rx * ry * ry - den) / den));
        const [ccx, ccy] = [(co * rx * y1) / ry, (-co * ry * x1) / rx];
        const [mx, my] = [cos * ccx - sin * ccy + (x + ex) / 2, sin * ccx + cos * ccy + (y + ey) / 2];
        const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
        const th = angle(1, 0, (x1 - ccx) / rx, (y1 - ccy) / ry);
        let dth = angle((x1 - ccx) / rx, (y1 - ccy) / ry, (-x1 - ccx) / rx, (-y1 - ccy) / ry);
        if (!fs && dth > 0) dth -= 2 * Math.PI;
        else if (fs && dth < 0) dth += 2 * Math.PI;
        const n = Math.max(4, Math.ceil(Math.abs(dth) / (Math.PI / 16)));
        for (let k = 1; k < n; k++) {
          const a = th + (dth * k) / n;
          pts.push([mx + rx * Math.cos(a) * cos - ry * Math.sin(a) * sin, my + rx * Math.cos(a) * sin + ry * Math.sin(a) * cos]);
        }
        [x, y] = [ex, ey];
      } else throw new Error(`path command ${cmd}`);
      if (C !== "C" && C !== "S" && C !== "Q" && C !== "T") pts.push([x, y]);
      prev = C;
    }
    return pts;
  }
  const s = LEAP_ICON_BOX.width / LEAP_VIEWBOX.width;
  const logo = outline(LEAP_PATH).map(([px, py]) => [LEAP_ICON_BOX.x + (px - LEAP_VIEWBOX.x) * s, LEAP_ICON_BOX.y + (py - LEAP_VIEWBOX.y) * s] as const);
  const icon = outline(LEAP_ICON_D);
  const segDist = (p: readonly [number, number], a: readonly [number, number], b: readonly [number, number]) => {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const L = dx * dx + dy * dy || 1e-9;
    const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
    return Math.hypot(p[0] - a[0] - k * dx, p[1] - a[1] - k * dy);
  };
  const toPolyline = (poly: readonly (readonly [number, number])[], p: readonly [number, number]) =>
    Math.min(...poly.map((a, k) => segDist(p, a, poly[(k + 1) % poly.length] ?? a)));

  it("places #leap with its own aspect, 48 units wide, the front toe on the floor y = 42", () => {
    expect(LEAP_ICON_BOX.width / LEAP_ICON_BOX.height).toBeCloseTo(LEAP_VIEWBOX.width / LEAP_VIEWBOX.height, 3);
    expect(Math.max(...logo.map((p) => p[1]))).toBeCloseTo(42, 1);
    expect(Math.min(...logo.map((p) => p[0]))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...logo.map((p) => p[0]))).toBeLessThanOrEqual(48);
  });

  it("the static-print path is the logo outline (within 0.2 units both ways)", () => {
    expect(Math.max(...icon.map((p) => toPolyline(logo, p)))).toBeLessThan(0.2);
    expect(Math.max(...logo.map((p) => toPolyline(icon, p)))).toBeLessThan(0.2);
    expect(LEAP_ICON_D.length).toBeLessThan(800); // it travels in the HTML of the card and the quiz
  });

  it("keeps the ProgramIcon contract the quiz reads: every apparatus has a path print", async () => {
    const { iconArt } = await import("@/components/sections/quiz/views");
    for (const icon of ["parter", "greda", "razboj", "preskok", "aerobik"] as const) {
      expect(iconArt(icon).paths.length, icon).toBeGreaterThan(0);
    }
    expect(iconArt("aerobik").paths.map((p) => p.d)).toEqual([LEAP_ICON_D]);
  });
});

describe("programs: plate scene (QP2-05, QP2-11)", async () => {
  const { isValidElement } = await import("react");
  const { ProgramIcon } = await import("@/components/sections/programs/ProgramIcon");
  type Props = { className?: unknown; href?: unknown; children?: unknown };
  /** Class names of a rendered tree; function components (the posed figure) are rendered too. */
  const classes = (node: unknown): string[] => {
    if (Array.isArray(node)) return node.flatMap(classes);
    if (!isValidElement<Props>(node)) return [];
    if (typeof node.type === "function") return classes((node.type as (p: Props) => unknown)(node.props));
    const own = typeof node.props.className === "string" ? node.props.className.split(" ") : [];
    return [...own, ...classes(node.props.children)];
  };
  const render = (icon: Parameters<typeof ProgramIcon>[0]["icon"], scene?: "card" | "sheet") =>
    classes(ProgramIcon({ icon, label: "", scene }));

  it("cards get the posed silhouette but no trails; the sheet gets both", () => {
    for (const icon of ["parter", "razboj", "preskok"] as const) {
      expect(render(icon, "card"), icon).toContain("pi-fig");
      expect(render(icon, "card"), icon).not.toContain("pi-fx");
      expect(render(icon, "sheet"), icon).toContain("pi-fx");
    }
    expect(render("greda", "card")).toContain("pi-fig");
    expect(render("greda", "sheet")).not.toContain("pi-fx"); // the beam has no trail
  });

  it("aerobik: the drawing is the silhouette itself; the scene adds her mirrored partner", () => {
    expect(render("aerobik")).toContain("pi-solid");
    expect(render("aerobik", "card")).toContain("pi-fig");
    expect(render("aerobik", "sheet")).toContain("pi-fig");
    expect(render("aerobik", "sheet")).not.toContain("pi-fx");
  });

  it("the bare drawing (quiz plates) has neither silhouette nor trails", () => {
    for (const icon of ["parter", "greda", "razboj", "preskok", "aerobik"] as const) {
      expect(render(icon)).not.toContain("pi-fig");
      expect(render(icon)).not.toContain("pi-fx");
    }
  });
});

describe("programs: every card plate is a scene that scales with it (QP3-02, QP3-03)", async () => {
  const { readFileSync } = await import("node:fs");
  const { isValidElement } = await import("react");
  const { ProgramCard } = await import("@/components/sections/programs/ProgramCard");
  const css = readFileSync("styles/sections/programs.css", "utf8");
  const px = (s: string | undefined) => parseFloat(s ?? "NaN");

  it("never hides the card silhouette behind a plate-height threshold", () => {
    expect(css).not.toMatch(/\.pc-icon\s+\.pi-fig-x\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.pc-scene\s*\{[^}]*width:\s*var\(--icon\);[^}]*container:\s*pc-scene\s*\/\s*size;/);
  });

  it("keeps the line 2.7–3.0 CSS px from the smallest (84px) to the largest (176px) drawing", () => {
    const icon = css.match(/\.pc-plate\s*\{[^}]*--icon-min:\s*(\d+)px;[^}]*--icon:\s*clamp\(var\(--icon-min\),\s*min\(64cqh,\s*var\(--fit\)\),\s*(\d+)px\)/);
    expect(icon, ".pc-plate --icon").not.toBeNull();
    const [lo, hi] = [px(icon?.[1]), px(icon?.[2])];
    expect([lo, hi]).toEqual([84, 176]);
    const base = px(css.match(/\.pi\s*\{[^}]*--sw:\s*([\d.]+)px/)?.[1]);
    const steps = [...css.matchAll(/@container pc-scene \(min-width: ([\d.]+)px\) \{\s*\.pc-icon \{\s*--sw: ([\d.]+)px;/g)].map(
      (m) => [px(m[1]), px(m[2])] as const,
    );
    expect(steps.length).toBeGreaterThanOrEqual(6);
    const bands = [[lo, base] as const, ...steps];
    bands.forEach(([from, sw], k) => {
      const to = Math.min(bands[k + 1]?.[0] ?? hi, hi);
      expect(from, "steps ascend").toBeLessThan(to);
      expect((sw * from) / 48, `${from}px`).toBeGreaterThanOrEqual(2.7);
      expect((sw * to) / 48, `up to ${to}px`).toBeLessThanOrEqual(3.0 + 1e-9);
    });
  });

  it("gives each apparatus its scene's width budget", () => {
    const fit = (icon: string) => css.match(new RegExp(`\\[data-apparatus="${icon}"\\][^{]*\\{\\s*--fit:\\s*(\\d+)cqw`))?.[1];
    expect(css).toMatch(/\.pc-plate\s*\{[^}]*--fit:\s*42cqw;/); // bars (the default)
    expect(fit("preskok")).toBe("55");
    expect(fit("parter")).toBe("60");
    expect(css).toMatch(/\.pc-plate:is\(\[data-apparatus="parter"\], \[data-apparatus="greda"\]\)\s*\{\s*--fit:\s*60cqw;/);
    expect(fit("aerobik")).toBe("58");
  });

  it("renders the scene in its own box, tags the plate with its apparatus and hangs the quiz stamp from the body", () => {
    type Props = { className?: unknown; children?: unknown; [k: string]: unknown };
    type Node = { cls: string[]; props: Props; kids: Node[] };
    const tree = (node: unknown): Node[] => {
      if (Array.isArray(node)) return node.flatMap(tree);
      if (!isValidElement<Props>(node)) return [];
      if (typeof node.type === "function") return tree((node.type as (p: Props) => unknown)(node.props));
      const cls = typeof node.props.className === "string" ? node.props.className.split(" ") : [];
      return [{ cls, props: node.props, kids: tree(node.props.children) }];
    };
    const find = (nodes: Node[], c: string): Node[] => nodes.flatMap((n) => (n.cls.includes(c) ? [n] : find(n.kids, c)));
    for (const program of visiblePrograms(false)) {
      const card = tree(ProgramCard({ program }));
      const [plate] = find(card, "pc-plate");
      expect(plate?.props["data-apparatus"], program.id).toBe(program.icon);
      const [scene] = find(plate ? [plate] : [], "pc-scene");
      expect(find(scene ? [scene] : [], "pi-fig-x").length, program.id).toBe(1);
      expect(find(plate ? [plate] : [], "pc-stamp"), program.id).toHaveLength(0);
      expect(find(find(card, "pc-body"), "pc-stamp"), program.id).toHaveLength(1);
    }
  });

  it("reserves three description lines from 1024px, so same-shaped cards start their titles level", () => {
    expect(css).toMatch(/@media \(min-width: 1024px\) \{\s*\.pc-desc \{\s*min-height: calc\(3 \* 1\.5em\);\s*min-height: 3lh;/);
  });
});

describe("programs: the filter Flip ends on the final layout (QP3-01)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("components/sections/programs/programs-motion.ts", "utf8");
  const call = src.slice(src.indexOf("Flip.from(state, {"), src.indexOf("onEnter:", src.indexOf("Flip.from(state, {")));

  it("takes leavers out of flow and tweens width/height (never scale), so no card snaps after the landing", () => {
    expect(call).toMatch(/absoluteOnLeave:\s*true/);
    expect(call).toMatch(/scale:\s*false/);
    expect(call).toMatch(/duration:\s*DUR\.base/);
    expect(call).toMatch(/ease:\s*EASE\.stick/);
  });
});
