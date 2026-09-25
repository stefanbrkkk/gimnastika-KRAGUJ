import { describe, expect, it } from "vitest";
import {
  HEADER_HIDE_AFTER,
  MENU_INDEX_ID,
  SHORT_VIEWPORT_MAX,
  bandDelta,
  focusScrollDelta,
  headerCtaHidden,
  initialHeaderState,
  isKeyboardOpen,
  isTextEntry,
  nextHeaderState,
  obscuredBy,
  pickInBand,
  stickyBarVisible,
  toneOf,
  type HeaderScrollState,
} from "@/components/sections/header/chrome";
import { POINTER_TILT, SETTLE_KICK, createBalance, isSettled, pointerTarget, stepBalance } from "@/components/notfound/tilt";

/** Feed a scroll path (list of scrollY values) through the header state machine. */
const run = (path: number[], start = 0): HeaderScrollState =>
  path.reduce((s, y) => nextHeaderState(s, y), initialHeaderState(start));

describe("header hide/show on scroll", () => {
  it("never hides within the first 120 px", () => {
    expect(run([20, 60, 100, HEADER_HIDE_AFTER]).hidden).toBe(false);
  });

  it("hides on scroll-down after 120 px", () => {
    expect(run([60, 110, 140]).hidden).toBe(true);
    expect(run([2000]).hidden).toBe(true); // jump (anchor link / reload mid-page)
  });

  it("reappears on scroll-up", () => {
    expect(run([400, 800, 780]).hidden).toBe(false);
  });

  it("ignores jitter smaller than the travel threshold", () => {
    expect(run([400, 800, 796, 799]).hidden).toBe(true);
    expect(run([405, 409, 403], 400).hidden).toBe(false); // visible stays visible on tiny moves
  });

  it("accumulates slow scrolling (1–3 px per event)", () => {
    const slowDown = Array.from({ length: 10 }, (_, i) => 300 + i * 2); // 300 → 318
    expect(run([300, ...slowDown]).hidden).toBe(true);
    const slowUp = Array.from({ length: 10 }, (_, i) => 900 - i * 2);
    expect(run([300, 900, ...slowUp]).hidden).toBe(false);
  });

  it("direction change resets the travel", () => {
    // down 10 (not enough), up 5, down 10 → still visible (travel restarted each time)
    expect(run([500, 510, 505, 515], 500).hidden).toBe(false);
  });

  it("shows again when back near the top, and clamps iOS rubber-band negatives", () => {
    expect(run([900, 1500, 100]).hidden).toBe(false);
    expect(run([900, 1500, -40]).hidden).toBe(false);
  });
});

describe("header tone from the section under it", () => {
  it("maps section themes", () => {
    expect(toneOf("dark")).toBe("dark");
    expect(toneOf("darker")).toBe("dark");
    expect(toneOf("light")).toBe("light");
    expect(toneOf("ice")).toBe("light");
    expect(toneOf(null)).toBe("light");
  });

  it("picks the section that contains the band line", () => {
    const hero = { item: "top", top: -700, bottom: 44 };
    const quiz = { item: "kviz", top: 44, bottom: 900 };
    expect(pickInBand([hero, quiz], 44)).toBe("kviz");
    expect(pickInBand([{ item: "a", top: -100, bottom: 200 }], 44)).toBe("a");
    expect(pickInBand([], 44)).toBeNull();
  });
});

describe("sticky bottom bar visibility", () => {
  const base = { mobile: true, heroCtasPassed: true, contactVisible: false, keyboardOpen: false, fieldFocused: false };

  it("shows on mobile after the hero CTAs are passed", () => {
    expect(stickyBarVisible(base)).toBe(true);
    expect(stickyBarVisible({ ...base, heroCtasPassed: false })).toBe(false);
  });

  it("is mobile only", () => {
    expect(stickyBarVisible({ ...base, mobile: false })).toBe(false);
  });

  it("hides over the contact block, with the keyboard open and in form fields", () => {
    expect(stickyBarVisible({ ...base, contactVisible: true })).toBe(false);
    expect(stickyBarVisible({ ...base, keyboardOpen: true })).toBe(false);
    expect(stickyBarVisible({ ...base, fieldFocused: true })).toBe(false);
  });

  it("yields to the header on short viewports (landscape phones, 400% zoom)", () => {
    expect(SHORT_VIEWPORT_MAX).toBe(480);
    // short + header shown (scroll-up / keyboard focus in the header) → bar steps aside
    expect(stickyBarVisible({ ...base, shortViewport: true, headerShown: true })).toBe(false);
    // short + header hidden (scrolling down) → the bar is back
    expect(stickyBarVisible({ ...base, shortViewport: true, headerShown: false })).toBe(true);
    // tall viewports keep both, as before
    expect(stickyBarVisible({ ...base, shortViewport: false, headerShown: true })).toBe(true);
    expect(stickyBarVisible({ ...base, headerShown: true })).toBe(true);
  });

  it("steps aside while the S10 action row (its own call + trial CTA) is half in view", () => {
    expect(stickyBarVisible({ ...base, enrollActionsVisible: true })).toBe(false);
    expect(stickyBarVisible({ ...base, enrollActionsVisible: false })).toBe(true);
  });

  it("steps aside while the S3 progress rail (prev/next + dots) is half in view", () => {
    expect(stickyBarVisible({ ...base, programsRailVisible: true })).toBe(false);
    expect(stickyBarVisible({ ...base, programsRailVisible: false })).toBe(true);
    // it only ever hides the bar: never shows it where another rule keeps it away
    expect(stickyBarVisible({ ...base, heroCtasPassed: false, programsRailVisible: false })).toBe(false);
    expect(stickyBarVisible({ ...base, contactVisible: true, programsRailVisible: false })).toBe(false);
  });

  it("detects the on-screen keyboard from the visual viewport", () => {
    expect(isKeyboardOpen(800, 800)).toBe(false);
    expect(isKeyboardOpen(800, 720)).toBe(false); // URL bar / small changes
    expect(isKeyboardOpen(800, 480)).toBe(true); // keyboard
    expect(isKeyboardOpen(800, 400, 2)).toBe(false); // pinch-zoom ×2, no keyboard
  });

  it("recognises text-entry fields", () => {
    expect(isTextEntry({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isTextEntry({ tagName: "INPUT", type: "tel" })).toBe(true);
    expect(isTextEntry({ tagName: "INPUT" })).toBe(true);
    expect(isTextEntry({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTextEntry({ tagName: "SELECT" })).toBe(true);
    expect(isTextEntry({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(isTextEntry({ tagName: "BUTTON" })).toBe(false);
    expect(isTextEntry({ tagName: "A" })).toBe(false);
    expect(isTextEntry({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTextEntry(null)).toBe(false);
  });
});

describe("focus not obscured (WCAG 2.4.11)", () => {
  it("scrolls up when focus sits under the header", () => {
    expect(obscuredBy({ top: 40, bottom: 90 }, { side: "top", edge: 76 })).toBe(40 - 88);
    expect(obscuredBy({ top: 120, bottom: 170 }, { side: "top", edge: 76 })).toBe(0);
  });

  it("scrolls down when focus sits under the bottom bar", () => {
    expect(obscuredBy({ top: 700, bottom: 760 }, { side: "bottom", edge: 736 })).toBe(760 - 724);
    expect(obscuredBy({ top: 500, bottom: 560 }, { side: "bottom", edge: 736 })).toBe(0);
  });

  it("fits a box into the free band between the bars, 12px clear of both", () => {
    // 640×400 (1280×800 at 200%): header hidden, bar top 336 → band 0…336
    expect(bandDelta({ top: 88, bottom: 351 }, 0, 336)).toBe(351 - 324); // a 263px print, taller than half the viewport
    expect(bandDelta({ top: 40, bottom: 300 }, 0, 336)).toBe(0);
    expect(bandDelta({ top: 60, bottom: 110 }, 70, 780)).toBe(60 - 82);
  });

  it("pins the top edge of a box that cannot fit the band", () => {
    expect(bandDelta({ top: 200, bottom: 600 }, 74, 326)).toBe(200 - 86);
    expect(bandDelta({ top: -30, bottom: 330 }, 0, 326)).toBe(-30 - 12);
    expect(bandDelta({ top: 86, bottom: 486 }, 74, 326)).toBe(0);
  });

  const phone = { scrollY: 3000, viewportHeight: 844, headerShown: true, headerBottom: 70, barTop: 780 };

  it("clears the header and the sticky bar together", () => {
    expect(focusScrollDelta({ top: 300, bottom: 500 }, phone)).toBe(0);
    expect(focusScrollDelta({ top: 50, bottom: 250 }, phone)).toBe(50 - 82);
    expect(focusScrollDelta({ top: 600, bottom: 800 }, phone)).toBe(800 - 768);
    expect(focusScrollDelta({ top: 600, bottom: 800 }, { ...phone, barTop: null })).toBe(0);
  });

  it("a scroll up that brings the hidden header back clears its resting edge too", () => {
    const hidden = { ...phone, headerShown: false };
    // ≥ 12px up → nextHeaderState shows the header → land under it, not at 12px
    expect(focusScrollDelta({ top: -40, bottom: 160 }, hidden)).toBe(-40 - 82);
    // a nudge smaller than the header's travel threshold keeps it hidden
    expect(focusScrollDelta({ top: 4, bottom: 204 }, hidden)).toBe(4 - 12);
    // …unless it ends within the first 120px, where the header always shows
    expect(focusScrollDelta({ top: 4, bottom: 204 }, { ...hidden, scrollY: 100 })).toBe(4 - 82);
    // short viewport (844×390): the bar steps aside once the header is back
    const short = { scrollY: 3000, viewportHeight: 390, headerShown: false, headerBottom: 74, barTop: 326 };
    expect(focusScrollDelta({ top: -27, bottom: 326 }, short)).toBe(-27 - 86);
    // scrolling down never brings the header back: header edge ignored
    expect(focusScrollDelta({ top: 40, bottom: 330 }, short)).toBe(330 - 314);
  });
});

describe("header CTA pill (one primary CTA per viewport)", () => {
  it("steps aside over the hero CTAs and over the S11 finale", () => {
    expect(headerCtaHidden({ heroCtasInView: true, contactVisible: false })).toBe(true);
    expect(headerCtaHidden({ heroCtasInView: false, contactVisible: true })).toBe(true);
  });

  it("is in the bar everywhere else (also when the hero CTAs start below the fold)", () => {
    expect(headerCtaHidden({ heroCtasInView: false, contactVisible: false })).toBe(false);
  });
});

describe("404 balance: the load catch reads, then holds", () => {
  const run = (v0: number, target = 0) => {
    let s = createBalance(3, v0);
    const peaks: number[] = [];
    let prev = s.velocity;
    let t = 0;
    let still = Infinity;
    while (t < 4) {
      s = stepBalance(s, target, 1 / 60);
      t += 1 / 60;
      if (Math.sign(s.velocity) !== Math.sign(prev)) peaks.push(s.angle);
      prev = s.velocity;
      if (still === Infinity && t > 0.2 && Math.abs(s.angle - target) < 0.3 && Math.abs(s.velocity) < 1) still = t;
      if (isSettled(s, target)) break;
    }
    return { peaks, still, settled: isSettled(s, target) };
  };

  it("leans about 14°, sways back and corrects: three visible swings", () => {
    const { peaks } = run(SETTLE_KICK);
    expect(Math.abs(peaks[0]!)).toBeGreaterThan(12);
    expect(Math.abs(peaks[0]!)).toBeLessThan(16);
    expect(peaks.filter((p) => Math.abs(p) >= 1)).toHaveLength(3);
  });

  it("is visibly still within 1.6 s and fully settled soon after", () => {
    const { still, settled } = run(SETTLE_KICK);
    expect(still).toBeLessThan(1.6);
    expect(settled).toBe(true);
  });

  it("desktop pointer: leans toward the pointer, clamped", () => {
    expect(pointerTarget(500, 0, 1000)).toBe(0);
    expect(pointerTarget(600, 0, 1000)).toBeCloseTo(3, 6);
    expect(pointerTarget(0, 0, 1000)).toBe(-POINTER_TILT);
    expect(pointerTarget(5000, 0, 1000)).toBe(POINTER_TILT);
    expect(pointerTarget(300, 0, 0)).toBe(0);
    expect(pointerTarget(Number.NaN, 0, 1000)).toBe(0);
  });
});

describe("menu fallback", () => {
  it("Meni links to the footer page index until hydration", () => {
    expect(MENU_INDEX_ID).toBe("meni");
  });
});
