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
    expect(names).toContain("pi-draw");
    for (const name of names) expect(keyframes(name), name).not.toMatch(/animation-timing-function\s*:\s*var\(/);
  });
});

describe("programs: each program's pose on its apparatus (plan §5.4)", async () => {
  const { POSES } = await import("@/components/brand/poses.generated");
  const { ANCHOR, ICON_FLOOR, PROGRAM_POSE, SCENE_K, SW_REF, headroom, posePlacement, poseTransform } = await import(
    "@/components/sections/programs/pose-scene"
  );
  type Icon = keyof typeof PROGRAM_POSE;
  const ICONS = ["parter", "greda", "razboj", "preskok", "aerobik"] as const satisfies readonly Icon[];

  /** Absolute polyline of a pose path (the family uses M/L/H/V/Z only, absolute or relative). */
  function polyline(d: string): [number, number][] {
    const t = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
    const pts: [number, number][] = [];
    let [x, y, sx, sy, i, cmd] = [0, 0, 0, 0, 0, ""];
    const num = () => parseFloat(t[i++] ?? "0");
    while (i < t.length) {
      if (/[a-zA-Z]/.test(t[i] ?? "")) cmd = t[i++] ?? "";
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      if (C === "Z") {
        [x, y] = [sx, sy];
        continue;
      }
      if (C === "M" || C === "L") {
        [x, y] = rel ? [x + num(), y + num()] : [num(), num()];
        if (C === "M") [sx, sy, cmd] = [x, y, rel ? "l" : "L"];
      } else if (C === "H") x = rel ? x + num() : num();
      else if (C === "V") y = rel ? y + num() : num();
      else throw new Error(`path command ${cmd}`);
      pts.push([x, y]);
    }
    return pts;
  }
  /** A pose's outline on the drawing (icon units). */
  const inkOf = (icon: Icon) => {
    const p = posePlacement(icon);
    return polyline(POSES[p.id].d).map(([px, py]) => [p.ox + px * p.k, p.oy + py * p.k] as const);
  };
  const onDrawing = (icon: Icon, [px, py]: readonly [number, number]) => {
    const p = posePlacement(icon);
    return [p.ox + px * p.k, p.oy + py * p.k] as const;
  };

  it("gives every program its own pose from the approved family, at the scene scale", () => {
    expect(ICONS.map((i) => PROGRAM_POSE[i].id)).toEqual(["star", "cartwheel", "barHandstand", "vault", "highKick"]);
    for (const i of ICONS) expect(PROGRAM_POSE[i].k).toBeCloseTo(i === "aerobik" ? 48 / 230 : SCENE_K, 9);
    expect(new Set(ICONS.map((i) => PROGRAM_POSE[i].id)).size).toBe(ICONS.length); // one pose per program (R2)
  });

  it("puts each hand and foot on its apparatus (±0.5 units), never ink below the floor", () => {
    const beamTop = 21.5 - SW_REF / 2;
    // Cartwheel: both hands on the beam top, inside the beam (x 3.5–44.5).
    const cw = POSES.cartwheel.contacts;
    for (const h of [cw.handL, cw.handR]) {
      const [x, y] = onDrawing("greda", h);
      expect(y).toBeCloseTo(beamTop, 1);
      expect(x).toBeGreaterThan(3.5 + 2);
      expect(x).toBeLessThan(44.5 - 2);
    }
    // Handstand: the hand on the HIGH rail (y 11.5, x 14.5–46.5), between the uprights (27.5, 43).
    const [bx, by] = onDrawing("razboj", POSES.barHandstand.contacts.hand);
    expect(by).toBeCloseTo(11.5 - (SW_REF * 1.4) / 2, 1);
    expect(bx).toBeGreaterThan(27.5);
    expect(bx).toBeLessThan(43);
    // Handspring: the hand on the vault table top (y 14, x 25.5–47).
    const [vx, vy] = onDrawing("preskok", POSES.vault.contacts.hand);
    expect(vy).toBeCloseTo(14 - SW_REF / 2, 1);
    expect(vx).toBeGreaterThan(25.5 + 2);
    expect(vx).toBeLessThan(47 - 2);
    // High kick: the standing foot on the mat line, and its lowest ink on it.
    const [fx, fy] = onDrawing("aerobik", POSES.highKick.contacts.foot);
    expect(fy).toBeCloseTo(ICON_FLOOR, 1);
    expect(fx).toBeCloseTo(ANCHOR.aerobik.x, 1);
    expect(Math.max(...inkOf("aerobik").map((p) => p[1]))).toBeCloseTo(ICON_FLOOR, 0);
    // Star: in the air over the carpet — its lowest ink above the carpet's back edge (y 22).
    const star = inkOf("parter");
    expect(Math.max(...star.map((p) => p[1]))).toBeLessThan(22);
    expect(Math.max(...star.map((p) => p[1]))).toBeGreaterThan(22 - 4);
    // No pose goes through its apparatus: the hands and feet are the lowest ink.
    for (const [icon, surface] of [
      ["greda", beamTop],
      ["razboj", 11.5 - (SW_REF * 1.4) / 2],
      ["preskok", 14 - SW_REF / 2],
      ["aerobik", ICON_FLOOR],
    ] as const) {
      expect(Math.max(...inkOf(icon).map((p) => p[1])), icon).toBeLessThanOrEqual(surface + 0.5);
    }
    for (const i of ICONS) expect(Math.max(...inkOf(i).map((p) => p[1])), i).toBeLessThanOrEqual(ICON_FLOOR + 0.5);
  });

  it("keeps each scene inside the drawing's width; only the handstand and handspring rise far above it", () => {
    for (const i of ICONS) {
      const ink = inkOf(i);
      expect(Math.min(...ink.map((p) => p[0])), i).toBeGreaterThanOrEqual(0);
      expect(Math.max(...ink.map((p) => p[0])), i).toBeLessThanOrEqual(48);
    }
    expect(headroom("razboj")).toBeGreaterThan(18);
    expect(headroom("razboj")).toBeLessThan(23);
    expect(headroom("preskok")).toBeGreaterThan(18);
    expect(headroom("preskok")).toBeLessThan(23);
    expect(headroom("greda")).toBeLessThan(8);
    expect(headroom("parter")).toBeLessThan(2);
    expect(headroom("aerobik")).toBe(0);
  });

  it("the plates reserve the whole exercise's headroom, not only the pose's (programs.css --head, whole units)", async () => {
    const { readFileSync } = await import("node:fs");
    const { PROGRAM_EXERCISES } = await import("@/components/sections/programs/program-exercises");
    const css = readFileSync("styles/sections/programs.css", "utf8");
    const head = (icon: string) =>
      Number(css.match(new RegExp(`\\.pc-plate\\[data-apparatus="${icon}"\\],\\s*\\.ps-plate\\[data-apparatus="${icon}"\\]\\s*\\{\\s*--head:\\s*(\\d+);`))?.[1] ?? 0);
    for (const i of ICONS) {
      // Every frame's highest ink, measured on the frames themselves (not the generated bounds).
      const top = Math.min(...PROGRAM_EXERCISES[i].frames.flatMap((d) => polyline(d).map((pt) => pt[1])));
      const need = headroom(i, top);
      expect(need, i).toBeCloseTo(headroom(i, PROGRAM_EXERCISES[i].bounds[1]), 1);
      expect(head(i), i).toBeGreaterThanOrEqual(need);
      expect(head(i), i).toBeGreaterThanOrEqual(headroom(i)); // …and the pose's own box
      expect(head(i), i).toBeLessThan(need + 1.5);
    }
    // The beam cartwheel starts upright in cart1's arms-up stance: 11.6 units, 4 more than its pose.
    expect(headroom("greda", PROGRAM_EXERCISES.greda.bounds[1])).toBeGreaterThan(headroom("greda") + 4);
    expect(head("greda")).toBe(12);
  });

  it("no frame of any exercise leaves its plate, at every drawing size (84–176px) and plate width", async () => {
    const { PROGRAM_EXERCISES } = await import("@/components/sections/programs/program-exercises");
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("styles/sections/programs.css", "utf8");
    // The card's width budget per apparatus: --fit = (content width − b) × 48 / reach (aerobik: none).
    const fit = (icon: Icon) => {
      const m = css.match(new RegExp(`\\.pc-plate\\[data-apparatus="${icon}"\\] \\{\\s*--fit: calc\\(\\(100cqw - (\\d+)px\\) \\* 48 / ([\\d.]+)\\);`));
      return m ? (w: number) => ((w - Number(m[1])) * 48) / Number(m[2]) : (w: number) => w;
    };
    for (const i of ICONS) {
      const ink = PROGRAM_EXERCISES[i].frames.flatMap((d) => polyline(d).map((pt) => onDrawing(i, pt)));
      const [x0, x1] = [Math.min(...ink.map((p) => p[0])), Math.max(...ink.map((p) => p[0]))];
      const y1 = Math.max(...ink.map((p) => p[1]));
      // Below the drawing: the 6 units under the floor, then the plate's bottom pad.
      expect(y1, i).toBeLessThanOrEqual(48);
      // Content widths from the 320px card (224px) up; the drawing is clamp(84px, ≤ --fit, 176px)
      // (64cqh only ever makes it smaller, which keeps every frame further inside).
      for (let w = 224; w <= 700; w += 4) {
        for (const padX of [12, 14]) {
          const size = Math.min(176, Math.max(84, fit(i)(w)));
          expect((x0 * size) / 48, `${i} left, ${w}px`).toBeGreaterThanOrEqual(-padX); // into the left pad, never past it
          expect((x1 * size) / 48, `${i} right, ${w}px`).toBeLessThanOrEqual(w + padX);
        }
      }
    }
  });

  it("the latent print (which the quiz reads) is the scene: apparatus paths + the pose, placed as on the card", async () => {
    const { iconArt } = await import("@/components/sections/quiz/views");
    for (const i of ICONS) {
      const art = iconArt(i);
      const p = posePlacement(i);
      expect(art.pose.id, i).toBe(PROGRAM_POSE[i].id);
      expect(art.pose.d, i).toBe(POSES[p.id].d);
      expect([art.pose.x, art.pose.y, art.pose.width, art.pose.height], i).toEqual([p.box.x, p.box.y, p.box.width, p.box.height]);
      expect(poseTransform(p)).toMatch(/^translate\(-?[\d.]+ -?[\d.]+\) scale\([\d.]+\)$/);
      expect(art.paths.length > 0, i).toBe(i !== "aerobik"); // aerobik: the pose is the whole drawing
    }
  });
});

describe("programs: plate scene (QP2-05, D-53)", async () => {
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

  it("cards and the sheet get the pose figure; no trails anywhere (a real exercise leads into the pose now)", () => {
    for (const icon of ["parter", "greda", "razboj", "preskok", "aerobik"] as const) {
      for (const scene of ["card", "sheet"] as const) {
        expect(render(icon, scene).filter((c) => c === "pi-pose"), `${icon} ${scene}`).toHaveLength(1);
        expect(render(icon, scene), `${icon} ${scene}`).not.toContain("pi-fx");
        expect(render(icon, scene), `${icon} ${scene}`).not.toContain("pi-ride"); // nothing rides an apparatus
      }
    }
    expect(render("aerobik")).not.toContain("pi-part"); // the high kick is the whole drawing
  });

  it("the bare drawing (the quiz's print) has no pose figure and no exercise", () => {
    for (const icon of ["parter", "greda", "razboj", "preskok", "aerobik"] as const) {
      expect(render(icon)).not.toContain("pi-pose");
      expect(render(icon)).not.toContain("ex-ghost");
      expect(render(icon)).not.toContain("ex-solid");
      expect(render(icon)).toContain("pi-solid"); // …but the latent print carries the pose
    }
  });

  it("every pose figure is its own <svg data-figure=\"pose:<id>\"> on its plate (card and sheet)", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { ProgramCard } = await import("@/components/sections/programs/ProgramCard");
    const { PROGRAM_POSE, posePlacement } = await import("@/components/sections/programs/pose-scene");
    for (const program of visiblePrograms(false)) {
      const html = renderToStaticMarkup(createElement(ProgramCard, { program }));
      const figs = html.match(/<svg data-figure="pose:[^"]+"[^>]*>/g) ?? [];
      expect(figs, program.id).toHaveLength(1);
      const { box } = posePlacement(program.icon);
      expect(figs[0]).toContain(`data-figure="pose:${PROGRAM_POSE[program.icon].id}"`);
      expect(figs[0]).toContain(`x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}"`);
      expect(html).not.toMatch(/href="#leap"/); // no logo figure on a program plate (R1)
    }
  });

  it("the card's pose figure is the exercise's static print: its ghost frames, then the final pose, overflow visible", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { ProgramCard } = await import("@/components/sections/programs/ProgramCard");
    const { PROGRAM_POSE } = await import("@/components/sections/programs/pose-scene");
    const { PROGRAM_EXERCISES } = await import("@/components/sections/programs/program-exercises");
    const { POSES } = await import("@/components/brand/poses.generated");
    for (const program of visiblePrograms(false)) {
      const ex = PROGRAM_EXERCISES[program.icon];
      expect(ex.pose, program.id).toBe(PROGRAM_POSE[program.icon].id); // the exercise ends in the card's pose
      const html = renderToStaticMarkup(createElement(ProgramCard, { program }));
      const fig = html.slice(html.indexOf("<svg data-figure=\"pose:"), html.indexOf("</svg>", html.indexOf("<svg data-figure=\"pose:")));
      expect(fig, program.id).toMatch(/^<svg data-figure="pose:\w+"[^>]* overflow="visible"/);
      const paths = [...fig.matchAll(/<path class="(ex-ghost|ex-solid)"(?: data-frame="(\d+)")? d="([^"]+)"><\/path>/g)];
      // One path per ghost frame, oldest first, and the solid last: nothing else in the figure.
      expect(fig.match(/<path /g)?.length, program.id).toBe(ex.ghosts.length + 1);
      expect(paths.map((m) => m[1]), program.id).toEqual([...ex.ghosts.map(() => "ex-ghost"), "ex-solid"]);
      ex.ghosts.forEach((g, k) => {
        expect(Number(paths[k]?.[2]), program.id).toBe(g);
        expect(paths[k]?.[3], `${program.id} ghost ${g}`).toBe(ex.frames[g]);
      });
      const solid = paths.at(-1)?.[3];
      expect(solid, program.id).toBe(POSES[ex.pose].d);
      expect(solid, program.id).toBe(ex.frames.at(-1));
      // Only the ghosts and the final pose are in the HTML: no in-between frame.
      const shipped = new Set([...ex.ghosts.map((g) => ex.frames[g]), ex.frames.at(-1)]);
      for (const f of ex.frames) if (!shipped.has(f)) expect(html.includes(f), program.id).toBe(false);
    }
  });
});

describe("programs: every card plate is a scene that scales with it (QP3-02, QP3-03)", async () => {
  const { readFileSync } = await import("node:fs");
  const { isValidElement } = await import("react");
  const { ProgramCard } = await import("@/components/sections/programs/ProgramCard");
  const css = readFileSync("styles/sections/programs.css", "utf8");
  const px = (s: string | undefined) => parseFloat(s ?? "NaN");

  it("never hides the card's pose behind a plate-height threshold", () => {
    expect(css).not.toMatch(/\.pc-icon\s+\.pi-pose\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.pc-scene\s*\{[^}]*width:\s*var\(--icon\);[^}]*container:\s*pc-scene\s*\/\s*size;/);
  });

  it("keeps the line 2.7–3.0 CSS px from the smallest (84px) to the largest (176px) drawing", () => {
    const plate = css.slice(css.indexOf(".pc-plate {\n  --icon-min:"), css.indexOf("container-type: size;", css.indexOf(".pc-plate {\n  --icon-min:")));
    const icon = [plate.match(/--icon-min:\s*(\d+)px;/)?.[1], plate.match(/--icon: clamp\(\s*var\(--icon-min\),[^;]*,\s*(\d+)px\s*\);/)?.[1]];
    expect(icon, ".pc-plate --icon").not.toContain(undefined);
    const [lo, hi] = [px(icon[0]), px(icon[1])];
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

  it("never lets a pose reach the plate's top edge: the headroom caps the drawing and floors the plate", () => {
    // --icon ≤ (plate height − bottom pad − top clearance) × 48 / (48 + headroom)
    expect(css).toMatch(/--icon: clamp\(\s*var\(--icon-min\),\s*min\(64cqh, var\(--fit\), \(100cqh - var\(--pad-b\) - var\(--top\)\) \* 48 \/ \(48 \+ var\(--head\)\)\),\s*176px\s*\)/);
    // …and a plate is never shorter than its smallest drawing plus that headroom.
    const floor = /min-height: max\(calc\(var\(--icon-min\) \+ (\d+)px\), calc\(var\(--icon-min\) \* \(48 \+ var\(--head\)\) \/ 48 \+ var\(--pad-b\) \+ var\(--top\)\)\);/g;
    expect([...css.matchAll(floor)].map((m) => m[1])).toEqual(["32", "28"]);
    expect(css).toMatch(/\.pc-plate,\s*\.ps-plate \{\s*--head: 0;\s*--top: 6px;/);
    // The sheet's portrait plate grows by the same headroom.
    expect(css).toMatch(/\.ps-plate \{[^}]*height: max\(176px, calc\(var\(--icon\) \* \(48 \+ var\(--head\)\) \/ 48 \+ var\(--pad-b\) \+ var\(--top\)\)\);/);
  });

  it("gives each apparatus its width budget: ≥8px clear of its bib in the bib's band", () => {
    const fit = (icon: string) => css.match(new RegExp(`\\.pc-plate\\[data-apparatus="${icon}"\\] \\{\\s*--fit: calc\\(\\(100cqw - (\\d+)px\\) \\* 48 / ([\\d.]+)\\);`))?.slice(1).map(Number);
    // bib width + 8px, and the drawing's reach in the bib's band (units): carpet edge, beam end,
    // high bar foot plate, vault table base.
    expect(fit("parter")).toEqual([74 + 8, 44.8]);
    expect(fit("greda")).toEqual([58 + 8, 44.5]);
    expect(fit("razboj")).toEqual([42 + 8, 46]);
    expect(fit("preskok")).toEqual([69 + 8, 45]);
    expect(css).toMatch(/\.pc-plate \{[^}]*--fit: 100cqw;/); // aerobik: no bib, the pose ends at 33 units
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
      expect(find(scene ? [scene] : [], "pi-pose").length, program.id).toBe(1);
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

  it("lets cards that land in view draw only after the flight has landed", () => {
    expect(flip).toMatch(/flightUntil = performance\.now\(\) \+ Math\.max\(flip\.duration\(\), hop\?\.duration\(\) \?\? 0\) \* 1000;/);
    expect(src).toMatch(/if \(flying > 0\) later\(drawBatch, flying\);/);
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
  const { PROGRAM_EXERCISES } = await import("@/components/sections/programs/program-exercises");
  /** The opener card: the sheet reads the card's server-rendered ghost frames (.pc-icon .ex-ghost). */
  const cardOf = (icon: keyof typeof PROGRAM_EXERCISES) =>
    ({
      querySelectorAll: (sel: string) => {
        expect(sel).toBe(".pc-icon .ex-ghost");
        const ex = PROGRAM_EXERCISES[icon];
        return ex.ghosts.map((f) => ({ dataset: { frame: String(f) }, getAttribute: (a: string) => (a === "d" ? ex.frames[f] : null) }));
      },
    }) as unknown as HTMLElement;
  const html = renderToStaticMarkup(createElement(ProgramSheet, { programId: "c-program", card: cardOf("razboj"), onClosed: () => {} }));

  it("keeps the way out in view: the close is the panel's first child and sticky in its scroller", () => {
    expect(html).toMatch(/<div class="ps-panel"><button type="button" class="ps-close" data-sheet-close="" aria-label="[^"]+">/);
    expect(css).toMatch(/\.ps-close \{\s*position: sticky;\s*top: 10px;/);
  });

  it("gives the scene its apparatus and a size-container box", () => {
    expect(html).toMatch(/<div class="ps-plate" data-apparatus="razboj"><span class="ps-scene"><svg class="pi ps-icon"/);
    expect(css).toMatch(/\.ps-scene \{[^}]*container: ps-scene \/ size;/);
  });

  it("draws the card's ghost frames and the final pose, so the sheet's static state is the finished exercise", async () => {
    const { POSES } = await import("@/components/brand/poses.generated");
    for (const [programId, icon] of [["ab-program", "preskok"], ["starija", "greda"]] as const) {
      const sheet = renderToStaticMarkup(createElement(ProgramSheet, { programId, card: cardOf(icon), onClosed: () => {} }));
      const ex = PROGRAM_EXERCISES[icon];
      const ghosts = [...sheet.matchAll(/<path class="ex-ghost" data-frame="(\d+)" d="([^"]+)"><\/path>/g)];
      expect(ghosts.map((m) => Number(m[1])), programId).toEqual([...ex.ghosts]);
      ghosts.forEach((m) => expect(m[2]).toBe(ex.frames[Number(m[1])]));
      expect(sheet).toContain(`<path class="ex-solid" d="${POSES[ex.pose].d}"></path>`);
    }
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
    expect(scene).not.toMatch(/pi-pose|pc-bib|display: none/);
    expect(land).toMatch(/\.ps-sched \.pg-week__label \{\s*display: none;/);
  });

  it("keeps the CTAs outside the text's scroller, after it", () => {
    expect(html).toMatch(/<\/section><\/div><div class="ps-actions"><a href="#kontakt" data-booking=/);
  });

  it("keeps the compact plate only for short AND narrow viewports (400% zoom)", () => {
    expect(css).not.toMatch(/@media \(max-height: 480px\) \{/);
    // The compact plate keeps only the drawing — for aerobik that is its pose.
    expect(block("@media (max-height: 480px) and (max-width: 639.98px)")).toMatch(/\.ps-plate:not\(\[data-apparatus="aerobik"\]\) \.ps-icon \.pi-pose/);
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

describe("programs: no figure in the rail or under the photo (figure system §5.4, R5)", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync("styles/sections/programs.css", "utf8");
  const browser = readFileSync("components/sections/programs/ProgramsBrowser.tsx", "utf8");
  const programs = readFileSync("components/sections/programs/Programs.tsx", "utf8");
  /** Declarations of the first rule for `selector` (top level or nested). */
  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    expect(at, selector).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("}", at));
  };

  it("the rail's marker is a lavender bead, not the silhouette", () => {
    expect(browser).not.toMatch(/#leap/);
    expect(browser).toMatch(/<span className="pg-rail__flier">\s*<span className="pg-rail__bead" \/>\s*<\/span>/);
    const bead = rule(".pg-rail__bead");
    expect(bead).toMatch(/width: 10px;/);
    expect(bead).toMatch(/height: 10px;/);
    expect(bead).toMatch(/background: var\(--color-lav-200\);/);
    expect(bead).toMatch(/border-radius: var\(--radius-full\);/);
    expect(css).not.toMatch(/pg-rail__leap|pg-hop-/);
  });

  it("slides on the flight ease and sticks its arrival on the land ease — motion only; reduced motion jumps", () => {
    expect(rule(".pg-rail__flier")).toMatch(/transition: transform var\(--dur-base\) var\(--ease-flight\);/);
    const start = css.indexOf("@media (prefers-reduced-motion: no-preference) {\n  html.js-motion .pg-rail");
    expect(start).toBeGreaterThan(-1);
    const motion = css.slice(start);
    // The landing exists only inside the motion query (its first use is there).
    for (const parity of ["0", "1"]) expect(css.indexOf(`.pg-rail[data-hop="${parity}"] .pg-rail__bead`)).toBeGreaterThan(start);
    // The landing starts when the slide has arrived.
    expect(motion).toMatch(/animation: pg-land-a var\(--dur-land\) var\(--ease-land\) var\(--dur-base\);/);
    expect(motion).toMatch(/animation: pg-land-b var\(--dur-land\) var\(--ease-land\) var\(--dur-base\);/);
    expect(browser).toMatch(/data-hop=\{page\.i % 2\}/);
    // Reduced motion: no slide.
    const reduce = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce) {"));
    expect(reduce).toMatch(/\.pg-rail__flier \{\s*transition: none;/);
  });

  it("KR-04 has no trail: at every width its paper stretches to the row, the label at the foot", () => {
    expect(programs).not.toMatch(/#leap|pg-photo__trail|PHOTO_TRAIL/);
    expect(css).not.toMatch(/pg-photo__(trail|mat|ghost)/);
    const frame = rule(".programs .pg-photo .frame");
    expect(frame).toMatch(/flex: 1 1 auto;/);
    expect(frame).not.toMatch(/max-height/);
    expect(rule(".programs .pg-photo .frame-foot")).toMatch(/margin-top: auto;/);
    // The print itself keeps the native/2 cap.
    expect(css).toMatch(/\n\.pg-photo \{[^}]*--pg-photo-cap: 533px;/);
    expect(rule(".programs .pg-photo .photo")).toMatch(/max-height: var\(--pg-photo-cap\);/);
  });
});

describe("programs: the scroll plays each card's whole exercise (D-54)", async () => {
  const { readFileSync } = await import("node:fs");
  const { CARD_SCRUB, slideIn } = await import("@/components/sections/programs/card-exercises");
  const css = readFileSync("styles/sections/programs.css", "utf8");
  const motion = readFileSync("components/sections/programs/programs-motion.ts", "utf8");
  const scenes = readFileSync("components/sections/programs/card-exercises.ts", "utf8");

  it("starts once the plate is nearly whole on screen and lands before it reaches the middle", () => {
    expect(CARD_SCRUB).toEqual({ from: 0.95, to: 0.45 });
    expect(scenes).toMatch(/scenes\.push\(\{ trigger: plate, figure, data, \.\.\.CARD_SCRUB, gate \}\)/);
  });

  it("phone row: a card plays as it slides in from the right; a passed card stays finished", () => {
    // 390px row, 306px plates: waiting off to the right, peeking, half in, wholly in, passed left.
    expect(slideIn(616, 306, 390)).toBe(0);
    expect(slideIn(390, 306, 390)).toBe(0);
    expect(slideIn(286, 306, 390)).toBeCloseTo(104 / 306, 9);
    expect(slideIn(237, 306, 390)).toBeCloseTo(0.5, 9);
    expect(slideIn(66, 306, 390)).toBe(1);
    expect(slideIn(-264, 306, 390)).toBe(1);
    expect(slideIn(0, 0, 390)).toBe(1); // a hidden plate never limits anything
    // Monotonic in the swipe: never a frame backwards while the row moves one way.
    let prev = -1;
    for (let left = 700; left >= -400; left -= 7) {
      const g = slideIn(left, 306, 390);
      expect(g).toBeGreaterThanOrEqual(prev);
      prev = g;
    }
    // The progress is the smaller of the scroll's and the swipe's.
    expect(scenes).toMatch(/const gate = \(\) => \{\s*const r = plate\.getBoundingClientRect\(\);\s*return slideIn\(r\.left, r\.width, boxRight\(\)\);/);
  });

  it("replaces the pose's mount and the performs: no card motion moves the gymnast any more", () => {
    expect(motion).toMatch(/const unscrub = armCardExercises\(strip\);/);
    expect(motion).not.toMatch(/data-perform|data-mount|pointerenter|focusin|PERFORM_MS|MOUNT_MS/);
    expect(css).not.toMatch(/data-perform|data-mount|pi-ride|pi-stick|pi-drop|pi-trail|pi-hop|pi-fx|--drop|--at\b/);
    // The pose no longer waits for the draw: she is there, mid-exercise, from the first frame.
    expect(css).not.toMatch(/\.pi-pose\s*\{[^}]*opacity:\s*0;/);
    // The apparatus still draws itself over its latent print…
    expect(css).toMatch(/html\.js-motion \.program-card:not\(\[data-drawn\]\) \.pc-icon \[data-draw\] \{\s*stroke-dashoffset: 1\.05;/);
    // …whose pose is hidden on a scene: the gymnast is always there, so it would stand ahead of her.
    expect(css).toMatch(/:is\(\.pc-icon, \.ps-icon\) \.pi-latent \.pi-solid \{\s*display: none;/);
  });

  it("ghosts are the plate's own ink, stepped like the title marks' (newest strongest), and leave opacity to the scrub", () => {
    const fill = (sel: string) => Number(css.match(new RegExp(`${sel.replace(/[.()]/g, "\\$&")} \\{\\s*fill-opacity: ([\\d.]+);`))?.[1]);
    const [newest, older, oldest] = [fill(".pi-pose .ex-ghost"), fill(".pi-pose .ex-ghost:nth-last-child(3)"), fill(".pi-pose .ex-ghost:nth-last-child(4)")];
    expect(oldest).toBeGreaterThan(0.1);
    expect(oldest).toBeLessThan(older);
    expect(older).toBeLessThan(newest);
    expect(newest).toBeLessThanOrEqual(0.35);
    // The scrub hides a ghost with opacity (styles/ui.css): nothing here may set it.
    for (const m of css.matchAll(/([^{}]*\.ex-ghost[^{}]*)\{([^}]*)\}/g)) expect(m[2], m[1]).not.toMatch(/(^|[^-])opacity:/);
    // Filled with the plate's figure ink (currentColor), like the pose itself.
    expect(css).toMatch(/\.pi \.pi-solid,\s*\.pi-pose path \{\s*fill: currentColor;/);
  });

  it("a live switch to reduced motion restores the static print", () => {
    expect(scenes).toMatch(/const onReduce = \(\) => \{\s*if \(reduce\.matches\) halt\(\);/);
  });
});

describe("programs: the detail sheet plays the exercise as it opens (D-55)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("components/sections/programs/ProgramSheet.tsx", "utf8");

  it("plays the whole exercise in ≈1.4s, started before the dialog shows, only on the motion branch", () => {
    const ms = Number(src.match(/const SHEET_PLAY_MS = (\d+);/)?.[1]);
    expect(ms).toBeGreaterThanOrEqual(1200);
    expect(ms).toBeLessThanOrEqual(1600);
    const motion = src.slice(src.indexOf("if (motionAllowed()) {"), src.indexOf("} else {", src.indexOf("if (motionAllowed()) {")));
    expect(motion).toMatch(/playExercise\(figure, exercises\[program\.icon\], SHEET_PLAY_MS/);
    expect(motion.indexOf("playExercise(")).toBeLessThan(motion.indexOf("show();"));
    expect(src.match(/playExercise\(/g)).toHaveLength(1); // reduced motion: the static print, nothing plays
    // A live switch to reduced motion or a close mid-play ends on the final pose.
    expect(src).toMatch(/if \(reduce\.matches\) stopPlay\?\.\(\);/);
    expect(src).toMatch(/cancelled = true;[^]*?stopPlay\?\.\(\);/);
  });
});

describe("programs: the exercise frames reach the client only in their own lazy chunk (D-53)", async () => {
  const { existsSync, readFileSync } = await import("node:fs");
  const { dirname, join, relative, resolve } = await import("node:path");
  const root = process.cwd();
  /** The modules a file imports statically (import/export … from; never `import type` or import()). */
  const deps = (file: string): string[] => {
    const src = readFileSync(file, "utf8");
    const specs = [...src.matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?["']([^"']+)["'];?/gm)].map((m) => m[1] ?? "");
    return specs
      .map((spec) => (spec.startsWith("@/") ? join(root, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(file), spec) : null))
      .flatMap((base) => (base ? [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")].filter(existsSync).slice(0, 1) : []));
  };
  const reach = (entry: string) => {
    const seen = new Set<string>();
    const walk = (f: string) => {
      if (seen.has(f)) return;
      seen.add(f);
      deps(f).forEach(walk);
    };
    walk(join(root, entry));
    return [...seen].map((f) => relative(root, f));
  };
  const FRAMES = /^components\/(brand\/exercises\/\w+\.generated\.ts|sections\/programs\/program-exercises\.ts)$/;

  it("no client module of the programs or the quiz imports the frames statically", () => {
    const entries = [
      "components/sections/programs/ProgramsBrowser.tsx", // first load
      "components/sections/programs/ProgramSheet.tsx", // lazy sheet chunk
      "components/sections/programs/programs-motion.ts", // lazy motion chunk
      "components/sections/programs/card-exercises.ts",
      "components/sections/programs/ProgramIcon.tsx", // rendered by the sheet on the client
      "components/sections/quiz/QuizApp.tsx",
    ];
    for (const e of entries) {
      const hit = reach(e).filter((f) => FRAMES.test(f));
      expect(hit, e).toEqual([]);
    }
    // The walker does see static imports: the server card reaches the frames through its print.
    expect(reach("components/sections/programs/ProgramCard.tsx")).toContain("components/sections/programs/program-exercises.ts");
    expect(reach("components/sections/programs/ProgramCard.tsx")).toContain("components/brand/exercises/vaultHandspring.generated.ts");
  });

  it("the scrub and the sheet load them with a dynamic import() of one module (one chunk), which holds data only", () => {
    for (const f of ["components/sections/programs/card-exercises.ts", "components/sections/programs/ProgramSheet.tsx"]) {
      expect(readFileSync(f, "utf8"), f).toMatch(/import\("\.\/program-exercises"\)/);
    }
    const data = deps(join(root, "components/sections/programs/program-exercises.ts")).map((f) => relative(root, f));
    expect(data.length).toBe(5);
    for (const f of data) expect(f).toMatch(/^components\/brand\/exercises\/\w+\.generated\.ts$/);
  });
});
