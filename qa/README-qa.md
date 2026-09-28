# QA toolchain — GSU „Kraguj“

Automated checks for every §7 acceptance criterion of `docs/master-prompt.md` that a
machine can verify, run exactly as §10 describes. Plain Node ESM scripts (Node ≥ 22.18)
using Playwright's Chromium, `@axe-core/playwright`, Lighthouse, sharp and zlib.
Every script prints `PASS/FAIL/WARN/SKIP/INFO` lines, writes a JSON result and exits
non-zero when a check fails.

## One command

```bash
npm run qa            # = node qa/run-all.mjs
```

Sequence: `npm run lint` → `npm test` → build the **MINOR_PHOTOS=false** and
**INDEXABLE=true** variants (via `NEXT_PUBLIC_*` env, DECISIONS D-07) → `npm run build`
(default, last) → serve `out/` on **4173** → `bundle`, `content`, `shots` (+ the
MINOR_PHOTOS=false variant), `trace`, `behavior`, `axe`, `lighthouse` (+ SEO on the
INDEXABLE=true variant) → `content` on both variants → `qa/report.json` with a readable
summary (printed, and in `qa/trace/summary.md`). Takes ~6–8 minutes.

- Stop anything serving on 4173/4174/4175 first (run-all serves the build itself and
  refuses to start otherwise), or set `QA_PORT` (variants use `QA_PORT+1`, `+2`).
- `out/` always ends as the **default** build. If the default build fails, the `out/`
  that existed before the run is restored.
- Variants land in `qa/variants/<name>/out` when `.gitignore` and `eslint.config.mjs`
  both ignore `qa/variants/`; otherwise in `<os tmp>/gsu-kraguj-qa-variants/<name>/out`
  (built files inside the repo would be scanned by Tailwind and linted by `eslint .`).
  Override with `QA_VARIANTS_DIR`.
- Skip steps with `QA_SKIP=lint,test,build,variants,bundle,content,shots,trace,behavior,axe,lighthouse`.
- `QA_LH_RUNS` (default 3): Lighthouse runs; the median Performance run is reported.

## Scripts (each also runs on its own)

Standalone scripts check `QA_OUT` (default `out`) served at `QA_BASE_URL` (default
`http://localhost:4173`). If nothing answers there, they start `serve` on that port
themselves and stop it afterwards (`QA_AUTOSERVE=0` disables that). If a server answers
but serves a different `index.html` than `QA_OUT`, they stop with an error instead of
checking a stale build.

| Script | §7 / §10 | What it asserts |
|---|---|---|
| `qa/bundle.mjs` | first-load JS, animation chunk, hero SVG | gzip-9 of every `<script src>` in `out/index.html`: **module scripts ≤ 160 KB** (noModule polyfills reported separately, D-08); GSAP not in first load; **initial animation chunk ≤ 45 KB** = GSAP chunks requested before `performance.mark("kraguj:intro-start")` at 1440×900 (static signature scan — `GreenSockGlobals`, `name:"motionPath"`, `kraguj:intro-start` — when no browser run is possible, `QA_BUNDLE_RUNTIME=0`); **hero SVG ≤ 22 KB** = inline sprite + every `<svg>` in `section#top` |
| `qa/content.mjs` | content test, image test, link test, JSON-LD | on `out/`: no „besplatan/besplatno“ (FREE_TRIAL=false), no `foundingDate`, no Facebook link (SHOW_FACEBOOK=false), no `viber://` (SHOW_VIBER=false), no 2023 medal counts, no apparatus names in `#uspesi` or in any block mentioning 2023, no minors' names (allow-list below), no birth dates (allow-listed event dates), no EXIF (XMP/IPTC warn) in any image, photo 08 stays pixelated, hidden photos pruned and unreferenced, 02/09 absent, every external link in docs/dosije.md, tel/sms/mailto/viber well-formed, every `.ics` parses with ical.js (VTIMEZONE Europe/Belgrade, CRLF, ≤ 75-octet lines, weekly RRULE) and Google Calendar links are well-formed, JSON-LD parses and matches §5, title/description/canonical/robots/sitemap vs INDEXABLE, one H1, 404 copy, in-page anchors and local files resolve |
| `qa/shots.mjs` | 4 sizes, JS off, reduced motion, photos ≤ native/2, diacritics, MINOR_PHOTOS=false | screenshots in `qa/shots/` (look at them) + overflow, tap-target, photo-width, clipped-text checks; see below |
| `qa/trace.mjs` | hero filmstrip, intro ≤ 1.9 s, pin rule, console, long tasks | filmstrips in `qa/trace/filmstrip-*.png`; see below |
| `qa/behavior.mjs` | sticky bar, header, booking sheet | sticky bar hidden at the top, shown once the hero CTAs are above the viewport, hidden over `[data-contact-block]` and with the keyboard open (simulated by shrinking `visualViewport.height` + a `resize` event), never on desktop; header hides after scrolling down, returns on scroll-up and on focus; hero CTA opens the `<dialog>` with focus inside, Esc closes and returns focus; program CTAs prefill „Grupa“ |
| `qa/axe.mjs` | axe-core | `/` and `/404.html` at 390×844 and 1440×900 (after a full scroll) plus the open booking sheet: **0 serious/critical**; moderate/minor listed as warnings; WCAG 2.0–2.2 A/AA + best practice |
| `qa/lighthouse.mjs` | Lighthouse | Playwright's Chromium via `CHROME_PATH`, `--form-factor=mobile --chrome-flags="--headless=new --no-sandbox"`: **Performance ≥ 90** (median), **Accessibility 100**, **Best Practices ≥ 95**, LCP ≤ 2.5 s (warn > 2.0 s), CLS ≤ 0.05, TBT ≤ 150 ms; **SEO 100 on an INDEXABLE=true build** (`QA_LH_SEO_OUT=<dir>` or `QA_LH_SEO_URL=<url>`); on the default noindex build only `is-crawlable` may fail. Reports: `qa/lh.report.html/.json`, `qa/lh-runs/`, `qa/lh-seo.report.*` |
| `qa/run-all.mjs` | §10 | the whole sequence above |

Unit tests owned by QA (run by `npm test`):

- `tests/content-source.test.ts` — every URL in `content/*.ts` (SOURCES, results, stat
  tiles, timeline, trust row, GSS, social, plus a raw scan of the files) is an exact URL
  token in `docs/dosije.md`. Exempt, with reasons in the file: the Google Maps search link
  (navigation, pinned in `links.test.ts`), `https://www.gssrb.rs` (JSON-LD `memberOf.url`;
  the dossier cites pages on that host — asserted) and the site's own origin.
- `tests/images.test.ts` — no EXIF/XMP/IPTC in `public/img` (container parser +
  sharp), the parser's self-test on images that do carry EXIF, `scripts/images.mjs` never
  keeps metadata, and photo 08's mosaic stays a mosaic in every generated file.

### Rules worth knowing

- **Sizes.** 360×800, 390×844, 768×1024 use touch input at exact CSS viewport sizes;
  1440×900 is a desktop with a fine pointer. `shots` renders at DPR 2 and
  saves CSS-pixel screenshots. Pages taller than 16 384 px are captured in slices and
  stitched (Chromium leaves one capture blank beyond that height).
  At 1440×900 the full-page shot shows an empty band under the hero: that is the
  ScrollTrigger pin spacer (+80 % of the viewport) captured at scroll 0 — expected.
- **Tap targets (≥ 48×48 CSS px).** Every visible `a[href]`, `button`, `input`, `select`,
  `textarea`, `summary` and `[role=button|tab|link|checkbox|radio|switch|menuitem]`.
  Exempt: an `<a>` with computed `display: inline` whose nearest text block (`p, li, dd,
  dt, td, figcaption, blockquote, address, small`) has more text than the link — a link
  inside running text (WCAG 2.5.8 inline exception). A visually hidden radio/checkbox is
  measured through its `<label>`. A smaller box still passes when `elementFromPoint()`
  hits the element at all 8 points of the 48×48 square around its centre (hit area
  enlarged by padding or a pseudo-element). Hidden things (`[hidden]`, `[inert]`, closed
  `<dialog>`, `aria-hidden`, opacity 0, ≤ 1 px like the skip link before focus) are skipped.
- **Photos ≤ native/2.** Rendered CSS width of every visible `<img>` of a generated photo
  (`data-native-width`, or the manifest width for its `/img/<slug>-…` URL), at DPR 2, in
  the page and in the gallery lightbox.
- **Filmstrip / no flash.** Two independent checks from navigation start: CDP
  `Page.startScreencast` frames (the H1 box must keep ≥ 50 % of its final luminance
  contrast in every frame after the first contentful one) and an init script that samples
  the H1 on every animation frame (effective opacity of the whole ancestor chain,
  visibility, display, size, clip-path). Verified against a build that fades the H1 in
  under `html.js-motion`: all six H1 checks fail there.
- **Intro.** `kraguj:intro-end − kraguj:intro-start ≤ 1900 ms`, `html[data-intro]` ends
  `done` (not `skipped`). **Pin**: `.pin-spacer` around `#top` at 1440×900 fine pointer;
  none at 390×844 or 1024×768 with touch. **Long tasks**: 4× CPU throttle, full wheel
  scroll after the intro; tasks > 50 ms inside the scroll window fail when a repeat run
  reproduces them (a one-off — typical on a busy machine — is a warning with the details;
  `QA_LONGTASK_RETRY=0` fails on the first run). Each task is attributed to the section
  on screen and the JS chunks that had just loaded. Load-phase tasks are only reported. **Console**: zero errors/warnings on load and during full scrolls
  (desktop, mobile, both again at 4× CPU).
- **Names allow-list** (content.mjs): Slađana Kovačević, Ivana Kovačević, Stefan
  Brkljačić, Nadia Comăneci, the school „Toza Dragović“, the street Save Kovačevića
  (declined forms included). Flagged: capitalised words with a patronymic ending (-ić and
  its cases) and a list of common Serbian given names (names that are also ordinary nouns
  — Nada, Vera, Zora, Dunja, Sofija, Mina … — are left out to avoid false hits).
  Dates: any d. m. yyyy / yyyy-mm-dd up to 2026 other than the known event dates
  (2. 12. 2023, 29. 5. 2022, 30. 11.–1. 12. 2024, 13. 12. 2025, 15. 5. 2026) and words like
  „rođena“, „datum rođenja“ fail. URLs and data: URIs are removed before scanning.
- **Medal counts / apparatus.** Counts like „2 zlata“, „4 bronze“, „sedam medalja“,
  „zlato ×2“ fail anywhere in rendered text. Apparatus words (preskok, greda, parter,
  razboj, dvovisinski, …) fail inside `#uspesi` and inside any block (li/p/figure/…) that
  mentions 2023 — not elsewhere, so the program icons in `#programi` are fine.
- **JS chunks.** Forbidden strings found only inside JS chunks are warnings (e.g. the
  `viber://` builder behind SHOW_VIBER or an FAQ entry behind a flag): they are dead data
  until the flag flips. `foundingDate` fails even there.

## Environment variables

| Variable | Default | Used by |
|---|---|---|
| `QA_OUT` | `out` | all |
| `QA_BASE_URL` | `http://localhost:4173` | bundle, shots, trace, behavior, axe, lighthouse |
| `QA_SHOTS_DIR` | `qa/shots` | shots |
| `QA_TRACE_DIR` | `qa/trace` | trace |
| `QA_RESULTS_DIR` | `qa/trace/results` | all (per-script JSON) |
| `QA_VARIANT_OUT`, `QA_VARIANT_PORT` | — , 4174 | shots (MINOR_PHOTOS=false export) |
| `QA_LH_SEO_OUT` / `QA_LH_SEO_URL`, `QA_LH_SEO_PORT` | —, 4175 | lighthouse |
| `QA_LH_RUNS` | 3 | lighthouse |
| `QA_BUNDLE_RUNTIME` | 1 | bundle (`0` = static signature scan only) |
| `QA_LONGTASK_RETRY` | 1 | trace (`0` = no repeat run before failing on long tasks) |
| `QA_AUTOSERVE` | 1 | standalone scripts |
| `QA_PORT`, `QA_SKIP`, `QA_VARIANTS_DIR` | 4173, —, see above | run-all |
| `NEXT_PUBLIC_<FLAG>` | — | content.mjs reads FLAGS from `content/site.ts` with the same overrides the build used |

All generated files stay in git-ignored paths (`qa/shots/`, `qa/trace/`, `qa/lh*`,
`qa/report.json`), so Tailwind's source scan and ESLint never pick them up.

## Examples

```bash
# the §10 flow by hand
npm run lint && npm test && npm run build && npx serve out -l 4173
node qa/bundle.mjs && node qa/content.mjs && node qa/shots.mjs && node qa/trace.mjs
node qa/behavior.mjs && node qa/axe.mjs && node qa/lighthouse.mjs

# check a MINOR_PHOTOS=false build without touching out/
NEXT_PUBLIC_MINOR_PHOTOS=false npm run build && mv out /tmp/kraguj-minor && npm run build
QA_VARIANT_OUT=/tmp/kraguj-minor node qa/shots.mjs
QA_OUT=/tmp/kraguj-minor NEXT_PUBLIC_MINOR_PHOTOS=false node qa/content.mjs

# a build served somewhere else
QA_OUT=/path/to/out QA_BASE_URL=http://localhost:4199 node qa/trace.mjs
```
