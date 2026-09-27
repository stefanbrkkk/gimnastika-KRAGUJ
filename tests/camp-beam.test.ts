import { describe, expect, it } from "vitest";
import { scrubProgress } from "@/lib/exercise-scrub";
import {
  APPEAR,
  CUT,
  ECHO,
  ECHO_AT,
  ECHO_STAGGER,
  END_LINE,
  FADE_DELAY,
  FLIGHT,
  FLY_AT,
  FOLD,
  GHOST_AT,
  GHOST_LAG,
  LAND_AT,
  LET_GO,
  MIN_SPAN_PX,
  MORPH,
  MORPH_AT,
  SINK,
  START_AIR,
  SWAY,
  SWAY_AT,
  TOTAL,
  arcAt,
  routineLines,
  routineProgress,
  swayEase,
} from "@/components/sections/camp/beam-scrub";

/** The tilt left at share t of the sway, as a share of the landing tilt. */
const tilt = (t: number) => 1 - swayEase(t);

describe("camp beam routine: scroll lines (beam-scrub.ts, D-60)", () => {
  it("starts once the beam stands clear of the bottom edge, or of the phone dock, and ends at END_LINE", () => {
    expect(END_LINE).toBe(0.5);
    const desk = routineLines(900, 0);
    expect(desk.from * 900).toBeCloseTo(900 - START_AIR, 9);
    expect(desk.to).toBe(END_LINE);
    const phone = routineLines(844, 68);
    expect(phone.from * 844).toBeCloseTo(844 - 68 - START_AIR, 9);
    // The scroll the whole routine is given: 426 px at 1440×900, 330 px at 390×844.
    expect(Math.round((desk.from - desk.to) * 900)).toBe(426);
    expect(Math.round((phone.from - phone.to) * 844)).toBe(330);
  });

  it("gives a short viewport (phone landscape) at least MIN_SPAN_PX by ending higher up, never above 20%", () => {
    const { from, to } = routineLines(390, 68);
    expect((from - to) * 390).toBeCloseTo(MIN_SPAN_PX, 9);
    expect(to).toBeLessThan(END_LINE);
    expect(routineLines(300, 68).to).toBe(0.2);
    expect(routineLines(0, 0)).toEqual({ from: 1, to: END_LINE });
  });

  it("maps the beam's place linearly onto 0…1, clamped: scrolling back rewinds, a still page holds", () => {
    const vh = 844;
    const cover = 68;
    const { from, to } = routineLines(vh, cover);
    expect(routineProgress(from * vh, vh, cover)).toBeCloseTo(0, 12);
    expect(routineProgress(to * vh, vh, cover)).toBeCloseTo(1, 12);
    expect(routineProgress(vh + 50, vh, cover)).toBe(0);
    expect(routineProgress(-200, vh, cover)).toBe(1);
    const a = routineProgress(700, vh, cover);
    const b = routineProgress(600, vh, cover);
    const c = routineProgress(500, vh, cover);
    expect(b - a).toBeCloseTo(c - b, 12);
    expect(routineProgress(600, vh, cover)).toBe(b);
  });

  it("is the same linear map as the flipbook scenes (lib/exercise-scrub.ts scrubProgress, D-52)", () => {
    for (const [vh, cover] of [[844, 68], [900, 0], [390, 68]] as const) {
      const { from, to } = routineLines(vh, cover);
      for (let y = -100; y <= vh + 100; y += 37) expect(routineProgress(y, vh, cover)).toBeCloseTo(scrubProgress(y, vh, from, to), 12);
    }
  });
});

describe("camp beam routine: the clock", () => {
  it("runs the phases in order and ends with the echoes", () => {
    expect(FLY_AT).toBeLessThan(APPEAR);
    expect(LAND_AT).toBeCloseTo(FLY_AT + FLIGHT, 12);
    expect(SWAY_AT).toBeGreaterThan(LAND_AT);
    expect(SWAY_AT).toBeLessThan(LAND_AT + CUT);
    expect(LET_GO).toBeCloseTo(SWAY_AT + SWAY, 12);
    expect(MORPH_AT).toBeCloseTo(LET_GO + SINK, 12);
    expect(ECHO_AT).toBeGreaterThan(MORPH_AT);
    expect(ECHO_AT).toBeLessThan(MORPH_AT + MORPH);
    expect(TOTAL).toBeCloseTo(ECHO_AT + ECHO_STAGGER + ECHO, 12);
    expect(MORPH_AT + MORPH).toBeLessThanOrEqual(TOTAL);
  });

  it("gives the flight about a third of the scroll and the landing + balance about a quarter", () => {
    expect(FLIGHT / TOTAL).toBeGreaterThan(0.28);
    expect(FLIGHT / TOTAL).toBeLessThan(0.36);
    expect((LET_GO - LAND_AT) / TOTAL).toBeGreaterThan(0.22);
    expect((LET_GO - LAND_AT) / TOTAL).toBeLessThan(0.3);
  });

  it("never shows her during the morph: she, her ghost, the bar and the legs are gone as it starts", () => {
    expect(LET_GO + FADE_DELAY + (SINK - FADE_DELAY)).toBeCloseTo(MORPH_AT, 12);
    expect(LET_GO + FOLD).toBeLessThanOrEqual(MORPH_AT);
  });

  it("fades the apex ghost in only after she passed its spot, on her own arc", () => {
    const passed = FLY_AT + FLIGHT * GHOST_AT;
    expect(passed + GHOST_LAG).toBeGreaterThan(passed);
    expect(arcAt(0)).toBe(0);
    expect(arcAt(1)).toBe(0);
    expect(arcAt(GHOST_AT)).toBe(1);
  });
});

describe("camp beam routine: the balance sway (swayEase)", () => {
  it("starts at the landing tilt and ends upright", () => {
    expect(swayEase(0)).toBe(0);
    expect(swayEase(1)).toBeCloseTo(1, 12);
  });

  it("swings once past upright, then a small correction — each swing smaller than the last", () => {
    expect(tilt(0.2)).toBeCloseTo(0, 12);
    expect(tilt(0.4)).toBeCloseTo(-0.36, 12);
    expect(tilt(0.6)).toBeCloseTo(0, 12);
    expect(tilt(0.8)).toBeCloseTo(0.04, 12);
    // Only two reversals over the whole sway: slow enough to read under a scroll, never a flicker.
    let reversals = 0;
    let prev = tilt(0.001) - tilt(0);
    for (let i = 2; i <= 1000; i++) {
      const d = tilt(i / 1000) - tilt((i - 1) / 1000);
      if (Math.sign(d) !== Math.sign(prev) && d !== 0) reversals++;
      prev = d;
    }
    expect(reversals).toBe(2);
  });

  it("is still when the beam lets go (no motion left at its end)", () => {
    const slope = (swayEase(1) - swayEase(0.99)) / 0.01;
    expect(Math.abs(slope)).toBeLessThan(0.05);
  });
});
