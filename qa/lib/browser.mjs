// Playwright helpers shared by shots/trace/behavior/axe.
import { chromium } from "playwright";

/** The four §7 layout sizes. Below 1024 px we emulate a touch phone/tablet. */
export const SIZES = [
  { id: "360x800", width: 360, height: 800, mobile: true },
  { id: "390x844", width: 390, height: 844, mobile: true },
  { id: "768x1024", width: 768, height: 1024, mobile: true },
  { id: "1440x900", width: 1440, height: 900, mobile: false },
];

export const sizeById = (id) => SIZES.find((s) => s.id === id);

export const launch = (options = {}) => chromium.launch({ headless: true, ...options });

export function contextOptions(size, { dpr, ...extra } = {}) {
  return {
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: dpr ?? (size.mobile ? 2 : 1),
    isMobile: size.mobile,
    hasTouch: size.mobile,
    locale: "sr-RS",
    timezoneId: "Europe/Belgrade",
    ...extra,
  };
}

/** Collects console errors/warnings and uncaught page errors into `bucket`. */
export function collectConsole(page, bucket = []) {
  page.on("console", (msg) => {
    const type = msg.type();
    if (type !== "error" && type !== "warning") return;
    const loc = msg.location();
    bucket.push({ type, text: msg.text(), where: loc?.url ? `${loc.url}:${loc.lineNumber}` : undefined, phase: bucket.phase });
  });
  page.on("pageerror", (err) => bucket.push({ type: "pageerror", text: String(err?.stack || err), phase: bucket.phase }));
  return bucket;
}

/**
 * Resolves once the hero intro is over: html[data-intro] is "done"/"skipped",
 * or motion never started (no html.js-motion: reduced motion, Save-Data, no JS).
 */
export async function waitForIntro(page, timeout = 6000) {
  try {
    await page.waitForFunction(
      () => {
        const d = document.documentElement;
        return !d.classList.contains("js-motion") || d.dataset.intro === "done" || d.dataset.intro === "skipped";
      },
      null,
      { timeout },
    );
    return await page.evaluate(() => document.documentElement.dataset.intro ?? "none");
  } catch {
    return "timeout";
  }
}

/**
 * Scrolls to the bottom in viewport steps (the page may grow while lazy content
 * mounts), pausing so IntersectionObservers, lazy images and dynamic imports fire.
 * `wheel: true` scrolls with real wheel events instead of scrollBy.
 */
export async function scrollThrough(page, { ratio = 0.75, delay = 220, wheel = false, maxSteps = 400 } = {}) {
  let steps = 0;
  let atBottom = 0;
  while (steps < maxSteps) {
    const { y, max, h } = await page.evaluate(() => ({
      y: window.scrollY,
      max: document.scrollingElement.scrollHeight - window.innerHeight,
      h: window.innerHeight,
    }));
    if (y >= max - 2) {
      atBottom += 1;
      if (atBottom >= 3) break;
      await page.waitForTimeout(delay * 2);
      continue;
    }
    atBottom = 0;
    const dy = Math.round(h * ratio);
    if (wheel) await page.mouse.wheel(0, dy);
    else await page.evaluate((d) => window.scrollBy({ top: d, left: 0, behavior: "instant" }), dy);
    steps += 1;
    await page.waitForTimeout(delay);
  }
  return { steps, height: await page.evaluate(() => document.scrollingElement.scrollHeight) };
}

/**
 * Full-page screenshot at CSS scale. Chromium renders a single capture only up to
 * 16 384 px tall (the rest comes out blank), so tall pages are captured in
 * clipped slices and stitched with sharp.
 */
export async function fullPageScreenshot(page, path, { slice = 8000 } = {}) {
  const { width, height } = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    height: document.scrollingElement.scrollHeight,
  }));
  if (height <= slice) return page.screenshot({ path, fullPage: true, scale: "css" });
  const { default: sharp } = await import("sharp");
  const parts = [];
  for (let top = 0; top < height; top += slice) {
    const h = Math.min(slice, height - top);
    const input = await page.screenshot({ fullPage: true, scale: "css", clip: { x: 0, y: top, width, height: h } });
    parts.push({ input, left: 0, top });
  }
  await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
    .composite(parts)
    .png({ compressionLevel: 9 })
    .toFile(path);
  return path;
}

export async function scrollToTop(page, delay = 400) {
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await page.waitForTimeout(delay);
}

/**
 * Waits for the network to go quiet, fonts, finite CSS/WAAPI animations and
 * visible images, plus `extra` ms for GSAP reveals (≤ 0.9 s + ≤ 0.36 s stagger).
 */
export async function settle(page, { timeout = 5000, extra = 1300 } = {}) {
  await page.waitForLoadState("networkidle", { timeout }).catch(() => {});
  await page
    .evaluate(async (limit) => {
      await document.fonts.ready;
      const end = performance.now() + limit;
      const busy = () =>
        document.getAnimations().some((a) => a.playState === "running" && Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity));
      const imagesPending = () =>
        [...document.images].some((img) => {
          if (img.complete) return false;
          const r = img.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
        });
      while (performance.now() < end && (busy() || imagesPending())) await new Promise((r) => setTimeout(r, 100));
    }, timeout)
    .catch(() => {});
  await page.waitForTimeout(extra);
}
