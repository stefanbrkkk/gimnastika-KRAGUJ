import { describe, expect, it } from "vitest";
import {
  HEADER_HIDE_AFTER,
  MENU_INDEX_ID,
  SHORT_VIEWPORT_MAX,
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
});

describe("menu fallback", () => {
  it("Meni links to the footer page index until hydration", () => {
    expect(MENU_INDEX_ID).toBe("meni");
  });
});
