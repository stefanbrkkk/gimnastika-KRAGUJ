import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HEADER_HIDE_AFTER,
  MENU_INDEX_ID,
  SHORT_VIEWPORT_MAX,
  bandDelta,
  focusScrollDelta,
  headerCapBandOn,
  headerCapOn,
  headerCtaHidden,
  initialHeaderState,
  isKeyboardOpen,
  isTextEntry,
  nextHeaderState,
  obscuredBy,
  pickInBand,
  pickUnder,
  stickyBarVisible,
  toneOf,
  type HeaderScrollState,
} from "@/components/sections/header/chrome";
import {
  HEADER_LAND_SCRIPT,
  HEADER_TONE_LAND,
  HEADER_TONE_OWNED,
  HEADER_TONE_SCRIPT,
  HEADER_Y_KEY,
  headerYKey,
} from "@/components/sections/header/header-tone";
import { BeamScene } from "@/components/notfound/BeamScene";
import {
  ANKLE,
  BEAM,
  BEAM_TOP,
  FIGURE,
  FOOT_CONTACT,
  LEG_COLUMN,
  LEGS,
  POSE,
  STAND,
  SUPPORT_CUT,
  SWAY_CUT,
  VIEW,
  swayAt,
} from "@/components/notfound/scene";
import { MAX_TILT, POINTER_TILT, SETTLE_KICK, createBalance, isSettled, pointerTarget, stepBalance } from "@/components/notfound/tilt";
import { POSES } from "@/components/brand/poses.generated";
import { titlePhrases } from "@/components/notfound/title";
import { NOT_FOUND, PHOTO_PLACEHOLDER } from "@/content/copy";
import type { PhotoId } from "@/content/photos";
import { CLUB, NAV } from "@/content/site";

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

describe("header band picking with nested full-bleed bands (D-37)", () => {
  const isBand = (id: string) => id.startsWith("band:");
  it("a band that contains the line wins over its section", () => {
    const about = { item: "o-nama", top: -900, bottom: 1400 };
    const band = { item: "band:hronologija", top: -20, bottom: 600 };
    expect(pickUnder([about, band], 40, isBand)).toBe("band:hronologija");
    expect(pickUnder([about, band], 5, isBand)).toBe("band:hronologija");
  });
  it("otherwise the section that owns the line", () => {
    const about = { item: "o-nama", top: -900, bottom: 1400 };
    const band = { item: "band:hronologija", top: 60, bottom: 600 };
    expect(pickUnder([about, band], 40, isBand)).toBe("o-nama");
    expect(pickUnder([], 40, isBand)).toBeNull();
  });
});

describe("header cap over the gap above the bar (SC3-05)", () => {
  it("is on while the page is scrolled, in the colour of the section under the gap", () => {
    expect(headerCapOn({ scrollY: 3200, theme: "light", onEdge: false })).toBe(true);
    expect(headerCapOn({ scrollY: 1, theme: "dark", onEdge: false })).toBe(true);
  });
  it("is off at the very top, while a diagonal edge crosses the gap, and before a section is known", () => {
    expect(headerCapOn({ scrollY: 0, theme: "dark", onEdge: false })).toBe(false);
    expect(headerCapOn({ scrollY: 1900, theme: "dark", onEdge: true })).toBe(false);
    expect(headerCapOn({ scrollY: 1900, theme: null, onEdge: false })).toBe(false);
  });
  it("paints its band behind the bar's top corners only over one tone (SC4-02)", () => {
    // the S4 scoreboard case: gap and bar centre both over the light S4 → page-coloured corners
    expect(headerCapBandOn({ capTheme: "light", barTheme: "light" })).toBe(true);
    expect(headerCapBandOn({ capTheme: "darker", barTheme: "darker" })).toBe(true);
    // a straight boundary between the gap and the bar centre (dark above, light below): no navy shoulders
    expect(headerCapBandOn({ capTheme: "dark", barTheme: "light" })).toBe(false);
    expect(headerCapBandOn({ capTheme: "darker", barTheme: "light" })).toBe(false);
    expect(headerCapBandOn({ capTheme: "dark", barTheme: "darker" })).toBe(false);
    expect(headerCapBandOn({ capTheme: "light", barTheme: "ice" })).toBe(false);
    expect(headerCapBandOn({ capTheme: null, barTheme: null })).toBe(false);
    expect(headerCapBandOn({ capTheme: "light", barTheme: null })).toBe(false);
  });
});

describe("404 h1 phrases (MD3-02: the same lines in every face)", () => {
  it("spell the h1 copy exactly, so the phrase-set title is what renders", () => {
    const phrases = titlePhrases(NOT_FOUND.title);
    expect(phrases).not.toBeNull();
    expect(phrases!.join(" ").replace(/\u00a0/g, " ")).toBe(NOT_FOUND.title);
    expect(phrases).toHaveLength(4);
  });
  it("keep the dash with „Ups“ and the demonstrative with its noun", () => {
    const phrases = titlePhrases(NOT_FOUND.title)!;
    expect(phrases[0]).toBe("Ups\u00a0—");
    expect(phrases[1]).toBe("ova\u00a0stranica");
  });
  it("fall back to the plain sentence when the copy changes", () => {
    expect(titlePhrases("Ups — ova stranica ne postoji.")).toBeNull();
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

  it("the phone's counter-rotation is clamped above the pointer's lean", () => {
    expect(POINTER_TILT).toBeLessThan(MAX_TILT);
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

/**
 * The 404 gymnast is the pose family's scale (docs/plan-figure-system.md §5.11): one figure, her
 * support foot on the beam's padded top, swaying about that foot's ankle.
 */
describe("404 scene: one scale pose standing on the beam", () => {
  const count = (html: string, re: RegExp) => html.match(re)?.length ?? 0;

  it("is the scale pose at the logo figure's body size", () => {
    expect(POSE).toBe(POSES.scale);
    expect(FIGURE.width).toBe(POSES.scale.viewBox.width);
    expect(FIGURE.height).toBe(POSES.scale.viewBox.height);
    expect(FOOT_CONTACT).toEqual(POSES.scale.contacts.foot);
  });

  it("stands with the support foot exactly on the beam's padded top, between the A-frames", () => {
    expect(FIGURE.x + FOOT_CONTACT[0]).toBeCloseTo(STAND.x, 9);
    expect(FIGURE.y + FOOT_CONTACT[1]).toBeCloseTo(BEAM.y, 9);
    expect(POSES.scale.floor).toBe(FOOT_CONTACT[1]); // the contact is her lowest ink: nothing sinks into the beam
    expect(BEAM_TOP).toBeGreaterThan(0);
    expect(STAND.x).toBeGreaterThan(LEGS[0]);
    expect(STAND.x).toBeLessThan(LEGS[1]);
    // her box stays in the view (and in the phones' centre crop, x 110…610) at rest
    expect(FIGURE.y).toBeGreaterThanOrEqual(VIEW.y);
    expect(FIGURE.x).toBeGreaterThanOrEqual(110);
    expect(FIGURE.x + FIGURE.width).toBeLessThanOrEqual(610);
  });

  it("sways about the ankle of the support foot, the foot staying on the beam", () => {
    // the ankle is right above the heel contact, inside the support leg's column
    expect(Math.abs(ANKLE.x - FOOT_CONTACT[0])).toBeLessThanOrEqual(4);
    expect(FOOT_CONTACT[1] - ANKLE.y).toBeGreaterThan(0);
    expect(FOOT_CONTACT[1] - ANKLE.y).toBeLessThanOrEqual(12);
    expect(ANKLE.x).toBeGreaterThan(LEG_COLUMN.left);
    expect(ANKLE.x).toBeLessThan(LEG_COLUMN.right);
    // the swaying part and the foot overlap across the ankle (no gap at any lean)
    expect(SUPPORT_CUT).toBeLessThan(ANKLE.y);
    expect(SWAY_CUT).toBeGreaterThan(ANKLE.y);
    expect(SWAY_CUT - SUPPORT_CUT).toBeGreaterThanOrEqual(4);
    expect(swayAt(-12.3456)).toBe(`rotate(-12.35 ${ANKLE.x} ${ANKLE.y})`);
  });

  it("renders one pose svg, upright (the no-JS and reduced-motion state), with no ghost clones", () => {
    const html = renderToStaticMarkup(createElement(BeamScene));
    expect(count(html, /data-figure="pose:scale"/g)).toBe(1);
    expect(html).toMatch(/<svg class="nf-scene__figure" data-figure="pose:scale"/);
    expect(html).not.toContain("#leap");
    expect(count(html, /data-nf-figure=""/g)).toBe(1);
    expect(html).toContain(`transform="${swayAt(0)}" data-nf-figure=""`);
    expect(html).not.toContain("data-nf-ghost");
    expect(html).toContain(`d="${POSES.scale.d}"`);
  });
});

describe("menu fallback", () => {
  it("Meni links to the footer page index until hydration", () => {
    expect(MENU_INDEX_ID).toBe("meni");
  });
});

/**
 * The figure grammar in the page chrome (docs/plan-figure-system.md R1, R3, R5): the logo
 * girl only as the brand, never as a UI indicator; a title mark is the landed leap with its
 * three ghost frames. qa/figures.mjs counts the rendered result; these pin the markup.
 */
describe("figures in the page chrome (plan §5.1, §5.11, §5.12)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const count = (html: string, re: RegExp) => html.match(re)?.length ?? 0;

  it("the menu sheet marks the current row with a bar, not a figure (R5)", async () => {
    const { MenuSheetBody } = await import("@/components/sections/header/MenuSheetBody");
    const html = renderToStaticMarkup(createElement(MenuSheetBody));
    expect(count(html, /data-nav-link/g)).toBe(NAV.length);
    expect(html).not.toContain("#leap");
    expect(html).not.toContain("<svg");
    const css = readFileSync("styles/sections/header.css", "utf8");
    expect(css).toMatch(/\.menu-sheet__link\[aria-current\]::before\s*\{[^}]*background:\s*var\(--color-lav-200\)/);
  });

  it("the footer mark is the logo alone: one silhouette, labelled, counted as the brand logo (R1)", async () => {
    const { FooterMark } = await import("@/components/sections/header/LeapTrail");
    const html = renderToStaticMarkup(createElement(FooterMark, { className: "site-footer__mark", title: CLUB.brandName }));
    expect(html).toContain('data-figure="brand:logo"');
    expect(html).toContain('viewBox="0 0 490 213"');
    expect(html).toContain(`role="img" aria-label="${CLUB.brandName}"`);
    expect(count(html, /href="#leap"/g)).toBe(1);
    expect(count(html, /href="#wordmark"/g)).toBe(1);
  });

  it("a photo placeholder carries the aperture glyph and its frame code, not the gymnast (R5)", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_MINOR_PHOTOS", "false");
    const { Picture, isPhotoPlaceholder } = await import("@/components/ui/Picture");
    const { PHOTOS } = await import("@/content/photos");
    const id = (Object.keys(PHOTOS) as PhotoId[]).find(isPhotoPlaceholder);
    expect(id).toBeDefined();
    const html = renderToStaticMarkup(createElement(Picture, { id: id!, sizes: "100vw", frame: true }));
    expect(html).toContain("data-placeholder");
    expect(html).not.toContain("#leap");
    expect(html).toMatch(/<svg class="ui-icon photo-placeholder__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/);
    expect(html).toContain(PHOTO_PLACEHOLDER);
    expect(html).toContain(PHOTOS[id!].frame);
  });

  it("a title mark is the leap landing with its three ghost frames, which stay at rest (owner, D-43)", async () => {
    const { ChronoMark } = await import("@/components/ui/ChronoMark");
    const html = renderToStaticMarkup(createElement(ChronoMark, {}));
    expect(html).toContain('data-figure="brand:mark"');
    expect(count(html, /class="chrono-ghost"/g)).toBe(3);
    expect(count(html, /class="chrono-solid"/g)).toBe(1);
    // One geometry in three places: the viewBox (ChronoMark), the flier's take-off offset
    // (ui.css) and the hero's hand-off onto the first ghost (scrub.ts MARK).
    const boxW = Number(/viewBox="0 0 (\d+) 208"/.exec(html)?.[1]);
    expect(boxW).toBeGreaterThan(230);
    expect(html).toMatch(/<use href="#leap" class="chrono-ghost" x="0" y="52"/);
    expect(readFileSync("styles/ui.css", "utf8")).toContain(`transform: translateX(-${boxW - 230}px);`);
    expect(/const MARK = \{ width: (\d+), first: \[0, 52\] as Pt/.exec(readFileSync("components/sections/hero/scrub.ts", "utf8"))?.[1]).toBe(String(boxW));
    // At rest (no JS, reduced motion, land={false}, after the landing) every ghost shows at its
    // token opacity; only the motion pre-state before the landing hides them.
    const css = readFileSync("styles/ui.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g), (m) => ({ sel: m[1]!.trim(), body: m[2]! }));
    for (const n of [1, 2, 3]) {
      expect(rules.find((r) => r.sel === `.chrono-ghost:nth-of-type(${n})`)?.body).toMatch(new RegExp(`opacity:\\s*var\\(--ghost-${n}-o\\)`));
    }
    const hidden = rules.filter((r) => r.sel.includes(".chrono-ghost") && /(^|;)\s*opacity\s*:\s*0;/.test(r.body));
    expect(hidden.length).toBeGreaterThan(0);
    for (const r of hidden) expect(r.sel).toContain("html.js-motion .chrono-mark:not([data-landed])");
  });
});

/**
 * MD4-02: the header's inline script keeps the tone of the painted position from the
 * first paint on (every scroll event and ResizeObserver delivery while the page is
 * parsed); the footer's script moves a deep link / reload / history arrival to its
 * landing position once the page is parsed. Both run here against a minimal DOM
 * stand-in: blocks are given in document coordinates, rects follow the live scrollY.
 */
describe("pre-paint header tone (header-tone.ts)", () => {
  interface Block {
    theme: string;
    top: number;
    bottom: number;
    /** [data-header-band] nested in a section (D-37). */
    band?: boolean;
    /** Some other themed element nested in a section (a card): never picked. */
    nested?: boolean;
  }
  interface Setup {
    navType?: string;
    hash?: string;
    scrollY?: number;
    innerWidth?: number;
    /** sessionStorage contents */
    stored?: Record<string, string>;
    /** navigation.currentEntry.key (undefined: no Navigation API) */
    entryKey?: string;
    /** The browser scrolls here in the first forced layout after this point (Chromium's fragment anchor). */
    layoutScrollsTo?: number;
    header?: boolean;
  }
  // A 390-wide page: bar 10 + 60 (band line 40, cap line 5), scroll-padding-top 88.
  const BLOCKS: Block[] = [
    { theme: "dark", top: 0, bottom: 900 }, // S1
    { theme: "light", top: 900, bottom: 1700 },
    { theme: "dark", top: 1700, bottom: 2800 },
    { theme: "light", top: 2800, bottom: 4000 }, // S5 with …
    { theme: "dark", top: 3000, bottom: 3100, nested: true }, // … a dark card
    { theme: "dark", top: 3200, bottom: 3600, band: true }, // … and the „Hronologija“ band
    { theme: "darker", top: 4000, bottom: 5000 }, // S7
    { theme: "ice", top: 5000, bottom: 5400 },
    { theme: "darker", top: 5400, bottom: 5600 }, // footer
  ];
  const MAX_SCROLL = 5600 - 844;

  /** Loads the page: the header's script runs, then (land !== false) the footer's. */
  const load = (o: Setup, land = true) => {
    const page = {
      scrollY: o.scrollY ?? 0,
      scrolls: [] as number[],
      attrs: { "data-theme": "dark" } as Record<string, string>,
      header: {} as Record<string, () => void>,
      win: {} as Record<string, () => void>,
      ro: null as null | (() => void),
      roOn: false,
    };
    const rect = (top: number, bottom: number) => ({ top: top - page.scrollY, bottom: bottom - page.scrollY });
    let pendingScroll = o.layoutScrollsTo;
    const bar = {
      get offsetTop() {
        // a forced layout: the place where Chromium may run its fragment anchor
        if (pendingScroll !== undefined) {
          page.scrollY = pendingScroll;
          pendingScroll = undefined;
        }
        return 10;
      },
      offsetHeight: 60,
    };
    const header = {
      querySelector: (sel: string) => (sel === "[data-header-bar]" ? bar : null),
      getAttribute: (k: string) => page.attrs[k] ?? null,
      setAttribute: (k: string, v: string) => {
        page.attrs[k] = v;
      },
      addEventListener: (type: string, fn: () => void) => {
        page.header[type] = fn;
      },
      dispatchEvent: (e: { type: string }) => {
        page.header[e.type]?.();
        return true;
      },
    };
    const els = BLOCKS.map((b) => ({
      band: !!b.band,
      getAttribute: (k: string) => (k === "data-theme" ? b.theme : null),
      hasAttribute: (k: string) => k === "data-header-band" && !!b.band,
      parentElement: { closest: () => (b.band || b.nested ? {} : null) },
      getBoundingClientRect: () => rect(b.top, b.bottom),
    }));
    const root = {};
    const scope = {
      document: {
        documentElement: root,
        querySelector: (sel: string) => (sel === "[data-site-header]" && o.header !== false ? header : null),
        querySelectorAll: (sel: string) => (sel.startsWith("main [data-header-band]") ? els.filter((e) => e.band) : els),
      },
      performance: { getEntriesByType: () => [{ type: o.navType ?? "navigate" }] },
      location: { hash: o.hash ?? "" },
      get scrollY() {
        return page.scrollY;
      },
      innerWidth: o.innerWidth ?? 390,
      sessionStorage: { getItem: (k: string) => o.stored?.[k] ?? null },
      ...(o.entryKey !== undefined ? { navigation: { currentEntry: { key: o.entryKey } } } : {}),
      scrollTo: ({ top }: { top: number; behavior: string }) => {
        page.scrolls.push(top);
        page.scrollY = Math.max(0, Math.min(MAX_SCROLL, top));
      },
      addEventListener: (type: string, fn: () => void) => {
        page.win[type] = fn;
      },
      removeEventListener: (type: string, fn: () => void) => {
        if (page.win[type] === fn) delete page.win[type];
      },
      ResizeObserver: class {
        constructor(cb: () => void) {
          page.ro = cb;
        }
        observe() {
          page.roOn = true;
        }
        disconnect() {
          page.roOn = false;
        }
      },
      Event: class {
        constructor(public type: string) {}
      },
    };
    // Sloppy-mode `with` gives the scripts live globals (scrollY follows scrollTo).
    const exec = (src: string) => new Function("scope", `with (scope) { ${src} }`)(scope);
    exec(HEADER_TONE_SCRIPT);
    if (land) exec(HEADER_LAND_SCRIPT);
    const tone = () => ({ theme: page.attrs["data-theme"], cap: page.attrs["data-cap-tone"] ?? null });
    return { page, tone, exec };
  };
  it("leaves a plain first visit alone: no listeners, no scroll, the server-rendered tone", () => {
    const { page, tone } = load({ scrollY: 0 });
    expect(tone()).toEqual({ theme: "dark", cap: null });
    expect(page.win.scroll).toBeUndefined();
    expect(page.roOn).toBe(false);
    expect(page.scrolls).toEqual([]);
  });

  it("measures nothing while it is parsed: the tone comes from the first ResizeObserver delivery", () => {
    const { page, tone } = load({ hash: "#uspesi" }, false);
    expect(page.roOn).toBe(true);
    expect(tone()).toEqual({ theme: "dark", cap: null });
    page.ro?.(); // first frame: the hero is under the bar
    expect(tone()).toEqual({ theme: "dark", cap: "dark" });
  });

  it("deep link: the measure at the end of parsing gets the landing tone when the fragment scroll runs in that layout", () => {
    // /#uspesi lands at 4000 − 88 = 3912: the light S5 is under the bar (band line 3952), not the darker S7.
    const { page, tone } = load({ hash: "#uspesi", layoutScrollsTo: 3912 });
    expect(page.scrolls).toEqual([]);
    expect(page.scrollY).toBe(3912);
    expect(tone()).toEqual({ theme: "light", cap: "light" });
  });

  it("deep link: never scrolled from script; the tone follows the browser's fragment scroll", () => {
    const { page, tone } = load({ hash: "#uspesi" });
    expect(page.scrolls).toEqual([]);
    page.ro?.();
    expect(tone()).toEqual({ theme: "dark", cap: "dark" });
    // /#uspesi lands at 4000 − 88 = 3912: the light S5 is under the bar (band line 3952), not the darker S7.
    page.scrollY = 3912;
    page.win.scroll?.();
    expect(tone()).toEqual({ theme: "light", cap: "light" });
  });

  it("a [data-header-band] under the line wins over its section; other nested themed elements never count", () => {
    const { page, tone } = load({ hash: "#hronologija" });
    page.scrollY = 3300 - 88;
    page.win.scroll?.();
    expect(tone()).toEqual({ theme: "dark", cap: "dark" });
    page.scrollY = 3120 - 88; // a dark card in S5 under the bar
    page.win.scroll?.();
    expect(tone()).toEqual({ theme: "light", cap: "light" });
  });

  it("maps themes like HeaderBehavior: darker keeps darker, ice → light bar; the cap takes the raw theme", () => {
    const a = load({ navType: "reload", scrollY: 4200 });
    a.page.ro?.();
    expect(a.tone()).toEqual({ theme: "darker", cap: "darker" });
    const b = load({ navType: "back_forward", scrollY: 5100 });
    b.page.win.scroll?.();
    expect(b.tone()).toEqual({ theme: "light", cap: "ice" });
  });

  it("while parsing, the tone follows a restore (Chromium restores as soon as the page is tall enough)", () => {
    const { page, tone, exec } = load({ navType: "reload", stored: { [HEADER_Y_KEY]: "4200 390" } }, false);
    page.ro?.(); // the hero under the bar
    expect(tone()).toEqual({ theme: "dark", cap: "dark" });
    page.scrollY = 1000; // restored in the layout where the document grew …
    page.ro?.(); // … and ResizeObserver is delivered after that layout, before its paint
    expect(tone()).toEqual({ theme: "light", cap: "light" });
    exec(HEADER_LAND_SCRIPT); // already restored: the footer's script moves nothing
    expect(page.scrolls).toEqual([]);
    expect(tone()).toEqual({ theme: "light", cap: "light" });
  });

  it("reload not yet restored at the end of parsing (WebKit, Firefox): this entry's stored position, same width", () => {
    const k = headerYKey("entry-a");
    expect(k).toBe(`${HEADER_Y_KEY}:entry-a`);
    expect(headerYKey(undefined)).toBe(HEADER_Y_KEY);
    const a = load({ navType: "reload", entryKey: "entry-a", stored: { [k]: "4200 390" } });
    expect(a.page.scrolls).toEqual([4200]);
    expect(a.tone()).toEqual({ theme: "darker", cap: "darker" });
    // without the Navigation API: the one slot
    const b = load({ navType: "back_forward", stored: { [HEADER_Y_KEY]: "1000 390" } });
    expect(b.page.scrolls).toEqual([1000]);
    expect(b.tone()).toEqual({ theme: "light", cap: "light" });
    // stored at the top: nothing to move
    expect(load({ navType: "reload", stored: { [HEADER_Y_KEY]: "0 390" } }).page.scrolls).toEqual([]);
  });

  it("never uses another entry's or another width's position, nor any with a #hash (the fragment wins)", () => {
    // back to an earlier entry of the page: only a later entry's position is stored
    const a = load({ navType: "back_forward", entryKey: "entry-a", stored: { [headerYKey("entry-b")]: "4200 390" } });
    expect(a.page.scrolls).toEqual([]);
    expect(a.tone()).toEqual({ theme: "dark", cap: "dark" }); // measured where it is: the hero
    // rotation: stored at 844 wide
    const b = load({ navType: "reload", entryKey: "entry-a", stored: { [headerYKey("entry-a")]: "4200 844" } });
    expect(b.page.scrolls).toEqual([]);
    // WebKit and Firefox go to the fragment on a reload / history arrival of /#uspesi
    const c = load({ navType: "reload", hash: "#uspesi", entryKey: "e", stored: { [headerYKey("e")]: "4400 390" } });
    expect(c.page.scrolls).toEqual([]);
    const d = load({ navType: "back_forward", hash: "#uspesi", stored: { [HEADER_Y_KEY]: "4400 390" } });
    expect(d.page.scrolls).toEqual([]);
  });

  it("stops when HeaderBehavior owns the tone", () => {
    const { page } = load({ hash: "#uspesi" });
    expect(page.win.scroll).toBeTypeOf("function");
    page.header[HEADER_TONE_OWNED]?.();
    expect(page.win.scroll).toBeUndefined();
    expect(page.roOn).toBe(false);
    expect(HEADER_LAND_SCRIPT).toContain(HEADER_TONE_LAND);
  });

  it("does nothing without a header (404)", () => {
    const a = load({ hash: "#uspesi", header: false });
    expect(a.tone()).toEqual({ theme: "dark", cap: null });
    expect(a.page.scrolls).toEqual([]);
    expect(a.page.win.scroll).toBeUndefined();
  });
});
