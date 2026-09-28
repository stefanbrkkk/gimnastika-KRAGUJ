#!/usr/bin/env node
// §7 "The sticky bottom bar appears after the hero CTAs leave view, and hides over
// #kontakt and while the keyboard is open" + §5 header and booking-sheet behaviour.
// Contracts: [data-sticky-bar][data-visible], [data-site-header][data-hidden],
// [data-hero-ctas], [data-contact-block], [data-booking] triggers, <dialog> sheet.
//
// The on-screen keyboard cannot be opened in headless Chromium, so it is simulated
// the way the page detects it: visualViewport.height is shrunk and a visualViewport
// "resize" event is dispatched (then restored).
import { collectConsole, contextOptions, launch, sizeById, waitForIntro } from "./lib/browser.mjs";
import { BASE_URL, OUT, requireOut } from "./lib/env.mjs";
import { runScript } from "./lib/report.mjs";
import { ensureServed } from "./lib/server.mjs";

const barState = (page) =>
  page.evaluate(() => {
    const bar = document.querySelector("[data-sticky-bar]");
    if (!bar) return null;
    const r = bar.getBoundingClientRect();
    const cs = getComputedStyle(bar);
    return { attr: bar.getAttribute("data-visible"), onScreen: cs.display !== "none" && cs.visibility !== "hidden" && r.top < window.innerHeight - 8 && r.height > 0 };
  });

const headerHidden = (page) => page.evaluate(() => document.querySelector("[data-site-header]")?.getAttribute("data-hidden") ?? null);

async function scrollToY(page, y) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  await page.waitForTimeout(700);
}

async function stickyBar(browser, url, report, consoleLog) {
  const context = await browser.newContext(contextOptions(sizeById("390x844")));
  const page = await context.newPage();
  collectConsole(page, consoleLog);
  await page.goto(`${url}/`, { waitUntil: "load" });
  await waitForIntro(page);
  await page.waitForTimeout(600);
  if (!(await barState(page))) {
    report.fail("stickyBar.exists", "no [data-sticky-bar] element");
    await context.close();
    return;
  }
  const top = await barState(page);
  report.check("stickyBar.hiddenAtTop", top.attr === "false", `at the top (hero CTAs in view): data-visible="${top.attr}"`, top);

  const pastHero = await page.evaluate(() => {
    const el = document.querySelector("[data-hero-ctas]") ?? document.getElementById("top");
    return el.getBoundingClientRect().bottom + window.scrollY + 40;
  });
  await scrollToY(page, pastHero);
  const shown = await barState(page);
  report.check("stickyBar.showsAfterHeroCtas", shown.attr === "true" && shown.onScreen, `hero CTAs scrolled out: data-visible="${shown.attr}", on screen ${shown.onScreen}`, shown);

  const contactY = await page.evaluate(() => {
    const el = document.querySelector("[data-contact-block]") ?? document.getElementById("kontakt");
    const r = el.getBoundingClientRect();
    return r.top + window.scrollY - window.innerHeight / 3;
  });
  await scrollToY(page, contactY);
  const overContact = await barState(page);
  report.check("stickyBar.hidesOverContact", overContact.attr === "false", `contact block in view: data-visible="${overContact.attr}"`, overContact);

  // The whole S11 contact block (heading → CTA panel → channel list) must hide the bar,
  // not only its last part: scroll so that only the top of #kontakt is on screen.
  const kontaktTopY = await page.evaluate(() => {
    const el = document.getElementById("kontakt");
    return el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.7;
  });
  await scrollToY(page, kontaktTopY);
  const atKontaktTop = await barState(page);
  const blockInView = await page.evaluate(() => {
    const el = document.querySelector("[data-contact-block]");
    const r = el?.getBoundingClientRect();
    return !!r && r.bottom > 0 && r.top < window.innerHeight;
  });
  report.check(
    "stickyBar.hidesFromKontaktTop",
    !blockInView || atKontaktTop.attr === "false",
    `top of #kontakt in view (contact block in view: ${blockInView}): data-visible="${atKontaktTop.attr}"`,
  );

  // Bottom of the page: once the contact channels are scrolled away (venue card, footer),
  // the bar must be back so a parent can still call in one tap.
  await scrollToY(page, 1e7);
  const atEnd = await barState(page);
  const endBlockInView = await page.evaluate(() => {
    const el = document.querySelector("[data-contact-block]");
    const r = el?.getBoundingClientRect();
    return !!r && r.bottom > 0 && r.top < window.innerHeight;
  });
  report.check(
    "stickyBar.consistentAtPageEnd",
    endBlockInView ? atEnd.attr === "false" : atEnd.attr === "true",
    `max scroll: contact block in view ${endBlockInView}, data-visible="${atEnd.attr}"`,
  );

  const midY = await page.evaluate(() => document.getElementById("programi")?.getBoundingClientRect().top + window.scrollY);
  await scrollToY(page, midY);
  const back = await barState(page);
  report.check("stickyBar.showsAgain", back.attr === "true", `back in the page (#programi): data-visible="${back.attr}"`);

  await page.evaluate(() => {
    const vv = window.visualViewport;
    Object.defineProperty(vv, "height", { configurable: true, get: () => Math.round(window.innerHeight * 0.55) });
    vv.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(400);
  const keyboard = await barState(page);
  report.check("stickyBar.hidesWithKeyboard", keyboard.attr === "false", `simulated keyboard (visualViewport 55 %): data-visible="${keyboard.attr}"`);
  await page.evaluate(() => {
    delete window.visualViewport.height;
    window.visualViewport.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(400);
  const after = await barState(page);
  report.check("stickyBar.returnsAfterKeyboard", after.attr === "true", `keyboard closed: data-visible="${after.attr}"`);
  await context.close();

  const desktop = await browser.newContext(contextOptions(sizeById("1440x900")));
  const dpage = await desktop.newPage();
  collectConsole(dpage, consoleLog);
  await dpage.goto(`${url}/`, { waitUntil: "load" });
  await waitForIntro(dpage);
  await scrollToY(dpage, 2500);
  const d = await barState(dpage);
  report.check("stickyBar.mobileOnly", !d.onScreen, `1440×900: bar not on screen (data-visible="${d.attr}")`, d);
  await desktop.close();
}

async function header(browser, url, report, consoleLog) {
  for (const id of ["390x844", "1440x900"]) {
    const context = await browser.newContext(contextOptions(sizeById(id)));
    const page = await context.newPage();
    collectConsole(page, consoleLog);
    await page.goto(`${url}/`, { waitUntil: "load" });
    await waitForIntro(page);
    await page.mouse.move(200, 400);
    const start = await headerHidden(page);
    if (start === null) {
      report.fail(`header.exists.${id}`, "no [data-site-header] element");
      await context.close();
      continue;
    }
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, 250);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(600);
    const down = await headerHidden(page);
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, -150);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(600);
    const up = await headerHidden(page);
    report.check(`header.hideOnScrollDown.${id}`, start === "false" && down === "true", `top: data-hidden="${start}", after scrolling down: "${down}"`);
    report.check(`header.showOnScrollUp.${id}`, up === "false", `after scrolling up: data-hidden="${up}"`);
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 250);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector("[data-site-header] a[href], [data-site-header] button")?.focus());
    await page.waitForTimeout(500);
    const focused = await headerHidden(page);
    report.check(`header.showOnFocus.${id}`, focused === "false", `focus inside the hidden header: data-hidden="${focused}"`);
    await context.close();
  }
}

async function booking(browser, url, report, consoleLog) {
  const context = await browser.newContext(contextOptions(sizeById("390x844")));
  const page = await context.newPage();
  collectConsole(page, consoleLog);
  await page.goto(`${url}/`, { waitUntil: "load" });
  await waitForIntro(page);
  await page.waitForTimeout(800);
  const cta = page.locator("#top [data-hero-ctas] a[data-booking]").first();
  if (!(await cta.count())) {
    report.fail("booking.heroCta", "hero CTA a[data-booking] not found");
    await context.close();
    return;
  }
  await cta.click();
  const opened = await page
    .waitForFunction(() => !!document.querySelector("dialog[open]"), null, { timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  const state = await page.evaluate(() => ({
    hash: location.hash,
    focusInside: !!document.activeElement?.closest("dialog[open]"),
    modal: !!document.querySelector("dialog[open]:modal"),
  }));
  report.check("booking.opensFromHero", opened && state.hash !== "#kontakt", `hero CTA opens the booking sheet with JS (hash "${state.hash}")`, state);
  report.check("booking.focusInside", opened && state.focusInside && state.modal, "focus moves into the modal sheet (focus trap via showModal)", state);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  const closed = await page.evaluate(() => ({
    open: !!document.querySelector("dialog[open]"),
    focusReturned: !!document.activeElement?.closest("[data-hero-ctas]"),
  }));
  report.check("booking.escCloses", !closed.open, "Esc closes the sheet");
  report.check("booking.returnsFocus", closed.focusReturned, "focus returns to the hero CTA", closed);

  const grouped = page.locator('#programi a[data-booking]:not([data-booking=""])').first();
  if (await grouped.count()) {
    const label = await grouped.getAttribute("data-booking");
    await grouped.scrollIntoViewIfNeeded();
    await grouped.click();
    await page.waitForFunction(() => !!document.querySelector("dialog[open]"), null, { timeout: 4000 }).catch(() => {});
    const value = await page.evaluate(() => {
      const sel = document.querySelector('dialog[open] [name="group"]');
      return sel ? (sel.selectedOptions?.[0]?.textContent ?? sel.value) : null;
    });
    report.check("booking.prefillsGroup", value !== null && value.trim() === label.trim(), `program CTA prefills Grupa: „${value}“ (data-booking „${label}“)`);
    await page.keyboard.press("Escape");
  } else report.skip("booking.prefillsGroup", "no program CTA with a group label in #programi");
  await context.close();
}

/** COPY-01 guard: no link/button in the accessibility tree without a name (after a full scroll). */
async function accessibleNames(browser, url, report) {
  for (const sizeId of ["390x844", "1440x900"]) {
    const context = await browser.newContext(contextOptions(sizeById(sizeId)));
    const page = await context.newPage();
    await page.goto(`${url}/`, { waitUntil: "load" });
    await waitForIntro(page);
    for (let y = 0; y < 40000; y += 700) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(800);
    const cdp = await context.newCDPSession(page);
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    const empty = nodes.filter(
      (n) => !n.ignored && ["link", "button"].includes(n.role?.value) && !String(n.name?.value ?? "").trim(),
    );
    report.check(`a11y.names.${sizeId}`, empty.length === 0, `${empty.length} link(s)/button(s) without an accessible name`, empty.slice(0, 5).map((n) => n.backendDOMNodeId));
    await context.close();
  }
}

/** Desktop deep links never jump: no pin under a scrolled viewport, target lands under the header. */
async function heroDeepLink(browser, url, report) {
  const context = await browser.newContext(contextOptions(sizeById("1440x900")));
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  for (const hash of ["#programi", "#raspored", "#uspesi"]) {
    await page.goto(`${url}/${hash}`, { waitUntil: "load" });
    await page.waitForTimeout(3500);
    const r = await page.evaluate((h) => ({
      top: Math.round(document.querySelector(h).getBoundingClientRect().top),
      pin: !!document.querySelector(".pin-spacer"),
      cls: window.__cls,
    }), hash);
    const expectedTop = 88;
    report.check(`hero.deepLink${hash}`, Math.abs(r.top - expectedTop) <= 8 && !r.pin && r.cls < 0.05, `${hash}: top ${r.top}px (want ${expectedTop}±8), pin-spacer ${r.pin}, CLS ${r.cls.toFixed(3)}`, r);
  }
  await context.close();
}

/** Landscape phone: the menu sheet shows its call link without scrolling. */
async function landscapeMenu(browser, url, report) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(`${url}/`, { waitUntil: "load" });
  await waitForIntro(page);
  await page.waitForTimeout(600);
  const btn = page.locator(".site-header .menu-btn").first();
  if (!(await btn.count()) || !(await btn.isVisible())) {
    report.skip("menu.landscape", "no visible menu button at 844×390");
    await context.close();
    return;
  }
  await btn.click();
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const d = document.querySelector("dialog[open]");
    const tel = d?.querySelector('a[href^="tel:"]');
    const b = tel?.getBoundingClientRect();
    return { open: !!d, telBottom: b ? Math.round(b.bottom) : null, vh: window.innerHeight };
  });
  report.check("menu.landscape", r.open && r.telBottom !== null && r.telBottom <= r.vh, `844×390: sheet open ${r.open}, call link bottom ${r.telBottom} ≤ ${r.vh}`, r);
  await context.close();
}

/** If the booking dialog chunk cannot load, the CTA still lands on the contact block. */
async function bookingChunkFailure(browser, url, report) {
  const context = await browser.newContext(contextOptions(sizeById("390x844")));
  const page = await context.newPage();
  await page.route(/\/_next\/static\/chunks\/.*\.js$/, async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    if (body.includes("booking__body")) return route.abort();
    return route.fulfill({ response: res, body });
  });
  await page.goto(`${url}/`, { waitUntil: "load" });
  await waitForIntro(page);
  await page.waitForTimeout(1500);
  await page.locator("#top [data-hero-ctas] a[data-booking]").first().click();
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => ({
    main: !!document.querySelector("main#sadrzaj"),
    dialog: !!document.querySelector("dialog[open]"),
    top: Math.round(document.getElementById("kontakt").getBoundingClientRect().top),
  }));
  report.check("booking.chunkFailure", r.main && (r.dialog || (r.top >= -10 && r.top <= 220)), `dialog chunk blocked: page intact ${r.main}, dialog ${r.dialog}, #kontakt top ${r.top}px`, r);
  await context.close();
}

await runScript("behavior", { target: BASE_URL }, async (report) => {
  requireOut();
  const server = await ensureServed(BASE_URL, OUT);
  if (server.matchesOut === false) throw new Error(`${BASE_URL} serves a different build than ${OUT} — stop that server or set QA_BASE_URL to a free port`);
  const browser = await launch();
  const consoleLog = [];
  try {
    await stickyBar(browser, server.url, report, consoleLog);
    await header(browser, server.url, report, consoleLog);
    await booking(browser, server.url, report, consoleLog);
    await accessibleNames(browser, server.url, report);
    await heroDeepLink(browser, server.url, report);
    await landscapeMenu(browser, server.url, report);
    await bookingChunkFailure(browser, server.url, report);
  } finally {
    await browser.close();
    await server.stop();
  }
  report.check("console.clean", consoleLog.length === 0, `${consoleLog.length} console error(s)/warning(s) during the interactions`, consoleLog.slice(0, 8).map((c) => `${c.type}: ${c.text.slice(0, 200)}`));
});
