import { describe, expect, it } from "vitest";
import { SCRUB_FROM, SCRUB_TO, frameAt, keyedOffset, scrubProgress } from "@/lib/exercise-scrub";

describe("scroll-scrubbed exercises: progress and frame (lib/exercise-scrub.ts)", () => {
  const vh = 800;

  it("starts when the scene's centre crosses the bottom edge and ends 40% from the top", () => {
    expect(SCRUB_FROM).toBe(1);
    expect(SCRUB_TO).toBe(0.4);
    expect(scrubProgress(vh, vh)).toBe(0);
    expect(scrubProgress(vh + 200, vh)).toBe(0);
    expect(scrubProgress(0.4 * vh, vh)).toBe(1);
    expect(scrubProgress(-300, vh)).toBe(1);
    expect(scrubProgress(0.7 * vh, vh)).toBeCloseTo(0.5, 9);
  });

  it("is linear in the scroll position between its lines, for any lines", () => {
    const a = scrubProgress(600, vh, 0.9, 0.3);
    const b = scrubProgress(500, vh, 0.9, 0.3);
    const c = scrubProgress(400, vh, 0.9, 0.3);
    expect(b - a).toBeCloseTo(c - b, 9);
    expect(scrubProgress(0.9 * vh, vh, 0.9, 0.3)).toBeCloseTo(0, 12);
    expect(scrubProgress(0.3 * vh, vh, 0.9, 0.3)).toBeCloseTo(1, 12);
  });

  it("degenerate lines (to ≥ from) show the finished exercise", () => {
    expect(scrubProgress(100, vh, 0.4, 0.4)).toBe(1);
    expect(scrubProgress(100, vh, 0.3, 0.6)).toBe(1);
  });

  it("maps progress onto every frame, first and last included, clamped", () => {
    expect(frameAt(0, 24)).toBe(0);
    expect(frameAt(1, 24)).toBe(23);
    expect(frameAt(0.5, 3)).toBe(1);
    expect(frameAt(-1, 24)).toBe(0);
    expect(frameAt(2, 24)).toBe(23);
    const seen = new Set(Array.from({ length: 1001 }, (_, i) => frameAt(i / 1000, 24)));
    expect(seen.size).toBe(24);
  });

  it("spreads key phases: each key frame gets its shift, in-betweens blend linearly by frame", () => {
    const at = keyedOffset([0, 10, 30], [[-100, 4], [-40, 0], [0, 0]]);
    expect(at(0)).toEqual([-100, 4]);
    expect(at(10)).toEqual([-40, 0]);
    expect(at(30)).toEqual([0, 0]);
    expect(at(5)).toEqual([-70, 2]);
    expect(at(20)).toEqual([-20, 0]);
    expect(at(-3)).toEqual([-100, 4]);
    expect(at(40)).toEqual([0, 0]);
    expect(keyedOffset([], [])(3)).toEqual([0, 0]);
  });
});
