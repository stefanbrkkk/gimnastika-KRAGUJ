#!/usr/bin/env node
// Fresh-page forward/reverse filmstrips for release-candidate motion review.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { contextOptions, launch, sizeById, waitForIntro } from "./lib/browser.mjs";
import { BASE_URL, OUT, ROOT, requireOut } from "./lib/env.mjs";
import { ensureServed } from "./lib/server.mjs";

const dir = join(ROOT, "qa/trace/rc-scenes");
mkdirSync(dir, { recursive: true });
requireOut();
const server = await ensureServed(BASE_URL, OUT);
const browser = await launch();
const scenes = [["results", "#uspesi"], ["timeline", "[data-timeline]"], ["camp", "#kamp"], ["enrollment", "#upis"]];

async function filmstrip(frames, path, width) {
  const meta = await sharp(frames[0].buffer).metadata();
  const height = Math.round(meta.height * width / meta.width);
  const cols = Math.min(4, frames.length);
  const tiles = [];
  for (const [index, frame] of frames.entries()) {
    const label = Buffer.from('<svg width="' + width + '" height="28"><rect width="' + width +
      '" height="28" fill="#071c35" fill-opacity=".92"/><text x="8" y="19" fill="#fff" font-family="Arial" font-size="15">' +
      frame.label + "</text></svg>");
    const tile = await sharp(frame.buffer).resize(width, height).composite([{ input: label, left: 0, top: 0 }]).png().toBuffer();
    tiles.push({ input: tile, left: (index % cols) * (width + 8), top: Math.floor(index / cols) * (height + 8) });
  }
  await sharp({ create: { width: cols * (width + 8) - 8,
    height: Math.ceil(frames.length / cols) * (height + 8) - 8,
    channels: 3, background: "#ffffff" } }).composite(tiles).png().toFile(path);
}

async function fresh(size, reduced = false) {
  const context = await browser.newContext(contextOptions(sizeById(size), {
    reducedMotion: reduced ? "reduce" : "no-preference",
  }));
  const page = await context.newPage();
  await page.goto(server.url + "/", { waitUntil: "load" });
  await waitForIntro(page);
  return { context, page };
}
const snap = async (page, label) => ({ buffer: await page.screenshot({ type: "png", scale: "css" }), label });

try {
  for (const size of ["1440x900", "390x844"]) {
    const tileWidth = size === "1440x900" ? 360 : 260;
    const step = Math.round(sizeById(size).height * 0.2);
    for (const [name, selector] of scenes) {
      const { context, page } = await fresh(size);
      const y = await page.evaluate((s) => {
        const el = document.querySelector(s);
        return el ? el.getBoundingClientRect().top + scrollY : null;
      }, selector);
      if (y === null) throw new Error("Missing scene " + selector);
      await page.evaluate((top) => scrollTo({ top, behavior: "instant" }),
        Math.max(0, y - sizeById(size).height * 1.2));
      await page.waitForTimeout(550);
      const forward = [await snap(page, "approach")];
      for (let n = 1; n <= 7; n += 1) {
        await page.mouse.wheel(0, step);
        await page.waitForTimeout(160);
        forward.push(await snap(page, "forward " + n));
      }
      await filmstrip(forward, join(dir, name + "-forward-" + size + ".png"), tileWidth);
      const reverse = [await snap(page, "end")];
      for (let n = 1; n <= 7; n += 1) {
        await page.mouse.wheel(0, -step);
        await page.waitForTimeout(160);
        reverse.push(await snap(page, "reverse " + n));
      }
      await filmstrip(reverse, join(dir, name + "-reverse-" + size + ".png"), tileWidth);
      await context.close();
    }

    const quiz = await fresh(size);
    await quiz.page.locator("#kviz").scrollIntoViewIfNeeded();
    const q = [await snap(quiz.page, "start")];
    const age8 = quiz.page.locator("#kviz .quiz-ages button").filter({ hasText: /^8$/ });
    await age8.click();
    q.push(await snap(quiz.page, "age 8"));
    await quiz.page.locator("#kviz .quiz-ctrl").first().click();
    q.push(await snap(quiz.page, "back"));
    await age8.click();
    await quiz.page.locator("#kviz .quiz-exps button").first().click();
    q.push(await snap(quiz.page, "result"));
    await quiz.page.locator("#kviz .quiz-ctrl").last().click();
    q.push(await snap(quiz.page, "reset"));
    await filmstrip(q, join(dir, "quiz-actions-" + size + ".png"), tileWidth);
    await quiz.context.close();

    const programs = await fresh(size);
    const disclosure = programs.page.locator("#programi .pg-times__details");
    await disclosure.scrollIntoViewIfNeeded();
    const closed = await snap(programs.page, "closed");
    await disclosure.locator("summary").focus();
    await programs.page.keyboard.press("Enter");
    if (await disclosure.getAttribute("open") === null) throw new Error("Disclosure did not open at " + size);
    if (await programs.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
      throw new Error("Open schedule overflows at " + size);
    await filmstrip([closed, await snap(programs.page, "open")],
      join(dir, "schedule-disclosure-" + size + ".png"), tileWidth);
    await programs.context.close();

    const reduced = await fresh(size, true);
    for (const [name, selector] of scenes) {
      await reduced.page.locator(selector).scrollIntoViewIfNeeded();
      await reduced.page.waitForTimeout(200);
      await reduced.page.screenshot({ path: join(dir, name + "-reduced-" + size + ".png"), scale: "css" });
    }
    await reduced.context.close();
    console.log("Captured " + size + ": forward/reverse motion, quiz, disclosure, reduced motion");
  }
} finally {
  await browser.close();
  await server.stop();
}
console.log("Release scene evidence: " + dir);
