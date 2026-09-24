#!/usr/bin/env node
// §7 motion checks (hero filmstrip, intro timing, pin rules) + §7 console check +
// M4 long-task check. Artefacts in QA_TRACE_DIR (default qa/trace).
//
// 1. Filmstrip (1440×900 fine pointer, 390×844 touch): CDP Page.startScreencast
//    from navigation start until the intro ends. Two independent flash checks:
//    - pixels: the H1 box of every frame from the first contentful frame on must
//      keep ≥ 50 % of the final frame's luminance contrast (text present);
//    - DOM: an init script samples the H1 on every animation frame from document
//      start: effective opacity (whole ancestor chain) = 1, visibility, display,
//      size, clip-path — never hidden, including the very first frame it exists.
//    Intro timing from performance marks kraguj:intro-start / kraguj:intro-end
//    (≤ 1900 ms); html[data-intro] must end "done" (not "skipped" = failsafe).
// 2. Pin: a ScrollTrigger pin (.pin-spacer around #top) exists at 1440×900 with a
//    fine pointer and does not exist on touch devices (390×844 and 1024×768 touch).
// 3. Long tasks: 4× CPU throttle (CDP Emulation.setCPUThrottlingRate), full wheel
//    scroll to the bottom after the intro; PerformanceObserver("longtask") tasks
//    > 50 ms inside the scroll window fail when a repeat run reproduces them (a
//    one-off is a warning; QA_LONGTASK_RETRY=0 fails on the first run). Each task is
//    attributed to the scroll position/section and the JS chunks that just loaded.
//    Load-phase tasks are reported only.
// 4. Console: zero errors/warnings (incl. hydration warnings) on load and during
//    a full scroll, in every context above.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { collectConsole, contextOptions, launch, scrollThrough, sizeById } from "./lib/browser.mjs";
import { BASE_URL, OUT, TRACE_DIR, requireOut } from "./lib/env.mjs";
import { runScript } from "./lib/report.mjs";
import { ensureServed } from "./lib/server.mjs";

const INTRO_BUDGET_MS = 1900;
const LONG_TASK_MS = 50;

/** Init script: samples the H1 each animation frame from document start (5 s). */
const H1_WATCH = `(() => {
  const log = (window.__qaH1 = { firstSeen: null, firstVisible: null, samples: 0, hidden: [] });
  const state = (el) => {
    let opacity = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none") return { visible: false, why: "display:none on " + n.tagName };
      if (n === el && cs.visibility === "hidden") return { visible: false, why: "visibility:hidden" };
      opacity *= parseFloat(cs.opacity || "1");
      const inset = cs.clipPath && cs.clipPath.match(/inset\\(([^)]*)\\)/);
      if (inset && inset[1].split(/\\s+/).some((v) => v.endsWith("%") && parseFloat(v) >= 50)) return { visible: false, why: "clip-path " + cs.clipPath + " on " + n.tagName };
    }
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return { visible: false, why: "zero size" };
    if (opacity < 0.99) return { visible: false, why: "opacity " + opacity.toFixed(2) };
    return { visible: true };
  };
  const tick = () => {
    const h1 = document.querySelector("h1");
    if (h1) {
      const s = state(h1);
      log.samples += 1;
      if (log.firstSeen === null) { log.firstSeen = Math.round(performance.now()); log.firstVisible = s.visible; }
      if (!s.visible && log.hidden.length < 50) log.hidden.push({ t: Math.round(performance.now()), why: s.why });
    }
    if (performance.now() < 5000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.addEventListener("readystatechange", tick);
})();`;

/** Init script: long tasks with timestamps. */
const LONGTASK_WATCH = `(() => {
  window.__qaLongTasks = [];
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__qaLongTasks.push({ start: Math.round(e.startTime), duration: Math.round(e.duration), name: e.name, container: (e.attribution && e.attribution[0] && e.attribution[0].containerType) || "" });
    }).observe({ type: "longtask", buffered: true });
  } catch (e) { window.__qaLongTasks.unsupported = String(e); }
})();`;

const marks = (page) =>
  page.evaluate(() => {
    const get = (n) => performance.getEntriesByName(n)[0]?.startTime ?? null;
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null;
    return { start: get("kraguj:intro-start"), end: get("kraguj:intro-end"), fcp, intro: document.documentElement.dataset.intro ?? null, timeOrigin: performance.timeOrigin };
  });

async function waitIntroEnd(page, timeout) {
  await page
    .waitForFunction(() => performance.getEntriesByName("kraguj:intro-end").length > 0 || document.documentElement.dataset.intro === "skipped", null, { timeout })
    .catch(() => {});
}

/** Luminance standard deviation of raw 1-channel pixels. */
function stdev(data) {
  let m = 0;
  let m2 = 0;
  for (const v of data) {
    m += v;
    m2 += v * v;
  }
  m /= data.length || 1;
  return Math.sqrt(Math.max(0, m2 / (data.length || 1) - m * m));
}

async function analyseFrames(frames, box, timeOrigin) {
  const out = [];
  for (const f of frames) {
    const buf = Buffer.from(f.data, "base64");
    // NB: sharp's stats() ignores pipeline operations, so crop to raw pixels first.
    const { data: grey, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    const scale = width / f.deviceWidth;
    const left = Math.max(0, Math.floor(box.x * scale));
    const top = Math.max(0, Math.floor((box.y - f.scrollY) * scale));
    const w = Math.min(width - left, Math.ceil(box.width * scale));
    const h = Math.min(height - top, Math.ceil(box.height * scale));
    let contrast = 0;
    if (w > 4 && h > 4) {
      const crop = Buffer.alloc(w * h);
      for (let y = 0; y < h; y++) grey.copy(crop, y * w, (top + y) * width + left, (top + y) * width + left + w);
      contrast = stdev(crop);
    }
    out.push({ t: Math.round(f.timestamp * 1000 - timeOrigin), contrast: Math.round(contrast * 10) / 10, frameStdev: Math.round(stdev(grey) * 10) / 10, buf, width, height });
  }
  return out;
}

async function saveFilmstrip(frames, file, tileWidth) {
  if (frames.length === 0) return;
  const pick = frames.length <= 12 ? frames : Array.from({ length: 12 }, (_, i) => frames[Math.round((i * (frames.length - 1)) / 11)]);
  const tileH = Math.round((pick[0].height / pick[0].width) * tileWidth);
  const cols = Math.min(4, pick.length);
  const rows = Math.ceil(pick.length / cols);
  const tiles = [];
  for (const [i, f] of pick.entries()) {
    const label = Buffer.from(
      `<svg width="${tileWidth}" height="26"><rect width="${tileWidth}" height="26" fill="#000" fill-opacity=".7"/><text x="8" y="18" font-family="Helvetica,Arial" font-size="15" fill="#fff">${f.t} ms · H1 σ ${f.contrast}</text></svg>`,
    );
    const tile = await sharp(f.buf).resize(tileWidth, tileH).composite([{ input: label, left: 0, top: 0 }]).png().toBuffer();
    tiles.push({ input: tile, left: (i % cols) * (tileWidth + 8), top: Math.floor(i / cols) * (tileH + 8) });
  }
  await sharp({ create: { width: cols * (tileWidth + 8) - 8, height: rows * (tileH + 8) - 8, channels: 3, background: "#ff00ff" } })
    .composite(tiles)
    .png()
    .toFile(file);
}

async function filmstripPass(browser, url, size, report, consoleLog) {
  const context = await browser.newContext(contextOptions(size));
  await context.addInitScript(H1_WATCH);
  const page = await context.newPage();
  consoleLog.phase = `load ${size.id}`;
  collectConsole(page, consoleLog);
  const cdp = await context.newCDPSession(page);
  const frames = [];
  let recording = true;
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    if (recording) frames.push({ data, timestamp: metadata.timestamp ?? Date.now() / 1000, deviceWidth: metadata.deviceWidth, scrollY: metadata.scrollOffsetY ?? 0 });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, everyNthFrame: 1 });
  await page.goto(`${url}/`, { waitUntil: "commit" });
  await page.waitForLoadState("load");
  await waitIntroEnd(page, 7000);
  await page.waitForTimeout(700);
  recording = false;
  await cdp.send("Page.stopScreencast").catch(() => {});
  const m = await marks(page);
  const box = await page.evaluate(() => {
    const r = document.querySelector("h1")?.getBoundingClientRect();
    return r ? { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height } : null;
  });
  const watch = await page.evaluate(() => window.__qaH1);

  // Timing.
  const duration = m.start !== null && m.end !== null ? Math.round(m.end - m.start) : null;
  report.data[`intro.${size.id}`] = { ...m, duration };
  report.check(`intro.ran.${size.id}`, m.intro === "done" && m.start !== null, `html[data-intro]="${m.intro}", intro-start at ${m.start === null ? "—" : Math.round(m.start)} ms (FCP ${m.fcp === null ? "—" : Math.round(m.fcp)} ms)`);
  if (duration !== null) report.check(`intro.duration.${size.id}`, duration <= INTRO_BUDGET_MS, `intro ${duration} ms (budget ≤${INTRO_BUDGET_MS} ms)`);
  else report.fail(`intro.duration.${size.id}`, "performance marks kraguj:intro-start/-end not both present", m);

  // DOM watcher.
  report.check(
    `h1.dom.${size.id}`,
    watch && watch.firstSeen !== null && watch.firstVisible && watch.hidden.length === 0,
    watch ? `H1 sampled on ${watch.samples} frames from ${watch.firstSeen} ms: ${watch.firstVisible ? "visible" : "HIDDEN"} on the first, hidden on ${watch.hidden.length}${watch.hidden.length >= 50 ? "+" : ""}` : "H1 watcher did not run",
    watch?.hidden,
  );

  // Pixels.
  if (!box) report.fail(`h1.frames.${size.id}`, "no <h1> on the page");
  else {
    const analysed = await analyseFrames(frames, box, m.timeOrigin);
    const contentful = analysed.findIndex((f) => f.frameStdev > 6);
    const final = analysed.at(-1);
    const shown = contentful < 0 ? [] : analysed.slice(contentful);
    const weak = shown.filter((f) => f.contrast < final.contrast * 0.5);
    const file = join(TRACE_DIR, `filmstrip-${size.id}.png`);
    await saveFilmstrip(shown, file, size.mobile ? 200 : 360);
    report.artifact(file);
    report.data[`frames.${size.id}`] = analysed.map(({ t, contrast, frameStdev }) => ({ t, contrast, frameStdev }));
    report.check(
      `h1.frames.${size.id}`,
      contentful >= 0 && weak.length === 0,
      `${analysed.length} frames; first contentful at ${shown[0]?.t ?? "—"} ms; H1 text present in ${shown.length - weak.length}/${shown.length} (final H1-box σ ${final?.contrast})`,
      weak.map(({ t, contrast }) => ({ t, contrast })),
    );
  }

  // Full scroll for the console check.
  consoleLog.phase = `scroll ${size.id}`;
  await scrollThrough(page, { delay: 150 });
  await page.waitForTimeout(800);
  await context.close();
}

async function pinPass(browser, url, report) {
  const cases = [
    { id: "1440x900-fine", size: sizeById("1440x900"), expectPin: true },
    { id: "390x844-touch", size: sizeById("390x844"), expectPin: false },
    { id: "1024x768-touch", size: { id: "1024x768", width: 1024, height: 768, mobile: true }, expectPin: false },
  ];
  for (const c of cases) {
    const context = await browser.newContext(contextOptions(c.size));
    const page = await context.newPage();
    await page.goto(`${url}/`, { waitUntil: "load" });
    await waitIntroEnd(page, 7000);
    await page.waitForTimeout(1500);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(600);
    if (!c.expectPin) {
      await scrollThrough(page, { delay: 120 });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(400);
    }
    const s = await page.evaluate(() => ({
      fine: matchMedia("(pointer: fine)").matches,
      wide: matchMedia("(min-width: 1024px)").matches,
      heroPinned: !!document.getElementById("top")?.closest(".pin-spacer"),
      spacers: document.querySelectorAll(".pin-spacer").length,
    }));
    const mediaOk = c.expectPin ? s.fine && s.wide : !s.fine;
    if (!mediaOk) report.fail(`pin.${c.id}`, `emulation mismatch: (pointer: fine)=${s.fine}, (min-width:1024px)=${s.wide}`);
    else if (c.expectPin) report.check(`pin.${c.id}`, s.heroPinned, `ScrollTrigger pin around #top on (min-width:1024px) and (pointer:fine)`, s);
    else report.check(`pin.${c.id}`, !s.heroPinned && s.spacers === 0, `no pin on a touch device (${s.spacers} .pin-spacer)`, s);
    await context.close();
  }
}

/** One 4×-throttled load + full wheel scroll; returns the H1 watch and long tasks. */
async function measureLongTasks(browser, url, size, consoleLog, label) {
  const context = await browser.newContext(contextOptions(size));
  await context.addInitScript(LONGTASK_WATCH);
  await context.addInitScript(H1_WATCH);
  const page = await context.newPage();
  consoleLog.phase = `load 4x ${size.id}${label}`;
  collectConsole(page, consoleLog);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(`${url}/`, { waitUntil: "load", timeout: 60000 });
  await waitIntroEnd(page, 12000);
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const watch = await page.evaluate(() => window.__qaH1);

  consoleLog.phase = `scroll 4x ${size.id}${label}`;
  const start = await page.evaluate(() => performance.now());
  let lastY = -1;
  let stuck = 0;
  const positions = [];
  for (let i = 0; i < 300; i++) {
    const { y, max, t, section } = await page.evaluate(() => ({
      y: window.scrollY,
      max: document.scrollingElement.scrollHeight - window.innerHeight,
      t: performance.now(),
      section: document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.closest("section[id], footer")?.id || "",
    }));
    positions.push({ t, y, section });
    if (y >= max - 2) break;
    if (y === lastY) stuck += 1;
    else stuck = 0;
    if (stuck > 5) await page.evaluate(() => window.scrollBy({ top: 400, behavior: "instant" }));
    else await page.mouse.wheel(0, 320);
    lastY = y;
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(1200);
  const end = await page.evaluate(() => performance.now());
  const tasks = await page.evaluate(() => window.__qaLongTasks);
  const scripts = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((e) => /\.js($|\?)/.test(e.name))
      .map((e) => ({ path: new URL(e.name).pathname, end: e.responseEnd })),
  );
  const inScroll = tasks
    .filter((t) => t.start >= start && t.start <= end && t.duration > LONG_TASK_MS)
    .map((t) => {
      const at = [...positions].reverse().find((p) => p.t <= t.start) ?? positions[0];
      const loaded = scripts.filter((sc) => sc.end >= t.start - 2000 && sc.end <= t.start + t.duration).map((sc) => sc.path.split("/").pop());
      return { ...t, scrollY: Math.round(at?.y ?? 0), section: at?.section ?? "", scriptsJustLoaded: loaded };
    });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => {});
  await context.close();
  return { watch, inScroll, loadPhase: tasks.filter((t) => t.start < start), windowMs: Math.round(end - start) };
}

const describeTasks = (tasks) =>
  tasks.map((t) => `${t.duration} ms @ ${t.start} ms, scrollY ${t.scrollY} (#${t.section || "?"})${t.scriptsJustLoaded.length ? `, after loading ${t.scriptsJustLoaded.join(" ")}` : ""}`);

/**
 * Long tasks during the scroll fail only when they reproduce: after a dirty run the
 * pass is repeated once (QA_LONGTASK_RETRY=0 disables that). A single run with a
 * multi-second "task" on a busy machine is usually the process being descheduled.
 */
async function longTaskPass(browser, url, size, report, consoleLog) {
  const first = await measureLongTasks(browser, url, size, consoleLog, "");
  const { watch } = first;
  report.check(
    `h1.dom.4x.${size.id}`,
    !!watch && watch.firstVisible && watch.hidden.length === 0,
    `4× CPU: H1 hidden on ${watch?.hidden.length ?? "?"}${(watch?.hidden.length ?? 0) >= 50 ? "+" : ""} of ${watch?.samples ?? 0} sampled frames`,
    watch?.hidden,
  );
  report.info(`longTasks.load.${size.id}`, `4× CPU, load phase: ${first.loadPhase.length} long task(s), longest ${Math.max(0, ...first.loadPhase.map((t) => t.duration))} ms (not budgeted)`);
  const runs = [first];
  if (first.inScroll.length && process.env.QA_LONGTASK_RETRY !== "0") runs.push(await measureLongTasks(browser, url, size, consoleLog, " (retry)"));
  report.data[`longTasks.${size.id}`] = runs.map((r) => ({ scrollWindowMs: r.windowMs, inScroll: r.inScroll, loadPhase: r.loadPhase }));
  const last = runs.at(-1);
  const msg = `4× CPU, full scroll (${Math.round(last.windowMs / 1000)} s): ${runs.map((r) => r.inScroll.length).join(" → ")} task(s) > ${LONG_TASK_MS} ms${runs.length > 1 ? " (first run, retry)" : ""}`;
  if (last.inScroll.length === 0 && first.inScroll.length > 0) report.warn(`longTasks.scroll.${size.id}`, `${msg} — not reproducible`, describeTasks(first.inScroll));
  else report.check(`longTasks.scroll.${size.id}`, last.inScroll.length === 0, msg, describeTasks(last.inScroll));
}

await runScript("trace", { target: BASE_URL }, async (report) => {
  requireOut();
  mkdirSync(TRACE_DIR, { recursive: true });
  const server = await ensureServed(BASE_URL, OUT);
  if (server.matchesOut === false) throw new Error(`${BASE_URL} serves a different build than ${OUT} — stop that server or set QA_BASE_URL to a free port`);
  const browser = await launch();
  const consoleLog = [];
  try {
    for (const id of ["1440x900", "390x844"]) await filmstripPass(browser, server.url, sizeById(id), report, consoleLog);
    await pinPass(browser, server.url, report);
    for (const id of ["390x844", "1440x900"]) await longTaskPass(browser, server.url, sizeById(id), report, consoleLog);
  } finally {
    await browser.close();
    await server.stop();
  }
  report.data.console = consoleLog;
  writeFileSync(join(TRACE_DIR, "console.json"), `${JSON.stringify(consoleLog, null, 2)}\n`);
  report.check(
    "console.clean",
    consoleLog.length === 0,
    `${consoleLog.length} console error(s)/warning(s) on load and during full scrolls (1440×900, 390×844, both also at 4× CPU)`,
    consoleLog.slice(0, 10).map((c) => `[${c.phase}] ${c.type}: ${c.text.slice(0, 200)}`),
  );
});
