#!/usr/bin/env node
// Figure budget (docs/plan-figure-system.md §3 rules R1–R5, §7 Phase 0): how often a
// visitor sees the gymnast. Guards the figure count so it can never creep back up.
//
// WHAT COUNTS AS ONE FIGURE (visible to a visitor — see "Visible" below):
//   - a <use> whose href ends in "#leap" (the logo split leap, components/brand/Sprite.tsx).
//     Several clipped <use> that draw ONE body are one figure: the hero rig
//     ([data-hero-ghost], [data-hero-leap]: torso + back leg + front leg), the hero's
//     scroll runner (.hero-spine: two clip halves) and the 404 beam figure
//     (.nf-scene__figure: legs + torso) — see GROUPS;
//   - an <svg data-figure="pose:<id>"> (a pose from the plan's §4 family), whatever it draws.
//     A #leap inside a pose svg is not counted twice (the pose is the figure).
//
// CONTRACT (the attribute the components carry; the checks are selectors, not heuristics):
//   data-figure="brand:logo"     the Logo component (header, menu sheet, footer, 404)
//   data-figure="brand:mark"     ChronoMark (section-title marks)
//   data-figure="brand:hero"     the hero art (and anything the hero adds at runtime,
//                                e.g. the .hero-spine runner that scrub.ts prepends to the section)
//   data-figure="brand:quiz"     the quiz band's flight to the child's program (plan §5.3)
//   data-figure="brand:doskok"   the contact finale (doskok frames)
//   data-figure="brand:booking"  the booking-sheet head
//   data-figure="pose:<id>"      on the <svg> of every pose figure (P1…P8)
//   Every visible #leap must sit inside an element with data-figure="brand…" (rule R1).
//   Figures created at runtime (scrub.ts, camp-beam.ts, …) need the attribute too:
//   the allow-list check also covers figures that are only visible while motion plays.
//
// CHECKS, per size (390×844 touch at DPR 2, 1440×900):
//   figures.static.<size>        FAIL if more than MAX_STATIC figures are visible in the
//                                final state (after a slow scroll-through: every lazy
//                                animation has landed; the fixed header judged at the top).
//   figures.perScreen.<size>     FAIL if more than MAX_PER_SCREEN figures are on one settled
//                                screen (quarter-viewport steps, a figure counts when ≥50 % of
//                                its box is in the viewport).
//   figures.leapAllowList.<size> FAIL if any visible #leap figure (static or motion) has no
//                                ancestor [data-figure^="brand"]; lists section + selector path.
//   INFO: per-section counts, the worst screen (scrollY + composition, screenshot with red
//   boxes in QA_SHOTS_DIR), brand / pose / unlabelled totals, motion-only figures, and the
//   404 page's figures (info only).
//
// Visible = non-zero box, not display:none, visibility visible, effective opacity
// (opacity of every ancestor × colour alpha × fill-opacity) > MIN_OPACITY, not
// clipped away by an overflow ancestor, a rect clip-path or the page bounds, and not
// painted in the colour of its nearest opaque background (contrast < 1.1: e.g. the quiz
// band's navy-on-navy occluder copies, which hide apparatus lines, are not figures).
// Not measured: interaction-only states (menu sheet, booking sheet, quiz steps,
// schedule "Po danu", carousel swipes). The inventory these thresholds come from is
// in docs/plan-figure-system.md §1 (live 1440 today: 93 static, 18 on one screen).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { contextOptions, launch, sizeById, waitForIntro } from "./lib/browser.mjs";
import { BASE_URL, OUT, SHOTS_DIR, requireOut } from "./lib/env.mjs";
import { runScript } from "./lib/report.mjs";
import { ensureServed } from "./lib/server.mjs";

const MAX_STATIC = 40;
const MAX_PER_SCREEN = 9;
const MIN_OPACITY = 0.05;
/** Share of a figure's box inside the viewport for it to count as "on screen". */
const ON_SCREEN = 0.5;
/** A figure seen at least this much inside the viewport while scrolling was seen by the visitor. */
const SEEN = 0.15;
/** Groups of clipped #leap uses that draw one body. */
const GROUPS = "[data-hero-ghost], [data-hero-leap], .hero-spine, .nf-scene__figure";
const SIZES = ["390x844", "1440x900"];

// ── in-page collector (installed with addInitScript; ids are stable per page) ──────
function installCollector({ groups, minOpacity }) {
  if (window.__qaFigures) return;
  const ids = new WeakMap();
  let next = 1;
  const idOf = (el) => {
    if (!ids.has(el)) ids.set(el, next++);
    return ids.get(el);
  };
  const intersect = (a, b) => ({ l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) });
  const area = (r) => Math.max(0, r.r - r.l) * Math.max(0, r.b - r.t);
  const alpha = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/) || c.match(/color\(srgb ([^)]+)\)/);
    if (!m) return 1;
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    return p.length > 3 ? parseFloat(p[3]) : 1;
  };
  const rgb = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const lum = (c) => {
    const [r, g, b] = rgb(c).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  /** Nearest opaque background colour behind an element (its ancestors' background-color). */
  const backdrop = (el) => {
    for (let e = el.parentElement; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && alpha(c) >= 0.9) return c;
    }
    return null;
  };
  const len = (v, ref) => (v.trim().endsWith("%") ? (parseFloat(v) / 100) * ref : parseFloat(v) || 0);

  /** Client-space box of a url(#id) clip path made of <rect>s; null for shape clips. */
  function rectClip(el, value) {
    const m = value.match(/url\("?#([^")]+)"?\)/);
    const cp = m && document.getElementById(m[1]);
    if (!cp || !el.getScreenCTM) return null;
    const rects = cp.querySelectorAll("rect");
    if (!rects.length || cp.querySelector("path, polygon, circle, ellipse")) return null;
    const ctm = el.getScreenCTM();
    if (!ctm) return null;
    let box = null;
    for (const r of rects) {
      const x = r.x.baseVal.value, y = r.y.baseVal.value, w = r.width.baseVal.value, h = r.height.baseVal.value;
      const pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => new DOMPoint(px, py).matrixTransform(ctm));
      const b = { l: Math.min(...pts.map((p) => p.x)), r: Math.max(...pts.map((p) => p.x)), t: Math.min(...pts.map((p) => p.y)), b: Math.max(...pts.map((p) => p.y)) };
      box = box ? { l: Math.min(box.l, b.l), t: Math.min(box.t, b.t), r: Math.max(box.r, b.r), b: Math.max(box.b, b.b) } : b;
    }
    return box;
  }

  /** Visibility of one element (a <use> or a pose <svg>), client coordinates. */
  function visibility(el) {
    const br = el.getBoundingClientRect();
    const box = { l: br.left, t: br.top, r: br.right, b: br.bottom };
    const why = [];
    let clip = { ...box };
    let opacity = 1;
    let fixed = false;
    if (br.width < 0.5 || br.height < 0.5) why.push("zero-box");
    const cs = getComputedStyle(el);
    if (cs.visibility !== "visible") why.push(`visibility:${cs.visibility}`);
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === "none") {
        why.push("display:none");
        break;
      }
      if (s.display === "contents") continue; // no box: opacity/overflow/clip do not apply
      opacity *= parseFloat(s.opacity);
      if (s.position === "fixed") fixed = true;
      if (e !== el && e !== document.body && (s.overflowX !== "visible" || s.overflowY !== "visible")) {
        const r = e.getBoundingClientRect();
        if (s.overflowX !== "visible") clip = intersect(clip, { l: r.left, r: r.right, t: -Infinity, b: Infinity });
        if (s.overflowY !== "visible") clip = intersect(clip, { t: r.top, b: r.bottom, l: -Infinity, r: Infinity });
      }
      const cp = s.clipPath && s.clipPath !== "none" ? s.clipPath : e.getAttribute?.("clip-path");
      if (cp && cp.startsWith("inset(")) {
        const r = e.getBoundingClientRect();
        const [t, rr = t, b = t, l = rr] = cp.slice(6, -1).split(/\s+round\s+/)[0].trim().split(/\s+/);
        clip = intersect(clip, { l: r.left + len(l, r.width), r: r.right - len(rr, r.width), t: r.top + len(t, r.height), b: r.bottom - len(b, r.height) });
      } else if (cp && cp.startsWith("url(")) {
        const r = rectClip(e, cp);
        if (r) clip = intersect(clip, r);
      }
    }
    const docW = document.documentElement.scrollWidth, docH = document.scrollingElement.scrollHeight;
    clip = intersect(clip, fixed ? { l: 0, t: 0, r: innerWidth, b: innerHeight } : { l: -scrollX, t: -scrollY, r: docW - scrollX, b: docH - scrollY });
    opacity *= alpha(cs.color) * (parseFloat(cs.fillOpacity) || 0);
    if (opacity <= minOpacity) why.push(`opacity ${opacity.toFixed(3)}`);
    const bg = backdrop(el);
    if (bg && contrast(cs.color, bg) < 1.1) why.push("same colour as its background");
    const frac = area(box) > 0 ? area(clip) / area(box) : 0;
    if (area(box) > 0 && frac <= 0.02) why.push("clipped-away");
    return { visible: why.length === 0, why, box, clip, opacity, fixed };
  }

  /** header / footer / dialog#id, or the outermost section[id] inside <main> (pin-spacers may wrap it). */
  function sectionOf(el) {
    let section = null;
    for (let e = el; e; e = e.parentElement) {
      if (e.tagName === "DIALOG") return e.id ? `dialog#${e.id}` : "dialog";
      if (e.matches("[data-site-header], body > header")) return "header";
      if (e.tagName === "FOOTER" && e.parentElement === document.body) return "footer";
      if (e.tagName === "SECTION" && e.id) section = e;
      if (e.tagName === "MAIN") return section ? `#${section.id}` : e.classList.contains("nf") ? "404" : "main";
    }
    return "other";
  }

  function pathOf(el) {
    const parts = [];
    for (let e = el; e && parts.length < 4 && e.tagName !== "SECTION" && e.tagName !== "MAIN" && e !== document.body; e = e.parentElement) {
      const cls = (e.getAttribute("class") || "").trim().split(/\s+/)[0];
      const fig = e.getAttribute("data-figure");
      parts.unshift(`${e.tagName.toLowerCase()}${cls ? `.${cls}` : ""}${fig ? `[data-figure="${fig}"]` : ""}`);
    }
    return parts.join(" > ");
  }

  function collect() {
    const units = new Map(); // figure element → parts
    const poses = [...document.querySelectorAll('svg[data-figure^="pose:"]')];
    for (const p of poses) units.set(p, { kind: "pose", parts: [p] });
    for (const u of document.querySelectorAll("use")) {
      const href = u.getAttribute("href") || u.getAttribute("xlink:href") || "";
      if (!href.endsWith("#leap")) continue;
      if (u.closest('svg[data-figure^="pose:"]')) continue; // the pose is the figure
      const g = u.closest(groups) || u;
      if (!units.has(g)) units.set(g, { kind: "leap", parts: [] });
      units.get(g).parts.push(u);
    }
    const out = [];
    for (const [el, { kind, parts }] of units) {
      const vs = parts.map(visibility);
      const vis = vs.filter((v) => v.visible);
      const use = vis.length ? vis : vs;
      const union = (key) => use.reduce((a, v) => (a ? { l: Math.min(a.l, v[key].l), t: Math.min(a.t, v[key].t), r: Math.max(a.r, v[key].r), b: Math.max(a.b, v[key].b) } : { ...v[key] }), null);
      const brandEl = el.closest('[data-figure^="brand"]');
      const figureAttr = kind === "pose" ? el.getAttribute("data-figure") : brandEl?.getAttribute("data-figure") ?? null;
      out.push({
        id: idOf(el),
        kind,
        figure: figureAttr,
        brand: kind === "leap" ? !!brandEl : false,
        section: sectionOf(el),
        path: pathOf(el),
        visible: vis.length > 0,
        why: vis.length ? [] : [...new Set(vs.flatMap((v) => v.why))],
        opacity: +Math.max(0, ...vis.map((v) => v.opacity)).toFixed(3),
        fixed: vs.some((v) => v.fixed),
        box: union("box"),
        clip: union("clip"),
        scrollY,
      });
    }
    return out;
  }

  window.__qaFigures = { collect };
}

/** Share of a figure's box inside the viewport (0 when not visible). */
function onScreen(f, w, h) {
  if (!f.visible || !f.box || !f.clip) return 0;
  const c = { l: Math.max(f.clip.l, 0), t: Math.max(f.clip.t, 0), r: Math.min(f.clip.r, w), b: Math.min(f.clip.b, h) };
  const a = Math.max(0, c.r - c.l) * Math.max(0, c.b - c.t);
  const full = Math.max(0, f.box.r - f.box.l) * Math.max(0, f.box.b - f.box.t);
  return full > 0 ? a / full : 0;
}

const collect = (page) => page.evaluate(() => window.__qaFigures.collect());
const scrollToY = (page, y) => page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
const maxScroll = (page) => page.evaluate(() => document.scrollingElement.scrollHeight - window.innerHeight);
const tally = (list, key) => list.reduce((acc, f) => ((acc[f[key] ?? "—"] = (acc[f[key] ?? "—"] || 0) + 1), acc), {});
const label = (f) => `${f.section} ${f.path}`;

/** Draws red numbered boxes over the given figures (viewport coords), for the worst-screen shot. */
async function markBoxes(page, figs) {
  await page.evaluate((list) => {
    const layer = document.createElement("div");
    layer.id = "qa-figure-boxes";
    layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
    list.forEach((f, i) => {
      const d = document.createElement("div");
      d.style.cssText = `position:absolute;left:${f.box.l}px;top:${f.box.t}px;width:${f.box.r - f.box.l}px;height:${f.box.b - f.box.t}px;border:2px solid #ff1a1a;box-sizing:border-box;font:700 11px/1 monospace;color:#fff`;
      d.innerHTML = `<span style="background:#ff1a1a;padding:1px 3px;position:absolute;top:-13px;left:-2px">${i + 1}</span>`;
      layer.appendChild(d);
    });
    document.body.appendChild(layer);
  }, figs);
}

async function measure(browser, baseUrl, size, report) {
  const W = size.width, H = size.height;
  const context = await browser.newContext(contextOptions(size));
  await context.addInitScript(installCollector, { groups: GROUPS, minOpacity: MIN_OPACITY });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await waitForIntro(page, 10000);
  await page.waitForTimeout(1000);

  /** Every figure seen visible (≥ SEEN on screen) at any moment, keyed by id. */
  const seen = new Map();
  const note = (figs) => {
    for (const f of figs) if (f.visible && onScreen(f, W, H) >= SEEN && !seen.has(f.id)) seen.set(f.id, f);
  };

  // 1 · Slow scroll: quarter-viewport glides, ~1 s dwell sampled every 120 ms, so every
  //     lazy / on-enter animation plays on screen and lands.
  const step = Math.round(H / 4);
  for (let guard = 0, bottom = 0; guard < 600; guard++) {
    for (let i = 0; i < 6; i++) {
      note(await collect(page));
      await page.waitForTimeout(120);
    }
    const [y, max] = [await page.evaluate(() => window.scrollY), await maxScroll(page)];
    if (y >= max - 2) {
      if (++bottom > 2) break;
      continue;
    }
    for (let i = 1; i <= 4; i++) {
      await scrollToY(page, Math.min(y + Math.round((step * i) / 4), max));
      await page.waitForTimeout(30);
    }
  }
  await page.waitForTimeout(2500);
  const atBottom = await collect(page);

  // 2 · Settled screens: back to the top, then down in quarter-viewport steps.
  await scrollToY(page, 0);
  await page.waitForTimeout(2500);
  const atTop = await collect(page);
  note(atTop);
  const screens = [];
  for (let k = 0; ; k++) {
    const max = await maxScroll(page);
    const target = Math.min(k * step, max);
    await scrollToY(page, target);
    await page.waitForTimeout(650);
    const figs = await collect(page);
    note(figs);
    const on = figs.filter((f) => onScreen(f, W, H) >= ON_SCREEN);
    screens.push({ scrollY: await page.evaluate(() => window.scrollY), n: on.length, ids: on.map((f) => f.id), bySection: tally(on, "section") });
    if (target >= max) break;
  }

  // Final state: everything visible at the bottom, except fixed chrome (the header hides on
  // scroll-down), which is judged at the top.
  const topById = new Map(atTop.map((f) => [f.id, f]));
  const finals = atBottom.map((f) => (f.fixed && topById.has(f.id) ? topById.get(f.id) : f)).filter((f) => f.visible);
  const staticIds = new Set(finals.map((f) => f.id));
  const motionOnly = [...seen.values()].filter((f) => !staticIds.has(f.id));
  const worst = screens.reduce((a, s) => (s.n > a.n ? s : a), { n: -1 });

  // Worst screen, with red boxes, for the eyes.
  let shotFile = null;
  if (worst.n > 0) {
    await scrollToY(page, 0);
    await page.waitForTimeout(600);
    await scrollToY(page, worst.scrollY);
    await page.waitForTimeout(1500);
    const figs = (await collect(page)).filter((f) => onScreen(f, W, H) >= ON_SCREEN);
    await markBoxes(page, figs);
    mkdirSync(SHOTS_DIR, { recursive: true });
    shotFile = join(SHOTS_DIR, `figures-worst-${size.id}.png`);
    await page.screenshot({ path: shotFile });
    report.artifact(shotFile);
  }

  // 404 (info only): the page's own final composition.
  const nf = await context.newPage();
  await nf.goto(`${baseUrl}/404.html`, { waitUntil: "load" });
  await nf.evaluate(() => document.fonts.ready);
  await nf.waitForTimeout(3500);
  const nfFigs = (await collect(nf)).filter((f) => f.visible);
  await context.close();

  // ── checks ──
  const leapSeen = [...new Map([...finals, ...motionOnly].map((f) => [f.id, f])).values()].filter((f) => f.kind === "leap");
  const offenders = leapSeen.filter((f) => !f.brand).map((f) => `${label(f)}${staticIds.has(f.id) ? "" : " (motion only)"}`);
  const brand = finals.filter((f) => f.kind === "leap" && f.brand).length;
  const pose = finals.filter((f) => f.kind === "pose").length;
  const unlabelled = finals.filter((f) => f.kind === "leap" && !f.brand).length;
  const perSection = tally(finals, "section");

  report.check(`figures.static.${size.id}`, finals.length <= MAX_STATIC, `${finals.length} visible figures in the final state (max ${MAX_STATIC})`, perSection);
  report.check(
    `figures.perScreen.${size.id}`,
    worst.n <= MAX_PER_SCREEN,
    `at most ${worst.n} on one settled screen (max ${MAX_PER_SCREEN}), worst at scrollY ${worst.scrollY}`,
    worst.bySection,
  );
  report.check(
    `figures.leapAllowList.${size.id}`,
    offenders.length === 0,
    `${offenders.length} visible #leap figure(s) outside [data-figure^="brand"] (${leapSeen.length} #leap seen)`,
    offenders,
  );
  report.info(`figures.sections.${size.id}`, Object.entries(perSection).map(([s, n]) => `${s} ${n}`).join(" · "));
  report.info(`figures.worst.${size.id}`, `${worst.n} at scrollY ${worst.scrollY}: ${Object.entries(worst.bySection ?? {}).map(([s, n]) => `${s} ${n}`).join(", ")}${shotFile ? ` (figures-worst-${size.id}.png)` : ""}`);
  report.info(`figures.kinds.${size.id}`, `brand #leap ${brand} · pose ${pose} · unlabelled #leap ${unlabelled}${pose ? ` (${Object.entries(tally(finals.filter((f) => f.kind === "pose"), "figure")).map(([k, n]) => `${k}×${n}`).join(", ")})` : ""}`);
  report.info(`figures.motionOnly.${size.id}`, motionOnly.length ? `${motionOnly.length} only while motion plays: ${motionOnly.map((f) => `${f.section} ${f.path.split(" > ").pop()}`).join(", ")}` : "none");
  report.info(`figures.notFound.${size.id}`, `${nfFigs.length} on /404.html (${nfFigs.filter((f) => f.kind === "leap" && !f.brand).length} #leap outside brand)`);

  report.data[size.id] = {
    thresholds: { MAX_STATIC, MAX_PER_SCREEN, ON_SCREEN, MIN_OPACITY },
    static: finals.length,
    perSection,
    kinds: { brand, pose, unlabelled },
    worst,
    screens: screens.map(({ scrollY, n, bySection }) => ({ scrollY, n, bySection })),
    offenders,
    motionOnly: motionOnly.map((f) => ({ section: f.section, path: f.path, kind: f.kind, figure: f.figure })),
    figures: finals.map((f) => ({ section: f.section, kind: f.kind, figure: f.figure, path: f.path, opacity: f.opacity, pageY: f.fixed ? null : Math.round(f.box.t + f.scrollY) })),
    notFound: nfFigs.map((f) => ({ kind: f.kind, figure: f.figure, path: f.path })),
  };
}

await runScript("figures", { target: BASE_URL }, async (report) => {
  requireOut();
  const server = await ensureServed(BASE_URL, OUT);
  if (server.matchesOut === false) throw new Error(`${BASE_URL} serves a different build than ${OUT} — stop that server or set QA_BASE_URL to a free port`);
  const browser = await launch();
  try {
    for (const id of SIZES) await measure(browser, server.url, sizeById(id), report);
  } finally {
    await browser.close();
    await server.stop();
  }
});
