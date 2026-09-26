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
    // The ≥1024 sheet keeps the house flight; the phone/tablet row glides on its bounded ease (QP4-01).
    expect(call).toMatch(/duration: row \? glideTime\(reach, DUR\.base, DUR\.reveal\) : DUR\.base,/);
    expect(call).toMatch(/ease: row \? glideEase : EASE\.stick,/);
  });
});

/* --------------------------------------------------------------------------------------------
   Design review round 4
   -------------------------------------------------------------------------------------------- */

describe("programs: the filter glides the row to its rest (QP4-01)", async () => {
  const { readFileSync } = await import("node:fs");
  const { restTarget } = await import("@/components/sections/programs/pager");
  const src = readFileSync("components/sections/programs/programs-motion.ts", "utf8");
  const flip = src.slice(src.indexOf("export async function flipFilter"));
  const browser = readFileSync("components/sections/programs/ProgramsBrowser.tsx", "utf8");

  it("rests on the first kept program, clamped to the end of the FINAL row (rows measured in the browser)", () => {
    // 390×844: photo 20–268, cards 318 wide, 12px gaps, 20px pads. „3–8 godina“ keeps the photo + Mlađa (280).
    expect(restTarget(260, 280 + 318 + 20, 390)).toBe(228);
    // „Od 8 godina“: Starija (then C, A·B) opens the row.
    expect(restTarget(260, 940 + 318 + 20, 390)).toBe(260);
    // 320×640 „3–8 godina“: Mlađa at 237, 260 wide.
    expect(restTarget(217, 237 + 260 + 20, 320)).toBe(197);
    // 768×1024 „3–8 godina“: the photo and Mlađa fit, so the row does not move at all.
    expect(restTarget(264, 296 + 320 + 32, 768)).toBe(0);
    // 844×390 „Takmičarke“: C's snap start would pass the row's end.
    expect(restTarget(264, 632 + 320 + 32, 844)).toBe(140);
    // „Sve“ opens on the photo.
    expect(restTarget(null, 1600 + 318 + 20, 390)).toBe(0);
  });

  it("never jumps the row inside apply(): snapping is off from before the layout changes until both flights land", () => {
    const apply = browser.slice(browser.indexOf("const apply = (fading: boolean) => {"), browser.indexOf("const settle = () =>"));
    expect(apply).toMatch(/return restOf\(strip,/);
    expect(apply).not.toMatch(/scrollTo|scrollLeft/);
    const snapOff = flip.indexOf('strip.style.scrollSnapType = "none"');
    expect(snapOff).toBeGreaterThan(-1);
    expect(snapOff).toBeLessThan(flip.indexOf("const rest = apply()"));
    expect(flip).toMatch(/const land = \(\) => \{\s*if \(--flying\) return;\s*strip\.style\.removeProperty\("scroll-snap-type"\);/);
  });

  it("puts the row at its rest once, while every frame is held where it stood on screen (bounds, not offsets)", () => {
    const at = (needle: string) => flip.indexOf(needle);
    expect(flip).toMatch(/Flip\.getState\(items as HTMLElement\[\], \{ simple: row \}\)/);
    expect(at('strip.scrollTo({ left: rest, behavior: "instant" })')).toBeGreaterThan(at("const rest = apply()"));
    expect(at('strip.scrollTo({ left: rest, behavior: "instant" })')).toBeLessThan(at("Flip.from(state, {"));
    expect(flip).toMatch(/Flip\.from\(state, \{[^]*?simple: row,/);
    expect(flip).not.toMatch(/scrollLeft: rest/); // no second, scroll-driven motion
  });

  it("hides a hopper for 60ms on each side of its move, so no frame shows it crossing the row", () => {
    expect(src).toMatch(/const HOP_OFF = 0\.14;\s*const HOP_MOVE = 0\.2;\s*const HOP_ON = 0\.26;/);
    expect(flip).toMatch(/tl\.to\(el, \{ opacity: 0, duration: HOP_OFF, ease: "none" \}, 0\)/);
    expect(flip).toMatch(/\.set\(el, \{ x: 0, y: on \? drop : 0, scale: 1, opacity: on \? 0 : 1, zIndex: restZ\.get\(el\) \}, HOP_MOVE\)/);
    expect(flip).toMatch(/if \(on\) arrive\(tl, el, HOP_ON, drop, false\)/);
  });

  it("lets cards that land in view draw or perform only after the flight has landed", () => {
    expect(flip).toMatch(/flightUntil = performance\.now\(\) \+ Math\.max\(flip\.duration\(\), hop\?\.duration\(\) \?\? 0\) \* 1000;/);
    expect(src).toMatch(/if \(flying > 0\) later\(drawBatch, flying\);/);
    expect(src).toMatch(/if \(flying\) later\(\(\) => perform\(card, delay\), flying\);/);
  });

  it("takes off on the next tick, so the first frame is the take-off and not ≈50ms (most of a stick flight) in", () => {
    expect(flip).toMatch(/Flip\.from\(state, \{[^]*?paused: true,/);
    expect(flip).toMatch(/gsap\.ticker\.add\(go, true\)/);
  });
});

describe("programs: the row's glide is bounded; farther moves hop (QP4-01, flight.ts)", async () => {
  const { GLIDE_PEAK, GLIDE_SPEED, glideEase, glideReach, glideTime, planRow } = await import("@/components/sections/programs/flight");
  const { DUR } = await import("@/lib/motion-env");
  const span = (left: number, width: number, top = 200) => ({ left, right: left + width, top });

  it("eases from 0 to 1 without overshoot, leaves at its peak slope and brakes onto the mark", () => {
    expect(glideEase(0)).toBe(0);
    expect(glideEase(1)).toBe(1);
    let prev = 0;
    let steepest = 0;
    for (let i = 1; i <= 1000; i++) {
      const p = i / 1000;
      const v = glideEase(p);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(1);
      steepest = Math.max(steepest, (v - prev) * 1000);
      prev = v;
    }
    expect(steepest).toBeLessThanOrEqual(GLIDE_PEAK + 1e-6);
    expect((glideEase(1) - glideEase(0.999)) * 1000).toBeLessThan(0.01); // slope 0 at the landing
  });

  it("never moves a gliding frame more than 24px in a 30ms frame, from one card to one row frame", () => {
    const reach = glideReach(DUR.reveal);
    for (const d of [20, 120, 197, 228, 260, 300, 332, 336, reach]) {
      const t = glideTime(d, DUR.base, DUR.reveal);
      const peak = (GLIDE_PEAK * d) / (t * 1000); // px per ms at the take-off
      expect(peak).toBeLessThanOrEqual(GLIDE_SPEED + 1e-9);
      expect(peak * 30).toBeLessThanOrEqual(24);
      expect(t).toBeGreaterThanOrEqual(DUR.base);
      expect(t).toBeLessThanOrEqual(DUR.reveal);
    }
    // One frame of the row (measured: 197–336px from 320 to 844 wide) still glides.
    expect(reach).toBeGreaterThanOrEqual(336);
  });

  it("390×844 „Takmičarke“ → „Sve“: the photo glides back in; C and A·B take off in place (their rest is off screen)", () => {
    const plan = planRow(
      [
        { from: span(-240, 248), to: span(20, 248) }, // photo
        { from: span(20, 318), to: span(940, 318) }, // C
        { from: span(350, 318), to: span(1270, 318) }, // A·B, its left edge in view
      ],
      0,
      390,
      glideReach(DUR.reveal),
    );
    expect(plan.reach).toBe(260);
    expect(plan.hops).toEqual([
      { index: 1, dx: 920, dy: 0, off: true, on: false },
      { index: 2, dx: 920, dy: 0, off: true, on: false },
    ]);
  });

  it("390×844 „Sve“ → „3–8 godina“: the photo and Mlađa glide one frame over together", () => {
    const plan = planRow(
      [
        { from: span(280, 318), to: span(52, 318) }, // Mlađa
        { from: span(20, 248), to: span(-208, 248) }, // photo
      ],
      0,
      390,
      glideReach(DUR.reveal),
    );
    expect(plan).toEqual({ hops: [], reach: 228 });
  });

  it("320×640 „Sve“ → „Od 8 godina“: Starija and C land from off screen, the photo glides out, A·B's unseen move does not slow it", () => {
    const plan = planRow(
      [
        { from: span(509, 260), to: span(20, 260) }, // Starija
        { from: span(781, 260), to: span(292, 260) }, // C
        { from: span(1053, 260), to: span(564, 260) }, // A·B: off screen all the way
        { from: span(20, 205), to: span(-197, 205) }, // photo
      ],
      0,
      320,
      glideReach(DUR.reveal),
    );
    expect(plan).toEqual({
      hops: [
        { index: 0, dx: -489, dy: 0, off: false, on: true },
        { index: 1, dx: -489, dy: 0, off: false, on: true },
      ],
      reach: 217,
    });
  });

  it("844×390 swiped to the end, „Sve“ → „Takmičarke“: C and A·B glide one frame over; the photo's edge lands", () => {
    const plan = planRow(
      [
        { from: span(-180, 320), to: span(156, 320) }, // C
        { from: span(156, 320), to: span(492, 320) }, // A·B
        { from: span(-1116, 248), to: span(-108, 248) }, // photo: 140px of it in view at the rest
      ],
      0,
      844,
      glideReach(DUR.reveal),
    );
    expect(plan).toEqual({ hops: [{ index: 2, dx: 1008, dy: 0, off: false, on: true }], reach: 336 });
  });
});

describe("programs: leavers take off from where they stand (QP4-05)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("components/sections/programs/programs-motion.ts", "utf8");
  const leave = src.slice(src.indexOf("onLeave: (els) =>"), src.indexOf("onComplete: land"));

  it("lifts 8px relative to Flip's placement of the absolute leaver, never to an absolute y", () => {
    expect(leave).toMatch(/y: "-=8", scale: 0\.97, duration: DUR\.fast, ease: EASE\.takeoff/);
    expect(leave).not.toMatch(/y: -8\b/);
  });
});

describe("programs: detail sheet (QP4-02, QP4-03)", async () => {
  const { readFileSync } = await import("node:fs");
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: ProgramSheet } = await import("@/components/sections/programs/ProgramSheet");
  const css = readFileSync("styles/sections/programs.css", "utf8");
  const block = (head: string) => {
    const start = css.indexOf(`${head} {`);
    if (start < 0) return "";
    let depth = 0;
    for (let i = css.indexOf("{", start); i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
    }
    return "";
  };
  const html = renderToStaticMarkup(createElement(ProgramSheet, { programId: "c-program", card: {} as HTMLElement, onClosed: () => {} }));

  it("keeps the way out in view: the close is the panel's first child and sticky in its scroller", () => {
    expect(html).toMatch(/<div class="ps-panel"><button type="button" class="ps-close" data-sheet-close="" aria-label="[^"]+">/);
    expect(css).toMatch(/\.ps-close \{\s*position: sticky;\s*top: 10px;/);
  });

  it("gives the scene its apparatus and a size-container box", () => {
    expect(html).toMatch(/<div class="ps-plate" data-apparatus="razboj"><span class="ps-scene"><svg class="pi ps-icon"/);
    expect(css).toMatch(/\.ps-scene \{[^}]*container: ps-scene \/ size;/);
  });

  it("lays a landscape phone out in two columns: scene over CTAs left, the text alone scrolling right", () => {
    const land = block("@media (max-height: 480px) and (min-width: 640px)");
    expect(land).toMatch(/\.ps-inner \{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 2fr\) minmax\(0, 3fr\);/);
    expect(land).toMatch(/grid-template-areas:\s*"plate body"\s*"actions body";/);
    expect(land).toMatch(/\.ps-body \{[^}]*grid-area: body;[^}]*overflow: hidden auto;/);
    expect(land).toMatch(/\.ps-actions \{[^}]*grid-area: actions;[^}]*position: static;/);
    // The text fades out 16px at the column's foot instead of being cut by the CTAs' rule.
    expect(land).toMatch(/\.ps-body::after \{[^}]*position: sticky;[^}]*bottom: 0;[^}]*height: 16px;/);
    // The gymnast and the bib stay; only the week rows' day letters (and, ≤380px tall, the rows) give way.
    const scene = land.replace(/\.ps-sched \.pg-week(?:__label)? \{[^}]*\}/g, "");
    expect(scene).not.toMatch(/pi-fig-x|pc-bib|display: none/);
    expect(land).toMatch(/\.ps-sched \.pg-week__label \{\s*display: none;/);
  });

  it("keeps the CTAs outside the text's scroller, after it", () => {
    expect(html).toMatch(/<\/section><\/div><div class="ps-actions"><a href="#kontakt" data-booking=/);
  });

  it("keeps the compact plate only for short AND narrow viewports (400% zoom)", () => {
    expect(css).not.toMatch(/@media \(max-height: 480px\) \{/);
    expect(block("@media (max-height: 480px) and (max-width: 639.98px)")).toMatch(/\.ps-icon \.pi-fig-x/);
  });
});

describe("programs: the rail's flier never leaves its track (round 4 regression)", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync("styles/sections/programs.css", "utf8");
  const browser = readFileSync("components/sections/programs/ProgramsBrowser.tsx", "utf8");

  it("places the flier on its cell's centre in track widths (cqw), never in % of a width that changes with the dot count", () => {
    expect(css).toMatch(/\.pg-rail__track \{[^}]*container: pg-track \/ inline-size;[^}]*overflow-x: clip;/);
    expect(css).toMatch(/\.pg-rail__flier \{[^}]*width: 0;[^}]*transform: translateX\(calc\(\(var\(--i\) \+ 0\.5\) \* 100cqw \/ var\(--n\)\)\);/);
    expect(css).not.toMatch(/translateX\(calc\(var\(--i\) \* 100%\)\)/);
  });

  it("clamps the flier's cell to the dots the rail shows", () => {
    expect(browser).toMatch(/"--i": Math\.min\(page\.i, railN - 1\), "--n": railN/);
  });
});
