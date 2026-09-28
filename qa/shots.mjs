#!/usr/bin/env node
// §7 layout, no-JS, reduced-motion, photo-width, diacritics and MINOR_PHOTOS=false
// checks, with screenshots in QA_SHOTS_DIR (default qa/shots). LOOK at them.
//
// Per size (360×800, 390×844, 768×1024 touch; 1440×900 desktop; all at DPR 2):
//   load → wait for the intro → scroll through (lazy content) → back to top →
//   settle → full-page shot + hero shot, and measure:
//   - overflow: document.scrollingElement.scrollWidth ≤ innerWidth (top, bottom, top)
//   - tap targets ≥ 48×48 CSS px: every visible a[href], button, input, select,
//     textarea, summary and [role=button|tab|link|checkbox|radio|switch|menuitem].
//     EXEMPT (WCAG 2.5.8 "inline" exception): an <a> whose computed display is
//     `inline` and whose nearest text block (p, li, dd, dt, td, figcaption,
//     blockquote, address, small) contains more text than the link itself —
//     i.e. a link inside running text. A visually hidden radio/checkbox is
//     measured through its <label>. A target smaller than 48×48 still passes when
//     elementFromPoint() hits it on all 8 points of the 48×48 box around its centre
//     (a hit area enlarged with padding or ::before/::after).
//   - photos: rendered CSS width ≤ native px / 2 for every visible <img> of a
//     generated photo (data-native-width, or the manifest width for its slug);
//     also inside the gallery lightbox.
//   - text cut by overflow (heuristic, warning only).
// Reduced motion: hero shot; no html.js-motion, no intro marks, no .pin-spacer.
// JS disabled: full page; H1 + hero art visible; primary CTA href="#kontakt" and it
//   jumps there; schedule (all §5 time slots) and contacts are in the rendered text.
// Diacritics: "Č č Ć ć Š š Ž ž Đ đ" in every Mona Sans weight/width the page uses.
// Variant (QA_VARIANT_OUT = a NEXT_PUBLIC_MINOR_PHOTOS=false export): every
//   [data-photo-id] of a minor is a placeholder, no minor photo URL anywhere,
//   02/09 absent, full-page shots.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { collectConsole, contextOptions, fullPageScreenshot, launch, scrollThrough, scrollToTop, settle, SIZES, sizeById, waitForIntro } from "./lib/browser.mjs";
import { BASE_URL, OUT, ROOT, SHOTS_DIR, VARIANT_OUT, VARIANT_PORT, loadPhotos, requireOut } from "./lib/env.mjs";
import { runScript } from "./lib/report.mjs";
import { ensureServed, startStatic } from "./lib/server.mjs";

const MANIFEST = JSON.parse(readFileSync(join(ROOT, "content/images.generated.json"), "utf8"));
const NATIVE = Object.fromEntries(Object.entries(MANIFEST).map(([slug, m]) => [slug, m.width]));
const DIACRITICS = "Č č Ć ć Š š Ž ž Đ đ";
/** §5 schedule times and §5 contacts: must be readable without JS. */
const SCHEDULE_TEXT = ["08:30–10:30", "16:00–18:00", "17:30–19:30", "19:30–21:30", "18:00–19:00", "19:00–20:00", "20:00–21:30", "Mlađa početna grupa", "Starija početna grupa", "Aerobna gimnastika"];
const CONTACT_TEXT = ["060 028 7631", "061 422 4386", "sladjanakovacevickg@gmail.com", "Save Kovačevića 25"];

const shot = (name) => join(SHOTS_DIR, name);

// ── in-page measurements ─────────────────────────────────────────────────────
function kontaktInView() {
  const r = document.getElementById("kontakt")?.getBoundingClientRect();
  return !!r && r.top < window.innerHeight && r.bottom > 0;
}

function measureOverflow() {
  const W = document.documentElement.clientWidth;
  const sw = document.scrollingElement.scrollWidth;
  const offenders = [];
  if (sw > window.innerWidth) {
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= W + 1) continue;
      let clipped = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== "visible" && p.getBoundingClientRect().right <= W + 1) {
          clipped = true;
          break;
        }
      }
      if (!clipped) offenders.push(`${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${[...el.classList].slice(0, 2).join(".")} right=${Math.round(r.right)}`);
      if (offenders.length >= 12) break;
    }
  }
  return { scrollWidth: sw, innerWidth: window.innerWidth, ok: sw <= window.innerWidth, offenders };
}

function measureTargets() {
  const MIN = 48;
  const TOL = 0.5;
  const SEL = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"]';
  const describe = (el) => {
    const text = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("value") || "").replace(/\s+/g, " ").trim().slice(0, 50);
    const section = el.closest("section[id], header, footer, nav, dialog")?.id || el.closest("section[id], header, footer, nav, dialog")?.tagName.toLowerCase() || "";
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${section ? ` in ${section}` : ""} „${text}“`;
  };
  const hidden = (el) => {
    if (el.closest('[hidden], [inert], dialog:not([open]), [aria-hidden="true"], template')) return true;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || cs.pointerEvents === "none") return true;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return true; // sr-only (e.g. skip link until focused)
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) if (getComputedStyle(n).opacity === "0") return true;
    return false;
  };
  const inlineTextLink = (el) => {
    if (el.tagName !== "A" || getComputedStyle(el).display !== "inline") return false;
    const block = el.closest("p, li, dd, dt, td, figcaption, blockquote, address, small");
    if (!block) return false;
    const own = (el.textContent || "").replace(/\s+/g, " ").trim().length;
    return (block.textContent || "").replace(/\s+/g, " ").trim().length > own + 3;
  };
  let checked = 0;
  let exempt = 0;
  const small = [];
  const seen = new Set();
  for (let el of document.querySelectorAll(SEL)) {
    if (el.matches('input[type="radio"], input[type="checkbox"]') && hidden(el)) el = el.closest("label") || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el;
    if (seen.has(el) || hidden(el)) continue;
    seen.add(el);
    if (inlineTextLink(el)) {
      exempt += 1;
      continue;
    }
    checked += 1;
    const r = el.getBoundingClientRect();
    if (r.width + TOL >= MIN && r.height + TOL >= MIN) continue;
    const i = small.length;
    el.setAttribute("data-qa-tap", String(i));
    small.push({ i, what: describe(el), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 });
  }
  return { checked, exempt, small };
}

async function probeTarget(i) {
  const el = document.querySelector(`[data-qa-tap="${i}"]`);
  if (!el) return { ok: false, reason: "gone" };
  el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
  // Two frames: scroll-linked layout (the desktop hero pin is position:fixed until
  // ScrollTrigger sees the jump) settles before hit-testing, as it does for a real tap.
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const misses = [];
  for (const [dx, dy] of [[-23.5, -23.5], [0, -23.5], [23.5, -23.5], [-23.5, 0], [23.5, 0], [-23.5, 23.5], [0, 23.5], [23.5, 23.5]]) {
    const x = cx + dx;
    const y = cy + dy;
    if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) {
      misses.push("off-screen");
      continue;
    }
    const hit = document.elementFromPoint(x, y);
    if (!hit || !(hit === el || el.contains(hit))) misses.push(hit ? `${hit.tagName.toLowerCase()}.${[...hit.classList].slice(0, 2).join(".")}` : "none");
  }
  return { ok: misses.length === 0, misses: [...new Set(misses)] };
}

function measurePhotos(native) {
  const out = [];
  for (const img of document.querySelectorAll("img")) {
    const r = img.getBoundingClientRect();
    if (r.width < 2 || getComputedStyle(img).visibility === "hidden") continue;
    const src = img.currentSrc || img.src || "";
    const m = src.match(/\/img\/(.+)-\d+\.(?:avif|webp|jpe?g|png)/);
    const nat = Number(img.dataset.nativeWidth) || (m ? native[m[1]] : 0);
    if (!nat) continue;
    out.push({ src: src.replace(/^https?:\/\/[^/]+/, ""), width: Math.round(r.width * 10) / 10, max: nat / 2, ok: r.width <= nat / 2 + 0.5, inDialog: !!img.closest("dialog, [role=dialog]") });
  }
  return out;
}

function measureClippedText() {
  const out = [];
  for (const el of document.body.querySelectorAll("h1, h2, h3, h4, p, li, a, button, span, dt, dd, figcaption, label, summary")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const clipsX = /hidden|clip/.test(cs.overflowX) || cs.textOverflow === "ellipsis";
    const clipsY = /hidden|clip/.test(cs.overflowY);
    if (!clipsX && !clipsY) continue;
    if (el.closest('.sr-only, [class*="visually-hidden"], [aria-hidden="true"]') || el.getBoundingClientRect().width <= 1) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
    if (!hasText) continue;
    if ((clipsX && el.scrollWidth > el.clientWidth + 1) || (clipsY && el.scrollHeight > el.clientHeight + 2)) {
      out.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join(".")} „${el.textContent.trim().slice(0, 40)}“`);
    }
  }
  return out.slice(0, 15);
}

// ── passes ───────────────────────────────────────────────────────────────────
async function layoutPass(browser, url, size, report) {
  const context = await browser.newContext(contextOptions(size, { dpr: 2 }));
  const page = await context.newPage();
  const consoleMsgs = collectConsole(page);
  await page.goto(`${url}/`, { waitUntil: "load" });
  await waitForIntro(page);
  const overflowTop = await page.evaluate(measureOverflow);
  await scrollThrough(page);
  await settle(page, { extra: 600 });
  const overflowBottom = await page.evaluate(measureOverflow);
  await scrollToTop(page);
  await settle(page);
  const overflowEnd = await page.evaluate(measureOverflow);
  const worst = [overflowTop, overflowBottom, overflowEnd].sort((a, b) => b.scrollWidth - a.scrollWidth)[0];
  report.check(`overflow.${size.id}`, worst.ok, `scrollWidth ${worst.scrollWidth} ≤ innerWidth ${worst.innerWidth}`, worst.offenders);

  await fullPageScreenshot(page, shot(`layout-${size.id}.png`));
  await page.screenshot({ path: shot(`hero-${size.id}.png`), scale: "css" });
  report.artifact(shot(`layout-${size.id}.png`));
  report.artifact(shot(`hero-${size.id}.png`));

  const photos = await page.evaluate(measurePhotos, NATIVE);
  const tooWide = photos.filter((p) => !p.ok);
  report.check(`photos.nativeHalf.${size.id}`, tooWide.length === 0, `${photos.length} photos ≤ native/2 CSS px at DPR 2`, tooWide);
  report.data[`photos.${size.id}`] = photos;

  const clipped = await page.evaluate(measureClippedText);
  report.check(`text.clipped.${size.id}`, clipped.length === 0, "no text cut off by overflow (heuristic)", clipped, { severity: "warn" });

  const targets = await page.evaluate(measureTargets);
  const failing = [];
  for (const t of targets.small) {
    const probe = await page.evaluate(probeTarget, t.i);
    if (!probe.ok) failing.push({ ...t, blockedBy: probe.misses });
  }
  report.data[`tapTargets.${size.id}`] = { checked: targets.checked, exempt: targets.exempt, small: targets.small.length, failing };
  report.check(
    `tapTargets.${size.id}`,
    failing.length === 0,
    `${targets.checked - failing.length}/${targets.checked} targets ≥48×48 (${targets.exempt} inline text links exempt; ${targets.small.length - failing.length} pass via an enlarged hit area)`,
    failing.map((f) => `${f.what} ${f.w}×${f.h}`),
  );

  // Gallery lightbox (if present): photos there obey the same cap.
  if (size.id === "390x844" || size.id === "1440x900") {
    const opener = page.locator("[data-gallery-open]").first();
    if (await opener.count()) {
      await opener.scrollIntoViewIfNeeded();
      await opener.click();
      await page.waitForTimeout(1200);
      const inBox = (await page.evaluate(measurePhotos, NATIVE)).filter((p) => p.inDialog);
      if (inBox.length) {
        report.check(`photos.lightbox.${size.id}`, inBox.every((p) => p.ok), `${inBox.length} lightbox photo(s) ≤ native/2`, inBox.filter((p) => !p.ok));
        await page.screenshot({ path: shot(`lightbox-${size.id}.png`), scale: "css" });
        report.artifact(shot(`lightbox-${size.id}.png`));
      } else report.info(`photos.lightbox.${size.id}`, "no <img> inside an open dialog after clicking the first gallery item");
      await page.keyboard.press("Escape");
    }
  }
  if (consoleMsgs.length) report.warn(`console.${size.id}`, `${consoleMsgs.length} console error(s)/warning(s) (trace.mjs is the strict check)`, consoleMsgs.slice(0, 5));
  await context.close();
}

async function reducedMotionPass(browser, url, size, report) {
  const context = await browser.newContext(contextOptions(size, { reducedMotion: "reduce" }));
  const page = await context.newPage();
  await page.goto(`${url}/`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => {
    const decor = document.querySelector("[data-hero-decor]");
    const cs = decor ? getComputedStyle(decor) : null;
    return {
      jsMotion: document.documentElement.classList.contains("js-motion"),
      intro: document.documentElement.dataset.intro ?? null,
      marks: performance.getEntriesByType("mark").map((m) => m.name).filter((n) => n.startsWith("kraguj:")),
      pins: document.querySelectorAll(".pin-spacer").length,
      decorVisible: !!cs && cs.visibility !== "hidden" && cs.opacity !== "0" && cs.display !== "none",
    };
  });
  await page.screenshot({ path: shot(`reduced-motion-hero-${size.id}.png`), scale: "css" });
  report.artifact(shot(`reduced-motion-hero-${size.id}.png`));
  report.check(`reducedMotion.noIntro.${size.id}`, !state.jsMotion && state.intro !== "running" && !state.marks.includes("kraguj:intro-start"), "no html.js-motion, no intro", state);
  report.check(`reducedMotion.heroStatic.${size.id}`, state.decorVisible, "hero decorative layer shows the final static composition", state);
  await scrollThrough(page, { delay: 120 });
  const pins = await page.evaluate(() => document.querySelectorAll(".pin-spacer").length);
  report.check(`reducedMotion.noPin.${size.id}`, pins === 0 && state.pins === 0, `no ScrollTrigger pin (${pins} .pin-spacer)`);
  await context.close();
}

async function noJsPass(browser, url, size, report) {
  const context = await browser.newContext(contextOptions(size, { javaScriptEnabled: false }));
  const page = await context.newPage();
  await page.goto(`${url}/`, { waitUntil: "load" });
  await page.waitForTimeout(500);
  const state = await page.evaluate(
    ({ schedule, contacts }) => {
      const vis = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.opacity !== "0";
      };
      const cta = document.querySelector("#top [data-hero-ctas] a");
      const text = (id) => (document.getElementById(id)?.innerText ?? "").replace(/\s+/g, " ");
      const sched = text("programi");
      const contact = text("kontakt");
      return {
        h1: vis(document.querySelector("h1")),
        decor: vis(document.querySelector("[data-hero-decor]")),
        ctaHref: cta?.getAttribute("href") ?? null,
        ctaText: cta?.textContent?.trim() ?? null,
        scheduleMissing: schedule.filter((s) => !sched.includes(s)),
        contactsMissing: contacts.filter((s) => !contact.includes(s)),
        telLinks: document.querySelectorAll('#kontakt a[href^="tel:"]').length,
      };
    },
    { schedule: SCHEDULE_TEXT, contacts: CONTACT_TEXT },
  );
  await fullPageScreenshot(page, shot(`nojs-${size.id}.png`));
  report.artifact(shot(`nojs-${size.id}.png`));
  report.check(`nojs.hero.${size.id}`, state.h1 && state.decor, "H1 and the hero composition are visible without JS", state);
  report.check(`nojs.ctaHref.${size.id}`, state.ctaHref === "#kontakt", `primary CTA „${state.ctaText}“ href="${state.ctaHref}"`);
  report.check(`nojs.schedule.${size.id}`, state.scheduleMissing.length === 0, "schedule (all §5 slots and groups) readable", state.scheduleMissing);
  report.check(`nojs.contacts.${size.id}`, state.contactsMissing.length === 0 && state.telLinks >= 2, `contacts readable (${state.telLinks} tel: links in #kontakt)`, state.contactsMissing);
  if (state.ctaHref === "#kontakt") {
    await page.locator("#top [data-hero-ctas] a").first().click();
    // CSS scroll-behavior: smooth may animate the jump: poll for up to 3 s.
    await page.waitForFunction(kontaktInView, null, { timeout: 3000, polling: 100 }).catch(() => {});
    const jumped = { hash: await page.evaluate(() => location.hash), inView: await page.evaluate(kontaktInView) };
    report.check(`nojs.ctaJumps.${size.id}`, jumped.hash === "#kontakt" && jumped.inView, "the CTA jumps to #kontakt without JS", jumped);
  }
  await context.close();
}

async function diacriticsPass(browser, url, report) {
  const context = await browser.newContext(contextOptions(sizeById("1440x900"), { dpr: 2 }));
  const page = await context.newPage();
  await page.goto(`${url}/`, { waitUntil: "load" });
  await waitForIntro(page);
  await scrollThrough(page, { delay: 120 });
  await scrollToTop(page);
  const used = await page.evaluate(() => {
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-mona").split(",")[0].trim().replace(/^["']|["']$/g, "");
    const combos = new Map();
    for (const el of document.body.querySelectorAll("*")) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())) continue;
      const cs = getComputedStyle(el);
      const first = cs.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
      if (!family || first !== family) continue;
      const key = `${cs.fontWeight}|${cs.fontStretch}`;
      combos.set(key, (combos.get(key) ?? 0) + 1);
    }
    return { family, combos: [...combos.entries()].map(([k, n]) => ({ weight: k.split("|")[0], stretch: k.split("|")[1], elements: n })) };
  });
  if (!used.family || used.combos.length === 0) {
    report.fail("diacritics.weights", `could not detect Mona Sans usage (--font-mona="${used.family}")`);
    await context.close();
    return;
  }
  const combos = used.combos.sort((a, b) => Number(a.weight) - Number(b.weight) || parseFloat(a.stretch) - parseFloat(b.stretch));
  report.data.monaSansUsage = used;
  report.info("diacritics.weights", `Mona Sans weights/widths in use: ${combos.map((c) => `${c.weight}/${c.stretch}`).join(", ")}`);
  const coverage = await page.evaluate(
    async ({ family, combos, text }) => {
      const box = document.createElement("div");
      box.id = "qa-diacritics";
      box.setAttribute("style", "position:fixed;inset:0 auto auto 0;z-index:2147483647;background:#fff;color:#112d5f;padding:24px 32px;font-family:var(--font-mona);");
      for (const c of combos) {
        const row = document.createElement("div");
        row.setAttribute("style", `font-weight:${c.weight};font-stretch:${c.stretch};font-size:40px;line-height:1.25;white-space:nowrap;`);
        row.textContent = `${text}  ·  ${c.weight} / ${c.stretch}`;
        box.append(row);
      }
      document.body.append(box);
      const ctx = document.createElement("canvas").getContext("2d");
      const missing = [];
      for (const c of combos) {
        await document.fonts.load(`${c.weight} 40px "${family}"`, text);
        for (const ch of text.replace(/\s/g, "")) {
          ctx.font = `${c.weight} 40px "${family}", monospace`;
          const withMona = ctx.measureText(ch).width;
          ctx.font = `${c.weight} 40px monospace`;
          const mono = ctx.measureText(ch).width;
          ctx.font = `${c.weight} 40px "${family}", monospace`;
          const base = ctx.measureText("C").width;
          ctx.font = `${c.weight} 40px monospace`;
          const baseMono = ctx.measureText("C").width;
          if (Math.abs(withMona - mono) < 0.01 && Math.abs(base - baseMono) > 0.01) missing.push(`${ch}@${c.weight}`);
        }
      }
      return { missing, loaded: document.fonts.check(`400 40px "${family}"`, text) };
    },
    { family: used.family, combos, text: DIACRITICS },
  );
  await page.locator("#qa-diacritics").screenshot({ path: shot("diacritics.png") });
  report.artifact(shot("diacritics.png"));
  report.check("diacritics.glyphs", coverage.missing.length === 0, `„${DIACRITICS}“ rendered with Mona Sans glyphs in ${combos.length} weight/width combos (screenshot diacritics.png)`, coverage);
  await context.close();
}

async function variantPass(browser, report) {
  if (!VARIANT_OUT) {
    report.skip("variant.minorPhotos", "QA_VARIANT_OUT not set (run-all.mjs builds NEXT_PUBLIC_MINOR_PHOTOS=false into qa/variants/minor-photos-off/out)");
    return;
  }
  const PHOTOS = await loadPhotos();
  const minors = Object.values(PHOTOS).filter((p) => p.hasMinors);
  const server = await startStatic(VARIANT_OUT, VARIANT_PORT);
  try {
    for (const size of [sizeById("390x844"), sizeById("1440x900")]) {
      const context = await browser.newContext(contextOptions(size));
      const page = await context.newPage();
      await page.goto(`${server.url}/`, { waitUntil: "load" });
      await waitForIntro(page);
      await scrollThrough(page, { delay: 150 });
      await scrollToTop(page);
      await settle(page, { extra: 600 });
      const state = await page.evaluate(
        ({ minorIds, minorSlugs }) => {
          const nodes = [...document.querySelectorAll("[data-photo-id]")];
          const notPlaceholder = nodes.filter((n) => minorIds.includes(n.dataset.photoId) && (!n.hasAttribute("data-placeholder") || n.querySelector("img")));
          const urls = [
            ...[...document.querySelectorAll("img")].flatMap((i) => [i.currentSrc, i.getAttribute("src"), i.getAttribute("srcset")]),
            ...[...document.querySelectorAll("source")].map((s) => s.getAttribute("srcset")),
            ...[...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
            ...[...document.querySelectorAll("[style]")].map((e) => e.getAttribute("style")),
          ].filter(Boolean);
          return {
            photoNodes: nodes.length,
            placeholders: nodes.filter((n) => n.hasAttribute("data-placeholder")).length,
            notPlaceholder: notPlaceholder.map((n) => n.dataset.photoId),
            campGroup: nodes.filter((n) => ["02", "09"].includes(n.dataset.photoId)).map((n) => n.dataset.photoId),
            leaks: urls.filter((u) => minorSlugs.some((s) => u.includes(`/img/${s}-`))).slice(0, 10),
          };
        },
        { minorIds: minors.map((p) => p.id), minorSlugs: minors.map((p) => p.slug) },
      );
      await fullPageScreenshot(page, shot(`variant-minor-photos-off-${size.id}.png`));
      report.artifact(shot(`variant-minor-photos-off-${size.id}.png`));
      report.check(`variant.placeholders.${size.id}`, state.placeholders > 0 && state.notPlaceholder.length === 0, `${state.placeholders}/${state.photoNodes} photo slots are placeholders; minors not replaced: ${state.notPlaceholder.length}`, state);
      report.check(`variant.noMinorUrls.${size.id}`, state.leaks.length === 0, "no minor photo URL in img/srcset/href/style", state.leaks);
      report.check(`variant.campGroupAbsent.${size.id}`, state.campGroup.length === 0, "photos 02 and 09 absent", state.campGroup);
      await context.close();
    }
  } finally {
    await server.stop();
  }
}

await runScript("shots", { target: BASE_URL }, async (report) => {
  requireOut();
  mkdirSync(SHOTS_DIR, { recursive: true });
  const server = await ensureServed(BASE_URL, OUT);
  if (server.matchesOut === false) throw new Error(`${BASE_URL} serves a different build than ${OUT} — stop that server or set QA_BASE_URL to a free port`);
  const browser = await launch();
  try {
    for (const size of SIZES) await layoutPass(browser, server.url, size, report);
    for (const id of ["390x844", "1440x900"]) await reducedMotionPass(browser, server.url, sizeById(id), report);
    for (const id of ["390x844", "1440x900"]) await noJsPass(browser, server.url, sizeById(id), report);
    await diacriticsPass(browser, server.url, report);
    await variantPass(browser, report);
  } finally {
    await browser.close();
    await server.stop();
  }
  console.log(`  screenshots → ${SHOTS_DIR}`);
});
