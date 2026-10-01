import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EXERCISE_ENROLL_CARTWHEEL } from "@/components/brand/exercises/enrollCartwheel.generated";
import { POSES } from "@/components/brand/poses.generated";
import { LeapBand } from "@/components/sections/enrollment/LeapBand";
import { NARROW, WIDE, buildBand, keyShifts, type FigureId } from "@/components/sections/enrollment/leap-band";
import { keyedOffset } from "@/lib/exercise-scrub";

/**
 * The scroll-scrubbed scenes outside S3 (D-52): the enrollment band (one cartwheel over the three
 * steps) and the coach plate (rising into the scale). The static markup is the finished exercise;
 * lib/exercise-scrub.ts plays it with the scroll.
 */
const count = (html: string, re: RegExp) => html.match(re)?.length ?? 0;
const attr = (html: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(html)?.[1];

describe("enrollment band: one cartwheel, its phases spread over the steps", () => {
  const ex = EXERCISE_ENROLL_CARTWHEEL;
  const KEYS: FigureId[] = ["cart1", "cart2", "cart3", "salute"];

  describe.each([
    ["wide", WIDE],
    ["narrow", NARROW],
  ] as const)("%s band", (variant, spec) => {
    const band = buildBand(spec);
    const shifts = keyShifts(band, ex.keyOrigins);
    const salute = band.figures[3];
    const vb = POSES.salute.viewBox;
    /** An exercise point (the salute's pose units) in band units, through the salute's nested svg. */
    const inBand = ([x, y]: readonly [number, number]) => [salute.x + (x - vb.x) * spec.s, salute.y + (y - vb.y) * spec.s] as const;

    it("moves each key frame exactly onto the figure buildBand places over its step", () => {
      expect(shifts[3]).toEqual([0, 0]);
      KEYS.forEach((id, k) => {
        const f = band.figures[k]!;
        const pvb = POSES[id].viewBox;
        const [ox, oy] = ex.keyOrigins[k]!;
        const [tx, ty] = shifts[k]!;
        // The pose box's corners: pose units → exercise units (keyOrigins) → shifted → band.
        for (const q of [
          [pvb.x, pvb.y],
          [pvb.x + pvb.width, pvb.y + pvb.height],
        ] as const) {
          const [bx, by] = inBand([q[0] + ox + tx, q[1] + oy + ty]);
          expect(bx, `${id} x`).toBeCloseTo(f.x + (q[0] - pvb.x) * spec.s, 6);
          expect(by, `${id} y`).toBeCloseTo(f.y + (q[1] - pvb.y) * spec.s, 6);
        }
      });
    });

    it("renders one figure: three phase ghosts in place and the salute, the shifts for the motion", () => {
      const html = renderToStaticMarkup(createElement(LeapBand, { spec, variant }));
      expect(count(html, /data-figure="pose:/g)).toBe(1);
      expect(html).toContain('data-figure="pose:salute"');
      expect(html).toContain('overflow="visible"');
      expect(count(html, /class="ex-ghost en-band__ghost"/g)).toBe(3);
      const at = keyedOffset(ex.keys, shifts);
      ex.ghosts.forEach((f, i) => {
        const [x, y] = at(f).map((v) => Math.round(v * 10) / 10);
        expect(html).toContain(`data-phase="${i + 1}" data-frame="${f}" d="${ex.frames[f]}" transform="translate(${x} ${y})"`);
      });
      expect(html).toContain(`<path class="ex-solid en-band__solid" d="${POSES.salute.d}"`);
      const read = attr(html, "data-shifts")!
        .split(",")
        .map((p) => p.split(" ").map(Number));
      read.forEach((p, k) => {
        expect(p[0]).toBeCloseTo(shifts[k]![0], 1);
        expect(p[1]).toBeCloseTo(shifts[k]![1], 1);
      });
      // No #leap and no second figure: the band is the exercise alone.
      expect(html).not.toContain("#leap");
    });
  });

  it("the ghosts are the three cartwheel phases, the solid the salute", () => {
    expect(ex.pose).toBe("salute");
    expect(ex.ghosts).toEqual(ex.keys.slice(0, 3));
  });

  it("the motion chunk reads the shifts from the markup and never imports the band geometry", () => {
    const src = readFileSync("components/sections/enrollment/leap-motion.ts", "utf8");
    expect(src).not.toMatch(/from "\.\/leap-band"/);
    expect(src).not.toMatch(/poses\.generated/);
    expect(src).not.toMatch(/from "@\/lib\/motion"|from "gsap"/);
  });
});

describe("coach plate: real portraits for both coaches", () => {
  it("renders both portraits as photos (no pending scale-exercise plate)", async () => {
    const { Coaches } = await import("@/components/sections/coaches/Coaches");
    const html = renderToStaticMarkup(createElement(Coaches));
    expect(html).toContain('data-photo-id="06"');
    expect(html).toContain('data-photo-id="07"');
    expect(html).not.toContain("coach__plate-pose");
  });
});
