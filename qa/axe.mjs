#!/usr/bin/env node
// §7 axe-core: 0 serious/critical violations on / and /404.html at 390×844 and
// 1440×900 (after scrolling through, so lazy islands are mounted), plus the open
// booking sheet at 390×844. Moderate/minor violations are listed as warnings.
// Rules: WCAG 2.0/2.1/2.2 A+AA and axe best practices.
import * as axeModule from "@axe-core/playwright";
import { contextOptions, launch, scrollThrough, scrollToTop, settle, sizeById, waitForIntro } from "./lib/browser.mjs";
import { BASE_URL, OUT, requireOut } from "./lib/env.mjs";
import { runScript } from "./lib/report.mjs";
import { ensureServed } from "./lib/server.mjs";

const AxeBuilder = axeModule.default?.default ?? axeModule.default ?? axeModule.AxeBuilder;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const BLOCKING = new Set(["serious", "critical"]);

const summarise = (violations) =>
  violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.length,
    targets: v.nodes.slice(0, 5).map((n) => `${n.target.join(" ")}${n.failureSummary ? ` — ${n.failureSummary.split("\n").slice(1, 2).join("").trim()}` : ""}`),
  }));

function record(report, id, result) {
  const blocking = result.violations.filter((v) => BLOCKING.has(v.impact));
  const other = result.violations.filter((v) => !BLOCKING.has(v.impact));
  report.data[id] = { violations: summarise(result.violations), incomplete: result.incomplete.map((v) => v.id), passes: result.passes.length };
  report.check(`axe.${id}`, blocking.length === 0, `${blocking.length} serious/critical, ${other.length} moderate/minor, ${result.passes.length} rules pass`, summarise(blocking));
  if (other.length) report.warn(`axe.${id}.minor`, other.map((v) => `${v.id} (${v.impact}, ${v.nodes.length})`).join(", "), summarise(other));
  if (result.incomplete.length) report.info(`axe.${id}.review`, `needs manual review: ${result.incomplete.map((v) => v.id).join(", ")}`);
}

await runScript("axe", { target: BASE_URL }, async (report) => {
  requireOut();
  const server = await ensureServed(BASE_URL, OUT);
  if (server.matchesOut === false) throw new Error(`${BASE_URL} serves a different build than ${OUT} — stop that server or set QA_BASE_URL to a free port`);
  const browser = await launch();
  try {
    for (const path of ["/", "/404.html"]) {
      for (const sizeId of ["390x844", "1440x900"]) {
        const context = await browser.newContext(contextOptions(sizeById(sizeId)));
        const page = await context.newPage();
        await page.goto(`${server.url}${path}`, { waitUntil: "load" });
        await waitForIntro(page);
        await scrollThrough(page, { delay: 150 });
        await scrollToTop(page);
        await settle(page, { extra: 800 });
        const id = `${path === "/" ? "home" : "404"}.${sizeId}`;
        record(report, id, await new AxeBuilder({ page }).withTags(TAGS).analyze());

        if (path === "/" && sizeId === "390x844") {
          const cta = page.locator("#top [data-hero-ctas] a[data-booking]").first();
          if (await cta.count()) {
            await cta.click();
            const open = await page
              .waitForFunction(() => !!document.querySelector("dialog[open]"), null, { timeout: 4000 })
              .then(() => true)
              .catch(() => false);
            if (open) {
              await page.waitForTimeout(700);
              record(report, "booking.390x844", await new AxeBuilder({ page }).include("dialog[open]").withTags(TAGS).analyze());
            } else report.skip("axe.booking.390x844", "booking sheet did not open");
          }
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await server.stop();
  }
});
