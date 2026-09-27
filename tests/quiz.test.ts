import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QUIZ } from "@/content/copy";
import { SCHEDULE } from "@/content/schedule";
import {
  QUIZ_AGES,
  QUIZ_RULES,
  buildOutcomeTable,
  isQuizAge,
  needsExperience,
  recommend,
  type QuizRecommendation,
} from "@/lib/quiz";

const [TEK_POCINJE, REKREATIVNO, TAKMICILO_SE] = QUIZ.experience;

/** Unwraps a result; fails the test when the quiz asks for step 2 instead. */
function resultOf(outcome: ReturnType<typeof recommend>): QuizRecommendation {
  if (outcome.status !== "result") throw new Error(`Expected a result, got "${outcome.status}"`);
  return outcome.recommendation;
}

const MLADJA = ["mladja"];
const STARIJA = ["starija"];
const BOTH_BEGINNER = ["mladja", "starija"];
const TAKMICARSKE = ["ab", "c-starije", "c-mladje"];

describe("quiz — §7 acceptance cases", () => {
  it("(3) → Mlađa početna grupa", () => {
    const r = resultOf(recommend(3));
    expect(r.kind).toBe("mladja");
    expect(r.groups).toEqual(MLADJA);
  });

  it("(7) → Mlađa početna grupa", () => {
    const r = resultOf(recommend(7));
    expect(r.kind).toBe("mladja");
    expect(r.groups).toEqual(MLADJA);
  });

  it("(8, Tek počinje) → both beginner groups + age-8 note", () => {
    const r = resultOf(recommend(8, "Tek počinje"));
    expect(r.kind).toBe("obe-pocetne");
    expect(r.groups).toEqual(BOTH_BEGINNER);
    expect(r.note).toBe("Za uzrast od 8 godina trenerica predlaže grupu na probnom treningu.");
  });

  it("(8, Takmičilo se) → Takmičarske grupe + competitive note", () => {
    const r = resultOf(recommend(8, "Takmičilo se"));
    expect(r.kind).toBe("takmicarske");
    expect(r.groups).toEqual(TAKMICARSKE);
    expect(r.note).toBe("Grupu predlaže trenerica posle probnog treninga.");
  });

  it("(9, Tek počinje) → Starija početna grupa", () => {
    const r = resultOf(recommend(9, "Tek počinje"));
    expect(r.kind).toBe("starija");
    expect(r.groups).toEqual(STARIJA);
    expect(r.note).toBeNull();
  });

  it("(12, Treniralo je rekreativno) → Takmičarske grupe", () => {
    const r = resultOf(recommend(12, "Treniralo je rekreativno"));
    expect(r.kind).toBe("takmicarske");
    expect(r.groups).toEqual(TAKMICARSKE);
  });

  it("(16, Tek počinje) → Starija početna grupa", () => {
    const r = resultOf(recommend(16, "Tek počinje"));
    expect(r.kind).toBe("starija");
    expect(r.groups).toEqual(STARIJA);
  });
});

describe("quiz — step 2 and edge cases", () => {
  it("asks step 2 for age 8 without experience", () => {
    expect(recommend(8)).toEqual({ status: "ask-experience" });
  });

  it("asks step 2 for every age ≥ 8 and never below 8", () => {
    for (const age of QUIZ_AGES) {
      expect(needsExperience(age)).toBe(age >= 8);
      expect(recommend(age).status).toBe(age >= 8 ? "ask-experience" : "result");
    }
  });

  it("ignores experience under 8 (step 2 is not asked)", () => {
    expect(resultOf(recommend(5, TAKMICILO_SE)).kind).toBe("mladja");
    expect(resultOf(recommend(7, REKREATIVNO)).kind).toBe("mladja");
  });

  it("rejects out-of-range and non-integer ages", () => {
    for (const bad of [2, 19, 0, -1, 7.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => recommend(bad)).toThrow(RangeError);
      expect(isQuizAge(bad)).toBe(false);
    }
    expect(() => recommend("8" as unknown as number)).toThrow(RangeError);
  });

  it("rejects an unknown experience answer", () => {
    expect(() => recommend(10, "Nešto drugo" as never)).toThrow(TypeError);
  });

  it("uses the age range 3…18 from content", () => {
    expect(QUIZ_AGES[0]).toBe(QUIZ.ageMin);
    expect(QUIZ_AGES.at(-1)).toBe(QUIZ.ageMax);
    expect(QUIZ_AGES).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it("≥ 8 with recreational or competitive experience is always Takmičarske", () => {
    for (const age of QUIZ_AGES.filter((a) => a >= 8)) {
      expect(resultOf(recommend(age, REKREATIVNO)).kind).toBe("takmicarske");
      expect(resultOf(recommend(age, TAKMICILO_SE)).kind).toBe("takmicarske");
    }
  });

  it("≥ 9 beginners always get Starija; 8-year-old beginners get both", () => {
    for (const age of QUIZ_AGES.filter((a) => a >= 8)) {
      expect(resultOf(recommend(age, TEK_POCINJE)).kind).toBe(age === 8 ? "obe-pocetne" : "starija");
    }
  });

  it("every result carries the aerobic hint (no age claim)", () => {
    for (const age of QUIZ_AGES) {
      const answers = needsExperience(age) ? QUIZ.experience : [undefined];
      for (const exp of answers) {
        const r = resultOf(recommend(age, exp));
        expect(r.aerobicHint).toBe("Pitajte trenericu i za aerobnu gimnastiku.");
      }
    }
  });

  it("returns only schedule group ids that exist in content/schedule.ts", () => {
    const ids = new Set(SCHEDULE.map((g) => g.id));
    for (const rule of QUIZ_RULES) {
      for (const id of rule.groups) expect(ids.has(id)).toBe(true);
    }
  });
});

describe("quiz — rules and UI table", () => {
  it("rules are in the §5 order (first match wins)", () => {
    expect(QUIZ_RULES.map((r) => r.kind)).toEqual(["mladja", "obe-pocetne", "starija", "takmicarske"]);
    expect(QUIZ_RULES.map((r) => r.ages)).toEqual([
      [3, 7],
      [8, 8],
      [9, 18],
      [8, 18],
    ]);
  });

  it("the outcome table used by the island agrees with recommend() for every answer", () => {
    const table = buildOutcomeTable();
    expect(table).toHaveLength(QUIZ_AGES.length);
    QUIZ_AGES.forEach((age, i) => {
      const entry = table[i];
      if (!needsExperience(age)) {
        expect(entry).toBe(resultOf(recommend(age)).kind);
      } else {
        expect(Array.isArray(entry)).toBe(true);
        QUIZ.experience.forEach((exp, j) => {
          expect((entry as readonly string[])[j]).toBe(resultOf(recommend(age, exp)).kind);
        });
      }
    });
  });
});

describe("quiz — result views (booking prefill)", () => {
  it("prefills the booking sheet's Grupa with one short label per result", async () => {
    const { resultView, BOTH_BEGINNERS_BOOKING } = await import("@/components/sections/quiz/views");
    expect(resultView("mladja").booking).toBe("Mlađa početna grupa");
    expect(resultView("starija").booking).toBe("Starija početna grupa");
    expect(BOTH_BEGINNERS_BOOKING).toBe("Mlađa ili starija početna grupa");
    expect(resultView("obe-pocetne").booking).toBe(BOTH_BEGINNERS_BOOKING);
    expect(resultView("takmicarske").booking).toBe(QUIZ.competitiveTitle);
  });
});

describe("quiz — group name typography", () => {
  it("keeps the dash with the word before it and a program designation whole (text unchanged)", async () => {
    const { groupNameDisplay, resultView } = await import("@/components/sections/quiz/views");
    expect(groupNameDisplay("Takmičarke — C program, starije")).toBe("Takmičarke — C program, starije");
    expect(groupNameDisplay("Takmičarke — A i B program")).toBe("Takmičarke — A i B program");
    expect(groupNameDisplay("Mlađa početna grupa")).toBe("Mlađa početna grupa");
    for (const g of resultView("takmicarske").groups) {
      expect(g.name.replace(/ /g, " ")).toMatch(/^Takmičarke — /);
    }
  });
});

describe("quiz — result views (S3 hand-off, plates, strip landing)", () => {
  it("recommends program ids for S3 (deduplicated, display order)", async () => {
    const { resultView } = await import("@/components/sections/quiz/views");
    expect(resultView("mladja").programs).toEqual(["mladja"]);
    expect(resultView("obe-pocetne").programs).toEqual(["mladja", "starija"]);
    expect(resultView("starija").programs).toEqual(["starija"]);
    expect(resultView("takmicarske").programs).toEqual(["ab-program", "c-program"]);
  });

  it("the single long flight is exactly the result reached without step 2", async () => {
    const { resultView } = await import("@/components/sections/quiz/views");
    for (const rule of QUIZ_RULES) {
      expect(resultView(rule.kind).band.variant === "skip").toBe(rule.experience === null);
    }
    expect(resultView("mladja").band.apparatus).toBe("parter");
    expect(resultView("starija").band).toEqual({ variant: "greda", apparatus: "greda" });
    expect(resultView("takmicarske").band).toEqual({ variant: "flat", apparatus: "preskok" });
  });

  it("she lands in the pose of the result's primary program (its first), on that program's apparatus", async () => {
    const { resultView } = await import("@/components/sections/quiz/views");
    const { programById } = await import("@/content/programs");
    const { PROGRAM_POSE } = await import("@/components/sections/programs/pose-scene");
    const { LANDING } = await import("@/components/sections/quiz/geometry");
    for (const rule of QUIZ_RULES) {
      const view = resultView(rule.kind);
      const primary = programById(view.programs[0] as Parameters<typeof programById>[0]);
      expect(view.band.apparatus, rule.kind).toBe(primary.icon);
      expect(LANDING[view.band.apparatus].id, rule.kind).toBe(PROGRAM_POSE[primary.icon].id);
    }
    // Multi-program results: the beginners' pair lands as Mlađa (star), the competitive one as A i B.
    expect(LANDING[resultView("obe-pocetne").band.apparatus].id).toBe("star");
    expect(LANDING[resultView("takmicarske").band.apparatus].id).toBe("vault");
  });

  it("every plate carries S3's apparatus drawing, its pose and colour for its program", async () => {
    const { isValidElement } = await import("react");
    const { PROGRAM_POSE } = await import("@/components/sections/programs/pose-scene");
    const { resultView, iconArt } = await import("@/components/sections/quiz/views");
    const { programById } = await import("@/content/programs");
    const { groupById } = await import("@/content/schedule");
    for (const rule of QUIZ_RULES) {
      for (const g of resultView(rule.kind).groups) {
        const program = programById(groupById(g.id as Parameters<typeof groupById>[0]).programId);
        expect(isValidElement(g.plate)).toBe(true);
        const props = (g.plate as { props: { color: string; art: ReturnType<typeof iconArt> } }).props;
        expect(props.color).toBe(program.color);
        expect(props.art).toEqual(iconArt(program.icon));
        expect(props.art.paths.length).toBeGreaterThan(0);
        expect(props.art.pose.id).toBe(PROGRAM_POSE[program.icon].id);
      }
    }
  });

  it("the quiz never picks up the cards' exercises: the print is the final pose alone, no ghost frame (D-53)", async () => {
    const { iconArt, plateOf } = await import("@/components/sections/quiz/views");
    const { QuizPlate } = await import("@/components/sections/quiz/QuizPlate");
    const { QuizBandArt } = await import("@/components/sections/quiz/QuizBandArt");
    const { PROGRAM_EXERCISES } = await import("@/components/sections/programs/program-exercises");
    const { programById } = await import("@/content/programs");
    for (const icon of ["parter", "greda", "razboj", "preskok", "aerobik"] as const) {
      const art = iconArt(icon);
      const ex = PROGRAM_EXERCISES[icon];
      expect(art.pose.d, icon).toBe(ex.frames.at(-1)); // the finished pose…
      const drawn = [art.pose.d, ...art.paths.map((p) => p.d)];
      for (const f of ex.frames.slice(0, -1)) expect(drawn, icon).not.toContain(f); // …and no other frame
    }
    const plates = ["mladja", "starija", "c-program", "ab-program", "aerobik"] as const;
    for (const id of plates) {
      const html = renderToStaticMarkup(createElement(QuizPlate, plateOf(programById(id))));
      expect(html, id).not.toMatch(/ex-ghost|ex-solid|data-scrub/);
      expect(html.match(/<svg data-figure="pose:/g), id).toHaveLength(1);
    }
    expect(renderToStaticMarkup(createElement(QuizBandArt))).not.toMatch(/ex-ghost|ex-solid/);
  });

  it("the strip's apparatus anchors still match S3's drawings (floor y 42, beam top 21.5, table top 14)", async () => {
    const { iconArt } = await import("@/components/sections/quiz/views");
    // The apparatus paths only (the print's pose is returned apart and never matched here).
    const all = (icon: "parter" | "greda" | "preskok") => iconArt(icon).paths.map((p) => p.d).join(" ");
    const num = (n: string) => new RegExp(`(?<![\\d.])${n.replace(".", "\\.")}(?![\\d.])`);
    expect(all("parter")).toMatch(num("42"));
    expect(all("parter")).toMatch(num("22"));
    expect(all("greda")).toMatch(num("21.5"));
    expect(all("greda")).toMatch(num("42"));
    expect(all("preskok")).toMatch(num("14"));
    expect(all("preskok")).toMatch(num("42"));
    // Every anchor the strip's geometry places the apparatus by is in S3's drawing (the landing
    // depth `land` is not a drawn coordinate: mid-depth, checked with the floor landing below).
    const { ICON } = await import("@/components/sections/quiz/geometry");
    for (const [key, n] of Object.entries(ICON.parter)) {
      if (key !== "land") expect(all("parter")).toMatch(num(String(n)));
    }
    for (const n of Object.values(ICON.greda)) expect(all("greda")).toMatch(num(String(n)));
    for (const n of Object.values(ICON.preskok)) expect(all("preskok")).toMatch(num(String(n)));
  });
});

describe("quiz — result CTA on two levels (QP-15)", () => {
  it("splits before the last „ za “ without changing the text", async () => {
    const { splitCta } = await import("@/components/sections/quiz/views");
    const [main, sub] = splitCta(QUIZ.resultCta);
    expect(main).toBe("Zakažite probni trening");
    expect(sub).toBe("za ovu grupu");
    expect(`${main} ${sub}`).toBe(QUIZ.resultCta);
    expect(splitCta("Zakažite probni trening")).toEqual(["Zakažite probni trening", ""]);
  });
});

describe("quiz — chronophotograph strip geometry", () => {
  it("the flight model: a symmetric parabola in time, apex at 50 %", async () => {
    const { hopAt, cubicBezier, pitchAt } = await import("@/components/sections/quiz/geometry");
    expect(hopAt(0, 48)).toBe(0);
    expect(hopAt(1, 48)).toBe(0);
    expect(hopAt(0.5, 48)).toBeCloseTo(48, 3);
    expect(hopAt(0.25, 48)).toBeCloseTo(hopAt(0.75, 48), 3);
    expect(hopAt(1 / 3, 48)).toBeCloseTo(48 * (1 - 1 / 9), 1); // quadratic: 1 − (1 − 2/3)²
    expect(cubicBezier(0.25, 0.1, 0.25, 1, 0.5)).toBeGreaterThan(0.5);
    expect(pitchAt(0)).toBe(0);
    expect(pitchAt(0.12)).toBeCloseTo(-18, 6);
    expect(pitchAt(1)).toBe(0);
  });

  it("the print keeps two real phases of the leap: the take-off at 01 and the apex over 02 (figure system R3)", async () => {
    const g = await import("@/components/sections/quiz/geometry");
    expect(g.EXPOSURES.map((e) => e.id)).toEqual(["takeoff", "apex"]);
    const [takeoff, apex] = g.EXPOSURES;
    expect(takeoff!.key).toBe(true);
    expect(apex!.key).toBe(false);
    const [x1, x2, x3] = g.FRAME_X;
    const hop1 = { from: [x1, 0], to: [x2, 0], amp: g.HOP } as const;
    const skip = { from: [x1, 0], to: [x3, g.LIFT.skip], amp: g.HOP_LONG } as const;
    // Samples of the flight model: the first leap on the two-question path (the same on every
    // landing variant), the one long flight for ages 3–7.
    for (const v of ["flat", "parter", "greda"] as const) {
      expect(takeoff!.pose[v]).toEqual(g.poseAt(hop1, 0.12));
      expect(apex!.pose[v]).toEqual(g.poseAt(hop1, g.APEX_T));
    }
    expect(takeoff!.pose.skip).toEqual(g.poseAt(skip, 0.12));
    expect(apex!.pose.skip).toEqual(g.poseAt(skip, g.APEX_T));
    // The take-off has just left the floor at 01, nose up; the apex of the long flight is over 02.
    expect(takeoff!.pose.flat.x - x1).toBeGreaterThan(0);
    expect(takeoff!.pose.flat.x - x1).toBeLessThan(g.FIG_W / 4);
    expect(takeoff!.pose.flat.r).toBeCloseTo(-18, 6);
    expect(apex!.pose.skip.x).toBe(x2);
    // Each apex is the top of its hop's parabola (qb-hop's keyframe at 50 %). The long flight
    // rises onto the raised floor as it goes, which lifts its highest instant ≈2 units above that.
    for (const [hop, p] of [
      [hop1, apex!.pose.flat],
      [skip, apex!.pose.skip],
    ] as const) {
      expect(g.hopAt(g.APEX_T, hop.amp)).toBeCloseTo(hop.amp, 6);
      for (let i = 0; i <= 100; i++) {
        expect(g.hopAt(i / 100, hop.amp)).toBeLessThanOrEqual(hop.amp + 1e-9);
        expect(g.poseAt(hop, i / 100).y).toBeGreaterThan(p.y - 3);
      }
    }
    // Two different phases, and neither is a copy of the flier's own resting pose.
    for (const v of ["flat", "skip"] as const) {
      expect(takeoff!.pose[v].r).not.toBe(apex!.pose[v].r);
      expect(apex!.pose[v].y).toBeLessThan(takeoff!.pose[v].y - 20);
      for (const p of [takeoff!.pose[v], apex!.pose[v]]) expect(p.r).not.toBe(0);
    }
  });

  it("each exposure develops when the flier passes it, left to right", async () => {
    const g = await import("@/components/sections/quiz/geometry");
    const [takeoff, apex] = g.EXPOSURES;
    expect(takeoff!.delay).toBe(Math.round(0.12 * g.FLIGHT_MS));
    expect(apex!.delay).toBe(g.FLIGHT_MS / 2);
    expect(takeoff!.delaySkip).toBe(Math.round(0.12 * g.FLIGHT_LONG_MS));
    expect(apex!.delaySkip).toBe(g.FLIGHT_LONG_MS / 2);
    // Both are passed before the flier lands (the hop ends at its flight time).
    expect(apex!.delay).toBeLessThan(g.FLIGHT_MS);
    expect(apex!.delaySkip).toBeLessThan(g.FLIGHT_LONG_MS);
    for (const key of ["delay", "delaySkip"] as const) {
      const order = g.EXPOSURES.map((e) => e[key]);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    }
    for (const v of ["flat", "skip"] as const) expect(takeoff!.pose[v].x).toBeLessThan(apex!.pose[v].x);
  });

  it("the stuck landing rests on its surface: the mat, the floor or the beam", async () => {
    const g = await import("@/components/sections/quiz/geometry");
    expect(g.lowestY(g.FLIER.f0)).toBeCloseTo(g.MAT_Y, 0);
    expect(g.lowestY(g.FLIER.f1)).toBeCloseTo(g.MAT_Y, 0);
    for (const v of ["flat", "parter", "greda", "skip"] as const) {
      expect(g.lowestY(g.FLIER.f2[v])).toBeCloseTo(g.MAT_Y - g.LIFT[v], 0);
    }
    expect(g.LIFT.flat).toBe(0);
    expect(g.LIFT.greda).toBeGreaterThan(g.LIFT.parter);
  });

  it("no exposure sinks below the mat or leaves the strip", async () => {
    const g = await import("@/components/sections/quiz/geometry");
    for (const e of g.EXPOSURES) {
      for (const p of Object.values(e.pose)) {
        expect(g.lowestY(p)).toBeLessThanOrEqual(g.MAT_Y + 0.5);
        expect(p.y + g.USE_Y).toBeGreaterThanOrEqual(-8); // top of the box (arm tips), unrotated
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(g.VB_W);
      }
    }
  });

  it("never leaves the strip in flight: the flier's box top stays ≥ −8 at every instant of every hop", async () => {
    const g = await import("@/components/sections/quiz/geometry");
    const [x1, x2, x3] = g.FRAME_X;
    const hops: import("@/components/sections/quiz/geometry").Hop[] = [
      { from: [x1, 0], to: [x2, 0], amp: g.HOP },
      ...(["flat", "parter", "greda"] as const).map((v) => ({ from: [x2, 0], to: [x3, g.LIFT[v]], amp: g.HOP }) as const),
      { from: [x1, 0], to: [x3, g.LIFT.skip], amp: g.HOP_LONG },
    ];
    for (const hop of hops) {
      for (let i = 0; i <= 100; i++) expect(g.poseAt(hop, i / 100).y + g.USE_Y).toBeGreaterThanOrEqual(-8);
    }
  });

  it("draws every landing scene at one scale, the card's proportions, standing on the mat inside the strip", async () => {
    const g = await import("@/components/sections/quiz/geometry");
    const { SCENE_K } = await import("@/components/sections/programs/pose-scene");
    for (const id of ["parter", "greda", "preskok"] as const) {
      const a = g.APPARATUS[id];
      const l = g.LANDING[id];
      expect(a.s, id).toBe(g.SCENE_S);
      expect(l.scale, id).toBeCloseTo(SCENE_K * g.SCENE_S, 9); // pose : apparatus as on the card
      expect(a.y + g.ICON.floor * a.s, id).toBeCloseTo(g.MAT_Y, 0);
      // The widest drawings span icon x 1–47.
      expect(a.x + 1 * a.s, id).toBeGreaterThanOrEqual(0);
      expect(a.x + 47 * a.s, id).toBeLessThanOrEqual(g.VB_W);
      // The pose stays inside the strip, as the flier does (her arm tips ≥ −8).
      expect(l.y, id).toBeGreaterThanOrEqual(-8);
      expect(l.x, id).toBeGreaterThan(0);
      expect(l.x + l.width, id).toBeLessThanOrEqual(g.VB_W);
      // Every scene is at 03: its pose right of 02 and over the frame's third of the strip.
      expect(l.x, id).toBeGreaterThan(g.FRAME_X[1]);
    }
    // The largest scale at which the handspring still fits (≤ 1 % below the limit).
    const v = g.LANDING.preskok;
    expect(v.y).toBeLessThan(-8 + 1.5);
    expect(g.APPARATUS.parter.y + g.ICON.parter.back * g.APPARATUS.parter.s).toBeGreaterThan(0);
  });

  it("each landing pose puts its contact on its apparatus, and no ink below its surface or the mat", async () => {
    const g = await import("@/components/sections/quiz/geometry");
    const { POSES } = await import("@/components/brand/poses.generated");
    const { SW_REF } = await import("@/components/sections/programs/pose-scene");
    /** A pose's outline in strip units (the family uses M/L/H/V/Z only). */
    const ink = (id: "parter" | "greda" | "preskok") => {
      const l = g.LANDING[id];
      const t = POSES[l.id].d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
      const out: [number, number][] = [];
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
        out.push([l.x + x * l.scale, l.y + y * l.scale]);
      }
      return out;
    };
    const low = (id: "parter" | "greda" | "preskok") => Math.max(...ink(id).map((p) => p[1]));
    const edge = (id: "greda" | "preskok", top: number) => g.APPARATUS[id].y + (top - SW_REF / 2) * g.APPARATUS[id].s;
    // Cartwheel: hands on the beam top (±0.5 strip units), inside the beam; nothing below it.
    const b = g.APPARATUS.greda;
    expect(g.LANDING.greda.at[1]).toBeCloseTo(edge("greda", g.ICON.greda.top), 0);
    expect(g.LANDING.greda.at[0]).toBeGreaterThan(b.x + g.ICON.greda.left * b.s);
    expect(g.LANDING.greda.at[0]).toBeLessThan(b.x + g.ICON.greda.right * b.s);
    for (const h of [POSES.cartwheel.contacts.handL, POSES.cartwheel.contacts.handR]) {
      const hx = g.LANDING.greda.x + h[0] * g.LANDING.greda.scale;
      const hy = g.LANDING.greda.y + h[1] * g.LANDING.greda.scale;
      expect(Math.abs(hy - edge("greda", g.ICON.greda.top))).toBeLessThan(0.5);
      expect(hx).toBeGreaterThan(b.x + g.ICON.greda.left * b.s);
      expect(hx).toBeLessThan(b.x + g.ICON.greda.right * b.s);
    }
    expect(low("greda")).toBeLessThanOrEqual(edge("greda", g.ICON.greda.top) + 0.5);
    // Handspring: the hand on the table top, inside the table; nothing below it.
    const v = g.APPARATUS.preskok;
    const [hx, hy] = [g.LANDING.preskok.x + POSES.vault.contacts.hand[0] * g.LANDING.preskok.scale, g.LANDING.preskok.y + POSES.vault.contacts.hand[1] * g.LANDING.preskok.scale];
    expect(Math.abs(hy - edge("preskok", g.ICON.preskok.top))).toBeLessThan(0.5);
    expect(hx).toBeGreaterThan(v.x + g.ICON.preskok.left * v.s);
    expect(hx).toBeLessThan(v.x + g.ICON.preskok.right * v.s);
    expect(g.LANDING.preskok.at).toEqual([expect.closeTo(hx, 0), expect.closeTo(hy, 0)]);
    expect(low("preskok")).toBeLessThanOrEqual(edge("preskok", g.ICON.preskok.top) + 0.5);
    // Star: in the air over the carpet — her feet above its back edge, never on or below it.
    const p = g.APPARATUS.parter;
    expect(low("parter")).toBeLessThan(p.y + g.ICON.parter.back * p.s);
    expect(low("parter")).toBeGreaterThan(p.y + g.ICON.parter.back * p.s - 4 * p.s);
    // No ink below the mat, anywhere.
    for (const id of ["parter", "greda", "preskok"] as const) expect(low(id), id).toBeLessThan(g.MAT_Y);
  });

  it("the vault: the leap sticks on the mat at 03 and the handspring is centred over 03 (its table out of her reach)", async () => {
    const g = await import("@/components/sections/quiz/geometry");
    expect(g.APPARATUS.preskok.lift).toBe(0);
    const land = g.FLIER.f2.flat;
    expect(land.x).toBe(g.FRAME_X[2]);
    expect(g.lowestY(land)).toBeCloseTo(g.MAT_Y, 0);
    const l = g.LANDING.preskok;
    expect(l.x + l.width / 2).toBeCloseTo(g.FRAME_X[2], 0);
    // Landing on the table top would lift her box past the strip's top: the vault is a cut.
    const tableLift = g.MAT_Y - (g.APPARATUS.preskok.y + g.ICON.preskok.top * g.APPARATUS.preskok.s);
    expect(g.REST_Y - tableLift + g.USE_Y).toBeLessThan(-8);
  });

  it("the beam landing: front foot on the beam top at its end, the seat of the split over the beam", async () => {
    const g = await import("@/components/sections/quiz/geometry");
    const a = g.APPARATUS.greda;
    const land = g.FLIER.f2.greda;
    const left = a.x + g.ICON.greda.left * a.s;
    const right = a.x + g.ICON.greda.right * a.s;
    const top = a.y + g.ICON.greda.top * a.s;
    const [footX, footY] = g.pointOf(land, ...g.LOW_POINTS[0]!);
    expect(footY).toBeCloseTo(top, 0);
    expect(footX).toBeGreaterThan(left);
    expect(footX).toBeLessThan(right);
    const [seatX, seatY] = g.pointOf(land, ...g.LOW_POINTS[2]!);
    expect(seatX).toBeGreaterThan(left);
    expect(seatX).toBeLessThan(right);
    expect(seatY).toBeLessThan(top);
    // A beam, not a bench: longer than 2/3 of her split from toe to toe (v2: 1/2).
    const leap = g.pointOf(land, ...g.FRONT_TOE)[0] - g.pointOf(land, ...g.BACK_TOE)[0];
    expect(right - left).toBeGreaterThan((2 / 3) * leap);
  });

  it("the floor landing: the front foot lands mid-depth on the carpet, inside its right edge", async () => {
    const g = await import("@/components/sections/quiz/geometry");
    const a = g.APPARATUS.parter;
    const P = g.ICON.parter;
    const depth = (g.ICON.floor - P.land) / (g.ICON.floor - P.back);
    expect(depth).toBe(0.5);
    const edge = (front: number, back: number) => a.x + (front + depth * (back - front)) * a.s;
    for (const v of ["parter", "skip"] as const) {
      const land = g.FLIER.f2[v];
      const [footX, footY] = g.pointOf(land, ...g.LOW_POINTS[0]!);
      expect(footY).toBeCloseTo(a.y + P.land * a.s, 0);
      expect(footX).toBeGreaterThan(edge(P.frontLeft, P.backLeft));
      expect(g.pointOf(land, ...g.FRONT_TOE)[0]).toBeLessThan(edge(P.frontRight, P.backRight) - 4);
    }
  });

  it("the frame numbers sit under the frames", async () => {
    const g = await import("@/components/sections/quiz/geometry");
    const { FRAME_LEFT } = await import("@/components/sections/quiz/QuizBand");
    g.FRAME_X.forEach((x, i) => expect(FRAME_LEFT[i]).toBe(`${((x / g.VB_W) * 100).toFixed(2)}%`));
  });
});

describe("quiz — strip print: the flight, then her program's pose (plan §5.3)", () => {
  const exposureTags = (html: string) => html.match(/<g class="qf qf--\w+"[^>]*>/g) ?? [];
  const css = readFileSync(new URL("../styles/sections/quiz.css", import.meta.url), "utf8");

  it("paints apparatus → grid and mat → exposures → flier → landing poses, with no occluder", async () => {
    const { QuizBandArt } = await import("@/components/sections/quiz/QuizBandArt");
    const html = renderToStaticMarkup(createElement(QuizBandArt));
    const order = ["qb-apps", "qb-grid", "qb-mat", "qb-latent", "qb-fly", "qb-land qb-land--parter"].map((c) =>
      html.indexOf(`class="${c}"`),
    );
    for (const i of order) expect(i).toBeGreaterThan(-1);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).not.toContain("qb-occlude");
    expect(css).not.toContain("qb-occlude");
    expect(exposureTags(html)).toHaveLength(2);
  });

  it("needs no occluder: no exposure, on any variant, reaches a landing apparatus", async () => {
    const g = await import("@/components/sections/quiz/geometry");
    // An exposure's reach to the right: its front toe (the fill's right extreme) at any pitch.
    const right = Math.max(
      ...g.EXPOSURES.flatMap((e) => Object.values(e.pose).map((p) => g.pointOf(p, ...g.FRONT_TOE)[0] + 4)),
    );
    for (const id of ["parter", "greda", "preskok"] as const) {
      const a = g.APPARATUS[id];
      const left = Math.min(a.x + (id === "preskok" ? g.ICON.preskok.run : id === "greda" ? g.ICON.greda.left : g.ICON.parter.frontLeft) * a.s, g.LANDING[id].x);
      expect(right, id).toBeLessThan(left);
    }
  });

  it("the brand figure (flier + two exposures) and each landing pose: poses are their own <svg data-figure=\"pose:…\">", async () => {
    const { QuizBandArt } = await import("@/components/sections/quiz/QuizBandArt");
    const html = renderToStaticMarkup(createElement(QuizBandArt));
    expect(html).toMatch(/^<svg class="quiz-band__svg"[^>]*data-figure="brand:quiz"/);
    expect(html.match(/href="#leap"/g)).toHaveLength(3);
    expect([...html.matchAll(/<svg data-figure="pose:(\w+)"/g)].map((m) => m[1])).toEqual(["star", "cartwheel", "vault"]);
  });

  it("the no-JS guide's still print: the same flight, the leap on the mat, no landing shown", async () => {
    const { QuizBandArt } = await import("@/components/sections/quiz/QuizBandArt");
    const html = renderToStaticMarkup(createElement(QuizBandArt));
    const { QuizGuide } = await import("@/components/sections/quiz/QuizGuide");
    const guide = renderToStaticMarkup(createElement(QuizGuide));
    expect(exposureTags(guide)).toEqual(exposureTags(html));
    // One flier plus the two exposures: three silhouettes in the guide's print; no data-app, so
    // the landing poses stay hidden (CSS keys them on data-app) and the leap keeps the mat.
    expect(guide.match(/href="#leap"/g)).toHaveLength(3);
    expect(guide).not.toMatch(/class="quiz-band"[^>]*data-app=/);
    expect(css).toMatch(/\.quiz-band\[data-app\] \.qb-body \{\s*opacity: 0;/);
    expect(css).toMatch(/\.qb-land \{\s*color: var\(--color-white\);\s*opacity: 0;/);
  });

  it("touchdown at 03: a ≤120ms crossfade from the leap to the pose, then the pose sticks about its contact", () => {
    const FWD = '.quiz-app:not([data-lite]) .quiz-band[data-dir="fwd"]';
    const body = css.match(new RegExp(`${FWD.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\[data-app\\] \\.qb-body \\{\\s*transition: opacity (\\d+)ms linear var\\(--qb-fly\\);`))?.[1];
    expect(Number(body)).toBeLessThanOrEqual(120);
    for (const id of ["parter", "greda", "preskok"]) {
      const sel = `${FWD}[data-app="${id}"] .qb-land--${id}`;
      const at = css.indexOf(sel);
      expect(at, id).toBeGreaterThan(-1);
      const decl = css.slice(css.indexOf("{", at), css.indexOf("}", at));
      expect(decl, id).toMatch(new RegExp(`transition: opacity ${body}ms linear var\\(--qb-fly\\);`));
    }
    // The stick starts as the crossfade ends, held compressed while the pose fades in.
    expect(css).toMatch(new RegExp(`animation: qb-pose-stick var\\(--dur-land\\) var\\(--ease-land\\) calc\\(var\\(--qb-fly\\) \\+ ${body}ms\\) backwards;`));
    expect(css).toMatch(/\.qb-land,\s*\.qb-land-stick \{\s*transform-box: view-box;\s*transform-origin: var\(--at\);/);
    // …and the flier's own step-2 stick and puff are gone (she is the pose by then).
    expect(css).not.toMatch(/qb-stick-b|qb-puff-b/);
  });

  it("the pose's contact (--at) is its landing contact, in strip units", async () => {
    const g = await import("@/components/sections/quiz/geometry");
    const { QuizBandArt } = await import("@/components/sections/quiz/QuizBandArt");
    const html = renderToStaticMarkup(createElement(QuizBandArt));
    for (const id of ["parter", "greda", "preskok"] as const) {
      const [x, y] = g.LANDING[id].at;
      expect(html).toContain(`class="qb-land qb-land--${id}" style="--at:${x}px ${y}px"`);
    }
  });
});

describe("quiz — rewind leaves the apparatus after her feet (QP3-04)", () => {
  const css = readFileSync(new URL("../styles/sections/quiz.css", import.meta.url), "utf8");
  const tokens = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const ease = (name: string) =>
    (tokens.match(new RegExp(`--ease-${name}: cubic-bezier\\(([^)]+)\\)`))?.[1] ?? "").split(",").map(Number) as [
      number,
      number,
      number,
      number,
    ];
  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    expect(at, selector).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("}", at));
  };
  const BACK = '.quiz-app:not([data-lite]) .quiz-band[data-dir="back"]';

  it("keeps the beam ≥ 95 % drawn until her front foot is past its end, and hides it before the rewind ends", async () => {
    const g = await import("@/components/sections/quiz/geometry");
    const rewind = Number(rule(`${BACK} .qb-fly`).match(/transform (\d+)ms var\(--ease-flight\)/)?.[1]);
    const [, dur, delay] = rule(`${BACK} .qb-app path`).match(/stroke-dashoffset (\d+)ms var\(--ease-takeoff\) (\d+)ms/)!.map(Number);
    const hide = Number(rule(`${BACK} .qb-app`).match(/opacity 0s linear (\d+)ms/)?.[1]);
    expect(rewind).toBeGreaterThan(0);
    expect(delay).toBeGreaterThan(0);
    expect(hide).toBe(delay! + dur!); // hidden exactly when its lines are gone
    expect(hide).toBeLessThanOrEqual(rewind); // …and never outlives the rewind

    // The rewind off the beam: front foot from the landing back to 02 on --ease-flight.
    const from = g.FLIER.f2.greda.x + g.FOOT.x;
    const dx = g.FLIER.f2.greda.x - g.FLIER.f1.x;
    const beamLeft = g.APPARATUS.greda.x + g.ICON.greda.left * g.APPARATUS.greda.s;
    const flight = ease("flight");
    const takeoff = ease("takeoff");
    for (const e of [flight, takeoff]) expect(e.filter(Number.isFinite)).toHaveLength(4);
    let leave = 0;
    while (leave < rewind && from - dx * g.cubicBezier(...flight, leave / rewind) > beamLeft) leave++;
    expect(leave).toBeLessThan(rewind);
    // Still ≥ 95 % drawn while her foot is over the beam.
    const undrawn = g.cubicBezier(...takeoff, Math.max(0, (leave - delay!) / dur!));
    expect(undrawn).toBeLessThan(0.05);
  });

  it("reduced motion / Save-Data keeps going back instant (the rules are motion-only)", () => {
    const motion = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference)"));
    expect(motion).toContain(`${BACK} .qb-app {`);
    expect(motion).toContain(`${BACK} .qb-app path {`);
    expect(css.indexOf(`${BACK} .qb-app`)).toBeGreaterThan(css.indexOf("@media (prefers-reduced-motion: no-preference)"));
  });
});

describe("quiz — strip caption stays one line at 320 (QP4-04)", () => {
  const css = readFileSync(new URL("../styles/sections/quiz.css", import.meta.url), "utf8");
  /** The unbreakable runs of a caption: text inside each nowrap part, in order. */
  const parts = (html: string, cls: string) =>
    [...html.matchAll(new RegExp(`<span class="${cls}">([^<]*)</span>`, "g"))].map((m) => m[1]);

  it("the „·“ travels with the answer after it, so it can never end a line", async () => {
    const { QuizBand } = await import("@/components/sections/quiz/QuizBand");
    const html = renderToStaticMarkup(
      createElement(QuizBand, { step: 2, asked: true, caption: ["10 god.", REKREATIVNO], art: null }),
    );
    expect(parts(html, "quiz-band__part")).toEqual(["10 god.", `· ${REKREATIVNO}`]);
    // The only break opportunity is the plain space before the dot, outside the nowrap parts.
    const caption = html.match(/<span class="quiz-band__caption">(.*?)<\/span><span class="quiz-band__code">/)?.[1] ?? "";
    expect(caption.replace(/<span class="quiz-band__part">[^<]*<\/span>/g, "|")).toBe("| |");
    expect(css).toMatch(/\.quiz-band__part \{\s*white-space: nowrap;/);
  });

  it("a narrow strip drops only the decorative „KR-Q“, and only for a two-answer caption", async () => {
    const { QuizBand } = await import("@/components/sections/quiz/QuizBand");
    const edge = (caption: string[]) =>
      renderToStaticMarkup(createElement(QuizBand, { step: 2, caption, art: null })).match(/data-parts="(\d)"/)?.[1];
    expect(edge(["5 god."])).toBe("1");
    expect(edge(["10 god.", REKREATIVNO])).toBe("2");
    expect(css).toMatch(/\.quiz-band__edge \{[^}]*container: qb-edge \/ inline-size;/);
    const rule = css.match(/@container qb-edge \(width < (\d+)px\) \{\s*([^{]+)\{\s*display: none;/);
    expect(rule?.[2]?.trim()).toBe('.quiz-band__edge[data-parts="2"] .quiz-band__code');
    // 320px screens give the edge 252px (hidden there); 340px screens give it 272px (kept).
    expect(Number(rule?.[1])).toBeGreaterThan(252);
    expect(Number(rule?.[1])).toBeLessThanOrEqual(272);
  });

  it("the no-JS guide keeps the same rule: a separator opens the next answer", async () => {
    const { QuizGuide } = await import("@/components/sections/quiz/QuizGuide");
    const answers = parts(renderToStaticMarkup(createElement(QuizGuide)), "quiz-rule__answer");
    expect(answers.length).toBeGreaterThan(0);
    for (const a of answers) expect(a).not.toMatch(/·\s*$/);
    expect(answers).toContain(`· ${TAKMICILO_SE}`);
  });
});
