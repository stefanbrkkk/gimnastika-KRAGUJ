#!/usr/bin/env node
// §7 "Content test on out/" + image privacy + links + JSON-LD + SEO basics.
// Runs on the static export only (no server). FLAGS are read from content/site.ts
// with THIS process's env — pass the same NEXT_PUBLIC_* vars the build used.
//
// Scanned documents ("rendered output"): every *.html (visible text, attributes,
// inline RSC payload), *.txt RSC payloads, *.xml, *.webmanifest, *.json, *.ics.
// JS chunks are scanned too, but only as warnings: they can hold strings of
// flagged-off data (e.g. an FAQ entry behind FREE_TRIAL) that never render.
import { existsSync, readFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import sharp from "sharp";
import { OUT, ROOT, loadPhotos, loadSite, requireOut } from "./lib/env.mjs";
import { IMAGE_EXT, inspectMetadata } from "./lib/exif.mjs";
import { decodeEntities, jsonLdBlocks, tags, textOf, walk } from "./lib/html.mjs";
import { checkPhoto08 } from "./lib/pixelation.mjs";
import { runScript } from "./lib/report.mjs";
import { mayPublishPhoto } from "../content/photos.ts";

const L = "\\p{L}\\p{N}_";
/** Whole-word, Unicode-aware (JS \b is ASCII-only: it breaks on č ć š ž đ). */
const word = (body, flags = "u") => new RegExp(`(?<![${L}])(?:${body})(?![${L}])`, flags);

// ── Privacy: people ──────────────────────────────────────────────────────────
// The only people who may be named (§5 + credit + easter egg), plus the school
// and the street, which are named after people. Declined forms included.
const ALLOWED_NAME_TOKENS = [
  /^Slađan(a|e|i|u|om)$/u,
  /^Ivan(a|e|i|u|om)$/u,
  /^Stefan(a|u|om)?$/u,
  /^Nadi(a|e|ji|ju|jom)$/u,
  /^Comăneci$/u,
  /^Kovačević(a|u|em|i|e|ima)?$/u,
  /^Brkljačić(a|u|em)?$/u,
  /^Toz(a|e|i|u|om)$/u,
  /^Dragović(a|u|em)?$/u,
  /^Sav(a|e|i|u|om)$/u,
];
const isAllowedName = (token) => ALLOWED_NAME_TOKENS.some((re) => re.test(token));

// Common given names of Serbian girls/boys (nominative). Words that are also
// ordinary Serbian nouns (Nada, Vera, Zora, Dunja, Sofija, Mina, Una, Tara,
// Mila, Iskra, Sanja, Vuk, Lav, …) are deliberately left out to avoid false hits.
const GIVEN_NAMES = `Ana Andrea Anastasija Anđela Aleksandra Bojana Danijela Dragana Ema Emilija Ena Hana Isidora Iva Jana
Jelena Jovana Katarina Kristina Ksenija Lana Lara Lea Lena Lenka Magdalena Marija Marta Maša Mia Milena Milica Minja
Nađa Natalija Nataša Nevena Nikolina Nina Petra Sara Tamara Teodora Tijana Valentina Vanja Vasilija Zoja Aleksa Andrej
Bogdan David Dimitrije Dušan Đorđe Filip Jovan Lazar Luka Marko Matija Mihajlo Miloš Nemanja Nikola Ognjen Pavle Petar
Relja Strahinja Teodor Uroš Vasilije Veljko Viktor Vukašin`
  .split(/\s+/)
  .filter(Boolean);
const GIVEN_RE = word(GIVEN_NAMES.join("|"), "gu");
/** Capitalised words with a Serbian patronymic surname ending (-ić and declensions). */
const SURNAME_RE = word("\\p{Lu}\\p{Ll}*ić(?:a|u|em|i|e|om|ima)?", "gu");

// ── Privacy: dates ───────────────────────────────────────────────────────────
const KNOWN_EVENT_DATES = new Set(["2023-12-02", "2022-05-29", "2025-12-13", "2026-05-15", "2024-11-30", "2024-12-01"]);
const DATE_RES = [
  { re: /(?<!\d)(\d{1,2})\.\s?(\d{1,2})\.\s?((?:19|20)\d{2})(?!\d)/g, order: "dmy" },
  { re: /(?<!\d)((?:19|20)\d{2})-(\d{2})-(\d{2})(?!\d)/g, order: "ymd" },
];
const BIRTH_WORDS = word("rođen[aoi]?|rodjen[aoi]?|datum(?:a|om)? rođenja|godište\\s*:?\\s*(?:19|20)\\d{2}|god\\.\\s*rođ", "giu");

// ── 2023 results: no medal counts, no apparatus names ───────────────────────
const COUNT = "[1-9]\\d?|jedn[aoeu]|jedan|dv[ae]|dvije|tri|četiri|pet|šest|sedam|osam|devet|deset";
const MEDAL = "zlat\\p{L}*|srebr\\p{L}*|bronz\\p{L}*|medalj\\p{L}*|odličj\\p{L}*";
const MEDAL_COUNT_RES = [
  word(`(?:${COUNT})\\s*(?:[×x]\\s*)?(?:${MEDAL})`, "giu"),
  word(`(?:${MEDAL})\\s*(?:[×x:]\\s*)(?:[1-9]\\d?)`, "giu"),
];
const APPARATUS_RE = word("preskok\\p{L}*|gred[aeiou]\\p{L}*|parter\\p{L}*|razboj\\p{L}*|dvovisinsk\\p{L}*|vratil\\p{L}*|karik\\p{L}*|konj(?:u|a|em)?|višeboj\\p{L}*|viseboj\\p{L}*", "giu");

/** Links that are navigation, not evidence (not required in the dossier). */
const NAVIGATION = [/^https:\/\/www\.google\.com\/maps\//, /^https:\/\/calendar\.google\.com\//];

const snippet = (s, i, len = 60) => s.slice(Math.max(0, i - len), i + len).replace(/\s+/g, " ").trim();

/** Raw document text for privacy scans: entities decoded, JSON escapes undone, URLs and data: URIs dropped. */
function privacyCorpus(raw) {
  return decodeEntities(raw)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\"/g, '"')
    .replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, " ")
    .replace(/https?:\/\/[^\s"'<>)\\]+/g, " ")
    .replace(/(?<=["'(\s=])\/[\w./-]+/g, " ");
}

/** React flight lazy references are `$L` + a hex id, e.g. `"$Lea"` — the id can spell a name. */
const isFlightRef = (corpus, m) => corpus[m.index - 1] === "$" && /^L[0-9a-f]+$/.test(m[0]);

function scanNames(corpus) {
  const hits = [];
  for (const re of [GIVEN_RE, SURNAME_RE]) {
    for (const m of corpus.matchAll(re)) if (!isAllowedName(m[0]) && !isFlightRef(corpus, m)) hits.push({ token: m[0], context: snippet(corpus, m.index) });
  }
  return hits;
}

function scanDates(corpus) {
  const hits = [];
  for (const { re, order } of DATE_RES) {
    for (const m of corpus.matchAll(re)) {
      const [d, mo, y] = order === "dmy" ? [m[1], m[2], m[3]] : [m[3], m[2], m[1]];
      const year = Number(y);
      if (year > 2026 || Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) continue;
      const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (!KNOWN_EVENT_DATES.has(iso)) hits.push({ date: m[0], iso, context: snippet(corpus, m.index) });
    }
  }
  for (const m of corpus.matchAll(BIRTH_WORDS)) hits.push({ date: m[0], context: snippet(corpus, m.index) });
  return hits;
}

const urlTokens = (text) => new Set((text.match(/https?:\/\/[^\s"'`<>()[\]{}|*]+/g) ?? []).map((u) => u.replace(/[.,;:!?]+$/, "")));

function flatten(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => flatten(n, out));
  else if (node && typeof node === "object") {
    out.push(node);
    for (const v of Object.values(node)) flatten(v, out);
  }
  return out;
}

const hasType = (node, type) => (Array.isArray(node["@type"]) ? node["@type"].includes(type) : node["@type"] === type);
const roundTrips = (s) => {
  try {
    return encodeURIComponent(decodeURIComponent(s)) === s;
  } catch {
    return false;
  }
};

await runScript("content", { target: OUT }, async (report) => {
  requireOut();
  const site = await loadSite();
  const PHOTOS = await loadPhotos();
  const { FLAGS } = site;
  report.data.flags = FLAGS;
  report.info("flags", Object.entries(FLAGS).map(([k, v]) => `${k}=${v}`).join(" "));

  const files = walk(OUT);
  const rel = (f) => relative(OUT, f);
  const htmlFiles = files.filter((f) => f.endsWith(".html"));
  const docFiles = files.filter((f) => /\.(html|txt|xml|webmanifest|json|ics)$/.test(f));
  const jsFiles = files.filter((f) => f.endsWith(".js"));
  const imageFiles = files.filter((f) => IMAGE_EXT.test(f));
  const read = (f) => readFileSync(f, "utf8");
  const docs = new Map(docFiles.map((f) => [f, read(f)]));
  const js = new Map(jsFiles.map((f) => [f, read(f)]));
  const indexHtml = docs.get(join(OUT, "index.html"));

  /** Pattern over docs (fail) and JS (warn). */
  const scan = (id, re, what, { jsSeverity = "warn" } = {}) => {
    const docHits = [];
    for (const [f, text] of docs) for (const m of text.matchAll(re)) docHits.push(`${rel(f)}: …${snippet(text, m.index, 50)}…`);
    report.check(id, docHits.length === 0, docHits.length ? `${what} in rendered output (${docHits.length})` : `no ${what} in rendered output`, docHits.slice(0, 12));
    const jsHits = [];
    for (const [f, text] of js) for (const m of text.matchAll(re)) jsHits.push(`${rel(f)}: …${snippet(text, m.index, 40)}…`);
    if (jsHits.length) report[jsSeverity](`${id}.js`, `${what} inside JS chunks (${jsHits.length}) — check it cannot render`, jsHits.slice(0, 8));
  };

  // 1 ─ Flags & forbidden content ────────────────────────────────────────────
  if (!FLAGS.FREE_TRIAL) scan("copy.noFreeTrial", word("besplat\\p{L}*", "giu"), '"besplatan/besplatno" (FREE_TRIAL=false)');
  else report.skip("copy.noFreeTrial", "FREE_TRIAL=true");
  scan("jsonld.noFoundingDate", /foundingDate/g, "foundingDate", { jsSeverity: "fail" });
  if (!FLAGS.SHOW_FACEBOOK) scan("links.noFacebook", /facebook\.com/gi, "Facebook links (SHOW_FACEBOOK=false)");
  else report.skip("links.noFacebook", "SHOW_FACEBOOK=true");
  if (!FLAGS.SHOW_VIBER) scan("links.noViber", /viber:\/\//g, "viber:// links (SHOW_VIBER=false)");
  for (const [id, re] of MEDAL_COUNT_RES.entries()) {
    const hits = [];
    for (const [f, text] of docs) {
      const t = f.endsWith(".html") ? `${textOf(text)} ${tags(text, "img").map((a) => a.alt ?? "").join(" ")}` : text;
      for (const m of t.matchAll(re)) hits.push(`${rel(f)}: …${snippet(t, m.index, 50)}…`);
    }
    report.check(`results.noMedalCounts${id ? "Alt" : ""}`, hits.length === 0, hits.length ? `medal counts in rendered output` : "no medal counts (e.g. „2 zlata“, „4 bronze“)", hits.slice(0, 10));
  }

  // 2 ─ DOM checks on index.html / 404.html (JS off, no network) ─────────────
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(indexHtml, { waitUntil: "domcontentloaded" });
    const dom = await page.evaluate(
      ({ apparatus }) => {
        const APP = new RegExp(apparatus, "iu");
        const attrText = (el) =>
          [el, ...el.querySelectorAll("*")]
            .flatMap((n) => ["alt", "aria-label", "title", "aria-description"].map((a) => n.getAttribute?.(a) ?? ""))
            .join(" ");
        const textOfEl = (el) => `${el.textContent ?? ""} ${attrText(el)}`.replace(/\s+/g, " ").trim();
        const results = document.getElementById("uspesi");
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const blocks = new Set();
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!/2023/.test(n.nodeValue ?? "") || n.parentElement?.closest("script,style")) continue;
          const block = n.parentElement?.closest("li, p, dd, dt, tr, figure, article, blockquote") ?? n.parentElement;
          if (block) blocks.add(block);
        }
        const h1s = [...document.querySelectorAll("h1")].map((h) => h.textContent?.replace(/\s+/g, " ").trim());
        const ids = new Set([...document.querySelectorAll("[id]")].map((e) => e.id));
        const anchors = [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute("href"));
        return {
          resultsFound: !!results,
          resultsApparatus: results ? (textOfEl(results).match(APP) ?? [null])[0] : null,
          blocks2023: [...blocks].map((b) => {
            const t = textOfEl(b);
            return { text: t.slice(0, 200), apparatus: (t.match(APP) ?? [null])[0] };
          }),
          h1s,
          missingAnchors: [...new Set(anchors)].filter((h) => h.length > 1 && !ids.has(decodeURIComponent(h.slice(1)))),
          headingText: [...document.querySelectorAll("h1,h2,h3")].map((h) => h.textContent ?? "").join(" · "),
          visibleText: (() => {
            const clone = document.body.cloneNode(true);
            clone.querySelectorAll("script, style, template").forEach((n) => n.remove());
            return clone.textContent ?? "";
          })(),
          lang: document.documentElement.getAttribute("lang"),
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null,
          canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
          robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
          ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null,
          heroCta: document.querySelector("#top [data-hero-ctas] a")?.getAttribute("href") ?? null,
          links: [...document.querySelectorAll("a[href]")].map((a) => ({
            href: a.getAttribute("href"),
            source: a.hasAttribute("data-source-url"),
            text: (a.textContent ?? "").trim().slice(0, 60),
          })),
        };
      },
      { apparatus: APPARATUS_RE.source },
    );
    report.data.links = dom.links.length;

    // Results: apparatus names never appear in #uspesi, nor next to any "2023".
    report.check("results.section", dom.resultsFound, "section#uspesi exists");
    report.check("results.noApparatus", !dom.resultsApparatus, dom.resultsApparatus ? `apparatus name „${dom.resultsApparatus}“ in #uspesi` : "no apparatus names in #uspesi");
    const app2023 = dom.blocks2023.filter((b) => b.apparatus);
    report.check("results.2023.noApparatus", app2023.length === 0, `blocks mentioning 2023: ${dom.blocks2023.length}; with apparatus names: ${app2023.length}`, app2023);
    const counts2023 = dom.blocks2023.filter((b) => MEDAL_COUNT_RES.some((re) => new RegExp(re.source, "iu").test(b.text)));
    report.check("results.2023.noCounts", counts2023.length === 0, `blocks mentioning 2023 with medal counts: ${counts2023.length}`, counts2023);

    // Structure & SEO basics.
    report.check("html.lang", dom.lang === "sr-Latn", `<html lang="${dom.lang}">`);
    report.check("html.oneH1", dom.h1s.length === 1, `${dom.h1s.length} <h1> on /`, dom.h1s);
    const { HERO_H1, SEO, SITE_URL, EMAIL, PHONES, SOCIAL, GSS, CLUB, VENUE } = { HERO_H1: "Sportska gimnastika za decu u Kragujevcu", ...site };
    report.check("html.h1Text", dom.h1s[0] === HERO_H1, `H1 is „${dom.h1s[0]}“`);
    report.check("seo.title", dom.title === SEO.title, "title matches §5", dom.title);
    report.check("seo.description", dom.description === SEO.description, "meta description matches §5", dom.description);
    const norm = (u) => (u ?? "").replace(/\/+$/, "");
    report.check("seo.canonical", norm(dom.canonical) === norm(SITE_URL), `canonical ${dom.canonical}`, { expected: SITE_URL });
    const noindex = /noindex/i.test(dom.robots ?? "");
    report.check("seo.robotsMeta", FLAGS.INDEXABLE ? !noindex : noindex, `meta robots "${dom.robots}" with INDEXABLE=${FLAGS.INDEXABLE}`);
    const sitemapFile = join(OUT, "sitemap.xml");
    const sitemapUrls = existsSync(sitemapFile) ? (read(sitemapFile).match(/<url>/g) ?? []).length : 0;
    report.check("seo.sitemap", FLAGS.INDEXABLE ? sitemapUrls > 0 : sitemapUrls === 0, `sitemap.xml has ${sitemapUrls} <url> entries with INDEXABLE=${FLAGS.INDEXABLE}`);
    const robotsTxt = existsSync(join(OUT, "robots.txt")) ? read(join(OUT, "robots.txt")) : null;
    report.check("seo.robotsTxt", robotsTxt !== null, robotsTxt === null ? "robots.txt missing" : "robots.txt exists");
    if (robotsTxt !== null && FLAGS.INDEXABLE) report.check("seo.robotsTxt.sitemap", /^sitemap:/im.test(robotsTxt), "robots.txt points to the sitemap (INDEXABLE=true)");
    if (dom.ogImage) {
      const ogPath = join(OUT, decodeURIComponent(new URL(dom.ogImage, SITE_URL).pathname));
      report.check("seo.ogImage", existsSync(ogPath), `og:image ${dom.ogImage} → ${rel(ogPath)}`);
    } else report.fail("seo.ogImage", "no og:image meta");
    const headings = dom.headingText.toLowerCase();
    const missingPhrases = ["sportsk", "gimnastik", "za decu", "kragujev", "aerobn", "upis"].filter((p) => !headings.includes(p));
    report.check("seo.headingKeywords", missingPhrases.length === 0, "headings mention sportska gimnastika / za decu / Kragujevac / aerobna / upis", { missing: missingPhrases }, { severity: "warn" });
    report.check("nojs.heroCta", dom.heroCta === "#kontakt", `primary hero CTA href="${dom.heroCta}" (no-JS fallback)`);
    report.check("links.inPageAnchors", dom.missingAnchors.length === 0, `a[href^="#"] without a matching id: ${dom.missingAnchors.length}`, dom.missingAnchors);

    // External links ↔ dossier; contact hrefs well-formed.
    const dossierUrls = urlTokens(read(join(ROOT, "docs/dosije.md")));
    const origin = new URL(SITE_URL).origin;
    const external = dom.links.filter((l) => /^https?:\/\//.test(l.href));
    const notInDossier = external.filter((l) => {
      if (NAVIGATION.some((re) => re.test(l.href))) return false;
      if (new URL(l.href).origin === origin) return false;
      return !dossierUrls.has(l.href);
    });
    report.check("sources.inDossier", notInDossier.length === 0, `${external.length} external links; not in docs/dosije.md: ${notInDossier.length}`, notInDossier);
    const sourceLinks = dom.links.filter((l) => l.source || /(^|\.)(gssrb|glassumadije)\.rs$/.test(/^https?:/.test(l.href) ? new URL(l.href).hostname : ""));
    report.info("sources.count", `${sourceLinks.length} source links (data-source-url or gssrb.rs/glassumadije.rs)`);
    const allowedTel = new Set(PHONES.map((p) => `tel:${p.e164}`));
    const bad = [];
    for (const { href } of dom.links) {
      if (href.startsWith("tel:") && !allowedTel.has(href)) bad.push(href);
      if (href.startsWith("sms:")) {
        const m = href.match(/^sms:(\+381\d{8,9})(?:\?&body=(.*))?$/);
        if (!m || !PHONES.some((p) => p.e164 === m[1]) || (m[2] !== undefined && !roundTrips(m[2]))) bad.push(href);
      }
      if (href.startsWith("mailto:")) {
        const m = href.match(/^mailto:([^?]+)(?:\?subject=([^&]*)(?:&body=(.*))?)?$/);
        if (!m || m[1] !== EMAIL || (m[2] !== undefined && !roundTrips(m[2])) || (m[3] !== undefined && !roundTrips(m[3]))) bad.push(href);
      }
      if (href.startsWith("viber:") && !/^viber:\/\/chat\?number=%2B381\d{8,9}$/.test(href)) bad.push(href);
    }
    report.check("links.contactFormats", bad.length === 0, `malformed or unknown tel/sms/mailto/viber hrefs: ${bad.length}`, bad);
    const hrefs = new Set(dom.links.map((l) => l.href));
    const missing = [...PHONES.map((p) => `tel:${p.e164}`), `mailto:${EMAIL}`, SOCIAL.instagram].filter((h) => ![...hrefs].some((x) => x === h || x.startsWith(`${h}?`)));
    report.check("links.contactsPresent", missing.length === 0, `both phones, the email and Instagram linked on / (missing: ${missing.length})`, missing);

    // 404 page.
    const notFound = docs.get(join(OUT, "404.html"));
    if (!notFound) report.fail("404.exists", "out/404.html missing");
    else {
      await page.setContent(notFound, { waitUntil: "domcontentloaded" });
      const nf = await page.evaluate(() => ({
        text: document.body.textContent ?? "",
        home: [...document.querySelectorAll("a")].find((a) => /Nazad na početnu/.test(a.textContent ?? ""))?.getAttribute("href") ?? null,
        h1: document.querySelectorAll("h1").length,
      }));
      report.check("404.copy", nf.text.replace(/\s+/g, " ").includes("Ups — ova stranica je izgubila ravnotežu."), "404 shows „Ups — ova stranica je izgubila ravnotežu.“");
      report.check("404.home", nf.home === "/", `„Nazad na početnu“ → ${nf.home}`);
      report.check("404.h1", nf.h1 === 1, `404 has ${nf.h1} <h1>`);
    }

    // JSON-LD (§5).
    const blocks = jsonLdBlocks(indexHtml);
    const parsed = [];
    for (const [i, b] of blocks.entries()) {
      try {
        parsed.push(JSON.parse(b));
      } catch (err) {
        report.fail("jsonld.parse", `block ${i} does not parse: ${err.message}`);
      }
    }
    report.check("jsonld.present", parsed.length > 0, `${blocks.length} JSON-LD block(s), ${parsed.length} parsed`);
    const nodes = flatten(parsed);
    const club = nodes.find((n) => hasType(n, "SportsClub"));
    if (!club) report.fail("jsonld.sportsClub", "no SportsClub node");
    else {
      const addr = club.address ?? club.location?.address ?? {};
      const same = [].concat(club.sameAs ?? []);
      const alt = [].concat(club.alternateName ?? []);
      const expectations = [
        ["name", club.name === CLUB.legalName, club.name],
        ["alternateName", alt.length === 2 && alt.includes("Gimnastički klub Kraguj") && alt.includes("Sportska Gimnastika Kraguj"), alt],
        ["telephone", club.telephone === "+381600287631", club.telephone],
        ["email", club.email === EMAIL, club.email],
        ["address", addr.streetAddress === VENUE.street && addr.postalCode === VENUE.postalCode && addr.addressLocality === VENUE.city && addr.addressCountry === VENUE.country, addr],
        ["sameAs.instagram", same.includes(SOCIAL.instagram), same],
        ["sameAs.facebook", FLAGS.SHOW_FACEBOOK ? same.includes(SOCIAL.facebook) : !same.some((u) => /facebook/.test(u)), same],
        [
          "memberOf",
          hasType(club.memberOf ?? {}, "SportsOrganization") && club.memberOf?.name === GSS.name && norm(club.memberOf?.url) === norm(GSS.url),
          club.memberOf,
        ],
        ["noFoundingDate", !JSON.stringify(parsed).includes("foundingDate"), "foundingDate present"],
      ];
      for (const [key, ok, got] of expectations) report.check(`jsonld.sportsClub.${key}`, ok, `SportsClub ${key}`, got);
    }
    const faq = nodes.find((n) => hasType(n, "FAQPage"));
    if (!faq) report.fail("jsonld.faqPage", "no FAQPage node");
    else {
      const qs = [].concat(faq.mainEntity ?? []);
      const flat = dom.visibleText.replace(/\s+/g, " ");
      const invisible = qs.filter((q) => !flat.includes(q.name) || !flat.includes(q.acceptedAnswer?.text ?? "\u0000"));
      report.check("jsonld.faqPage", qs.length >= 7 && invisible.length === 0, `FAQPage with ${qs.length} questions, all visible on the page`, invisible.map((q) => q.name));
    }
    await context.close();
  } finally {
    await browser.close();
  }

  // 3 ─ Privacy: names & birth dates (documents) ─────────────────────────────
  const nameHits = [];
  const dateHits = [];
  for (const [f, text] of docs) {
    if (f.endsWith(".ics")) continue; // DTSTART/DTSTAMP are machine dates; names checked below via html/txt
    const corpus = privacyCorpus(text);
    for (const h of scanNames(corpus)) nameHits.push({ file: rel(f), ...h });
    if (!/\.(xml|webmanifest)$/.test(f)) for (const h of scanDates(corpus)) dateHits.push({ file: rel(f), ...h });
  }
  for (const f of docFiles.filter((x) => x.endsWith(".ics"))) {
    const corpus = privacyCorpus(read(f).replace(/^(DTSTART|DTEND|DTSTAMP|RRULE|LAST-MODIFIED|CREATED|UID|TZ\w+)[^\n]*$/gm, ""));
    for (const h of scanNames(corpus)) nameHits.push({ file: rel(f), ...h });
    for (const h of scanDates(corpus)) dateHits.push({ file: rel(f), ...h });
  }
  const uniq = (arr, key) => [...new Map(arr.map((x) => [key(x), x])).values()];
  const names = uniq(nameHits, (h) => `${h.token}|${h.context}`);
  report.check("privacy.noMinorNames", names.length === 0, names.length ? `${names.length} name-like token(s) outside the allow-list` : "no person names except the allow-list (Slađana/Ivana Kovačević, Stefan Brkljačić, Nadia Comăneci, „Toza Dragović“, Save Kovačevića)", names.slice(0, 15));
  const dates = uniq(dateHits, (h) => `${h.date}|${h.context}`);
  report.check("privacy.noBirthDates", dates.length === 0, dates.length ? `${dates.length} unknown date(s) / birth-date wording` : "no birth dates (only the known event dates)", dates.slice(0, 15));

  // 4 ─ Images: EXIF, photo 08, hidden photos pruned, references resolve ─────
  const exifFiles = [];
  const xmpFiles = [];
  for (const f of imageFiles) {
    const buf = readFileSync(f);
    const m = inspectMetadata(buf);
    let sharpExif = false;
    try {
      sharpExif = !!(await sharp(buf).metadata()).exif;
    } catch {
      /* not decodable by sharp (e.g. .ico) — container scan still applies */
    }
    if (m.exif.length || sharpExif) exifFiles.push({ file: rel(f), found: m.exif.length ? m.exif : ["sharp metadata().exif"] });
    if (m.xmp.length || m.iptc.length) xmpFiles.push({ file: rel(f), found: [...m.xmp, ...m.iptc] });
  }
  report.check("images.noExif", exifFiles.length === 0, `${imageFiles.length} images scanned, ${exifFiles.length} with EXIF`, exifFiles);
  report.check("images.noXmpIptc", xmpFiles.length === 0, `${xmpFiles.length} images with XMP/IPTC`, xmpFiles, { severity: "warn" });

  const slug08 = PHOTOS["08"].slug;
  const files08 = imageFiles.filter((f) => basename(f).startsWith(`${slug08}-`) && /\.(avif|webp|jpe?g|png)$/.test(f));
  if (files08.length === 0) report.skip("images.photo08", `no ${slug08}-* files in out/ (hidden under the current flags)`);
  for (const f of files08) {
    const r = await checkPhoto08(f);
    report.check(`images.photo08.${basename(f, extname(f))}${extname(f)}`, r.pixelated && r.controlLooksNatural, `pixelated face stays pixelated (median block σ ${r.mosaic.medianStd}, edge ratio ${r.mosaic.ratio})`, r);
  }

  const hidden = Object.values(PHOTOS).filter((p) => !mayPublishPhoto(p, FLAGS));
  report.info("images.hidden", `photos withheld by per-ID publication rights and flags: ${hidden.map((p) => p.id).join(", ") || "none"}`);
  const leftovers = imageFiles.filter((f) => hidden.some((p) => basename(f).startsWith(`${p.slug}-`)));
  report.check("images.hiddenPruned", leftovers.length === 0, `files of hidden photos left in out/: ${leftovers.length}`, leftovers.map(rel));
  const referenced = [];
  for (const [f, text] of [...docs, ...js]) for (const p of hidden) if (text.includes(`/img/${p.slug}-`)) referenced.push(`${rel(f)} → ${p.slug}`);
  report.check("images.hiddenUnreferenced", referenced.length === 0, `references to hidden photos: ${referenced.length}`, referenced);
  for (const p of Object.values(PHOTOS).filter((x) => x.campGroup && !FLAGS.CAMP_GROUP_PHOTOS)) {
    report.check(`images.campGroup.${p.id}`, !indexHtml.includes(`data-photo-id="${p.id}"`), `photo ${p.id} absent (CAMP_GROUP_PHOTOS=false)`);
  }

  // 5 ─ Calendar: .ics files parse (ical.js) with VTIMEZONE; Google links well-formed.
  const icsFiles = docFiles.filter((f) => f.endsWith(".ics"));
  if (icsFiles.length === 0) report.warn("ics.present", "no .ics files in out/");
  const { default: ICAL } = await import("ical.js");
  for (const f of icsFiles) {
    const raw = readFileSync(f);
    const text = raw.toString("utf8");
    const problems = [];
    if (/[^\r]\n/.test(text)) problems.push("bare LF line ending");
    const longLines = text.split("\r\n").filter((l) => Buffer.byteLength(l, "utf8") > 75);
    if (longLines.length) problems.push(`${longLines.length} line(s) > 75 octets`);
    try {
      const cal = new ICAL.Component(ICAL.parse(text));
      const tz = cal.getAllSubcomponents("vtimezone").map((c) => c.getFirstPropertyValue("tzid"));
      if (!tz.includes("Europe/Belgrade")) problems.push("no VTIMEZONE Europe/Belgrade");
      const events = cal.getAllSubcomponents("vevent");
      if (events.length === 0) problems.push("no VEVENT");
      for (const ev of events) {
        for (const prop of ["uid", "dtstamp", "dtstart", "rrule"]) if (!ev.hasProperty(prop)) problems.push(`VEVENT without ${prop.toUpperCase()}`);
        if (ev.getFirstProperty("dtstart")?.getParameter("tzid") !== "Europe/Belgrade") problems.push("DTSTART without TZID=Europe/Belgrade");
        const rrule = ev.getFirstPropertyValue("rrule");
        if (rrule && (rrule.freq !== "WEEKLY" || !rrule.parts?.BYDAY?.length)) problems.push(`RRULE ${rrule.toString()}`);
      }
    } catch (err) {
      problems.push(`ical.js: ${err.message}`);
    }
    report.check(`ics.${basename(f)}`, problems.length === 0, "parses with ical.js, VTIMEZONE Europe/Belgrade, CRLF, ≤75-octet lines, weekly RRULE", [...new Set(problems)]);
  }
  // Google links live in rendered hrefs (S4 era) and, since the Programs×Schedule
  // merge, in the RSC flight payload of the detail sheets (`href":"…`, `&` as \u0026).
  const gcal = [
    ...indexHtml.matchAll(/href="(https:\/\/calendar\.google\.com\/[^"]*)"/g),
    ...indexHtml.matchAll(/href\\":\\?"?(https:\/\/calendar\.google\.com\/(?:[^"\\]|\\u0026)*)/g),
  ].map((m) => decodeEntities(m[1].replace(/\\u0026/g, "&")));
  const badGcal = gcal.filter((href) => {
    const u = new URL(href);
    const q = u.searchParams;
    return (
      u.pathname !== "/calendar/render" ||
      q.get("action") !== "TEMPLATE" ||
      !q.get("text") ||
      !/^\d{8}T\d{6}\/\d{8}T\d{6}$/.test(q.get("dates") ?? "") ||
      q.get("ctz") !== "Europe/Belgrade" ||
      !/^RRULE:FREQ=WEEKLY;BYDAY=[A-Z,]+$/.test(q.get("recur") ?? "")
    );
  });
  report.check("links.googleCalendar", gcal.length > 0 && badGcal.length === 0, `${gcal.length} Google Calendar link(s): action=TEMPLATE, dates, ctz=Europe/Belgrade, recur=RRULE:FREQ=WEEKLY;BYDAY=…`, badGcal);

  // Local references in HTML resolve to files in out/.
  const broken = [];
  for (const f of htmlFiles) {
    const html = docs.get(f);
    const refs = [
      ...[...html.matchAll(/\s(?:src|href)="(\/[^"]*)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/\ssrcset="([^"]*)"/gi)].flatMap((m) => decodeEntities(m[1]).split(",").map((s) => s.trim().split(/\s+/)[0])),
    ].filter((u) => u && u.startsWith("/") && !u.startsWith("//"));
    for (const u of new Set(refs)) {
      const path = decodeURIComponent(decodeEntities(u).split(/[?#]/)[0]);
      const candidates = path.endsWith("/") ? [join(OUT, path, "index.html")] : [join(OUT, path), join(OUT, `${path}.html`)];
      if (!candidates.some((c) => existsSync(c))) broken.push(`${rel(f)} → ${u}`);
    }
  }
  report.check("links.localResolve", broken.length === 0, `local src/href/srcset in the HTML missing from out/: ${broken.length}`, broken.slice(0, 20));
});
