# DECISIONS — GSU „Kraguj“ website

Every decision and assumption made while building from `docs/master-prompt.md` (the binding
spec) and `docs/dosije.md` (facts). The master prompt forbids questions to the user, so
anything undecided was decided here and can be reverted by the club.

## Process

- **D-01 · The master prompt wins over generic tooling defaults.** The `client-website-builder`
  default stack includes shadcn/ui and a Vercel deploy. The master prompt forbids extra runtime
  dependencies (§6), requires Cloudflare Pages documentation and says „Do NOT deploy“, so:
  no shadcn, no deploy. Dialogs, sheets and tabs are small, hand-written, accessible components.
- **D-02 · PRODUCT.md was derived from the brief, not from an interview** (Impeccable `init`
  normally interviews; the master prompt forbids questions). Inferred items are marked there.

## Stack & tooling

- **D-03 · TypeScript 5.9.3, not 7.x.** TS 7 is the Go-native compiler; Next 16's type-check
  step uses the TypeScript JS API. 5.9 is the latest 5.x.
- **D-04 · ESLint 9 (flat config) with eslint-config-next 16.3.6.** ESLint 10 is out, but the
  Next plugin set is validated against 9. `next build` no longer lints, so `npm run lint` runs separately.
- **D-05 · Mona Sans started on `next/font/google`** (`Mona_Sans`, axes `["wdth"]`, latin + latin-ext); superseded by D-22.
  The OFL woff2 from github.com/github/mona-sans is kept subset (Latin + Latin Extended-A) at
  `fonts/mona-sans-latin-ext.woff2`; `app/fonts.ts` documents the one-line swap for offline builds.
- **D-06 · Doto is subset with pyftsubset** to digits, `.`, `:`, `–`, `~`, space (1.3 KB woff2).
  ROND is pinned to 100 (round LED dots, like a judges' scoreboard); wght stays variable 400–900.
  Loaded with `preload: false` so it never competes with the hero LCP.
- **D-07 · Flags have env overrides** (`NEXT_PUBLIC_<FLAG>=true|false`) so QA can build the
  MINOR_PHOTOS=false and INDEXABLE=true variants without editing files. The defaults in
  `content/site.ts` are what the club edits.

## Performance architecture

- **D-08 · First-load JS is measured without the `noModule` polyfill chunk.** Next 16 emits a
  ~39 KB gz core-js bundle as `<script noModule>`; module-capable browsers (every browser that can
  run React 19) never download or execute it. `qa/bundle.mjs` reports both numbers; the budget
  (≤160 KB gz) is checked against the module scripts.
- **D-09 · GSAP never ships in the first-load bundle.** React 19 + the Next 16 App Router runtime
  alone are ≈130 KB gz, leaving ≈30 KB for all islands. GSAP core + MotionPathPlugin + CustomEase
  (+ the hero timeline) therefore form the *initial animation chunk*, loaded right after hydration
  via `next/dynamic(..., { ssr: false })` / `import()` (budget ≤45 KB gz). `lib/motion-env.ts` holds
  the gsap-free helpers; `lib/motion.ts` (gsap) is imported only from lazily loaded modules.

- **D-22 · Mona Sans is self-hosted as one subset file (`next/font/local`, ≈61 KB) instead of
  `next/font/google` (two files, ≈130 KB).** The master prompt names `next/font/local` as the
  fallback; the switch was needed for the §6 LCP budget. `scripts/fonts.sh` rebuilds it from the
  OFL source: opsz pinned, wght 400–900, wdth 100–125, Basic Latin + Serbian Latin + the
  punctuation in use. New characters in content (e.g. ö) need a re-run (README).
- **D-23 · Next's first-load scripts load right after the first contentful paint.** Measured cause
  of the LCP miss (3.1–3.2 s simulated, Lighthouse mobile): Next 16 requests all ~150 KB gz of
  first-load JS from `<head>` before anything paints, so on a slow phone the H1 waits for bandwidth
  and main-thread time. A stripped-JS experiment gave 1.9 s. `scripts/defer-scripts.mjs` (postbuild)
  moves those `<script async>`/preload tags into a tiny inline loader that injects the same files
  on the `first-contentful-paint` entry (rAF fallback, 1.5 s safety timer). Same files, same order-
  independent async loading, same hydration; the page is complete without JS anyway. `qa/bundle.mjs`
  still counts these scripts as first-load JS.
- **D-24 · `experimental.inlineCss: true`.** The 22 KB gz stylesheet is inlined into the HTML, removing
  the only render-blocking request. Result with D-22…D-24: LCP 1.8 s, Performance 99 (median of 3),
  TBT ≈100 ms, CLS 0.
- **D-25 · The grain tile is a 4-colour palette PNG (4 KB instead of 24 KB)**; at 3.5 % overlay opacity
  the quantisation is invisible.
- **D-26 · Dependencies were reinstalled from scratch** after the first install was interrupted by a
  full disk: the lockfile had lost the optional `@rolldown/binding-darwin-arm64`, so Vitest could not start.

- **D-27 · Review round 1 (9 independent lenses + adversarial verification, 99 findings, 78 confirmed)** is
  fixed area by area; shared fixes: keyboard focus uses an unlayered outline in the exact position of the
  §3 ring, so component box-shadows cannot hide it; every button/summary gets the §4 :active squash through
  the independent `translate`/`scale` properties (composes with GSAP transforms); CSS motion tokens
  (`--dur-*`, `--offset-reveal`) mirror `lib/motion-env.ts`; `queuePrimaryMotion()` serialises primary
  motions across sections (ONE primary motion per viewport); `QuietBoundary` keeps a failed optional chunk
  from reaching Next's error screen; the head failsafe runs only on pages with the hero.
- **D-28 · Hydration safety net for D-23:** HeadingLandings marks `html[data-hydrated]`; the deferred-script
  loader removes `html.js`/`js-motion` if a script fails to load or hydration has not happened 12 s after the
  request, so the no-JS fallbacks (static quiz guide, anchor links) replace dead controls.
- **D-29 · Coach licence lines link their ✅ GSS sources** (registered coaches list, licensed judges list — docs/dosije.md §3).
  The Slađana placeholder frame is labelled „KR-07“ — the slot of the excluded photo 07 — instead of a promise
  („Portret uskoro“) in the UI.
- **D-30 · Photo 05 stays "adults only"** as the master prompt says: the girls in the background are small,
  distant and not identifiable. If the club disagrees, set `hasMinors: true` for 05 in `content/photos.ts`.
- **D-31 · Program 5's short label is „Aerobna gimnastika“** (was „Aerobik“), so the schedule pills, the program
  titles and the section copy use one name.
- **D-32 · The inline RSC payload no longer repeats the stylesheet** (`scripts/slim-flight.mjs`, postbuild).
  With D-24 the CSS (≈197 KB raw after design v2) sat in the HTML three times: the `<style>` in `<head>` plus two
  text rows of `self.__next_f` (page tree and root not-found boundary). React adopts the existing `<style>` by its
  `data-href` on hydration and never reads that text, and this one-page export has no client navigation, so the rows
  become empty strings and the payload is emitted in one push. index.html: 207 → 132 KB gz. The script re-parses
  its output and fails the build on any payload shape it does not know (Next upgrade guard). Hydration is covered by
  qa/behavior (27 hydration-dependent checks).
- **D-33 · Section chunks never load before the hero intro is over.** `whenNear()` (lib/motion-env.ts) waits for
  `afterHeroIntro()`: html[data-intro] = done | skipped, at most 2.5 s, and not at all when there is no intro to
  protect (motion off, no hero, hero off screen after a deep link). Cause: after the S2 redesign, S3 starts 1536 px
  down at 1440×900, inside the 1-viewport margin, so its sheet, motion and Flip chunks were fetched during the hero
  intro (initial animation chunk 50.4 KB against ≤45). Now 43 KB.
- **D-34 · The S7 podium has no place numerals.** Digits next to „Medalje“ („2 1 3 Medalje“) read as medal counts,
  which the club has not confirmed (TODO 10; qa results.noMedalCounts). Step heights and medal colours carry the order.
- **D-35 · QA harness fixes (no check loosened):** qa/shots waits two frames after its instant scroll before hit-testing
  (the desktop hero pin is `position: fixed` until ScrollTrigger sees the jump, so the probe hit the hero; a real tap
  cannot happen in that frame). qa/content ignores React flight references (`"$Lea"` = `$L` + hex id) in the name scan.
- **D-36 · The schedule's white "lit" tab labels render only under the pill** (visibility, delayed by the 320 ms slide
  for the label it leaves). The clipped-away copies were real text for contrast checkers (axe 1.11:1, Lighthouse a11y 97).
- **D-37 · The header tone follows nested full-bleed bands** marked `[data-header-band]` (S5 „Hronologija“ is dark
  inside a light section), preferred over their parent section.
- **D-38 · Until the first paint, sections from S3 on use `content-visibility: auto`** (html.cv, app/globals.css + the
  head script in app/layout.tsx). On a plain first visit (no #hash, navigation type „navigate“, JS on) the head script
  sets html.cv, and it removes it in the frame after the first contentful paint (1.5 s fallback). The first paint lays out
  only S1 + S2, and the below-the-fold fonts and photos (Doto, KR-04) are no longer requested before it. Lighthouse mobile
  LCP 2.10 → 1.80 s, TBT 46 ms (median of 3; the extra step was one simulated RTT from those requests plus the layout of the whole
  page). Measured alternatives: removing KR-04 or Doto, or inlining the grain, gave nothing on its own; all three together
  gave 1.96–2.03 s. A permanent `content-visibility` was tried and rejected: deep links landed 276 px off (placeholder
  heights above the target), and the no-JS readability checks failed. Hence the first-paint-only window, which never
  affects anchors, restored scroll positions or no-JS. `whenNear()` also observes the enclosing section, which is harmless
  and keeps the look-ahead if the window is ever widened.

## Images & privacy

- **D-10 · Image widths are strictly 480/960/1600, never above native.** Photos 03, 04, 15 (1066 px),
  05 (1200 px), 06 (1170 px) and 11 (1500 px) top out at 960 w. `<Picture>` caps the CSS width at
  native/2 and reduces the cap further when a cover-crop to a taller box would enlarge the image.
- **D-11 · One subtle cool grade is baked in at build** (sharp `linear` + −6 % saturation) instead of a
  CSS filter, so nothing filter-related runs at scroll time. Grain is a static 128 px PNG tile at 3.5 %.
- **D-12 · Hidden photos are also removed from `out/`** (`scripts/prune-out.ts`, postbuild). Without it,
  a photo hidden by `CAMP_GROUP_PHOTOS=false` or `MINOR_PHOTOS=false` would still sit at a guessable
  `/img/...` URL. With MINOR_PHOTOS=false the blur placeholder of a minor's photo is not inlined either.
- **D-13 · Minor classification of the reserve photos:** 13 (three adults), 17 (cake) and 19 (cookies)
  show no children; 14, 15, 16, 18 do. 05 and 06 are adults only (per the master prompt).
- **D-14 · Photo 08 always renders uncropped** (`object-fit: contain`, `noCrop`), so the pixelated face
  can never look like an accidental crop, and no sharpening is ever applied.

## Content & language

- **D-15 · Feminine forms for coaches** (trenerica, sutkinja, predsednica, članica) per the master
  prompt; the section title is „Trenerice“. The header link keeps the master prompt's exact label
  „Treneri“. The club may revert either.
- **D-16 · Photo 06 is treated as Ivana Kovačević** (master prompt), although the dossier marks
  „ko je ko“ as ⚠️. Its alt text contains no name.
- **D-17 · The 2017 timeline line** („Od 2017. radimo kao GSU „Kraguj“.“) is shown as written in the
  master prompt; wording to be confirmed with the club (no marker in the UI).
- **D-18 · Program icons follow the master prompt's list in card order:** 1 parter (square),
  2 greda (long line), 3 dvovisinski razboj (two bars), 4 preskok (vault table), 5 aerobik (figure).
- **D-19 · Camp note (valid until 2027-06-30)** is rendered into the static HTML when the build date is
  before the cutoff and hidden after mount if the visitor's Europe/Belgrade date is past it.

## Layout

- **D-20 · Section themes** (dark ↔ light rhythm along the page): S1 hero dark (navy-900) ·
  S2 quiz light · S3 programs ice · S4 schedule light · S5 about ice · S6 coaches light ·
  S7 results darker (navy-950 scoreboard) · S8 camp light · S9 gallery ice · S10 enrollment light ·
  S11 contact dark · footer darker.
  *Current (after round 1 AD-02 and design v2):* S3 programs dark · S5 about light with a dark „Hronologija“ band · S9 gallery darker; dark sections enter on a diagonal edge.
- **D-21 · Section titles carry a small chronophotograph mark** (three ghost frames landing as the solid
  silhouette) — the "silhouette lands on section titles" idea from §1, done in CSS with one
  IntersectionObserver for the whole page. Titles alternate left/right on desktop (the floor diagonal).

## Build-time decisions per area

Recorded by the area implementations (M1–M5); each line is one decision.

### Hero (S1)

- D-HERO-1 · Composition: the leap (art band) sits above a full-width mat line (the floor); eyebrow + 144px H1 below. ≥1024: H1 in cols 1–8, sub/CTAs/trust in cols 9–12 aligned to the H1's cap line. Keeps the ghost frames off the text and fits 1440×900 / 1280×800.
- D-HERO-2 · The art is drawn in logo units (logo 490×213 at scale 1), so flier, ghosts and landed silhouette are the same <use href=#leap> at the same size.
- D-HERO-3 · Two art variants: compact (high leap from the left edge; phones and portrait tablets, capped at 540px and right-aligned from 640px) and wide (long, low travelling leap — the logo's own grand jeté; landscape ≥640 and all ≥1024). CSS shows one; the motion layer animates whichever is visible.
- D-HERO-4 · Ghost frame positions are computed on the server by geometry.ts, a copy of MotionPathPlugin's resolution-12 progress→point math. Verified against gsap in tests/hero-geometry.test.ts and in the browser (<0.01 units).
- D-HERO-5 · Each silhouette has an invisible 230×150 rect so its getBBox is exactly the #leap symbol box, making alignOrigin [.5,.6] deterministic.
- D-HERO-6 · Takeoff: the silhouette's legs touch the mat; the logo stands on the mat (lowest ink 1.3 units above it). The quadratic parabola has its apex at t=.5, where the hang ease holds the flier.
- D-HERO-7 · Added frame ticks on the mat under each ghost frame (Marey's measuring rule), revealed with the ghosts and faded with them on the desktop scrub.
- D-HERO-8 · The mat line is its own full-bleed SVG (viewBox 0 0 100 4, preserveAspectRatio none, explicit width calc(50% + 50vw)), so it is exactly 1.5px thick at any scale and draws by stroke-dashoffset with pathLength=1.
- D-HERO-9 · Dash tweens use autoRound:false; gsap otherwise rounds px values, and with pathLength=1 the line jumped from hidden to fully drawn.
- D-HERO-10 · Wordmark wipe runs 1.1–1.85s (not 1.9s) so the measured intro stays ≤1.9s including frame latency (1844ms measured in production).
- D-HERO-11 · H1 font-stretch steps 105 / 112 / 118 / 125% at <640 / 640 / 1024 / 1280. 118 at 1024–1279 because 125 overflows cols 1–8 at 1024; font-stretch percentages can't be interpolated with vw in calc().
- D-HERO-12 · The intro is skipped (final state, data-intro=done) if the hero is not in view when the motion layer starts (reload while scrolled / deep link).
- D-HERO-13 · Desktop pin start is "top top", or "bottom bottom" when the hero is taller than the viewport, so short laptop windows never hide the hero's bottom while pinned.
- D-HERO-14 · The floor-exercise diagonal is a runtime SVG created only by the desktop scroll code (no static markup): from the mat's right end → near the viewport's right edge → down to the container's bottom-left, toward the left-aligned quiz title.
- D-HERO-15 · Ghost frames fade oldest-first on the desktop scrub, like decaying afterimages.
- D-HERO-16 · Easter egg is pointer/tap only (a hidden delight in the aria-hidden decor); the story is announced through an SSR'd aria-live polite region. The egg chunk loads only on the third tap. Doto weight 900 so the LED dots read solid.
- D-HERO-17 · HeroMotionLoader uses useSyncExternalStore (server snapshot false) instead of setState in an effect: HeroMotion renders only after hydration and only when motion is allowed, so reduced-motion / Save-Data visitors never download gsap.

### Page chrome — header, menu sheet, sticky bar, footer

- D-chrome-1 · The header is a solid floating pill bar (never glass). Its surface follows the section under its centre line: white on light/ice, navy-950 on dark, navy-900 on 'darker'. The logo is white or navy to match. The swap is instant so nothing tweens colour while scrolling.
- D-chrome-2 · The section under the header is found with one IntersectionObserver whose rootMargin leaves a 1px band at the bar's centre line; it is rebuilt only when the viewport size really changes. A second 1px band at 30% of the viewport drives scroll-spy aria-current on the nav links.
- D-chrome-3 · 'Reappears on :focus-within' is implemented for keyboard focus (:focus-visible), so clicking a nav link with the mouse does not pin the header open while the page scrolls. Keyboard focus inside always shows it.
- D-chrome-4 · Below 640px the header shows only logo + 'Meni'; there is no room for the trial CTA, so it lives in the menu sheet (and in the hero/sections). From 640px the header CTA appears; the full link row from 1024px.
- D-chrome-5 · The menu sheet is a native <dialog> opened with showModal(). Links close it in a window-capture click listener before the browser follows the #anchor. For #anchor links the restored focus is dropped so the next Tab continues inside the target section. The sheet CTA opens booking through openBooking(), so the booking sheet returns focus to the Meni button.
- D-chrome-6 · The sheet body (links, CTA, call link, ghost-frame trail) is a Server Component passed into the MobileMenu island as children; only the button/dialog behaviour ships as client JS.
- D-chrome-7 · Sticky bar: Pozovite is the only filled pill (lavender on navy); SMS/Viber and Raspored are outlined. Icons are drawn for the site (24px grid, 1.75 stroke). The hero CTAs count as 'left' only once they are above the viewport.
- D-chrome-8 · The sticky bar also hides whenever a text field has focus (covers old Android keyboards that resize the layout viewport). Keyboard detection: layout height − visualViewport.height × scale > 150px (pinch-zoom safe).
- D-chrome-9 · WCAG 2.4.11 guard (focus-guard.ts): after keyboard focus moves, wait for scrolling to settle, then scroll the focused element 12px clear of the visible header or bar. Needed because Chrome smooth-scrolls to focus and does not apply scroll-padding when the element is already on screen.
- D-chrome-10 · Without JS the 'Meni' button is hidden rather than dead. On mobile the sticky bar appears after about one screen of scroll via a CSS scroll timeline (always shown where unsupported), so it never covers the hero on first paint.
- D-chrome-11 · Footer: the white logo is the last frame of the chronophotograph; the leap takes off again past it in three fading steel ghost frames (static SVG from #leap, no gradient). Footer links open in a new tab and say so to screen readers, using SourceLink's wording.

### Quiz (S2)

- D-Q1 · The quiz logic is a pure, ordered rule table (lib/quiz.ts QUIZ_RULES; first match wins). recommend(age, experience?) returns {status:"ask-experience"} for age ≥ 8 without an answer. It throws RangeError for an age outside 3…18 or a non-integer, and TypeError for an unknown answer. It ignores the answer under 8, because step 2 is not asked there.
- D-Q2 · The island ships no rules and no content. The server builds a view model (views.ts): a precomputed outcome table by age, one result view per outcome with schedule chips from formatDays/formatTimes, and the copy. The island only looks up answers in that table. It is about 2.6 KB gz with no gsap.
- D-Q3 · No-JS fallback: a static age → group guide (QuizGuide) built from the same QUIZ_RULES and schedule data, with the CTA as a plain #kontakt link. html.js (set by the head script before first paint) hides the guide; html:not(.js) hides the island. Nothing swaps after hydration, so there is no layout shift.
- D-Q4 · Chips use button semantics rather than radios, because choosing an answer moves to the next step and arrow keys must not trigger that. Each group is role=group labelled by its question, with aria-pressed, roving tabindex, grid-aware arrows and Home/End.
- D-Q5 · Focus and live region: the result sits in a persistent aria-live="polite" region, per the spec. Focus moves to the new question heading or the result heading (tabIndex −1, no focus ring on headings) so it is never lost when the pressed chip unmounts.
- D-Q6 · The „result card carries the silhouette“ idea is built as one card with a darkroom strip on top: a Marey-style chronophotograph with a faint measuring grid, the mat line and frames 01/02/03. The same #leap path moves one frame per answer (takeoff → flight → landing) and leaves ghost frames in #cfe6ff and #c9b8ff. Motion is transform/opacity only, 600ms ease-stick, pivot set by nested <g> (no transform-box on <use>). Under reduced motion, Save-Data and no-JS it is the static final composition. *(superseded by design v2: D-Q12…D-Q15)*
- D-Q7 · Booking prefill labels: program titles for beginner results. „Mlađa početna grupa / Starija početna grupa“ for the age-8 beginner result. QUIZ.competitiveTitle for the competitive result. The booking dialog adds unknown labels as their own option.
- D-Q8 · The competitive result lists its three schedule groups by their S4 names (Takmičarke — A i B program; C program, starije; C program, mlađe) as h4 under the title. Beginner results use the program title plus its age line („3–8 godina“ / „od 8 godina“).
- D-Q9 · The answers so far appear as an edge print on the strip („9 GOD. · TEK POČINJE“). This replaces a kicker above the result heading (the craft floor bans eyebrows); the strip is aria-hidden.
- D-Q10 · Frame numbers use full-contrast steel-300 / white on navy, never dimmed with opacity (axe color-contrast). Upcoming frames are lighter in weight, and a skipped frame 02 is struck through. *(superseded by design v2: D-Q18)*
- D-Q11 · Desktop layout: the heading sits sticky in columns 1–4 (top 112px) and the card in columns 5–12. This follows the page's left/right title rhythm. Below 1024px they stack. *(superseded by design v2: D-Q17)*

### Programs (S3)

- Programs = a contact sheet of program frames. Each card is a white mount with a plate in the program color holding the hand-drawn apparatus icon. Photo 04 (KR-04) is the sixth frame of the sheet.
- Layout: below 1024px a native scroll-snap row that runs to the screen edge, with the next card showing and a JS pager (‹ n/5 ›). At 1024–1279px a 2-column grid; at 1280px and up a 3-column grid with the photo visually first (CSS order; DOM stays cards first). A 5-column row cannot fit the stacked CTAs.
- Mobile row uses natural card heights (align-items: flex-start), so a short card has no gap above its CTAs. Desktop grid rows stretch, so CTAs line up per row.
- Age chips filter by hiding cards; they do not reorder. Mapping follows the §5 quiz rules: „3–8 godina“ → mlađa početna; „Od 8 godina“ → starija početna + both competitive programs; „Takmičarke“ → C + A/B. Aerobic gymnastics has no age claim, so it shows only under „Svi programi“, and the status line then repeats QUIZ.aerobicHint („Pitajte trenericu i za aerobnu gimnastiku.“).
- Filter motion: Flip 0.28s ease stick with scale:true and absoluteOnLeave; entering cards fade/scale .96→1, leaving cards fade in 0.18s ease takeoff. Reduced motion or Save-Data: instant change plus a 150ms WAAPI crossfade, and no gsap download.
- Detail sheet is a native <dialog> with showModal: bottom sheet below 640px, centered 620px dialog above. The card morphs into the panel (Flip.from, 0.42s — longer than base 280ms because it is a large shared-element move) and flies back in 0.18s (Flip.fit, ease takeoff). The card is hidden while the sheet is open.
- Links inside the sheet close it synchronously and return focus before the click bubbles on. The booking and schedule delegates then take over (booking sheet records the + button as its return target).
- Card hover lift and + rotation use the independent `translate`/`rotate` CSS properties, so they never fight GSAP/Flip transforms. Both are enhancements only; the visible + button is the real affordance.
- Icon draw on enter is CSS stroke-dashoffset on pathLength=1 paths (dasharray 1 3, hidden offset 1.05 so round caps leave no dot), triggered by one IntersectionObserver. No DrawSVG needed.
- Parter icon is a square floor mat in perspective: a flat square with a diagonal read as an image placeholder. Razboj is a low and a high rail on uprights with guy wires, so it does not look like a bar chart.
- Titles glue a spaced dash to the word before it (no-break space) so „Takmičarke — C program“ never wraps as „Takmičarke / — C program“. Text is otherwise unchanged.
- Days are shown as „Po, Sr, Pe“ (aria-hidden) with sr-only full names; times are split only at „ ili “. The rendered text equals formatBlock(), which is unit-tested.
- Sheet chunk is loaded through one cached import() (not next/dynamic), so the near-prefetch and the first tap share one chunk. First open took about 20ms in a production build instead of about 320ms.

### Schedule (S4)

- S4-01 · „Sledeći trening“ counts the next training START strictly after now (Europe/Belgrade); a training in progress does not count (Mon 18:30 → „u sredu u 18:00“).
- S4-02 · The chip names only fixed slots. For a group mixing fixed and „ili“ slots (A i B, C mlađe) the chip is hidden whenever an „ili“ training could come before the next fixed one, because the time is unknown and naming the later slot would be wrong. Groups with no fixed slot (C starije) never get a chip.
- S4-03 · .ics files are static build output (app/kalendar/[file]/route.ts → out/kalendar/kraguj-<group>.ics), one VEVENT per fixed block. DTSTAMP = build time; DTSTART = first occurrence on/after the build date (Europe/Belgrade). Google links use the same date. No UNTIL: the weekly schedule is open-ended.
- S4-04 · Event text: SUMMARY „GSU „Kraguj“ · <group name>“, LOCATION „<VENUE.name>, <street>, <city>“, DESCRIPTION = §5 S4 sub line + „Pozovite 060 028 7631“ + <SITE_URL>/#raspored. All composed from existing content strings.
- S4-05 · Cards and the „Po danu“ rows are ordered by program (S3 order 1…5), the same order as the filter pills, not by the order in content/schedule.ts. Groups of hidden programs (Trampolina) are skipped.
- S4-06 · Filtering sets `hidden` on [data-sched-item] (both views at once), so Flip can capture state synchronously. The server-rendered cards and rows stay Server Components, and the island (~3.1 KB gz chunk) ships no content data.
- S4-07 · Without JS the segmented control, filters and chip placeholders are hidden (html:not(.js)). The server-rendered „Po grupi“ view is the complete schedule and the .ics links still work.
- S4-08 · Before mount (no selection) all seven day panels render in „Po danu“. It is never visible, because „Po grupi“ is the default and today gets selected on mount.
- S4-09 · The day strip sticks under the floating header while it is shown (via :has([data-site-header][data-hidden="false"]), offsets 76/80/92px from header.css geometry) and at top:0 once the header hides.
- S4-10 · Display-only typesetting of group names: one-letter words („C“, „A“, „i“) are glued with NBSP, and „(3–8 god.)“ never splits (NBSP + word joiners). The underlying content strings are unchanged.
- S4-11 · Mixed groups carry a small note „U kalendar se dodaju samo termini sa stalnim vremenom: …“ so a parent importing the .ics knows the „ili“ days are not included.

### About (S5) and coaches (S6)

- S5 about is light with a full-bleed dark darkroom band for „Hronologija“ (design review v2, AC-02; replaces the earlier „ice“ choice, now matching master §5 „light“).
- S5 order: mobile mission → photo 03 → history → timeline; desktop photo 03 in cols 1–5, text in cols 7–12, timeline in cols 5–12 with a sticky „Hronologija“ h3 in cols 1–4.
- Timeline years with several entries (2024) share one node and render as a nested list.
- Timeline motion is driven by IntersectionObserver: the line moves one node at a time as each year crosses 65% of the viewport. Not a scrub: no scroll listener, no rAF loop, same on mobile. Years already scrolled past show as reached without animation.
- Timeline line keeps going past the last year and fades out (static mask) — the club's story continues.
- Photo 17 (cake) is its own list item after 2017 with no year node, so no date is claimed.
- Coach cards use a container query: side by side at card width ≥540 px (768 stacked; 1280/1440 two columns), stacked at 360 and at 1024 (two narrow columns).
- Slađana's placeholder reuses the site's navy .photo-placeholder in the same 4:5 frame as Ivana's portrait. The frame label reads „Portret uskoro“ (COACHES_COPY.portraitPending).
- „Licenca GSS“ badge: round stamp in the accent colour (royal-600 on white, 6.46:1) with „LICENCA“ on the arc and „GSS“ in the centre. No club or GSS logo, so it can't pass as an official GSS seal. Its final rotation is 0° per §4. *(superseded by design v2: inked two-layer stamp, no shadow — see About/coaches v2)*
- Photo 05 is shown as a 3:2 crop (object-position 50% 29%) of the 1200×1600 original, 600 CSS px max. On desktop it sits in cols 7–12 so the heading (top-left) and the print (bottom-right) form the floor diagonal.
- Brush annotation = grease-pencil selection loop drawn as a dry brush. It is one of the page's two allowed annotations; the Results agent owns the other.
- Coaches motion sequences are serialised (a shared 'busy until' clock): portraits, then stamps, then the brush. Only one primary motion per viewport.
- Both motion islands follow the ContactDoskok pattern: a tiny client component with whenNear() and import() of a plain TS module that uses @/lib/motion. No gsap in the first-load bundle.

### Results (S7) and camp (S8)

- D-S7-1 · The scoreboard is a row of four 'units' (2×2 below 1024 px): a dark display window with a static unlit-dot texture holding the right-aligned Doto numeral (iceblue-200 on navy-950), then the label and „izvor ↗“.
- D-S7-2 · The digit flip goes from edge-on (rotateX −90°) to the final digit, never from a different number, so no wrong value ever shows (SOURCE RULE). No count-up.
- D-S7-3 · Medal marks are decorative, aria-hidden and derived from the wording: three overlapping discs for „Zlato, srebro i bronza“ (kinds, not counts) and gold for „1. mesto“. They come from the `medals` field in content/results.ts.
- D-S7-4 · The podium (2nd · 1st · 3rd, then the step dividers) rises from the bottom edge of the gradient band in navy-950 strokes, with the gold/silver/bronze marks resting on the steps. It is the only drawing on the gradient.
- D-S7-5 · Motion is one sequencer (title mask → digit flip → podium draw → brush draw). Each step waits for its own element and for the running step to finish. Anything already visible when the motion arms keeps its final state. The SplitText revert puts the ChronoMark node back (HeadingLandings keeps observing it).
- D-S7-6 · The brush annotation over photo 01 is a five-layer dry-brush swoosh across the empty floor in the lower right, drawn in the photo's 960×720 space so it never touches a person.
- D-S8-1 · Postcards are a fanned stack of contact-sheet frames: flick the top card either way to send it to the back, or use prev/next. Without JS they fall back to a scroll-snap row. The stack CSS is scoped to html.js (set pre-paint), so there is no CLS on hydration.
- D-S8-2 · The beam → wave static state (no JS, mobile, coarse pointer, reduced motion) is the WAVE, the scrub's final state. On desktop the scrub starts as a balance beam with A-frame legs that fade out while the line morphs.
- D-S8-3 · The phone number in the camp note is a tel: link, split out of the exact CAMP.note text so the copy stays editable in content/copy.ts.
- D-S8-4 · Postcards have no captions (frame labels only), so nothing implies a photo was taken in Greece.
- D-S8-5 · CampIsland reads the note cutoff from data-until instead of importing content/copy, which keeps copy strings out of the first-load bundle.

### Gallery (S9) and enrollment + FAQ (S10)

- S9 chips: an extra „Sve“ (all) chip is the default, and every chip shows its photo count (computed, so it follows CAMP_GROUP_PHOTOS). Gallery chips use no program colors: categories are not programs, and „one color = one program“ must hold.
- S9 without JS: every openable print is an <a> to its largest generated .webp, so no-JS users still get the full image. With JS a plain left click opens the lightbox; modifier or middle clicks keep the native link.
- S9 lightbox = native <dialog> + showModal() (inert page, Esc) plus a strict Tab wrap. It is a lazy chunk (about 3.3 KB gz), warmed together with Flip and Observer when the gallery is ≤1 viewport away. Observer loads even under reduced motion, because swipe-to-close is a gesture, not decoration.
- S9 lightbox shows the currently filtered set in sheet order; the „n / total“ counter refers to that set.
- S9 focus returns to the print of the photo currently shown, which is where the close Flip lands, rather than always to the print that opened it.
- S9 layout: 2-column masonry under 640px, 3 columns from 640px. The frame caption shows the category (a text cue for the filter) and is hidden under 480px to keep narrow frames clean. *(superseded by design v2: GE-01 justified contact-sheet strips)*
- S9 swipe-down closes above 110px drag or 900px/s release velocity. During the drag the photo follows the finger, scales down to 0.9 at most, and the scrim fades toward the page.
- S10 steps are three frames of one leap (ghost takeoff, ghost apex, solid landing on the mat line = „postaje član kluba“), with outline numerals for steps 1–2 and a solid numeral for 3. *(superseded by design v2: GE-06/GE-07 leap band and ghost-ramp numerals)*
- S10 adds a booking CTA („Zakažite probni trening“, data-booking="") and a secondary call button („Pozovite 060 028 7631“) under the steps, reusing existing copy (CTA.trial, HERO.ctaSecondary), so a parent can act right where step 1 says „Javite se“. Never two filled buttons side by side.
- S10 shows „Upis traje tokom cele godine.“ next to a decorative, aria-hidden row of 12 filled dots (all months open), echoing the schedule's week-dot rows.
- S10 FAQ is not an exclusive accordion (no `name` attribute), so parents can open several answers. The height animation uses ::details-content grid rows plus content-visibility allow-discrete where supported, and is instant elsewhere.
- S10 checklist items are rendered lowercase exactly as in content/copy.ts (no CSS capitalisation).
- S10 FAQ last line: only the number is the tel link, not the whole sentence.

### Contact (S11) and booking sheet

- D-S11-1: The S11 CTA panel is a leotard-gradient frame (10/14/16px) around a solid navy-950 slab, so no text ever sits on the gradient. Desktop splits 7/5 (panel left, contacts right under the right-aligned title); mobile stacks panel then contacts. *(superseded by design v2: D-S11-18 leotard sash)*
- D-S11-2: The slab repeats the hero trust points (HERO.trust) as the closing argument and puts BOOKING.privacy under the button. No new copy was invented.
- D-S11-3: The „doskok“ is shown as a static chronophotograph: 3 steel-300 ghost frames plus a white landed frame doing a split on the button's top edge. This is the no-JS and reduced-motion final state. JS replays the hop through exactly those positions. *(superseded by design v2: D-S11-19/20 back-salto doskok)*
- D-S11-4: The landing squash animates a wrapper, not the <a>, so the global .btn:active squash (a CSS transition) keeps working.
- D-S11-5: The doskok arms only when ≤1 viewport away (whenNear plus dynamic import). If the CTA is already on screen at arm time (deep link or restored scroll), the static state stays, so nothing flashes.
- D-BK-1: The booking entry is split in two. BookingSheet is a tiny first-load listener (capture-phase delegated click plus BOOKING_EVENT). BookingDialog is a lazy chunk (~4.5 KB gz), preloaded on idle and on the first pointerdown/focus on any [data-booking].
- D-BK-2: The sheet uses the native <dialog>.showModal() with a strict Tab wrap. Initial focus goes to the title on touch (so the keyboard does not cover the sheet) and to the first field on fine pointers.
- D-BK-3: Message rules: without a child name the „dete:“ label stays („dete: godište 2018“); an empty note is omitted; an empty group becomes „grupa: neka trenerica predloži“; all values are trimmed and whitespace collapsed.
- D-BK-4: Birth year must be between (Europe/Belgrade year − 18) and (year − 2), i.e. 2008–2024 in 2026. Phone accepts digits, spaces, ( ) . / - and a leading +, with 6–15 digits.
- D-BK-5: Grupa select order: undecided „Neka trenerica predloži“ (value ""), then any unmatched prefill label (e.g. the quiz's „Takmičarske grupe (A, B i C program)“) as its own option, then the visible program titles. Matching ignores case, spacing and dash style.
- D-BK-6: Form values stay in memory between opens on the same page. A new request overrides Grupa only when its prefill is non-empty. Nothing is stored.
- D-BK-7: BOOKING.after appears after SMS/email/Viber actions, not after a call. It lives in a role=status live region, is scrolled into view, and keeps the phone number on one line.
- D-BK-8: The palette has no red, so validation errors use royal-600 (accent) plus a drawn icon plus text. Colour is never the only signal.
- D-BK-9: Viber (flag) writes the clipboard synchronously in the click, then follows viber://. After 1.5s, if the document is still visible, it shows BOOKING.viberFailed. On pointer:fine it shows „Viber: 060 028 7631“ as text instead of a link.
- D-LINK-1: The §7 source-URL test scans content/, components/ and app/ for http(s) URLs. Navigation links (Google Maps search, Google Calendar template, own domain, w3.org, schema.org) are not treated as sources.

### SEO, icons, share image, 404

- D-SEO-1 · The share image and icons are route handlers with real file extensions (app/og.png/route.tsx, app/icons/[file]/route.tsx, next/og ImageResponse at build), not the opengraph-image/icon file conventions. Under output:'export' those conventions write extensionless files (out/opengraph-image, out/icon), which Cloudflare Pages serves as application/octet-stream. lib/seo.ts declares og:image, twitter:image and the icon links explicitly.
- D-SEO-2 · INDEXABLE=false policy: meta 'noindex, nofollow, noimageindex'; robots.txt keeps the HTML crawlable ('Allow: /') because a crawler must fetch a page to see its noindex (a site-wide Disallow can leave the bare URL indexed from external links), but it disallows /img/ so compliant crawlers never fetch children's photos; no Sitemap line; sitemap.xml is an empty <urlset>. INDEXABLE=true: 'index, follow', robots.txt allows all + Sitemap, sitemap lists SITE_URL/. noindex is not consent: MINOR_PHOTOS and Cloudflare Access still decide what is public.
- D-SEO-3 · The sitemap lists loc only. Google ignores changefreq and priority, and a build timestamp is not a truthful lastmod.
- D-SEO-4 · JSON-LD is one @graph: WebSite (site name „Gimnastički klub Kraguj“), SportsClub (§5 fields, location = Place named after the school with hasMap, sport = Sportska/Aerobna gimnastika, logo = generated /icons/logo.png, image = /og.png, no foundingDate) and FAQPage from visibleFaq(). It is serialized with <, >, &, U+2028 and U+2029 escaped.
- D-SEO-5 · The OG image is a still of the hero's final composition. It reuses buildVariant() from components/sections/hero/geometry.ts with an OG-specific spec, lifts the ghost opacity to .16–.42 so it survives a phone thumbnail, and adds HERO.eyebrow and HERO.h1 in Mona Sans. Satori cannot read woff2, so static TTF instances (wght 600/wdth 108 and wght 760/wdth 112, subset to ASCII + čćšžđČĆŠŽĐ„“·—–▸) were made with fontTools from fonts/source/MonaSansVF-wdth-opsz-wght.woff2. They live in components/seo/fonts with the OFL and are read at build only, never shipped.
- D-SEO-6 · Icons come from the sprite silhouette. The SVG favicon follows prefers-color-scheme (navy on light, ice-50 on dark, transparent). PNG 32 is white on a navy rounded square; apple-touch 180 and 192/512 are white on full-bleed navy; the maskable 512 keeps the ink inside the 80% safe circle. There is no favicon.ico.
- D-SEO-7 · The web manifest uses display 'browser' (it stays a web page). appleWebApp is { capable: false, title: 'Kraguj' }, so the iOS home-screen label is short without switching to standalone mode.
- D-SEO-8 · The 404 exports its own metadata: title „Ups — ova stranica je izgubila ravnotežu | Gimnastički klub Kraguj“, robots noindex+follow (so it stays consistent with Next's own noindex even when INDEXABLE=true), and canonical: null so a missing URL never claims to be the home page.
- D-404-1 · The 404 gymnast balances against real gravity. The on-screen down angle comes from DeviceOrientation β/γ plus the screen angle, and the upper body counter-rotates (clamped ±24°) with an under-damped spring and 3 lagging ghost frames. The one-path silhouette is cut at the waist (logo y≈150, where only the 26-unit torso crosses) so the legs stay on the beam; rotating the whole figure would push a leg through the beam.
- D-404-2 · iOS permission detection: Chromium 153 also exposes DeviceOrientationEvent.requestPermission, so its presence alone does not mean iOS. The page always listens, and shows the enable button only on touch devices that expose requestPermission and received no orientation data within 1 s.
- D-404-3 · The root not-found boundary is part of the root layout's tree, so its client code ships on every page. The 404 therefore uses a tiny loader and a next/dynamic (ssr:false) tilt chunk of 1.6 KB gz. The home page's first-load JS does not grow, and the button label comes in as a prop so content/copy.ts stays out of the chunk.
- D-404-4 · The 404 layout is start-aligned on phones and vertically centred on desktop, where the iOS button is out of flow. Late-appearing UI never shifts content. On phones the scene is shown as a centre crop (preserveAspectRatio slice, 500/286) so the gymnast reads larger.

## Review round 1 — area fixes

These lines supersede earlier lines with the same ID in the per-area sections above.

### Hero (S1) — round 1

- D-HERO-11 (rewrite) · H1 font-stretch is 105 / 112 / 118 / 121% at <640 / 640 / 1024 / 1280. 125% overflowed cols 1–8 at every width ≥1280 (+16px at 1280); 121% fits with 3–12px to spare. A hero-only width cap, font-size ≤ (66.667cqi − 8px) / 5.91 (118%) or / 6.02 (121%) with .hero__inner as an inline-size container, keeps the widest line („Kragujevcu“, 5.8917em at 118% and 6.0031em at 121%) inside cols 1–8 at 1024–~1140. The global display-xl token is unchanged.
- D-HERO-18 · Short desktop viewports: the wide art band is capped at 23svh (right-aligned), and the H1 font-size ≤ (77svh − 164px) / 3.635, never below 88px. 164 = 92 header room + 20 + 16 eyebrow + 12 + 20 bottom + 4; 3.635 = 4 lines of .88 plus .115em of descender. The whole H1 therefore sits in the first viewport with ≥14px of air at 1280×720, 1280×800, 1366×768 and 1536×864. 1440×900 and taller are untouched. The aside's cap-line alignment uses the same --hero-fs.
- D-HERO-14 (rewrite) · The floor diagonal (desktop scrub) is routed by components/sections/hero/spine.ts: mat end → right margin (≤32px out) → vertical drop → 28° diagonal (the pitch of the 118deg leotard gradient) out through the hero's bottom edge toward the next section. The drop goes only as far as needed for the diagonal to clear every text box (Range rects of eyebrow, H1, sub and trust + CTA boxes, +16px), so it never crosses text. It is recomputed on refreshInit and unit-tested. Rejected alternatives: masking the text boxes (leaves stubs), an opaque aside background (the line still runs behind the H1), and drawing in S2 (not visible during the pin).
- D-HERO-19 · The desktop pin (80vh spacer) is created only while the page rests at the top (scrollY ≤ 1, and no hash whose target lies lower); otherwise it is armed on the first return to the top. Deep links, reloads and nav clicks during the intro land exactly (top 88, CLS 0), and a visitor who scrolled during the intro is never snapped back.
- D-HERO-20 · HeroMotion and EasterEgg are wrapped in QuietBoundary. HeroMotion's fallback shows the final composition at once (data-hero-ready, and data-intro=skipped unless it is already done) instead of waiting for the 2.5s head failsafe, and other sections keep html.js-motion. A ScrollTrigger import failure is caught (the static hero stays).
- D-HERO-21 · Display-only typesetting in Hero.tsx; content/copy.ts and the OG image are unchanged. Eyebrow: separators are glued with a no-break space and each segment is nowrap; only the first segment may wrap, on phones. Subline: a dash never starts a line, a one-letter word never ends one, and „od 3. godine“ stays together.
- D-HERO-22 · The intro registers its 1.85s with queuePrimaryMotion without awaiting it (the hero is the first primary motion, so the ≤1.9s budget is kept: 1848ms measured in production). Intro fades use DUR.tap / DUR.fast. The egg flip uses --dur-fast / --dur-base with a DUR.reveal hold, and the egg close button eases the global :active squash.

### Page chrome — round 1

- D-chrome-10 (replaces the old line) · 'Meni' is server-rendered as a real link to the footer page index (#meni), so it works without JS, before hydration (D-23 defers scripts) and when a chunk fails. Once hydrated it becomes a disclosure button (role=button, aria-haspopup/expanded/controls, Space on key-up) that opens the sheet. Invoker Commands were rejected: older iOS Safari and WebViews don't support them, and they would still do nothing without JS. Without JS, the mobile sticky bar appears after about one screen via a CSS scroll timeline.
- D-chrome-12 · The footer adds #meni, a compact page index that mirrors the menu sheet: the label 'Meni', the six NAV links, 'Zakažite probni trening' and 'Pozovite 060 028 7631'. This departs from the §5 FOOTER item list; it is the no-JS and pre-hydration target of Meni and gives parents a way on from the bottom of a long page. All §5 FOOTER items are still present. Layout: 2-column links on mobile; 3-column links plus an actions row from 640px; from 1024px the GSS/Instagram links and ©/credit share one hairline row; from 1280px brand and index sit side by side.
- D-chrome-13 · On viewports 480px tall or less (landscape phones, 400% zoom), the header and the sticky bar are never on screen together. The bar steps aside while the header is shown (scroll-up or keyboard focus) and returns on scroll-down; StickyBarBehavior reads the header's data-hidden. Without JS the header is position:absolute there, so it scrolls away.
- D-chrome-14 · Menu sheet rows are clamp(48px, 7.6svh, 64px) tall, and the ghost-frame trail is hidden when the viewport is under 780px tall, so the CTA and call are on the sheet's first screen. Landscape viewports 500px tall or less get a 3x2 link grid (2 columns under 560px wide) with CTA and call in one row; at 844x390 everything ends at about 255px.
- D-chrome-15 · Header from 640 to 1023px: the bar is 64px tall (was 60px), the CTA pill and Meni are 52px (§3 button height), and the bottom edge is at 74px. Header .btn transitions only translate/scale, so there is no background, colour or press-lip box-shadow tween when the theme swaps on scroll (MOT-09).
- D-chrome-16 · The sticky bar hides while any part of [data-contact-block] (S11 heading, CTA panel, contact channels; not the venue card) is in the viewport, with zero rootMargin. It returns over the venue card and the footer (A-01, PJ-01). The hero-CTA observer's root box extends 1,000,000px below the viewport, so 'passed' flips on any crossing of the top edge, including menu or anchor jumps over CTAs that start below the fold.
- D-chrome-17 · Sticky bar pills are content-sized flex items that share the spare width equally, so every label has the same inner padding. Under 360px: 20px icon, 4px gap, 6px padding. The press uses translate/scale like .btn, and Pozovite's lip goes to 0 on press.
- D-chrome-18 · Chrome motion uses the tokens: header hide 180ms (takeoff), show 280ms (stick); sheet shutter 280ms; rows staggered 40ms (was 30ms) with the --offset-reveal offset. .menu-btn uses the global translate/scale squash, which removes the double squash.
- New UI strings: None new. The footer index label reuses HEADER_COPY.menu 'Meni' (also its nav's accessible name via aria-labelledby). The footer CTA and call reuse CTA.trial and CTA.call + PRIMARY_PHONE.display, the same text as the menu sheet and hero ('Pozovite 060 028 7631').

### Contact (S11) and booking sheet — round 1

- D-BK-1 (rev): BookingSheet loads the dialog through one cached import() promise (no next/dynamic), warmed on idle and on the first pointerdown/focus on [data-booking]. First open is about 20 ms (was about 320 ms). If the chunk fails, or the dialog throws (QuietBoundary), the tap falls back to the no-JS path: #kontakt (pushState), scrollIntoView, focus the S11 h2.
- D-BK-4 (rev): Godište deteta is a native select. It shows „Izaberite“ (a disabled placeholder), then years from Europe/Belgrade year − 2 down to − 18, newest first. The message still reads „godište 2018“. There is one error, „Izaberite godište deteta.“; the range error is removed.
- D-BK-5 (rev): Grupa keeps at most ONE extra (unmatched) option, the latest prefill. A program-title prefill clears it; an empty prefill keeps the current choice (lib/booking applyGroupPrefill).
- D-BK-9 (rev): Viber (flag) is an outlined full-width action on touch-first devices. On desktop it shows „Viber: 060 028 7631“ as text in the footer.
- D-BK-10: The primary send action depends on the device (lib/booking primaryChannel). A coarse primary pointer or no hover gets SMS filled and email outlined. A fine pointer that hovers (desktops and touch laptops, whose sms: rarely works) gets email filled and SMS outlined. The call link stays tertiary; BOOKING.after follows every message hand-off, never a call.
- D-BK-11: Validation runs on send only, per channel. Ime roditelja and Godište are always required. Telefon is required only for email: SMS/Viber carry the sender's number, and the message then has no „tel: …“. A phone that is filled in must look like one on every channel. Editing a field clears its own error at once; the first invalid field gets focus. Errors use icon + text + a thicker accent border.
- D-BK-12: Selects are a native <select> laid transparently (opacity 0) over a visible value box that wraps long labels, so quiz prefills never truncate. The box draws the global focus ring through :has(select:focus-visible), with :focus-within as fallback. Every input and select uses 17px text, at least 52px height, radius-md and a 1px slate-600 border.
- D-BK-13: Napomena is collapsed behind a quiet accent text button („+ Dodajte napomenu“, drawn + icon). It reveals the field labelled „Napomena (opciono)“ as a 3-row textarea and focuses it; once opened it stays open.
- D-BK-14: Sheet layout is head / scrolling fields / fixed action footer (safe-area padding). The footer holds the status, primary | secondary side by side when it is at least 300px wide (stacked at 320), and the call link below. The privacy line closes the fields. It fits without scrolling at 390×844 and 1280×720.
- D-BK-15: Field grid: at ≥360 the child's name and Godište share a row (1.3fr / 1fr); at ≥560 there are two equal columns (parent | phone, child | year). Grupa and Napomena are full width.
- D-BK-16: Enter in a text field moves to the next field. The form has no submit button, so implicit submission never happens, and nothing is ever sent by Enter.
- D-BK-17: The sheet's initial focus stays the same (title on touch, first field on fine pointers). The title's local outline:none and underline are removed, so the global focus ring applies.
- D-S11-6: [data-contact-block] moved from the <address> to div.contact__block, which wraps the heading, the CTA panel and the contact channels. The venue card is outside it, so the mobile sticky bar returns over the venue card and footer. At ≥640 the wrapper is a CSS subgrid of .contact__grid: desktop 7/5 with the panel spanning channels + venue, tablet list | venue. It is guarded by @supports, with a single-column fallback.
- D-S11-7: <address> now wraps only the contact channels (phones, e-mail, Instagram). The training venue card is a plain div: it is a location, not contact information.
- D-S11-8: Without JS, the S11 doskok button's href is sms:+381600287631?&body=<BOOKING.message.intro>, the sheet's own hand-off. With JS it still opens the sheet (data-booking=""). All other booking CTAs keep href="#kontakt".
- D-S11-9: The doskok waits for the S11 title's landing to finish (data-landed + 800 ms), then runs through queuePrimaryMotion(950 ms). A live switch to reduced motion reverts it to the static composition. *(superseded by design v2: D-S11-21 trigger)*
- D-S11-10: The CTA panel's foot row (privacy left, doskok right) is a container query on the slab (content ≥520px), so the button label never wraps in the 7/12 column at 1024–1180; below that it stacks. At <360 the panel, slab, button and contact-row padding is tighter, so neither the CTA label nor „sladjanakovacevickg“ wraps mid-word. The trust items use text-wrap: balance, so no single word is left alone on the last line. *(superseded by design v2: D-S11-15 5/7 swap)*
- New UI strings: „Izaberite“: first (disabled placeholder) option of the Godište deteta select (BOOKING.fields.birthYearPlaceholder) · „Dodajte napomenu“: quiet text button that reveals the Napomena field, with a drawn „+“ icon before it (BOOKING.addNote) · „Izaberite godište deteta.“: validation error; replaces „Upišite godište deteta.“ (BOOKING.errors.birthYearMissing) · Removed: „Upišite godište od četiri cifre, između {min}. i {max}.“ (unreachable with the year select)

### Quiz (S2) and programs (S3) — round 1

- Programs layout: under 640px (one card in view) cards keep natural heights. From 640px (several cards in view) the row stretches and CTAs line up along the bottom, as in the desktop grid.
- Programs pager (<1024) sits above the row, in the filters block. On phones it has its own right-aligned row under the chips and status; from 768 it joins the chips row. It counts program cards only (not photo 04), is hidden with 1 or fewer cards or when the row does not scroll, and disables › on the last card. If a disabling arrow has keyboard focus, focus moves to the other arrow.
- Programs desktop head (≥1024) is a grid: chips on the left, heading on the right centred on the chips row, status in its own row, so filtering never moves the heading.
- Programs filter Flip: while the Flip runs, leaving cards carry data-out (display:none in CSS, overridden by Flip's inline display), so the 0.18s takeoff fade renders. They get `hidden` on completion. This works around Tailwind's [hidden]{display:none!important}.
- Program detail sheet: the card opens as a clip-path window (translate + clip-path from the card's rect to the panel's box, 0.42s ease-stick) instead of a Flip scale morph. No content is scaled, so there is no empty slab and no distortion. It closes by shrinking back onto the card while fading into it (0.18s takeoff). It is still a FLIP (first/last/invert/play), but no Flip plugin is loaded in the sheet chunk.
- Program icons draw after the section title's landing ends (+0.8s, bounded) and through queuePrimaryMotion (one primary motion per viewport). The hidden pre-state applies only under prefers-reduced-motion: no-preference.
- Sheet week row = the S4 7-dot row (dots on a mat line, program-colour fill with navy ring, bold label), so it never reads as a day picker.
- Card titles use the global h3 width axis (104% mobile / 118% desktop); measured, no extra wraps.
- Quiz motion is not queued through queuePrimaryMotion: it is direct feedback to a tap, never scroll-triggered, and queueing would add input latency.
- Quiz strip caption (answers so far) is 13px in sentence case („9 god. · Tek počinje“), each answer unbreakable; KR-Q and 01/02/03 stay 11px caps frame labels (replaces the caps edge print in D-Q9).
- Quiz 3-column competitive result only from 1280px. Below that the groups stack, because at 1024 each column was about 160px and times broke.
- Time ranges („08:30–10:30“) never break at the dash, in quiz slots and in program cards. Lines wrap only around „ ili “ (and before an optional shift note). In quiz slots, „ili“ uses the quiet small/muted style of the program cards.
- Quiz group names: display-only no-break spaces keep „Takmičarke —“ together and keep „C program“ / „A i B program“ whole, with text-wrap: balance. Booking labels use the raw titles.
- No-JS quiz guide: groups always stack (the answer column is narrow), and each experience answer is unbreakable, wrapping only after „ · “. The CTA is CTA.trial.
- New UI strings: „Mlađa ili starija početna grupa“ — booking prefill (Grupa) for the age-8 beginner quiz result; replaces „Mlađa početna grupa / Starija početna grupa“ (components/sections/quiz/views.ts BOTH_BEGINNERS_BOOKING) · „Sve“ — S3 all-programs chip; replaces „Svi programi“ (shared vocabulary with S4/S9) · „Prikažite programe“ — aria-label of the S3 chip group; replaces „Prikažite programe za uzrast“

### Schedule (S4) — round 1

- S4 layout: the location card sits beside the panel (8/4, sticky top 104px) only from 1280px, and the controls row spans the full width there, so all six pills fit on one line. At 1024–1279 the section stacks like the tablet layout (cards 2-up at about 450px, location card below): an 8/4 split at 1024 squeezed cards to about 290px, with 3-line titles, a dash starting a line, a wrapped chip and a 4-line location title. The location card is passed into ScheduleBoard as an `aside` prop.
- S4 pills use the S3/S9 chip vocabulary (2px hairline, pressed = navy + white + the shared ✓ SVG). The program swatch follows the ✓. A pill grows by the ✓ width when pressed, as in S3/S9.
- S4 pill layout: one swipeable row on phones with an edge fade (mask-image) on the side that has more pills; two real lines (Sve + 2 | 3) when the controls are narrower than 960px (@container sched-controls); one line otherwise. This avoids a lone orphan pill.
- S4 filter Flip leave: leaving items get data-leaving (non-important display:none) instead of `hidden`, so Flip absoluteOnLeave can show them fading (linear opacity + takeoff scale .96, DUR.fast) under the moving items (isolation, z -1). `hidden` is set onComplete/onInterrupt; the next filter or view switch completes a running Flip first.
- S4 status line (role=status, polite, sr-only) is set only for filter and day actions: „Prikazano: {n} od {N} grupa.“ / „Prikazano: {n} od {N} treninga u {akuzativ}.“; filtered-empty and weekend reuse the visible panel sentences. View switches are announced by the tabs.
- S4-03 update: Google Kalendar links keep the build-date `dates` only as the no-JS fallback. After mount and every minute the island rewrites `dates` to the next start strictly after now (occurrenceDates strict), the same rule as „Sledeći trening“. .ics files stay build-time (the RRULE makes an old DTSTART harmless).
- S4-11 update: the calendar-scope note is body-small (15px) in the text colour, with slot text NBSP-glued. The group without a fixed slot (C starije) gets a footer with „Termini ove grupe nemaju stalno vreme, pa se ne dodaju u kalendar.“ plus „Pozovite 060 028 7631“ (tel:).
- „danas“ marker: 13px lowercase (as written), .01em tracking. 13px caps with .08em tracking would not fit the 43px day tab at 320px.
- S4-10 update (display-only typesetting): the dash in group names is glued to the preceding word (never starts a line); group titles and Po danu names use text-wrap: balance; the hyphenated compound in the location title is kept whole; the location title in the ≥1280 sidebar is clamp(24px, 2.5vw − 8px, 28px) so it never breaks at the hyphen. The location card uses 16px side padding below 360px so that word stays inside the padding at 320.
- „Sledeći trening“ chip: label and value sit in one text column, so on narrow cards the value wraps under the label (not under the icon). Radius 18px (a pill on one line, a soft ticket on two).
- S4 card titles use font-stretch 118% on desktop (was 112%), per §3.
- S4 hover styles are gated by @media (hover: hover), so touch taps leave no sticky hover ring.
- S4 forced-colors block: real borders on controls and surfaces; the selected tab, pressed pill and selected day use Highlight/HighlightText; the decorative sliding pill is hidden.
- S4 motion tokens: sched-in uses translateY(var(--offset-reveal)) and var(--dur-base). Tabs, pills and day buttons transition translate/scale for the global :active squash (press dur-tap, release dur-slow-squash rebound).
- New UI strings: „Termini ove grupe nemaju stalno vreme, pa se ne dodaju u kalendar.“: note on the card of a group without a fixed slot (C program, starije) · „Prikazano: {n} od {N} grupa.“: sr-only polite status after a filter change in „Po grupi“ (same pattern as the S3 „Prikazano: …“) · „Prikazano: {n} od {N} treninga u {ponedeljak/utorak/sredu/četvrtak/petak}.“: sr-only polite status after a filter or day change in „Po danu“ · „(otvara se u novom prozoru)“: sr-only suffix on the Google Kalendar and maps links; replaces „(otvara se u novoj kartici)“ and matches SourceLink · Reused, not new: HERO.ctaSecondary „Pozovite 060 028 7631“ as the call link on the C-starije card; SCHEDULE_UI.filteredEmpty and SCHEDULE_LOCATION.weekendEmpty as status text

### About (S5) and coaches (S6) — round 1

- S6 desktop (≥1024): the coach cards stack in cols 1–7 with equal heights (grid-auto-rows 1fr), and photo 05 fills cols 8–12 at exactly their height (object-fit cover, object-position 100% 50%, photo box ≤800 px so it never draws wider than 600 px). This replaces the half-empty row under the cards. Below 1024 photo 05 stays the 3:2 print under the cards (object-position 50% 29%), as §5 describes.
- Photo 05's frame is built in Coaches.tsx around <Picture> (no frame prop). The frame label comes from PHOTOS['05'].frame and the caption is COACHES_COPY.groupPhotoCaption. This makes the brush overlay equal to the photo box.
- The brush loop is drawn once in the 3:2 print's 600×400 space. The SVG's viewBox is the whole photo (1200×1600) with preserveAspectRatio xMaxYMid slice, which matches object-fit cover. A CSS transform on .brush__art places the loop per layout: translate(0,400) scale(2) for the 3:2 print, translate(0,232) scale(2) for the desktop column. The same loop surrounds both coaches in both crops.
- Coach card container query: stacked below 520 px card width; portrait left from 520 px (168 px portrait, 44 px gap, 76 px stamp); 224 px portrait with a 52 px gap and 86 px stamp from 620 px.
- Coach licence lines show a SourceLink („izvor ↗“) under the role text: coach lists → SOURCES.coachLicences, judge licence → SOURCES.judgeLicences. Licence numbers, OT/SOT, permit colours and judge category are never shown (dosije „Značenje oznaka“).
- Slađana's placeholder is an aria-hidden decorative frame labelled only with its frame code „KR-07“ (COACHES_COPY.portraitFrame), with no promise in the UI.
- Source links in S5/S6: the link box, and so its focus ring, hugs the text; a ::before of exactly 48 px keeps the touch target. Before this, the 2px ring around the 48 px box struck through the title line above.
- S5 desktop: the single club print (photo 03) is sticky (top 112 px, like the „Hronologija“ title) inside its grid area, so at 1024–1279, where the text is longer, it travels with the reader instead of leaving a hole. Not applied to the CAMP_GROUP_PHOTOS pair, which could outgrow the viewport.
- Coaches motion: a local chain (portraits+stamps, then the brush). It waits for the „Trenerice“ title's landing (0.8 s) and goes through queuePrimaryMotion(). Pending cards on screen or within 35% of a viewport below join the batch that starts. On desktop the brush waits up to 1.2 s for a card still to come.
- Timeline: each line leg goes through queuePrimaryMotion(); a leg that arrives while the line is travelling retargets it. Dots are marked reached when their leg starts, so dot and line stay in step. All async tweens are recorded in the matchMedia context.
- New UI strings: sr-only SourceLink context pattern for coach licence lines: „<ime> — <uloga>“, e.g. „Slađana Kovačević — Licencirana trenerica sportske gimnastike (GSS)“. The resulting accessible name is „Izvor za „…“: gssrb.rs, PDF (otvara se u novom prozoru)“, built by the shared SourceLink. The visible label is the default „izvor ↗“.

### Results (S7) and camp (S8) — round 1

- D-S7-2 (revised) · The digit flip never hides anything in advance. At its turn, the static last digit folds out edge-on (0→90°, DUR.tap, takeoff) and back in (−90→0°, DUR.base, rebound), staggered by STAGGER.cards. Only the correct numeral is ever on screen (SOURCE RULE), even while the flip waits. No count-up.
- D-S7-3 (revised) · Medal marks: one aria-hidden 18px disc per row. „Zlato, srebro i bronza“ gets a single disc with diagonal gold/silver/bronze bands (kinds, never a count, §5 S7), and „1. mesto“ gets gold. A fixed 18px marks column keeps text, date and „izvor“ on one left edge.
- D-S7-5 (revised) · Results motion runs under gsap.matchMedia(MQ.noReduce), so a live switch to reduced motion reverts the split and every inline state. The title's SplitText mask starts on HeadingLandings' IO line (−15%), so mask and chrono landing are one composite landing. The flip, podium and brush wait for their element (−18% line), for the heading landing (+800ms) and the running step, then go through queuePrimaryMotion(). Pre-states are set only for elements off-screen at arm time. The IO observes the h2, not the mark, because a fully mask-clipped element never intersects.
- D-S7-7 · The podium has a dotted navy ghost (stroke-dasharray 0 7, opacity .32) under its solid line. The solid line hides it in the final state; while the draw waits its turn, the band shows a deliberate dotted podium instead of an empty gradient (chronophotograph ghost → solid).
- D-S7-8 · The brush annotation renders only over the real photo 01 (!isPhotoPlaceholder("01")), never over „Fotografija uskoro“.
- D-S7-9 · The stat source-link context for a year tile (4-digit 19xx/20xx value, no prefix) reads „<year> — <label>“, matching the §5 S7 line („2007 — početak rada“). The other tiles read as one phrase.
- D-S7-10 · Below 360px the scoreboard numerals are 36px (still ≥32px Doto) and the window padding is 8px, so „oko 120“ fits at 320px.
- D-S7-11 · Result-row titles and trust-row pills use text-wrap: balance, so no lone word („programa“, „Srbije“, „(2024)“) sits on a last line at 320–1440.
- D-S8-6 · The camp tel link has a 48px target (inline-block, padding-block 13px, margin-block −13px), matching .faq__tel. Its focus ring is a ::after 3px outside the number (§3 3px gap + 2px ring), so it does not frame the invisible target across the line above.
- D-S8-7 · The beam → wave scrub has an in-view guard. If the horizon is on screen when the chunk arrives, the scrub is created only after the horizon leaves the viewport, so a still page never snaps the wave to a half-beam.
- D-S8-8 · Postcards: exits DUR.fast (takeoff), restack DUR.reveal (stick). Reduced motion is re-checked on every change, so a live switch makes changes instant.
- D-S8-9 · Placeholder postcards (MINOR_PHOTOS=false) drop out of the stack while a real camp photo remains. If none remains, ONE placeholder card shows, centered (rotate −2°, no stack, no prev/next, stage height auto), resting on the horizon. The public variant never shows a carousel of identical „Fotografija uskoro“ cards.
- New UI strings: sr-only SourceLink context „2007 — početak rada“ (the year tile; §5 S7 wording, replaces „2007 početak rada“)

### Gallery (S9) and enrollment + FAQ (S10) — round 1

- S9 sheet order is a presentation order (model.ts SHEET_ORDER = 01·16·08·05·12·10·04·14·03·11·15, applied by inSheetOrder() in Gallery.tsx); content/gallery.ts keeps the category mapping. Grouping by category left the CSS-columns masonry with one column about 430px short at 3 columns (1440). The new order spreads the two portraits and three squares across columns. Column spread, measured: 1440 ≈155px (was 435), 1024 ≈130 (was 343), 390/360 ≈45–50 (was 121–129). The near-identical mural frames 12/14 are never side by side. Filtered views stay balanced (Takmičenja 01·08·05, Kampovi 16·10·11). Photos not listed (02/09 with CAMP_GROUP_PHOTOS) follow in content order. The lightbox follows the sheet order. *(superseded by design v2: GE-02 order 04·01·15·05·12·08·03·10·11·14·16)*
- S9 filter status (aria-live „Takmičenja — 3 fotografije“) is screen-reader-only (sr-only). On screen the pressed chip (✓ + count badge) already says it, and the always-reserved empty status row had added about 32px between chips and prints plus a 10px jump on the first filter.
- S9 desktop head: chips vertically centred on the right-aligned „Galerija“ heading (previously bottom-aligned, which put the chips visibly above the heading), matching S3 „Programi“.
- S9 filter Flip: leaving prints fade out in place, beneath the moving prints (z-index 0 vs 1), for DUR.fast with ease takeoff. The data-leaving attribute stands in for `hidden` during the Flip because of Tailwind's [hidden]{display:none!important}; `hidden` is set on complete.
- S9 lightbox photo track is a focusable scroll region (tabIndex 0, aria-label = GALLERY_UI.dialogLabel, part of the Tab wrap, inset focus ring), per axe scrollable-region-focusable.
- S10 FAQ: the global :active squash is moved from the full-width <summary> row onto its round +/× icon (same values: translate 0 1px, scale 1.03/.94, rebound on release). A 3% horizontal stretch of a 650px row pushed the text and icon past the hairline dividers and read as a glitch.
- S10 FAQ questions use text-wrap: balance, so two-line questions split evenly (no lone „počne?“ at 320–360).
- S10 steps (≥640): `.en-step { align-content: start }`. Stretched auto rows had pushed the numeral and text of the step with the shortest text 10–20px below its neighbours at 1024–1440. Numerals and texts now share one baseline at 640, 768, 1024, 1280 and 1440.
- S10 checklist tick-in is S10's primary motion and goes through queuePrimaryMotion(620ms). Durations are tokenised (draw --dur-base, box squash --dur-slow-squash, stagger 60ms), and the pre-state is gated by prefers-reduced-motion: no-preference. *(superseded by design v2: GE-10 real checkboxes, animation only on tap)*

### 404 and error fallbacks — round 1

- D-404-5 · The 404 tilt chunk loads only when motion is allowed (useSyncExternalStore on the prefers-reduced-motion media query). A live switch to reduced motion unmounts it and restores the static pose. Failure isolation is a plain import() with a rejection handler plus a try/catch around the mount, not next/dynamic + QuietBoundary: Turbopack copied QuietBoundary and the loadable runtime into the not-found chunk that ships on every page. Measured first-load JS for „/“: 159,024 B gz → 158,563 B gz (−0.45 KB). For /404: −0.38 KB.
- D-404-6 · Between 1024 and 1279 px the 404 grid splits 6/6. Five columns are narrower than the two buttons side by side, so they wrapped into two uneven rows at 1024.
- D-ERR-1 · app/global-error.tsx is the one Serbian error screen for every uncaught client exception. It renders its own <html lang="sr-Latn">, viewport and title. The site's inlined CSS survives a global error (React keeps precedence styles; verified in the export), so it reuses the 404's .nf system. It names the „mona“ font family directly because the layout's next/font variable classes are lost. The club's name as text replaces the sprite logo.
- D-ERR-2 · No app/error.tsx. It would add about 1.0 KB gz of first-load JS to every page, and all it would bring is the logo and the skip link. global-error already keeps the language, CSS, font and copy.
- D-ERR-3 · The error screen's facts (CLUB.brandName, HERO.ctaSecondary, telHref(PRIMARY_PHONE.e164)) are mirrored in the dependency-free components/notfound/fallback.ts, so content/* stays out of the every-page chunk. tests/seo.test.ts asserts they are identical to content and that the module has no imports.
- D-ERR-4 · The error screen's home link is a plain <a href="/"> (eslint rule disabled on that line, with the reason). After a crash the visitor needs a fresh document, and a client <Link> to the same path would keep the error state.
- New UI strings: „Stranica se nije učitala.“: h1 of the error screen (app/global-error.tsx, components/notfound/fallback.ts ERROR_COPY.title) · „Došlo je do greške. Osvežite stranicu — ako se greška ponovi, pozovite nas.“: lead line of the error screen (ERROR_COPY.lead) · „Osvežite stranicu“: reload button of the error screen (ERROR_COPY.reload) · „Stranica se nije učitala | Gimnastički klub Kraguj“: document title of the error screen (composed from ERROR_COPY.title and CLUB.brandName) · Reused, not new: „Gimnastički klub Kraguj“ (CLUB.brandName) as the home text link; „Pozovite 060 028 7631“ (HERO.ctaSecondary) → tel:+381600287631; the 404 tilt button now uses NOT_FOUND.enableTilt „Uključite senzor pokreta“ (unchanged wiring)

### Orchestrator — round 1

- The schedule's „Sledeći trening“ row keeps its height when no fixed slot is next (visibility instead of
  display), so #raspored is exactly as tall before and after hydration and deep links below it land at 88px.
- Section-title landings take a slot in `queuePrimaryMotion` (≈800 ms), so a section's own primary motion
  follows its title instead of overlapping it. Tap feedback (quiz, filters, sheets) is never queued.
- `SCHEDULE_UI` holds all schedule strings (incl. „(otvara se u novom prozoru)“, the no-fixed-slot note and
  the sr-only filter status); forced-colors borders/highlights for S3/S9 chips live in styles/ui.css.

## Final UI review — judged by the orchestrator

8 specialist analysts (art direction desktop/mobile, UI consistency, typography, interaction, page choreography, micro-interactions, breakage hunter) proposed 98 edits; a pre-screener reproduced each; the orchestrator judged every one.

- **Accepted (70):** AD-02, AD-03, AD-04, AD-05, AD-09, AD-12, AM-02, AM-03, AM-04, AM-05, AM-08, AM-09, ANIM-01, ANIM-02, ANIM-03, ANIM-05, ANIM-06, ANIM-09, ANIM-10, BRK-01, BRK-02, BRK-03, BRK-04, BRK-05, BRK-06, BRK-07, BRK-08, BRK-09, BRK-10, BRK-11, BRK-12, BRK-13, INT-01, INT-02, INT-03, INT-06, INT-07, INT-09, MI-01, MI-02, MI-03, MI-04, MI-06, MI-08, MI-09, MI-10, MI-11, MI-13, TY-01, TY-02, TY-03, TY-04, TY-05, TY-06, TY-07, TY-08, TY-09, TY-10, TY-11, TY-12, TY-13, UIC-01, UIC-02, UIC-03, UIC-05, UIC-06, UIC-07, UIC-08, UIC-09, UIC-14. Overrides of earlier decisions: AD-02 (S3 becomes a dark „darkroom“ section with white card mounts — D-20 assumed chalk/ice separate sections, measured 1.05:1), BRK-07 (phone program cards stretch to one height so CTAs never jump between swipes — four reviewers flagged the dead band), INT-09 (clearer, still red-free validation errors — the client asked for a frictionless form).
- **Rejected, with reasons:**
  - AD-01 (Section titles on the §3 display step at ≥1280 (not the quiz)): a 2× type jump at 1280 and a quiz title left at h2; section titles keep the h2 token (hierarchy is addressed by the larger, visible landing mark and the display-step finale TY-07)
  - AD-06 (Program cards: one filled action per frame; „Pogledajte raspored“ as a): §5 S3 specifies two buttons per card; each card already has exactly one filled action
  - AD-07 (S7: move the trust row under photo KR-01 to close the bottom-left empt): not reproduced (columns end 50px apart, not 300)
  - AD-08: done in design review v2 (RC-01) — the S7 brush now underlines „Medalje“.
  - AD-10 (S10 checklist: sticky only while an FAQ answer is open): the fix introduced a visible glitch in the pre-screen
  - AD-11 (Schedule cards: move the empty space from mid-card to the bottom): moves the whitespace and breaks footer alignment
  - AM-01 (Header over the hero: hide its logo, bar surface and (640–1023) CTA wh): §5 asks for the white logo and the header pill over dark sections
  - AM-06 (Phone program row: equal contact-sheet frames, with the colour plate a): makes the colour plates huge; superseded by BRK-07
  - AM-07 (Footer after the doskok: demote the footer „Zakažite probni trening“ t): the footer pair is filled + outlined, as everywhere; the sticky bar returns over the footer on purpose
  - ANIM-04 (Hero: give the signature landing a „stick“ with the §4 landing squash): the pinned hang ease is the specified landing
  - ANIM-07 (Land section titles once scrolling pauses, not at the bottom edge whil): adds a global scroll listener; the shared −15% line is deliberate
  - ANIM-08 (One easing rule for line draws: strokes that draw use ease-flight (mat): §4 assigns stick to reveals; a line drawing on is a reveal
  - ANIM-11 (Hero at 390: don't pre-fade a takeoff frame that is a third off-screen): D-HERO-3 takes off from the edge on purpose
  - INT-04 (Header hides immediately after the parent uses it (or the menu) to nav): §5 specifies hide-on-scroll-down
  - INT-05 (Sticky-bar SMS and the S11 email row open an empty message): the generic contact channels open empty on purpose
  - INT-08 (The quiz knows the child's age, but the sheet makes the parent pick Go): a non-monotonic year list; parents know the birth year
  - INT-10 (The „+“ sheet mostly repeats the card; give it the per-group actions t): duplicates S4, which the sheet already links to
  - INT-11 (On desktop, the modal backdrop over the dark hero lets the 144 px H1 c): taste; the dialog already dominates
  - INT-12 (404 „Ravnoteža na gredi“ has no input on desktop, so the gag is a stil): §4 defines the 404 gag as DeviceOrientation
  - MI-05 (Flip filters: the next section jumps up in one frame and cuts leaving/): the proposed z-index made the cut worse
  - MI-07 (Sliding tab pill: both labels wash out mid-slide): the fix costs more than a 1–2 frame wash
  - MI-12 (Booking bottom sheet opens over ~700 px in 280 ms and pops rather than): not reproduced (headless frame skipping)
  - UIC-04 (The venue card exists twice (S4, S11): give both the same hierarchy, p): the two venue cards have different jobs (S4 primary aside, S11 secondary)
  - UIC-10 (S11 CTA panel: concentric slab corners (off-token 12px slab)): negligible benefit, off-token fix
  - UIC-11 (Quiet text buttons (quiz Nazad / Počnite ponovo, booking „Dodajte napo): breaks the quiz control row at 320
  - UIC-12 (KR frame codes: one class (404 and lightbox reuse .frame-label)): the 404 code is a page kicker, not a photo foot
  - UIC-13 (Lightbox counter matches the other two ‘n / N’ counters (tabular, labe): no jitter reproduced
  - UIC-15 (Label width axis: controls at 104%, caps labels at 100%): invisible 4% axis difference that eats the 320px margin
- **Shared layer (orchestrator):** real hop landing on every section title (ANIM-01: X linear, Y a parabola through the ghost frames, 600 ms); larger mark on phones (AM-04) and royal-tinted ghosts on light sections; `lib/typeset.ts` Serbian typesetting applied to running copy (TY-02, BRK-13); `.ui-icon` stroke system (UIC-01); `.icon-btn` recipe (UIC-02); hover only on hover-capable devices (INT-06, MI-11); dark-section CTA presses without its lip (MI-10); `.measure` = min(64ch, 34em) below 1024 (TY-06); light↔light section boundaries spaced 72/144 between content as §3 says (AD-04); chip toggles transition only translate/scale (MI-04).

## Final UI review — implementation notes

These lines supersede earlier lines with the same ID.

### hero

- D-HERO-3 (amend) · The wide art and the desktop composition apply to landscape ≥640, or ≥1024 with a fine pointer. Portrait touch ≥1024 (iPad Pro 12.9, large Android tablets) keeps the one-column tablet poster: compact leap right-aligned, capped at 720px (540px from 640), H1 at 112% full width, CTAs and trust in a row. Pin and spine only run on (min-width:1024px) and (pointer:fine), where the wide art always shows.
- D-HERO-3b · On short portrait phones the compact art is right-aligned and height-capped with max(16svh, 100svh − 560px): a continuous cap with no height breakpoint, so it does not jump when the toolbar hides. The primary CTA is on the first screen from 360×640 up (320×640 is 12px short). Tall phones (≥ ~740px) are unchanged. Without svh the art stays full width.
- D-HERO-11 (amend) · The H1 is typeset for display only (typesetSr: 'u' + NBSP + 'Kragujevcu'), so it never ends a line on the preposition. The widest line is 'u Kragujevcu' at 6.7311em (118%) and 6.8581em (121%), so the width-cap divisors are 6.75 and 6.87. Resulting H1: 90.5px at 1024, 113.7px at 1280×800, 126.9px from 1416 up; 1280×720 and 1366×768 are still capped by height. content/copy.ts, the title, meta and OG image keep the plain string.
- D-HERO-18 (amend) · Landscape phones (landscape, height ≤500, width <1024) size the H1 at clamp(2.75rem, 16svh, 5.5rem). At 844×390 that is 62.4px on 2 lines, with the CTAs at y 489 instead of 690.
- D-HERO-15 (amend) · Desktop scrub: the floor diagonal draws over the whole pinned range (timeline 0–1) while the ghosts fade oldest-first (0–.65, stagger .09). The first wheel tick visibly grows the line from the mat's right end, and the line reaches the hero's bottom edge exactly at pin end.
- D-HERO-23 · .hero__title has overflow-wrap: break-word. Under the WCAG 1.4.12 text-spacing override a word that no longer fits breaks instead of running under the aside or being clipped by the hero; at default spacing nothing changes.
- D-HERO-21 (amend) · Hero typesetting now goes through lib/typeset typesetSr for the eyebrow segments, H1, sub (plus 'od 3.' glued to the word before it), CTA labels (phone number unbreakable) and trust items. The easter-egg story is typeset in its lazy chunk, which is the only place it is shown, so the dash in '10 — pisalo' no longer starts a line.
- Hero icons: the trust ✓ and the egg close × carry .ui-icon (stroke 2, action glyphs). The trust icon-to-label gap is 8px. The egg close :hover is gated by @media (hover: hover).

### chrome-404

- D-chrome-19 · Sticky bar with enlarged system text (Android font scale, OS page zoom): the pill list is an inline-size container. At ≤17.5em, measured in the list's own font size so it follows the text scale, the pill icons are dropped and the padding goes to 6px. At normal text sizes nothing changes (320px: list 304px > 297.5px). The pill icon gap stays 6px (4px under 360px), a documented exception to the 8px icon gap: with 8px the bar would overflow at 360px and about 113% text, just before the container rule takes over.
- D-chrome-20 · Menu sheet: the ::backdrop is transparent, so the 280ms shutter visibly comes down over the live page (the dialog covers the viewport itself). „Zatvorite“, Esc and Android back ('cancel', preventDefault) lift it again: data-closing → CSS menu-shutter-out (clip-path, 180ms takeoff) → close() on animationend, with a 260ms fallback timer. The close is instant under reduced motion or Save-Data. Links keep the synchronous close (D-chrome-5). Every close path ends in the close handler, which clears the timer and data-closing.
- D-chrome-21 · Focus guard (replaces the half-viewport bail of D-chrome-9): the focused element is scrolled into the free band between the resting edges of the header and the sticky bar, 12px clear of both. An element taller than the band has its top edge pinned under the header. Scrolling up while the header is hidden brings it back (≥12px travel, or into the first 120px), so that correction also clears the header's resting edge. On ≤480px-tall viewports it also uses the bar's space, since the bar steps aside there. The pure logic is in chrome.ts (bandDelta, focusScrollDelta) and unit-tested.
- D-chrome-22 · The footer's external links share one pattern: label + trailing ↗ (ExternalIcon) on GSS, Instagram and Facebook. Instagram and Facebook keep their leading glyph and the 12px gap (a 24px glyph in a 56px list row).
- D-chrome-23 · Chrome icons carry .ui-icon (non-scaling stroke). Pictograms (phone, message, Viber, calendar, Instagram, Facebook) are 1.75px. Action glyphs are 2px: ×, ↗, and the menu bars, which swap with × in the same button. Every :hover rule in header.css is gated by @media (hover: hover). Header, menu-sheet and footer copy goes through typesetSr (phone numbers never break), and the footer line also glues its „ · “ separator to the word before it.
- D-404-5 · The 404 h1 is typeset for display only (typesetSr + NBSP in „ova stranica“): „Ups — / ova stranica / je izgubila / ravnotežu.“ on desktop and at 320px, „Ups — ova stranica / je izgubila / ravnotežu.“ at 360px. The document title, metadata and content/copy.ts keep plain spaces, and global-error is unchanged. The 404.copy check in qa/content.mjs already normalises NBSP (JS \s matches U+00A0).

### programs

- D-20 (rev, AD-02): S3 programs is a dark navy-900 „darkroom“ section, replacing „ice“. Program cards and the program detail sheet are white light-theme prints (data-theme="light" on article.program-card and on the dialog). KR-04 keeps the dark navy-950 frame. The pressed chip uses the section CTA pair (lav-200 + navy).
- Programs (BRK-07, overrides the „natural heights“ lines): below 1024 the scroll-snap row also stretches, so every card has the row's height and the CTAs sit at the same place on every card. A short card's extra height is whitespace above its CTAs.
- Programs (BRK-11/TY-10): at 320–339px a card is calc(100vw − 60px) wide, so „Zakažite probni trening“ stays one 52px line; the next card still peeks by 28px.
- Programs (UIC-08): the filled „Zakažite probni trening“ comes first in every card and in the sheet footer, as in every other CTA pair. At ≥640 the sheet footer is two equal columns, like the booking sheet (UIC-05).
- Programs detail sheet (MI-01): closes by shrinking back onto the card (0.18s takeoff, fully opaque); the card reappears in the frame the sheet closes. Replaces „while fading into it“.
- Programs filter Flip (MI-06): the Flip state is captured before React commits the pressed chip, the status line and the pager (one flushSync). Every layout shift of a tap therefore moves inside the 280ms Flip.
- Programs filter Flip (MI-13): a leaving card fades linearly (0.18s) while its 0.96 exit scale keeps takeoff; entering cards fade/scale 0.96→1 over 0.28s stick, clearProps. Same pattern as S4. Replaces „fade in 0.18s ease takeoff“.
- Programs icon draw (ANIM-09): the observer watches each card's colour plate (threshold 0.6), not the card. Plates that come into view before the pending draw starts join the same staggered batch, so both desktop rows draw together and off-screen phone cards never draw unseen.
- Programs KR-04 (AD-09): at ≥1280 the print stretches to its row's baseline. The photo box is capped at 533px (native 1066/2) and the frame is capped with it, so the cover crop is never drawn above native/2. Filtered rows that are taller leave a short notch (47px at 1366+, 78px at 1280).
- Programs sheet (BRK-12): below 480px viewport height the plate is 72px with a 40px icon. Below 640px wide the stacked CTAs follow the text instead of staying sticky.
- Programs: .pg-pager__btn uses the shared .icon-btn recipe (UIC-02); every functional icon in S3 (✓, chevrons, +, ×) carries .ui-icon (2 CSS px). The chip ✓-to-label gap is 8px. Chips transition only translate/scale (MI-04) and chip hover is gated by (hover: hover). .pc-age is a 1px ring (a label, UIC-06).
- Programs typesetting: card title, age and description, the filter status (typeset on the server) and the sheet copy go through typesetSr. The sheet's location line also glues „Toza Dragović“ and „Save Kovačevića 25“ (display only; the content string is unchanged).
- Programs forced colors: programs.css re-applies Highlight/HighlightText to the pressed chip, because its own pressed rule comes later in the cascade than the styles/ui.css forced-colors rule.

### quiz-about-coaches

- TY-04 · Quiz answer chips: three content-sized tracks (repeat(3, auto)) from 768px, one 460px column at 1024–1279. „Treniralo je rekreativno“ is one line from 360 to 1920 (at 320 it still wraps). Arrow keys read the column count from the computed grid.
- INT-01 · Quiz result: the heading takes focus with preventScroll. One rAF later the page scrolls just far enough for the booking CTA to clear the fold or the mobile sticky bar by 16px. It scrolls only when the whole CTA fits with the heading still at least 96px from the top; there is no partial scroll. A heading that is off-screen goes to 96px, as the native focus scroll did. Positions are measured at rest: the card's in-flight quiz-in translateY is subtracted. Scrolling is instant under reduced motion or Save-Data. The competitive result at 320–360px wide stays below the fold by design.
- AD-05 · S5 ≥1024: KR-17 hangs in the empty cols 1–4 as a margin print, level with the 2017→2022 leg. Its list item and reading order are unchanged; it only drops out of the flow (height 0, absolute print, right edge 48px from the rail, width = cols 1–4 − 24px capped at 300px). The „Hronologija“ h3 is therefore no longer sticky at ≥1024. The zero-height item keeps one 44px row gap.
- AM-09 · S5 phones (<640): the mission's first sentence is set as a statement (h3 token, 650 weight) and the rest reads as body copy. This is display-only typesetting, like D-HERO-21: one <p> with identical characters, split only before a capital letter so ordinals never cut it, no split without a match. At ≥640 the lead is unchanged.
- Typesetting · S2/S5/S6 server components pass visible copy through typesetSr (lib/typeset). Booking prefill labels, the licence-stamp label and sr-only source contexts stay raw.
- Icons · Quiz chip arrow and the Nazad/Počnite ponovo glyphs use .ui-icon with 2px action strokes.

### schedule

- S4 AM-05: when no fixed slot is next, the invisible „Sledeći trening“ row moves to the end of the card foot (grid order 99). It becomes bottom padding and the calendar links sit right under the hairline. #raspored height is unchanged.
- S4 UIC-03: schedule cards and „Po danu“ day cards get the same elevation as every other white card: hairline ring + var(--shadow-2), static. The location card stays flat as the secondary aside.
- S4 UIC-07: „Dodajte u kalendar (.ics)“, „Google Kalendar“ and the tel link use the .link underline recipe: 1.5px at 0.2em, 2.5px on hover (hover-gated).
- S4 INT-02: picking a day in „Po danu“ while the strip is stuck brings the day panels back to 12px under the strip at the header-shown offset. The upward scroll re-shows the header. It runs only for a user's day pick that changes the day, never for the after-mount today selection or view/filter changes.
- S4 INT-07: with a program filter on, day tabs without a training of that program are muted like the weekend (weight 500 + muted colour) and read „<dan>, bez treninga“ to screen readers. They stay focusable and selectable. Emptiness is computed from the filter with matches(), never from `hidden`. Nothing changes under „Sve“.
- S4 MI-03: the location card is position: relative; z-index: 1, so on stacked layouts it paints over a card fading out of the filter Flip. No JS change.
- S4-10 update (BRK-04): the hyphenated compound in the location title stays whole unless it cannot fit its line (inline-block, not nowrap). The days column of the days/times grid may shrink (minmax(0, 5.75rem)) before a time range sticks out of its card. The page never scrolls sideways under zoom, 150% text or WCAG text spacing.
- S4 shared layer: server-rendered running copy now goes through typesetSr: section intro, calendar notes, empty-state sentences, „Pozovite 060 028 7631“, link labels, nickname and address. Group names use typesetSr + the existing glue. Functional icons (calendar, external, phone, pin, pill ✓) carry .ui-icon, so strokes are 1.75/2 CSS px. The drawn leap silhouettes do not. The „ · <slot>“ separator on multi-slot Google links is NBSP-glued, so it never starts a line.
- S4 bundle: INT-02 + INT-07 add +223 B gz to the schedule island chunk (15,497 → 15,720 B). Measured by two production builds in a clone; first-load module JS 155.6 → 155.8 KB gz, within the 160 KB budget.
- New UI strings: „, bez treninga“: sr-only suffix on a „Po danu“ day tab when a program filter is on and that day has none of its trainings (e.g. „utorak, bez treninga“). Reuses SCHEDULE_UI.dayOff; no new string in content/.

### results-camp

- D-S7-5 (revised, ANIM-03): the title's SplitText mask and the chrono landing share ONE queuePrimaryMotion(800) slot. results-motion sets data-landed on the mark and starts the line rise in the same callback. SplitText is reverted (and the same mark node re-inserted) 950 ms later, after the 600 ms hop, so no chrono transition is ever cancelled. The flip, podium and brush still wait for their element (−18% line), the heading landing (+800 ms) and the running step.
- D-S7-5 addendum (ANIM-10): the brush step observes the stroke's own path (strokes[0]), not the full-photo overlay, so on desktop the podium always goes before the brush (flip → podium → brush). On phones the layout order stays brush → podium.
- D-S7-10 addendum (BRK-10): S7's own .container-site is a named container (scoreboard / inline-size, never the shared class). Below 15.5em (page zoom ≤280px or enlarged text) the scoreboard is one tile per row. At ≥1024 below 50em (enlarged text only; the default is ≥54em) it is two per row, so „2007“ / „oko 120“ never leave their display window.
- D-S7-12 (UIC-09/UIC-06): the scoreboard uses radius-lg (20px) like the sibling Medalje panel, concentric with its 8px windows. Trust-row pills have a 2px hairline ring (tappable), steel-300 on hover, and hover is gated with (hover: hover).
- D-S7-13 (TY-05/TY-13c/TY-02): result dates use proportional figures at 15px (the Nastupi 14px override is removed). All visible S7/S8 copy (titles, stat labels, result titles/dates, photo caption, trust pills, camp lead, camp note) goes through typesetSr() in the server components. SourceLink sr-only contexts stay raw.
- D-S8-10 (AD-12): at ≥1024 the postcard prev/next sit centred under the stack they move (cols 6–12, row 4, below the horizon), the same order as on phones. The left column ends with the note.
- D-S8-11 (UIC-02/UIC-01): the postcard buttons use the shared .icon-btn recipe (48px). The chevrons and the note sun icon are .ui-icon (action glyph 2px, pictogram 1.75px); the trust-pill external arrow is a 1.75 pictogram with an 8px icon gap. The camp note keeps a 12px icon gap as a documented exception: a 24px leading icon beside a multi-line paragraph, not an icon+label pair.
- D-S8-12 (UIC-07/TY-11): the camp note is at body size (17px/1.5). Its phone link is 700 with proportional figures and the number glued with NBSP. The display lead uses text-wrap: balance.

### gallery-enrollment

- S9 sheet order (AD-03): SHEET_ORDER = 16·08·01·05·12·10·04·14·15·03·11. The gallery opens on photos no other section shows (≥640 first row KR-16 · KR-12 · KR-15; phones 16 | 04), with the same column membership and spreads as before (46/106/131/152/164 px at 390/768/1024/1280/1440). *(superseded by design v2: GE-02)*
- S9 public variant (BRK-01, same rule as D-S8-9): with MINOR_PHOTOS=false the sheet shows the real photos plus ONE „Fotografija uskoro“ placeholder, last. Chips count real photos only; with fewer than two categories there is no chip row. The kept placeholder shows under „Sve“ only. With MINOR_PHOTOS=true nothing changes.
- S9 lightbox close (MI-02): every close path first calls revealPrint(), an instant scroll that brings the whole print link (frame + caption foot, i.e. the focus target) into the band scroll-padding + 12px, rounded outward to whole px. It runs while the lightbox still covers the page. Focus then returns with preventScroll, and finalize runs right after dialog.close(), so the opener never paints a ring and the page never scrolls after the photo lands. A forced close reveals in finalize.
- S9 lightbox close scrim (MI-09): fades over DUR.fast (linear), an exit ≤200ms per §4; the photo's Flip.fit stays DUR.base, stick.
- S9 filter Flip (MI-13), the shared S3/S4/S9 recipe: leavers fade linearly over DUR.fast and shrink to 0.96 with takeoff; newcomers go from opacity 0 / scale 0.96 to 1 over DUR.base (stick), then clearProps opacity,transform.
- S10 tablets 768–1023 (AM-08): kit card and FAQ side by side (5fr/7fr, gap 24px), kit not sticky; the section is 1210px at 768 (was 1731).
- S10 step numerals (TY-05): proportional lining figures (tabular class removed), so the outline 1 has no slab foot.
- S10 FAQ phone link (UIC-07 + TY-05): explicit lining proportional figures, matching every other inline „060 028 7631“. TY-05's proportional rule wins over UIC-07's tabular value, as the orchestrator already ruled for .camp__tel.
- S9/S10 shared layer: typesetSr() on all running copy rendered by Gallery.tsx/Enrollment.tsx (heading, captions, steps, year line, CTA labels incl. „Pozovite 060 028 7631“, checklist, note, FAQ questions/answers, last line); .ui-icon on the functional glyphs (chip ✓, zoom mark 1.75px as a pictogram, lightbox ×/‹/› 2px, FAQ +/× 2px; not on the checklist boxes or leap silhouettes); every :hover rule in gallery.css/enrollment.css is gated by @media (hover: hover); gallery chip gap 8px (icon→label and label→count, count margin removed). The lightbox buttons keep their own recipe (UIC-02: lightbox unchanged).

### booking-contact

- D-S11-9 (rev) · The S11 title mark is static (SectionHeading land={false}), so the doskok is S11's only landing and no longer waits for the title (trackHeadingLanding removed). It plays when half of the hop band ([data-doskok-arc]) or half of the button is in view, with no bottom margin, through queuePrimaryMotion. So the hidden pre-state never rests as an empty band above a visible button, including after the header „Kontakt“ jump at 1024–1440 where the display title leaves the button at the fold. *(superseded by design v2: D-S11-21 trigger)*
- D-S11-11 · Doskok flight (ANIM-05): the hop flies on EASE.hang (fast takeoff, hold at the apex, fast drop into the squash), and the ghost drops follow the same ease. The flier fades in over DUR.tap on the first ghost frame. DOSKOK_MS is unchanged.
- D-S11-12 · The S11 title is the page's only use of the §3 display step (TY-07): clamp(2.25rem,1rem+5.4vw,6rem), line-height .92, letter-spacing −.04em, weight 800, max-width 14ch, balance, keeping the h2 width rules. Its mark is width max(1.1em, 4rem): proportional on desktop (≈103px at 1440) and never smaller than the other titles' phone marks (≈64px). At 320–343 the title is three lines („Dođite / na probni / trening“) because „probni trening“ (240px) does not fit a 280px line with any mark. *(superseded by design v2: D-S11-16/17)*
- D-S11-13 · S11 icons use the shared .ui-icon system: contact pictograms stroke 1.75, the → and ↗ glyphs 2 (same weights as the chrome icons), the trust ✓ at 2. The maps pin is 20px (as in S4). Icon-to-label gap is 8px on the trust list; the contact rows keep 16px beside their 48px icon circle, as the list-row layout. Hover is gated by (hover: hover). *(superseded by design v2: D-S11-24 (no → on call/e-mail rows))*
- D-S11-14 · 640–719 (TY-08): venue card side padding 16px, maps button padding 12px with a 6px icon gap (a documented exception to the 8px gap, only in this range), and handle/email at 15px. Below 390 the handle and email are 16px. The maps button is one 52px line at every width; at 320 the handle keeps its <wbr> break after „_“.
- D-BK-8 (rev, INT-09) · Validation errors: the error line is navy (--fg) at 15px/650 with an 8px gap and balanced lines. The icon is a filled royal-600 disc with a white „!“ (solid means stop; outline glyphs are info or actions). The invalid box has a 2px accent border (1px border plus 1px inset ring, no shift) on an ice-50 fill. Still no red, and colour is never the only signal.
- D-BK-12 (rev, TY-01/AM-02/INT-03) · Both selects stop their text 40px from the right edge, with the chevron 12px in, so stacked chevrons line up. The 134px Godište box at 360 keeps „Izaberite“ on one line with 13.8px to the chevron, and the row stays 52px. overflow-wrap:anywhere remains only as a last resort for very large text.
- D-BK-14 (amendment, BRK-05) · At viewport heights of 480px or less (phones in landscape, 200–400% zoom), the whole sheet scrolls as one (head, fields, footer) and there is no sticky head. The fixed action footer applies only above 480px, the same threshold as D-chrome-13. The dialog resets its scrollTop on open.
- D-BK-18 · Booking title is font-stretch 118% from 1024px (TY-13b).
- D-BK-19 · Sheet copy is typeset for display with typesetSr: privacy line, error lines, status (replaces the old keep-number-together spans), call and Viber numbers, and the visible select value box (e.g. „…(A, / B i C program)“). The <option> labels, the message and the hrefs stay raw. The dialog chunk is lazy, and typeset is already in other client islands, so first-load JS is unchanged (155.8 KB gz in the production build).
- TY-05 (booking-contact part) · Phone numbers in S11 rows and in the sheet's call and Viber lines use proportional figures (tabular removed).

### UI strings that are not in the master prompt

Mechanical labels only (buttons, aria labels, states, validation). No facts. All are editable in content/ or the named component.

- **Hero (S1):** "Zatvorite" — aria-label of the easter-egg close button (components/sections/hero/EasterEgg.tsx)
- **Page chrome — header, menu sheet, sticky bar, footer:** "Glavni meni" — aria-label of the main navigation (header + menu sheet) · "Meni" — visible label of the mobile menu button and the sheet's accessible name · "Zatvorite" — visible label of the sheet's close button (same word as BOOKING.close) · "Brzi kontakt" — aria-label of the mobile sticky bottom bar · "(otvara se u novom prozoru)" — screen-reader suffix on footer links that open a new tab (same wording as SourceLink) · Screen-reader-only number suffix on the bar's call/SMS links: " 060 028 7631" (PRIMARY_PHONE.display) · Sheet call link text "Pozovite 060 028 7631" is built from CTA.call + PRIMARY_PHONE.display (identical to HERO.ctaSecondary)
- **Quiz (S2):** „Nazad“ — back control (quiz step 2 and result) · „Počnite ponovo“ — restart control (quiz result) · „god.“ — age unit in the strip's answers caption („9 god. · Tek počinje“) and the no-JS guide („3–7 god.“, „8 god.“, „9–18 god.“, „8–18 god.“), matching the schedule's „(3–8 god.)“ · „KR-Q“ — frame code on the chronophotograph strip (the photos' KR-xx convention; aria-hidden) · „01“ „02“ „03“ — frame numbers on the strip (aria-hidden) · „Mlađa početna grupa / Starija početna grupa“ — booking prefill for the age-8 beginner result, composed from program titles · „ · “ — separator between answers and between experience labels in the guide (non-breaking space before the dot)
- **Programs (S3):** Chip: „Svi programi“ · Chip: „3–8 godina“ · Chip: „Od 8 godina“ · Chip: „Takmičarke“ · Chip group aria-label: „Prikažite programe za uzrast“ · Filter status (aria-live): „Prikazano: {n} od {ukupno} programa.“ (+ reuses QUIZ.aerobicHint when aerobic gymnastics is filtered out) · + button aria-label: „Više o programu „{naziv programa}““ · Sheet schedule subheading: „Raspored“ · Pager aria-labels: „Prethodni program“ / „Sledeći program“ · Sheet close aria-label reuses BOOKING.close „Zatvorite“; sheet location line reuses SCHEDULE_LOCATION.sub
- **Schedule (S4):** Prikaz rasporeda (aria-label of the Po grupi/Po danu tablist) · Program (aria-label of the filter pill group) · Sve (filter pill) · Dani treninga (aria-label of the 7-dot week row) · trening / bez treninga (sr-only state per day in the week row, e.g. „ponedeljak, trening“) · Dan u nedelji (aria-label of the day strip) · danas (today marker under the day tab; also used in chip forms) · Izabrani program nema trening ovog dana. (day view, filtered empty state) · U kalendar se dodaju samo termini sa stalnim vremenom: {Ut, Če 17:30–19:30}. (note on mixed groups) · (otvara se u novoj kartici) (sr-only on Google Kalendar and maps links) · Adresa (label on the location card) · u gradu poznata kao „ŠUP“ (location card; wording from the §5 S4 sub line + VENUE.nickname) · Sledeći trening: (label; master-prompt text followed by a colon) · .ics SUMMARY / Google text: „GSU „Kraguj“ · {group name}“ · .ics DESCRIPTION / Google details: {§5 S4 sub}\nPozovite 060 028 7631\n{SITE_URL}/#raspored · .ics PRODID „-//GSU Kraguj//Raspored treninga//SR“ and X-WR-CALNAME = SUMMARY
- **About (S5) and coaches (S6):** „izvor (sportska)“ — visible label of the 2026 GSS artistic-gymnastics registration list link (mechanical) · „izvor (aerobna)“ — visible label of the 2026 GSS aerobic registration list link (mechanical) · sr-only SourceLink context „42 registrovane takmičarke u sportskoj gimnastici, 2026.“ (wording from §5 S7) · sr-only SourceLink context „12 registrovanih takmičarki u aerobnoj gimnastici, 2026.“ (wording from §5 S7) · sr-only SourceLink context pattern „<year>. — <timeline title>“ (e.g. „2007. — Počeci kluba“) · Stamp SVG shows „LICENCA“ / „GSS“ in caps: the visual split of COACHES_COPY.badge „Licenca GSS“ (sr-only span carries the original)
- **Results (S7) and camp (S8):** „Fotografija {n} od {N}“ — sr-only live-region text for the postcard counter (components/sections/camp/camp-copy.ts); visible counter „1 / 2“ · „(otvara se u novom prozoru)“ — sr-only suffix on the two trust-row links (same wording as the Contact section) · SourceLink accessible names (via the shared component): „Izvor za „<stat or result>“: <host>, PDF (otvara se u novom prozoru)“
- **Gallery (S9) and enrollment + FAQ (S10):** „Sve“ — gallery all-photos chip (GALLERY_UI.all) · „Prikažite fotografije“ — aria-label of the chip group · „{Kategorija} — {n} fotografija|fotografije“ — aria-live filter status, e.g. „Takmičenja — 3 fotografije“ (Serbian plural helper photoWord) · „Otvara veći prikaz fotografije.“ — aria-describedby hint on gallery links · „Galerija — veći prikaz“ — lightbox dialog aria-label · „Zatvorite“ — lightbox close button aria-label (same as BOOKING.close) · „Prethodna fotografija“ / „Sledeća fotografija“ — lightbox prev/next aria-labels (same wording as CAMP.prev/next) · „{i} / {n}“ (visible) and „Fotografija {i} od {n}“ (screen readers) — lightbox counter
- **Contact (S11) and booking sheet:** „Neka trenerica predloži“: label of the undecided Grupa option (lib/booking.ts GROUP_UNDECIDED.label) · „neka trenerica predloži“: how the undecided group reads in the message („grupa: neka trenerica predloži“) · „Upišite ime roditelja.“: validation error · „Upišite broj telefona.“: validation error · „Proverite broj telefona — dozvoljene su cifre, razmaci i „+“ na početku.“: validation error · „Upišite godište deteta.“: validation error · „Upišite godište od četiri cifre, između {min}. i {max}.“: validation error (currently 2008 and 2024) · „(otvara se u novom prozoru)“: sr-only on the Instagram and maps links (same wording as SourceLink) · „Viber: 060 028 7631“: desktop fallback when SHOW_VIBER=true · Reused, not new: HERO.trust (3 points) and BOOKING.privacy in the S11 CTA slab; CTA.trial on the doskok button; BOOKING.close as the aria-label of the sheet's close button
- **SEO, icons, share image, 404:** OG/Twitter image alt: „Gimnastički klub Kraguj — logo kluba i silueta gimnastičarke u skoku“ · 404 document title (composed from NOT_FOUND.title + brand): „Ups — ova stranica je izgubila ravnotežu | Gimnastički klub Kraguj“ · 404 frame label: „▸ KR-404“ (contact-sheet frame label; the ▸ is aria-hidden) · Manifest short_name and apple-mobile-web-app-title: „Kraguj“ · JSON-LD sport values (not visible UI): „Sportska gimnastika“, „Aerobna gimnastika“ · Reused existing copy (not new): the OG image text uses HERO.eyebrow and HERO.h1; the 404 secondary button uses HERO.ctaSecondary „Pozovite 060 028 7631“; NOT_FOUND.title / cta / enableTilt

## Design review v2 — decisions

Second design pass (user request: critical design/UI review, sport-related motion, a better hero).
Eight area critics scored and proposed; the orchestrator judged every proposal (scratchpad design-verdicts);
eight fixers implemented the accepted ones. Where a line below contradicts an earlier decision, this one wins.

### Shared layer (commit 88e88a1)

- Section titles get their own step, `--text-section` (clamp 2rem → 4.25rem, 800, lh .95, ls −.035em), between display and h2.
- Gymnastics motion vocabulary: `--ease-land` / `EASE.land` (stuck landing), `spring`, `wobble`, `swing` (elastic, sampled into CSS `linear()` by scripts/ease-tokens.mjs → styles/motion-tokens.css), `score` (steps). Every landing in the site uses `land`; nothing lands on a plain ease-out.
- The title mark (ChronoMark) flies a real parabola (X linear, Y out-of-range cubic-bezier), pitches −10° → 4° → 0 and sticks the landing (1.05/.86 → 1). HeadingLandings sets `data-landing` / `data-landed`; accents never take a primary-motion slot.
- Leotard ghost tokens `--ghost-1/2/3` (royal/violet on light; ice/lavender/violet on dark) for every chronophotograph trail.
- Dark sections get a diagonal top edge (`<Section edge="up">`, `.edge-cut` + `.edge-line`, cut clamp(28px, 5.5vw, 88px)).
- Source links are quiet footnotes (13px, muted). Photos get a visible cool grade (saturation .9, blue lift) in scripts/images.mjs.
- Deliberate spec deviations accepted in this pass: the S7 split-flap flip became an LED score scan (same intent, D-S7-2 v2); S3 and S9 are dark „darkroom“ sections; the nav label is „Trenerice“ (both coaches are women); S5 is light with a dark „Hronologija“ band.

### Hero lab (commit 480c3c6) and hero polish

- Four hero concepts were built in isolated worktrees (sports photo, strobe, kinetic landing, floor pass) and judged by three independent judges (sports art director, parent on an Android phone, motion juror). Floor pass won 3/3 and was merged; the others were discarded.
- D-HERO-24 · Floor pass v2: a chassé bound into a step-hop split leap. She enters in the air (whole, inside the frame), plants the push foot and takes off. The horizontal speed of the centre of mass is one smooth curve from the entry through the takeoff into the flight; the dip is spread over about 6 frames. The planted toe is solved so it never slides, the body compresses at most about 9%, and height follows an inverted pendulum plus a Hermite correction.
- D-HERO-25 · Rig v2 is a ball joint. Each leg turns about the centre of a disc inscribed in the thigh (back [92.5,126.25] r 8.9, front [131,125.1] r 9.8, measured on the logo raster). The cut runs along two radii of the disc, so there is no notch or lump at any angle or DPR. The discs are drawn as ink with the torso.
- D-HERO-26 · The chalk puff is removed (§4 bans sparkle); the mat flex stays, measured at touchdown.
- D-HERO-27 · The stick uses EASE.land about the front toe: 0.94 / 1.03 in 70 ms, then EASE.land back over 260 ms and hold (no rebound). It is solved in pass.ts and tested against gsap CustomEase.
- D-HERO-28 · The wordmark develops behind a clip edge slanted like the script (±30% of half the ink height ≈ 17°) that trails the back toe and runs on from touchdown. Nothing shows until the whole „K“ is inside the edge.
- D-HERO-29 · Each ghost develops as she passes it: opacity rises to rest + 0.15 in 60 ms, then settles over 0.4 s. Opacity only, no white flash doubles.
- D-HERO-30 · Compact plate uses viewBox 800×440 with the logo in the right 61%. Frames: bound, takeoff, then 4 flight frames evenly spaced by x, clear of the wordmark by at least 8 units and of the landed gymnast. Ticks are checked against a rasterised wordmark profile (never through „g“/„j“). The apex keeps at least 37 units under the art's top (header clearance).
- D-HERO-31 · Desktop scrub: a white second exposure (a clone of #leap) runs the spine from the landed gymnast to the S2 title mark. The pin covers the hero's stretch; a second scrubbed trigger (pin end → mark top at 80% of the viewport) carries her on. At the end, 'kraguj:handoff' is dispatched and data-landing + data-landed are set on #kviz .chrono-mark. The spine is 2 px steel-300 at 0.8 with rounded corners and is recomputed on refreshInit (sticky title measured unstuck). The scrub code lives in scrub.ts, loaded with ScrollTrigger, so the initial animation chunk stays at 43 KB.
- D-HERO-32 · Static composition: a halftone dot field from the club banner behind the landing zone only (two masked radial-gradient layers, static); trust strip in 3 columns at 640–1023; mat spans 100vw from 1680 px.
- D-HERO-33 · Phone H1 = max(44px, min(17.8px + 8.5vw, 26.4px + 2.75svh, (100vw − 40px)/6.3)), so it is larger where the height allows and the primary CTA stays on the first screen. Landscape phones: hero padding-top 100 px for apex clearance under the header.
- D-HERO-34 · The OG image renders the floor-pass plate from pass.ts (hero/og-art.ts). seo/art.ts ogArtSvg() and geometry.ts are no longer used by the route but are kept (geometry tests still cover them).
- Frame numbers 1–6 not added (they collide with the eyebrow under the mat and crowd the feet above it).

### Page chrome and 404 — design v2

- D-chrome-24 · Header CTA step-aside (ID-06, C-15): data-cta on [data-site-header] comes from StickyBarBehavior (hero CTAs intersecting the viewport, or any part of [data-contact-block]). The pill keeps its box; take-off exit, stuck-landing return. With JS it starts stepped aside, with a 4s CSS failsafe; keyboard focus in the header always shows it; no JS = always shown. The header logo stays (§5).
- D-chrome-25 · From 1200px the header bar is a 3-column grid with the nav on the page axis, offset by (8-24)/2px for the asymmetric bar padding; 1024-1199 keeps the flex row (ID-10). The desktop logo is 129x56 (ID-09).
- D-chrome-26 · Sticky bar = floating dock (C-07): 8px (6px under 360) + safe area from the edges, max 560px, 60px tall (58 under 360), navy-950 pill with a static shadow. Spring arrival and pill rise (MD-17), 180ms take-off exit. It also steps aside while >=50% of S10 .en-actions is in view (GE-11). The focus guard uses the dock's resting top.
- D-chrome-27 · Menu sheet (C-14, C-22, M-05): corner trail removed. The current row carries the „you are here“ silhouette with its take-off and apex frames and plays a hop with a stuck landing on open. Tall tablets get display-size links on 96px rows, in one column (two columns overflow at 640-800 with the row frames). On sheets >=700px tall the CTA and call stand at the foot of the sheet.
- D-chrome-28 · Chrome motion (nav spy hop MO-03, footer take-off MO-05) lives in the lazy chunk chrome-motion.ts, imported on idle only when motionAllowed(). Pre-states are set by JS right before playing and only off-screen, so a failed chunk leaves the static chrome.
- D-chrome-29 · The footer's trial CTA and call are index-style text links (ID-11), so the S11 doskok stays the page's finale. Footer and menu ghost frames use the shared --ghost tokens.
- D-404-7 · 404 stage (C-16): no frame; the floor is a page-wide mat line level with the beam's feet; A-frame supports like S8; padded beam top; KR-404 as a bottom-left frame label under the floor (aria-hidden; the separate kicker above the h1 is removed). Desktop copy and beam share the floor line.
- D-404-8 · 404 balance (C-17, MD-13): SPRING k100/c7 (ζ≈.35) and SETTLE_KICK -250 °/s give a 14° lean with three visible swings, still by 1.4s. The verdict's literal -150 with k90/c9 only swayed 7.7° (simulated and tested). Fine pointer: she leans toward the pointer, ±12°, through the same spring; DeviceOrientation stays primary.
- D-404-9 · Judges' board (C-19, M-07): aria-hidden Doto plate. The static state shows 4.04; with motion it shows 10.00 and posts 4.04 row by row after the catch (data-posted from the tilt chunk; CSS failsafe at 3.6s). On phones it sits above the scene, because the raised hand fills the scene's top-right corner there.
- First-load JS impact of this area: +0.3 KB gz (156.3 → 156.6 KB with the same tree), for the verdict-mandated CTA and S10 observers plus the lazy-loader stub; the motion code itself is lazy.
- TODO for the club (ID-09): a small-size logo lockup (script „Kraguj“ + silhouette, without „GIMNASTIČKI KLUB“) for header and menu-sheet renders under 150px.
- New or reused UI strings: „10.00“ → „4.04“: 404 judges' board numerals (decorative, aria-hidden, Doto); mechanical, no fact; „KR-404“: unchanged text, moved from the h1 kicker to a frame label under the scene (now aria-hidden; the ▸ comes from .frame-label::before); No new words: the footer index links reuse CTA.trial and „Pozovite 060 028 7631“ (CTA.call + PRIMARY_PHONE.display); the new → is a drawn aria-hidden icon

### Quiz (S2) — design v2

- D-Q12 · Quiz strip = one tumbling pass as a Marey print: 7 exposures (3 key frames + 2 in-flight frames per hop), figure 184 units in a 720×204 viewBox, mat at 192. Exposure positions and develop times are samples of the flight model the CSS plays (geometry.ts), so each ghost appears exactly where and when the flier passes it — a chronophotograph trail like the hero and title ghosts, not a content stagger.
- D-Q13 · The strip's picture is a server component (QuizBandArt) passed to the island as a prop. The island only sets data-step / data-v / data-app / data-dir; all states and motion are CSS. Plates, the CTA label and the hint are also server-rendered nodes. Quiz island module: 2742 B gz (HEAD 2837 B); first-load JS 156.6 KB gz in a clean clone build.
- D-Q14 · Flight = X linear (constant horizontal speed) + Y parabola (exact quadratic halves) + pitch 0/−18/−4/+4/0, 600 ms (700 ms for the single long flight of ages 3–7), then a stuck landing: 1.05/.88 → 1 in 260 ms with --ease-land from the feet, and a chalk puff at the front foot. Going back rewinds; it does not leap backwards.
- D-Q15 · Landing per result: Mlađa → one long flight onto the floor (parter, landing 30 units up, mid-depth); 8 + Tek počinje → floor; Starija → split leap onto the beam top (45 units up); Takmičarske → off the uneven bars (high rail at the in-flight frames' chest height) onto the mat. Apparatus drawings are read from S3's ProgramIcon at build time (not copied); a test pins the anchor coordinates (floor y 42, beam top 21.5, high rail 11.5, floor back edge 22). *(superseded by design round 2: D-Q23/D-Q24)*
- D-Q16 · The latent print surfaces 560 ms after the section title's mark lands (CSS :has(.chrono-mark[data-landed])): no observer in the island and no queue slot, since it follows an accent. Before that it is hidden only under html.js-motion.
- D-Q17 · Desktop quiz follows QP-04 ("head card" / "band card", 5fr/7fr, sticky band). The keypad is 8×2 from 640, but 4×4 with 60px keys at 1024–1279, where 8 keys would each be under 48px. Experience answers are one row on tablets and from 1360; stacked (460px) at 1024–1359.
- D-Q18 · Result plates: 44px for a single group, 32px for 2–3 groups and throughout the no-JS guide, 24px for the aerobic hint. Stroke is 1.75 CSS px (non-scaling); rails are heavier.
- D-Q19 · QP-10 hand-off contract: window 'kraguj:recommend' with detail {ids: ProgramId[], age: number|null}, dispatched from the answer handlers. A clear ({ids:[], age:null}) is sent once when leaving a result.
- D-Q20 · Phones in landscape (max-height 520): the strip's picture is capped at 440px wide, so the question shares the screen with it.
- Replaces D-Q6 (static final composition under reduced motion), D-Q10 (struck-through 02 when step 2 is skipped) and D-Q11 (sticky heading in cols 1–4).

### Programs (S3) — design v2

- Programs icons (QP-05): every apparatus stands on the floor y=42 of its 48-unit drawing, the height of the plate's mat line. Stroke weight is ≈2.8 CSS px at every size (--sw 1.6/1.4/1.06 user-unit px at 84/96/132px). Uneven-bar rails are heavier (×1.4) than their uprights (×0.82).
- ProgramIcon structure is a contract: .pi-latent (static print), .pi-part[data-part] with data-draw paths, .pi-fx (trails), stroke classes .pi-thin/.pi-rail/.pi-post and a head <circle>. The quiz's views.ts iconArt() reads the rendered tree, so these names must stay stable.
- Programs motion lives in the lazy chunk programs-motion.ts (1.7 KB gz), loaded when the section is ≤1 viewport away and motion is allowed. It never imports @/lib/motion statically: a static import made Turbopack put gsap's MotionPath helpers (paths.js/matrix.js) in this chunk, so the hero intro started downloading it. gsap is reached only through loadMotion() for the filter Flip.
- The icon draw no longer waits for the section-title landing (+800ms); it only goes through queuePrimaryMotion (≤250ms wait), in line with the v2 rule that content is never held behind decoration. The latent print covers the wait.
- Every drawing performs once right after its draw. Phones perform again on snap (IntersectionObserver ≥0.85, ≥4s apart); hover devices on pointer enter or keyboard focus from outside the card. The hover answer is the perform (it includes the apparatus's own compression), not a squash held while hovering. *(superseded by design round 2: D-P2 round 2: scene plates, apparatus-only performs)*
- KR-04 opens the phone row at min(248px, 64vw). The photo box is capped at 533px tall (a square cover draws at the box's longer side = native/2), so on phones the slot ends on a static landing trail: 3 leap silhouettes in the ghost tokens on a mat line, aria-hidden, hidden from 1024.
- With MINOR_PHOTOS=false the photo placeholder is the last frame at every width, including ≥1280 (it used to open the 3-column sheet).
- No orphan card at ≥1024 (QP-20): data-count on the strip drops the photo in the 2-column sheet when the count is even, and in the 3-column sheet when it is a multiple of 3.
- Phones: the pressed chip's count is a white corner tab (✓ + label + count do not fit the 136px chip at 320); from 640 the count sits inline, as in S9. The status line is screen-reader-only below 640, and the aerobic hint is shown as a visible line under the row there.
- The filter scrolls the row to its first program (the photo stays off to the left); „Sve“ scrolls back to the photo.
- Filter Flip (MI-06, supersedes the shared S3/S4/S9 recipe for S3 only): leaving cards lift 8px, shrink to 0.97 and fade in 180ms; arriving cards drop 16px on phones / 24px on desktop and stick the landing with a 3% compression at their feet on EASE.land. S3 cards stand for athletes' programs, so take-off and landing is the metaphor.
- Rail flier: one dot cell wide, translated by whole cells. The first version was full-width and translated, which overflowed the page by 19px on phones and widened the mobile layout viewport.
- The strip's scrollbar is hidden; the rail is its scroll indicator, with 48px prev/next buttons.
- Recommendation stamp: lav-200 pill with a navy 1.5px ring, 22px tall, top-left of the plate (clears the high rail by ≥9px). It reads „Preporuka · 9 god.“ when the event carries an integer age, otherwise „Preporuka“. { ids: [] } clears it.
- Desktop head gap is clamp(24px, 4.5vw − 16px, 48px), so at 1024 the four chips (with the count) stay on one line beside the title.
- Tertiary „Pogledajte raspored“ applies at every width (one filled action per print). The detail sheet keeps its two-column filled + outlined footer (UIC-05).
- The detail sheet shows the bib too, so it is the same print as the card, enlarged.
- New or reused UI strings: „Preporuka“ — the quiz-recommendation stamp on a program plate (PROGRAMS_UI.recommended); „god.“ — age unit on that stamp, composed as „Preporuka · {age} god.“ with no-break spaces (PROGRAMS_UI.ageUnit; same unit as the quiz strip's „9 god.“); Competitor-bib numerals (aria-hidden, typographic renderings of the cards' own age lines and titles): „3–8“, „8+“, „C“, „A·B“ (model.ts PROGRAM_BIB); Reused, not new: QUIZ.aerobicHint as the visible line under the phone row when a chip hides aerobic gymnastics (aria-hidden; the sr status already says it); Removed: the visible „n / N“ pager count (it was aria-hidden), replaced by the aria-hidden dot rail

### Schedule (S4) — design v2

- S4 v2 · „Sledeći trening“ is a section scoreboard (navy-950 dot-matrix window, Doto 900 numerals, as in S7). It shows the earliest fixed start across the groups the filter shows, computed by earliestNext() (per-group nextTraining rules, so an „ili“ slot is never named), and updates every minute. SSR renders the shell with „––:––“; without JS it is hidden. *(superseded by design round 2: S4 v2.1 — the scoreboard names „ili“ slots with both options)*
- S4 v2 · Scoreboard placement: a sticky stack above the location card in the ≥1280 aside (fixed height 9.5rem, which sets the card's sticky offset); a one-row strip at 640–1279; a compact block under the pills on phones (label on its own line below 360).
- S4 v2 · The scoreboard draws its colon as two CSS LEDs on Doto's dot grid (Doto's own colon is a pair of 5-dot clusters). The colon steps back 0.12em because Doto digits sit left in a 0.6em cell, and the time box takes back the trailing 0.125em.
- S4 v2 · The card's „Sledeći trening“ chip is value-only („danas u 18:00“; the label stays for screen readers) and hangs as a navy tag on the card's top edge from 640px. It is absolutely positioned, so it never shifts layout and needs no reserved row. Phones drop it (the scoreboard answers it). This replaces the reserved invisible row of AM-05.
- S4 v2 · Phones: calendar actions collapse into one native <details> row per card („Dodajte u kalendar“). From 640px the closed details stays rendered via ::details-content (@supports), so the links are simply shown; browsers without support keep a working disclosure.
- S4 v2 · AD-11 revisited: cards keep their natural height (align-items:start), so no card has a hole in the middle; the row gap is 32px for the edge tags.
- S4 v2 · From 1024px the view tabs stand in the heading row (SectionHeading display:contents inside .sched-head); pills 28px below. Tabs and pills stay 48px under a fine pointer as well (§3, qa 48×48 check).
- S4 v2 · Alternatives („08:30–10:30 ili 16:00–18:00“) stack in cards with „ili“ hanging in a 32px gutter, so both ranges share a left edge. „Po danu“ rows ≥640 have a 17.5rem time column (one line); phone rows have a 22px gutter. Times stay at the §3 20px token.
- S4 v2 · Program swatches are bars (16×6, navy edge; 22×8 in card heads) because circles mean days in S4. A pressed pill hides its bar.
- S4 v2 · Both tab pills slide on the flight ease (320ms) with a white-label layer clipped to the pill, so labels invert exactly under it. Base labels stay navy; the selected day label is white and bold in the lit layer, weekends included.
- S4 v2 · The filter Flip holds the card list's height with min-height (no height animation) until 0.36s, then releases it; on stacked layouts the location card lands in its new place. A day card clips its rows while they move. A card whose size changes lands again instead of being scaled.
- S4 v2 · Day changes Flip rows keyed by data-flip-id="group|block": shared rows hold, new rows land, and rows missing from the new day vanish (they live in the other day's display:none panel).
- S4 v2 · Today's „Po danu“ marks (static, also under reduced motion): finished ranges and rows go muted by colour (AA holds), the next visible row gets a royal rule on the card edge, and the „now“ line with the standing leap separates started rows from it. „ili“ rows are split by range.
- S4 v2 · Motion code, today's marks, the Google Calendar date refresh, the stuck-strip scroll correction and the pill-row edge fades moved to schedule-enhance.ts. It is a lazy chunk (≈2.6 KB gz) imported when #raspored is ≤1 viewport away; GSAP and Flip load from it only when motion is allowed. If the chunk fails to load, every landing pre-state resolves and the static links remain.
- S4 v2 · First-view landings (week-row days, scoreboard posting, location pictogram) are CSS keyed by data-landed, set by one IntersectionObserver at 35%. Cards are queued via queuePrimaryMotion (≤250ms); the scoreboard and pictogram are accents. Week-row keyframes run only while data-landed="go", so a filter never replays them.
- S4 v2 · The location card is a white end-cap (hairline + shadow-2) with a drawn perspective floor square, its diagonal and a pin. The pictogram sits beside the street lines on phones and in the aside, and top-right at 640–1279 with the maps button bottom-right.
- S4 v2 · The weekend empty state uses the shared ChronoMark (landed). A user's Su/Ne pick replays the leap toward Monday; on phones the sentence wraps under the mark.
- S4 v2 · Bundle: first-load JS +21 B gz (160,117 → 160,138 B summed at gzip -9 over index.html's first-load chunks; qa:bundle reads 156.4 KB in both builds). Clone builds differed only in the schedule files and NEXT_PUBLIC_MINOR_PHOTOS=false.
- New or reused UI strings: „Dodajte u kalendar“: summary of the phone calendar disclosure. It is §5 „Dodajte u kalendar (.ics)“ minus „(.ics)“, derived in code (ICS_SHORT).; „danas“ / „sutra“ / „u {ponedeljak…nedelju}“: the scoreboard's day part. These are the §5 chip forms split before „u HH:MM“ (formatNextDay).; „Sledeći trening: {danas u 18:00}, {group name}“: the scoreboard's sr-only sentence, composed from SCHEDULE_UI.next, the §5 chip form and the group name.; „––:––“: scoreboard placeholder glyphs (aria-hidden) when no fixed start is next or before mount.; The card tag label „Sledeći trening:“ is now sr-only; it is the existing string with no new text.

### About (S5) and coaches (S6) — design v2

- S5 switches from theme ice to light (master §5). „Hronologija“ moves into a full-bleed data-theme=dark darkroom band inside S5, cut on the floor diagonal with the shared .edge-cut/.edge-line. The band ends the section (#o-nama padding-bottom 0), and S6 restores full 72/144px top spacing because this is a dark→light edge (#o-nama + #treneri in coaches.css).
- Timeline = Marey plate: one #leap exposure per year (36/44/52px), each with a dark backing that cuts the rail. Ghost colours step through the shared --ghost-1/2/3 from oldest to newest, with opacity lifted ×1.5 because the figure is thin at node size. The last year is solid lav-200. The static state is the finished plate.
- The timeline flier IS the reached year's solid frame: the ghost of a year is exposed when the flier leaves it (attribute + CSS transition). This replaces a separate node-ring pop (MD-09).
- Timeline legs: distance/1100 px·s⁻¹ clamped .22–.65s, or .9s for a multi-year flight. Years flown over light up at the exact crossing time (inverted ease). Years already scrolled past are placed instantly, never animated off-screen and never holding the primary-motion queue.
- S5's two motions (KR-03 print landing, timeline flier) are separate lazy modules (print-motion.ts, timeline-motion.ts), each armed by AboutMotion only when its own element is ≤1 viewport away.
- The KR-03 print lands through two paper ghosts outlined in --ghost-1/--ghost-2. They exist only under html.js-motion and are opacity 0 at rest, so no static misregistered outline remains (AC-07).
- The KR-07 Marey plate carries data-theme=dark so its ghosts use the dark ghost steps. Its solid frame drops onto the mat and sticks (EASE.land) rather than rising from below.
- Coach cards: no title wait; a card starts at 20% visible via queuePrimaryMotion. Safety net: a pre-hidden card ≥50% in view for 300ms without having started is shown statically. The brush is decoration: once half in view it is committed to play after running card reveals (≤1.2s), so its pending state is 'not drawn yet', never an empty frame.
- The portrait clip reveals the whole print, paper included, and ends at inset(−40px) so the frame's hairline and shadow never pop when clip-path is cleared.
- Licence stamp (AC-06 as amended): two layers (surface-tinted disc + ink), ink multiply on light sections, a static per-card vector speckle mask (SVG, deterministic, no PNG), no shadow, no z-index (so the ink can blend into the print), rest 0°. The press keeps −8°→0 with takeoff-down / land-settle physics and a one-off ink ring. Two cards' presses are kept ≥140ms apart.
- Brush loop redrawn (AC-05): an open loop around heads and shoulders with a single-path taper (core ends where the loop closes; bristle strands run on through the flick). The thin strand's bristle gaps are a static dash mask so DrawSVG still works.
- Coach licence source: below 1024px on its own line; from 1024px inline as „(GSS) · izvor ↗“. The role's last two words are bound with an NBSP (display-only) and ride with the link in a nowrap span. The link is inline-block for a clean focus ring.
- Compact phone coach card (<520px container): portrait min(132px,42%) beside the name, roles full width; stamp 64px.
- KR-17: 2:1 crop at 50% 55%; the desktop margin print is centred on the 2017→2022 leg with a 1px leader to the rail.
- MI-AC-6 (S5→S6 handover diagonal) not built: the new darkroom band edge already divides the sections, and a line crossing it would compete with the S6 title's own landing.
- New or reused UI strings: „·“ — visual separator before the inline „izvor ↗“ on coach licence lines at ≥1024px (CSS ::before inside the aria-hidden label span; not read by screen readers)

### Results (S7) and camp (S8) — design v2

- D-S7-2 (v2, RC-04/MD-05): the split-flap flip is replaced by the LED „score posts“ scan — a deviation from the literal §4 „flip“ with the same intent. At play time each numeral goes dark and re-lights one Doto dot row at a time, top to bottom (clip-path insets in em, calibrated to Doto's 7-row grid), then the board blinks once. Nothing is hidden in advance, a partly lit numeral only ever shows the top rows of the correct digits, and there is no count-up.
- D-S7-4 (v2, RC-05): the podium rises out of the „Medalje“ panel as solid navy-900 blocks (the body's own colour; heights 64/44/30) with a 2.5 navy-950 outline, place numerals 2·1·3 inside the blocks (text on navy, never on the gradient) and r=10 medals with V-ribbons. It is about 64–72% of the band width, capped by the band height (band 144px from 1024 up, 120px below).
- D-S7-5 (v2, MD-02/RC-10/MD-10): the title mask rises on its own IO (−15%, no queue) and the chrono mark lands through HeadingLandings like every other title; the split is reverted only when no hop is running. The primary steps are score posting → (phones) photo shutter → medal ceremony + brush. Each starts on the −18% line through queuePrimaryMotion (≤250 ms). Nothing pops (RC2-01/MD2-06): an off-screen step is finished without animating, a visible step that waited too long plays compressed. Safety net: a pre-hidden element that stays ≥50% in view for 300 ms without its trigger plays now. headingWait is removed.
- D-S7-6 (v2, RC-01, replaces the photo-01 swoosh and the AD-08 note): the S7 brush annotation is a white dry-brush underline under „Medalje“ (6 overlapping strands rising along the floor diagonal), drawn last in the medal ceremony. It marks the actual wins, never touches a child, and survives MINOR_PHOTOS=false. It is still one of the page's two brush annotations.
- D-S7-8 (v2): obsolete. The brush no longer depends on photo 01, so the public build keeps it.
- D-S7-14 (RC-02): below 640 px the scoreboard is a results list, one row per stat (132px window · label + izvor). Below 390 the window is 108px with a 36px numeral; below 360 it is 100px with 32px (Doto stays ≥32px).
- D-S7-15 (RC-03/RC-11/RC-15/RC-17): S7 izvor links are quiet footnotes (steel-300 / 560, lav-200 on hover or focus) placed 6px under the label. The stat izvor focus ring hugs the word, not the 48px target. „oko“ is a field tag in the window corner. The numerals get a static LED bloom and the windows an inset bezel. Display order is 42 · 12 · oko 120 · 2007 (the year tile goes last; content unchanged). From 1024 up the numeral scales from 58px at 1024 to 84px at 1440 so „2007“ keeps air in its window.
- D-S7-16 (RC-09): from 1024 up the trust row sits under photo 01 in the photo column; below 1024 it closes the section. The photo is not sticky, because the trust row shares its column.
- D-S7-17 (MI-06): below 1024, photo 01 opens like a shutter from a slit when it enters (only if off-screen when the code arms).
- D-S8-2 (v2, RC-07/MD-07/MI-04, a deviation from the §4 desktop scrub): the beam is a real one (10px bar on splayed legs), and a one-shot „last beam routine“ plays on every device where motion is allowed: leap with ghost frames → stuck landing and balance wobble → legs fold and bar fades → MorphSVG to the sea → echo swells ripple out. One morphing path, no ScrollTrigger in S8. The pre-state is set only if the horizon is off-screen when the code arms. The static state (no JS, reduced motion, Save-Data) is the wave plus echoes. The wobble is on the gymnast, not the beam, because rotating inside the stretched SVG distorts.
- D-S8-7 (v2): superseded — the in-view guard now means „horizon on screen when the code arms → keep the static wave, no routine“.
- D-S8-13 (RC-13): the sea has two static echo swells behind the wave (royal-500 .45/2px, steel-300 .5/1.5px). The horizon viewBox is 1440×80 and the SVG is 56/64/80px tall at phone/tablet/desktop, with margins re-anchored so the wave keeps its place.
- D-S8-14 (RC-06): from 1024 up, the camp lead is a postcard headline (30–38px, 620, 112% width, max 13em) under the title, and the note stands at the base of the text column, 112px above the column bottom (not 88) so the leap has clear air. The lead glues short prepositions and its last word.
- D-S8-15 (RC-08): from 1024 up, postcard exits are asymmetric — right exits go 0.62 of the stage width; left throws, prev and drags are bounded by the measured room beside the text column (never over the lead or note), with the z-index swap at the apex. The left flick threshold scales with that room. Phones are unchanged.
- D-S8-16 (RC-12/MI-05/RC-14): every postcard has shadow-2, and the top card's shadow-3 crossfades by opacity (::after). The new top card lands on the pile with a small stuck-landing squash. The back slot is translate(22%, −8%) rotate(6°) so faces show.
- D-S8-17 (RC-16): the camp note is an ice-50 card with a dashed, tilted postmark around the sun glyph.
- TODO for the club (RC-14): may photo 16 (camp lunch, already public in S9 „Kampovi“) join the S8 postcard stack as a third card? §5 S8 lists only 10 and 11, so it stays out until the club agrees (TODO in Camp.tsx).

### Gallery (S9) and enrollment + FAQ (S10) — design v2

- S9 layout (GE-01; deviation from §4/§5 'CSS-columns masonry'): justified contact-sheet strips. Each print is a flex item with grow = aspect ratio and basis = ratio × row + 12px (the frame padding); row is a fraction of the sheet width (container units, vw fallback). Every strip has equal photo heights and flush ends. An ::after spacer (basis 30% of the width, 70% on phones) leaves only a clearly short last strip ragged.
- S9 strips: phones <560: 04 | 01·15 | 05·12 | 08·03 | 10·11 | 14·16 (the lead print spans its strip, flex-basis 100%). 560–1023: 04·01 | 15·05·12 | 08·03·10 | 11·14·16. ≥1024: 04·01·15 | 05·12·08·03 | 10·11·14·16. Filtered views use one row height. All measured in the DOM: flush, equal, ≤ native/2.
- S9 sheet order (GE-02, supersedes AD-03): 04·01·15·05·12·08·03·10·11·14·16. KR-14 stays (§5) and is never adjacent to KR-12.
- S9 becomes a darkroom (GE-03): theme darker + edge up. Prints are white paper mounts through an inner .gl-mount data-theme="light" wrapper, so the link keeps the section's lavender focus ring. Chips use the dark recipe.
- S9 Marey rule under every strip (≥640): each print draws its share of a 1px line plus end ticks. The colour is an opaque color-mix, so the ticks of neighbours coincide without doubling.
- S9 frame caption (category) is hidden on prints ≤200px wide (container query) and on all phones, so no strip mixes feet. *(superseded by design round 2: GE2-03 per-sheet caption rule)*
- S9 entrance (MD-08): the print link swings and the item fades, so the strip rule stays level. The lazy lightbox chunk arms it (armHang), adding no first-load bytes. It only runs when the sheet is below the fold at arm time and only on the prints in view (max 6). GE-M4 'Ekspozicija' is not built (one primary motion per viewport). *(superseded by design round 2: GE2-01 prints hidden only before they are ever seen)*
- S9 filter motion moves to the lazy gallery-flip.ts. Flip scale:true (strips resize, so transform only). The newcomer tween is not returned to Flip, because Flip re-applied its start state. Resets restore each print's --ar after clearProps.
- S9 lightbox: opaque navy-950 scrim. Per-slide print foot (frame · category, n / N, typeset alt caption) is aria-hidden; the live counter sits sr-only in the top bar. A Marey rule with a hopping marker sits under the stage. The stage reserves the foot's height. In landscape ≤560px tall: arrows at the sides, caption hidden.
- S10 leap band (GE-06): geometry in leap-band.ts; the same module renders on the server and drives the motion, so the flight ends exactly on the landed frame. Pitches −24° / −10° / +6° (the logo pose is already tilted +10°; −10° is a level split). Mat contacts are the lowest silhouette points at each pitch, measured from the path. The trajectory is a quadratic through the hips. Ghosts use --ghost-1 / --ghost-2 at .42 / .62; the landing is accent.
- S10 leap motion: data-leap armed/play/done on .en-leap. The pre-state exists only under html.js-motion + no-preference and hides decoration only (step texts, year line and actions stay visible; numerals wait at .35). It waits for the title mark's landing (+800ms), then queuePrimaryMotion(1460). A failsafe lands the final state. *(superseded by design round 2: MD2-07 no title wait)*
- S10 step numerals (GE-07): aria-hidden (the <ol> gives the order). Ghost ramp in one blue: royal-500 at 45% → 78% → navy. The leotard violet stays on the frames because violet is not allowed as text.
- S10 year strip (GE-08): lamps with J–D initials. The row layout starts at ≥1280; at 1024 the actions had stacked.
- S10 kit + FAQ (GE-09): no sticky. The H3 sits above the card. From 768 the titles share a subgrid row, so the card top = the FAQ hairline and rows run on one 65px pitch.
- S10 checklist (GE-10, amends §5 'animated checklist'): real unticked checkboxes, the whole row is the target, the focus ring is on the drawn box. Animation only on tap. No persistence. ChecklistTicks is deleted.
- S10 full bag (GE-M6) is CSS :has() only; no JS.
- S10 FAQ next actions (GE-13) reuse CTA.viewSchedule (with data-schedule-program="mladja") and CONTACT.mapsCta → VENUE.mapsUrl. They live in a local map until content/faq.ts gets a link field. The answer box uses overflow: clip with a 6px clip margin so the link's focus ring isn't cut.
- Bundle: first-load module JS 156.2 KB gz, against 156.4 KB for the same tree built with the pre-change versions of these files (both MINOR_PHOTOS=false builds in a clone). Motion code now loads lazily: gallery-flip, leap-motion (~1.5KB gz), and armHang inside the lightbox chunk.
- New or reused UI strings: „J F M A M J J A S O N D“ — month initials under the S10 year lamps (aria-hidden); „1“ „2“ „3“ — frame numbers under the narrow (phone) leap band (aria-hidden); „ · “ — separator in the lightbox print foot, e.g. „KR-15 · Treninzi“ (aria-hidden); „↗“ (aria-hidden) + reused „(otvara se u novom prozoru)“ (SCHEDULE_UI.newTab) on the FAQ maps link; Reused existing copy as FAQ next actions: „Pogledajte raspored“ (CTA.viewSchedule), „Otvorite u mapama“ (CONTACT.mapsCta)

### Contact (S11) and booking sheet — design v2

- D-S11-15 · Desktop 5/7 swap: the CTA panel stands in the right 7 columns straight under the right-aligned title (title → panel → button in one column); phones/e-mail/Instagram and the venue take the left 5 columns. The title's mark sits over the panel's sash, so the finale leap drops onto the button.
- D-S11-16 · The S11 title is right-aligned from 640px (the shared rule starts at 1024) so the take-off mark is above the sash on tablets as well; phones stay left-aligned.
- D-S11-17 · The S11 title mark is 2em wide on the display step (was max(1.1em,4rem)): it is the take-off frame, sized so its solid frame reads at about the x-height of „trening“.
- D-S11-18 · CTA panel: the 10–16px gradient frame is replaced by a leotard sash, a diagonal band with parallel 28° edges across the slab's top-right corner (≥640), and by a 10px gradient mat along the bottom edge (<640). No text on either.
- D-S11-19 · The static doskok composition is the last three frames of a back-salto dismount (ghost tilts +30°/+16°/+6°) plus the upright landed frame. Every frame is placed relative to the button (x in % of its width, y in leap widths above its top edge). Landing at 26% on phones and 55% from 640; the trust column is ≤52% (62% from 1024) so no text meets the trail or the sash.
- D-S11-20 · Flight direction: the right-facing club silhouette always takes off from a mark that is right of or above the landing, so it travels backwards. It therefore flies a back salto (backward rotation), never a mirrored figure. The flier is the landed frame itself, moved by transform, so the end state is exactly the static composition.
- D-S11-21 · Doskok trigger: the button ≥85% in view for 120ms (re-arms if it leaves). The only hidden pre-state is the landed figure (it is still on the title mark); the ghost trail stays visible and flashes as it is passed, so the slab never rests empty (e.g. after the header „Kontakt“ jump that leaves the button at the fold at 1440×900).
- D-S11-22 · No live „Sledeći trening“ scoreboard in S11 (the C-01 suggestion): C-18 was not accepted, the C-04 sash occupies the upper right (§3: no text on the gradient), and S4-DR-04 puts that scoreboard in S4.
- D-S11-23 · The two numbers share one „Pozovite“ row as two tel: links (28/700 and 22/650, ≥48px each), side by side with a hairline pseudo-element once the column is ≥380px wide. The visible label is aria-hidden; each link carries an sr-only „Pozovite “ prefix.
- D-S11-24 · Call and e-mail rows lose the trailing →; only Instagram keeps ↗ (it leaves the site). With hover, the leading disc fills lav-200 with a navy icon.
- D-BK-20 · Booking head: navy-950 darkroom band (data-theme=dark on the head), white silhouette (44px under 480px so „Zakažite probni trening“ stays on one line at 390; 52px from 480), 3px leotard hairline under it. The booking sheet is counted as the trial-training CTA's own surface under §3 pinned gradient use #2 (accepted C-10).
- D-BK-21 · Phones: the head is the sheet's handle (grabber, touch-action:none). A pull past 30% of the sheet height or a flick over 0.5px/ms closes it from where the finger let go; otherwise it springs back 280ms ease-stick. Upward pulls rubber-band at ×0.2. Instant under reduced motion.
- D-BK-22 · ≥768 the dialog is anchored at max(24px,10svh) from the top and grows downward (no re-centring jumps); the backdrop is .82 there, .66 on phones.
- D-BK-8 (rev 2) · Invalid fields: 2px royal border (1px + inset), white fill, 4px 16% royal halo, and a filled „!“ disc inside the control's right end (hidden on selects under 200px so the narrow Godište box keeps „Izaberite“ whole). The error line is navy text only.
- D-BK-23 · After a hand-off, the status is a „landed“ card (silhouette + BOOKING.after, royal outline on white) and both send buttons step down to outlined until the next edit. The card takes focus (preventScroll) when the page becomes visible again.
- D-BK-24 · On each send attempt, up to three invalid fields do one beam-wobble (push −5px, settle with --ease-wobble), 40ms apart; CSS only, never while typing, off under reduced motion.

## Design review round 2 — decisions

Eight critics re-reviewed the frozen v2 build (scores, first review → v2: schedule 5.5→7.2, about-coaches 5.5→7.5, first-impression 6→7, quiz-programs 5.5→7.3, gallery-enrollment 5.5→7.5, results-camp 6→7.5, conversion 6→7.5, motion-director 5→7).
The orchestrator ruled on all 74 findings (scratchpad verify-verdicts). One was modified: QP2-04 keeps the §5 card order, so no CSS `order`,
and gives the spare row height to the plate instead. Nine fixers implemented them. The shared layer adds tests/css-keyframes.test.ts: Chromium plays
a `var()` easing inside `@keyframes` as linear, so keyframe easings must be literal values (MD2-01/02).

### Hero (S1) — round 2

- D-HERO-35 · The spine's lane beside the next title runs right of every title line it passes above the baseline, not just right of the mark: dropX = titleRight + clamp(12, (wall − titleRight)/2, 32), computed by nextLeg() in spine.ts. The route never crosses „Koji program“ at any width ≥1024.
- D-HERO-36 · Runtime guard: routeClear() samples the drawn route every 1 px against the next title's line rects (+2 px) and S2's other text and card boxes. A route that would touch them ends at the hero's bottom edge instead; the hand-off is skipped and HeadingLandings lands the mark.
- D-HERO-37 · After the hand-off the spine line fades out (data-handed, opacity over --dur-reveal on --ease-stick, time-based and not scroll-driven). It comes back as soon as the scrub runs back up (p < 0.98).
- D-HERO-38 · Desktop pin end is '+=50%' (amends §4 '+=80%' and the 80vh spacer in D-HERO-19). The ghost frames and ticks no longer fade on the scrub (amends §4 'ghost frames fade one by one' and D-HERO-15): the chronophotograph stays whole while she leaves.
- D-HERO-39 · The second exposure runs at max(min(laneK, kMark), 0.45 × the landed size). Where her ink box would come within 8 px of the viewport's sides or within 4 px of text (the hero's text, and the next title's inked glyphs: 0.8 em above each baseline plus descender letters), she fades out over 120 ms and only the line draws. Shown stretches shorter than 48 px are suppressed. She shrinks below 0.45× only over the last 70 px, where she becomes the mark's first frame for the hand-off.
- D-HERO-40 · The hero diagonal starts low enough that the runner standing on it (half-width 114k, height 160k) clears every hero text box (spineRoute's `runner` option), so she runs the diagonal under the trust strip, never over it.
- D-HERO-41 · From 1680 px, while the spine runs, the wall-to-wall mat's run past the spine's corner retracts by clip-path over the first 32 px of route. There is no T-junction, and the mat is wall to wall again at rest.
- D-HERO-42 · Wide-plate halftone: --dots-at 70% 86%, masks radial-gradient(40% 58%) and (38% 78%). Both reach alpha 0 before the field's right edge, so there is no hard vertical cut at the container (FI2-04). The compact plate's masks are unchanged.
- D-HERO-43 · Portrait phones under 360 px: eyebrow 11px/.06em, H1 2.5rem, subline at the small step, eyebrow margin 18px, CTA margin 22px, compact art max-height max(12svh, 100svh − 600px). The primary CTA's bottom is at 554 at 320×568 and 562 at 320×640. This deviates from the §3 label size of 13px on these widths only; 360 px and up are unchanged (D-HERO-33 stays).
- D-HERO-30 (amend) · The phones' plate has 5 ghost frames: bound, takeoff (t .24), rise (.385), apex (.62) and descent (.935), each ≥0.7× the wider figure's width from the next by x from the takeoff on (worst 0.726). This deviates from §4 '6 ghost frames' on the compact plate only; the wide plate keeps 6. Ghost colour and opacity come from ghostColor(i, n) and ghostOpacity(i, n): identical values for 6 frames, a .10→.28 ramp and ice·ice·lav·violet·violet for 5.
- D-HERO-34 (amend) · The OG pass pins its own six ghost times (the old compact times), so og.png is unchanged (byte-identical) by the phones' 5-frame plate.

### Page chrome and 404 — round 2

- D-chrome-30 · The dock also steps aside while ≥50% of S3's .pg-rail (prev/next + dots, <1024) is in view (QP2-02). This is the same rule and motion as the S10 action row (StickyBarBehavior IntersectionObserver, chrome.ts programsRailVisible, unit-tested). At 390/414 the reading position of a card puts the rail in the dock's zone.
- D-chrome-31 · The dock arrives on its own curve, --ease-dock = cubic-bezier(0.34, 1.45, 0.5, 1): 6.6% overshoot, 5px over its 84px travel, measured 860→771→776 at 390 (MD2-09). The review's 1.35 computes to 3.4px, under the ≈6px it asked for. --ease-spring stays 0.34,1.8,0.5,1 for the small apparatus parts. The exit is unchanged.
- D-chrome-32 · Dock pills start at --pill-at 44ms, when the capsule has covered 40% of its travel on --ease-dock, with a 40ms stagger (CV2-10). The content arrives with its container. The literal '.4 × 420ms' = 168ms would have started them after the capsule was 98% up.
- D-chrome-33 · Menu 'you are here' hop: --hop-dur 380ms on the current link. The take-off frame is exposed at 45% of the flight and the apex frame at 75%, each as a 120ms linear fade, so the trail develops behind her in the air and is complete as she sticks (CV2-10).
- D-chrome-34 · Easings inside @keyframes are literal values with the token named beside them: Chromium plays a keyframe-level var() as linear (MD2-02). Applies to spy-hop-a/b (land) and footer-push (spring).
- D-404-10 · 404 floor plane (CV2-09): a navy-950 fill runs from the mat line to the bottom of the page, edge to edge (.nf__stage::before; .nf clips both axes). From 640px wide and 700px tall the body is centred between the logo and the page bottom, as on desktop, so tablets are no longer top-heavy. The logo stays top-left.
- D-404-11 · 404 frame row (CV2-09): the KR-404 label and the iOS sensor button share one row under the floor (.nf__foot), with the 48px button right-aligned. On touch screens ((any-pointer: coarse)) the label's line box is 48px from first paint, so the late button never moves anything, even when the row wraps at 320. The desktop copy's floor offset follows the row: calc(40px + gap + row height). This replaces D-404-4's out-of-flow desktop button.
- First-load JS impact of this area: +0.1 KB gz (156.5 → 156.6 KB, clean HEAD export with only these files overlaid) for the rail observer. GSAP is still out of first load; the initial animation chunk stays at 43 KB.

### Quiz (S2) — round 2

- D-Q21 (QP2-07) · From 1024 the quiz card stretches over the heading and strip rows (align-self: stretch), so its white face ends level with the strip on every step. On the two questions the question is centred in the card; the result starts at the top and grows the row when it is taller. Nothing animates height.
- D-Q22 (QP2-08) · Two-group result (8 + „Tek počinje“) from 1024: names on the h4 step clamp(1.125rem, 1rem + .4vw, 1.375rem) with text-wrap: pretty, and the plate on the first line (align start, margin-top .1em). The groups stack below 1360 (the D-Q17 breakpoint), because at 1280 a name needs 244 px of a 234 px column. The three-group competitive result and the no-JS guide are unchanged.
- D-Q23 (QP2-12, amends D-Q15) · The strip's apparatus is 1.5× its v2 size (parter 4.5, greda 3.3, razboj 4.8) with constant line weight in strip units (CSS divides by an inline --s). Landings follow the new surfaces: beam top 67.6 units up, front foot at the beam's end with the seat of the split over it; floor mid-depth 45 up. The bars stand between 02 and 03 with the high rail at the in-flight frames' raised hands, placed so the high bar's right upright is 10 units left of the landed back toe. The landing stays over the 03 tick; the critic's +12 x shift was not needed.
- D-Q24 (QP2-12) · The strip's viewBox is 720×212 with the mat at 200 (was 204/192), so the flights keep the v2 heights (48 / 64) onto the higher apparatus and stay within the ≥ −8 top limit (worst −5.7). The strip is about 4–6 CSS px taller.

### Programs (S3) — round 2

- D-P2-01 · Phone row pager (QP2-01): the prev/next target is the pure pagerTarget() in components/sections/programs/pager.ts. It sorts the snap starts (the photo is last in the DOM but first on screen) and clamps to the row; unit-tested with starts measured at 320 and 390.
- D-P2-02 · No dead white above CTAs (QP2-04, ruling version): at every width the card plate takes the row's spare height (flex 1000 0 auto, no cap); the body does not grow. No CSS order and no subgrid. CTAs align per row; titles may start at different heights across a desktop row.
- D-P2-03 · Plate scene (QP2-05): .pc-plate is a size container. The icon is clamp(84/96px, 64cqh, 132px), and the Marey grid lives on ::after, because container units resolve only for the plate's descendants. The user-unit stroke steps down through container queries so the line stays 2.6–3.0 CSS px. Non-scaling strokes were rejected: they break the pathLength=1 draw in Chromium. The posed #leap silhouette shows when the plate is ≥160px (container content ≥150px).
- D-P2-04 · Card mount (QP2-05): a scene plate's first draw plays the sheet's mount instead of the first perform (hop at +450ms, stick at +950ms, data-mount, through queuePrimaryMotion, once per card). The card hop is −10 units (sheet −14.5) so her back foot stays on the print. Performs are blocked while a card mounts.
- D-P2-05 · Aerobik (QP2-06): the drawing is the sprite's exact #leap (<use>), 48 units wide with the front toe on the floor y=42. It is revealed with clip-path from the floor up (600ms ease-stick). Its static print (.pi-latent) is a simplified path in icon units (leap-icon.ts, 668 chars, ≤0.2 units from the logo, tested), so the quiz's iconArt keeps reading paths. The scene (sheet, and card plates ≥160px) adds a mirrored partner 30 units (62% of a body) to the right, hopping in from the right.
- D-P2-06 · Filter Flip stacking (QP2-09): stayers and arrivals get z-index 1 and leavers 0 during the Flip. A leaver is data-out or computed display:none (the photo dropped by the sheet's count rule).
- D-P2-07 · KR-04 paper (QP2-10): at ≥1024 the frame stretches to its row and the KR-04 foot sits at the bottom (margin-top:auto); the print keeps its 533px cap. The ≥1280 re-show rule uses display:flex (block dropped the column).
- D-P2-08 · Card performs are the apparatus's own physics only (QP2-11): beam vertical flex (beam translateY + legs scaleY, same wobble), rail flex (scaleY .94/.92 about the feet), springboard/table spring, floor give, aerobic jump. .pi-fx is rendered only in the detail sheet, where the trail plays at 560ms beside the landing silhouette.
- D-P2-09 · Literal keyframe easings (MD2-01): programs.css @keyframes carry the linear() lists of styles/motion-tokens.css after a rebound cubic-bezier fallback, and literal spring/land cubic-beziers. tests/programs.test.ts pins the lists to motion-tokens.css and fails on any var() keyframe easing.
- First-load impact: module first-load JS measured 156.9 KB gz in a clean clone build of the current tree (≤160); GSAP not in first load; the programs-motion chunk is 2.0 KB gz (was 1.7) and still reaches gsap only through loadMotion().

### Schedule (S4) — round 2

- S4 v2.1 · The „Sledeći trening“ scoreboard names „ili“ slots too (supersedes „an ‚ili‘ slot is never named“): earliestNext() takes the earliest training across the shown groups. An „ili“ slot posts its first option in Doto with „ili 16:00“ under the numerals, so both options are shown and nothing is guessed. It counts while one option is still ahead and sorts by that option. Today, once the first option has begun, it goes muted (steel-300) and the later option takes the numeral colour. The card chip stays fixed-only (§5). Under „Sve“ the board therefore shows the competitive „ili“ slot on Po/Sr/Pe mornings and afternoons until 16:00, and at weekends.
- S4 v2.1 · Scoreboard rows are [label | numerals], [day | „ili“ line], [group], so the height is equal in the pending, ready and alt states (no shift after mount or on a filter). ≥1280 height 9.5rem → 10rem. data-state="none" (no candidate; unreachable with this data) hides the board and the ≥1280 location card takes its place.
- S4 v2.1 · „Po danu“ today marks: a row has started only when its last option has started; an „ili“ row with 16:00 ahead is upcoming (its finished 08:30 range stays muted). The royal rule marks the first upcoming row, „ili“ included (the scoreboard's pick); the now line sits above it only when started rows are above it.
- S4 v2.1 · Filter Flip: leaving items are not Flip targets. They are pinned at their measured boxes and dismount in place (120 ms fade + 8 px takeoff drop), and entering items land from 0.1 s. Both views hold the shrinking box (card list or day card) at its height with min-height until 0.36 s, then the location card lands. .sched-cards has align-content:start, so the held min-height never stretches grid rows (a pre-existing 548 px drift).
- S4 v2.1 · Day change: rows missing from the new day fade out as pinned clones (120 ms, linear) while shared rows hold 60 ms and then glide; the day card keeps its height until the motion ends.
- S4 v2.1 · Both sliding pills and their lit layers use 320 ms var(--ease-stick) (fast-out: 83% there at 80 ms, so the pill leads the panel); the squash starts at 100 ms. The day pill shows the white labels of the days it passes (data-pass for the slide); at rest only the selected label is rendered (D-36 kept).
- S4 v2.1 · Phone „Po danu“ rows have no gutter: „ili“ trails the first range and the second range starts its own line at x=0 (cards keep the hanging „ili“). The phone calendar disclosure indents its links to the summary text column on a hairline guide; the .ics link has a download icon.
- S4 v2.1 · ≥1280: the scoreboard's bottom margin equals the location card's height (--sched-aside-h, set by the enhancer's ResizeObserver), so both sticky boxes leave together and the card no longer slides over the board at the end of the section (pre-existing; the row height is unchanged).
- S4 v2.1 · Keyframe eases in schedule.css are literals (MD2-02).
- S4 v2.1 · Bundle (clone build of the current tree, all fixers' edits): first-load module JS 156.8 KB gz (≤160), GSAP not in first load, initial animation chunk 43 KB. The lazy schedule-enhance chunk is 3.37 KB gz (was ≈2.6 KB; over the 3 KB aim because of clones, pins, sweep and height hold).
- UI strings: „ili {16:00}“: the scoreboard's line under the numerals. It reuses the „ili“ of the §5 data form („08:30–10:30 ili 16:00–18:00“, content/schedule.ts formatTimes), with the later option's start time.; „Sledeći trening: {danas u 08:30} ili {16:00}, {group name}“: the scoreboard's sr-only sentence for an „ili“ slot (the existing composed form plus the „ili“ option).; In „Po danu“ rows, „ili“ is now its own span between the two ranges (same text; no new string).

### About (S5) and coaches (S6) — round 2

- D-AC2-1 · KR-05 brush (AC2-01, replaces the AC-05 loop): five overlapping dry-brush strands built like the S7 underline. Geometry is in brush-geometry.ts (pure, server-side, deterministic, Catmull-Rom as relative cubics): a hand-drawn oval (top 8% flatter, radius ±3%, 6° tilt + lean, slight outward spiral) starting and closing at 1–2 o'clock, 4% overshoot, flick along the tangent ≤30 units. Strand starts and ends are staggered so both ends splay. Bristle gaps are static masks that grow as the brush runs dry. The navy 0.18 under-stroke appears only over the pale wall at the upper right (masked copy of the core). Draw: core 0.72 s, bristles +0.04–0.12 s, ≈0.86 s.
- D-AC2-2 · The brush is decoration in the primary-motion queue (RC2-08). It waits for a primary motion already running (queuePrimaryMotion(1140, 1600)), then a 220 ms breath, then holds the slot for its draw. It commits only when the reader pauses on KR-05 (≥50% in view and no scroll for 300 ms, or 1.4 s in view), and it shows static instead of drawing when <15% of it is visible.
- D-AC2-3 · Wide coach card = index card (AC2-02): the name is level with the top of the print, the roles stand on the print's foot (the last rule on the „▸ KR-0x“ baseline, 11 px above the frame bottom), and the gap between them is headroom. The desktop print is 200 px (≥1024 with a container ≥620).
- D-AC2-4 · The KR-07 plate is always the finished static plate (AC2-03). Card 1's only motion is the stamp press, 120 ms after the card starts (queuePrimaryMotion at 20% visibility).
- D-AC2-5 · Licence stamp v3 (AC2-06/07): size and overhang are CSS vars. ≤300 px container: 52 px, clear of the frame code. The disc is 20% surface on photo cards and absent on the plate card. Where the KR-07 impression crosses the navy plate it prints in lav-200: the same impression, clipped by a static wrapper to the plate box (frame padding 6 px, foot 28 px). „GSS“ always lands on the white foot of the print (76/86 px stamps lowered to bottom −16/−21 px); measured median 5.4:1 at every width.
- D-AC2-6 · Hronologija content before decoration (AC2-04): a year lights on its own crossing (≤250 ms) and only the ghost exposure follows the flier. A new target mid-flight retargets at the current speed (min(remaining + 0.09 s/year, 0.9 s)); a touchdown with a further year wanted springs straight on (no squash or hold). Only flights from rest take a queue slot.
- D-AC2-7 · Timeline leap (AC2-09): each leg rises −8 px (desktop) / −6 px (phone) in its first 22% (power2.out), then drops onto the next year riding the progress head (power2.in). Pitch −8° at take-off, +4° at the apex; leg duration unchanged.
- D-AC2-8 · The inline „2007.“ in Istorijat uses proportional lining figures (no slashed zero); the timeline years keep tabular figures (AC2-08).
- AC2-05: the ≥1024 sticky KR-03 print (top 112 px) was already in HEAD. Verified in real scrolling at 1024/1280/1440: it releases at the grid end, 96 px above the band, and the header (bottom 84 px) never overlaps it. No change.

### Results (S7) and camp (S8) — round 2

- D-S7-5 (v3, RC2-01/MD2-06): nothing in the S7 sequence pops. A running step whose element has left the viewport completes invisibly as soon as another step waits, and its busy time no longer holds the next step in the shared queue. A step that is off-screen at its turn is finished without animating. A visible step ≥50% in view for more than 600 ms by its turn plays compressed: the scan and the shutter at 2.5×, the ceremony as a ≤700 ms short form (outline and blocks 240 ms, medals −16 px in 180 ms 40 ms apart with a 1.08/.88 landing squash, brush in 300 ms). A final state is never gsap.set on screen.
- D-S7-6 (v3, RC2-02): the Medalje brush is drawn by the same hand as the S5 loop (AC2-01): a loaded core plus four offset strands, pressure breathing, and bristle gaps as static dash masks. It rises only about 8 units and tapers into the core at both ends (a short pressed landing, a long dry lift). Strands start and end inside the core. The body is about 5 px at 1440. It sits at bottom −0.68em with 18 px of title padding, clear of the 'j' descender.
- D-S7-14 (v3, RC2-03): below 640 every LED window is a fixed 72 px face, centred beside its caption. Below 360 the window is 92 px (6 px side padding, Doto 32 px) and the caption is 14/1.32.
- D-S7-15 addendum (RC2-04): from 640 up the caption plate sits at the foot of each tile (label margin-top:auto), so labels end on one shared line and every izvor sits on one row. From 1024 the label uses the full tile width (no 24ch cap). 1024–1279 uses a 16 px caption with balanced lines.
- D-S8-14 (v3, RC2-05/MD2-08): the camp lead also glues the coordinated pair ('treninzi i druženje'), presentation only. From 1024 the note stands 146 px above the column bottom (was 112), leaving about 90 px of clear air over the beam for the 48 px flier.
- D-S8-2 (v3, RC2-07/MD2-08): the last beam routine takes off from the bar (crouch scaleY .9 → 1, EASE.takeoff). It flies one split leap with ghosts, sticks the landing and wobbles. When the bar lets go she drops 18 px through the beam line (clipped) and fades with her ghosts while the bar fades and the legs fold, all within DUR.fast. Only then does the line morph into the sea (DUR.reveal) and the echoes swell. Total 1.9 s. She is never on screen during the morph.
- D-S8-19 (MD2-08): the flier is 34/40/48 px (phones, tablets, ≥1024). Her lane and arc are measured at play time against the postcards' exact rotated frames and the text column (6 px vertical and 12 px horizontal clearance, lift 0.5–0.75 body height). She is drawn smaller where the room is tight (29 px at 320, 25 px in phone landscape); if nothing fits, the beam simply lets go into the sea. For the room, the horizon's margin-top is −22 px on phones (was −47) and −40 px at 640–1023 (was −58).
- D-S8-18 (RC2-06): phone landscape (orientation landscape, max-height 540 px). The postcard stack is min(70vw, (100svh − 160px) × 1.3) wide and centred, the no-JS cards are capped at (100svh − 130px) × 1.33 (440 px cap kept ≥1024), and the pager moves 40 px up (<1024). Photo 01's column is capped at (100svh − 110px) × 1.33, with the same crop and the native/2 cap kept. The whole card, its caption and the pager fit on one screen above the sticky bar.

### Gallery (S9) and enrollment + FAQ (S10) — round 2

- S9 entrance v2 (GE2-01/MD2-03; supersedes 'only on the prints in view (max 6)', the −30% reading zone and backwards fill): the hang is an arrival. While the sheet is below the fold at arm time, whole strips of its first screenful (≤6 prints) wait on their pegs (data-hang=pre: opacity 0, ±3°, −10px, screen + no-preference + html.js-motion only). Each print plays (data-hang=play) when its top edge is 12% into the viewport. Batches get a 50ms stagger; the first batch uses queuePrimaryMotion (≤250ms), later batches reserve the slot without waiting. End-state-only keyframes (gl-settle/gl-land/gl-show, fill both). MD-02 safety net: ≥50% in view for 300ms plays at once. A chip tap or unmount settles waiting prints.
- S9 entrance: a pre-state covers whole strips only. A plain 6-print cap split strip 2 at 1440 (05·12·08 hidden next to a visible 03).
- S9 filter Flip (GE2-02): data-flipping on the grid hides the strip rules during the Flip; they fade back over 180ms (no-preference) under the landed strips.
- S9 frame feet (GE2-03; supersedes 'category hidden on prints ≤200px wide and on all phones'): the category is decided per sheet with @container gl-sheet (width < 1316px) → hidden on every print. Only the full 1320px sheet (viewports ≥1412) shows it. The per-print ≤200px guard stays for flagged sheets. The foot is a fixed 31px, and frames fill their stretched strip item (flex column, foot margin-top:auto), so rendered bottoms coincide; sub-pixel aspect-ratio heights painted KR-03 1px low at 1024.
- S9 head ≥1024 (GE2-04): chip group content-sized, head row-reverse + wrap, gap 20px clamp(24px, 4.5vw − 16px, 48px). Four chips stay on one row beside the title from 1024; if they ever don't fit, the whole group wraps as one row.
- S9 lightbox foot (GE2-05): .lb-print is a size container. Under 212px (portraits in the ≤560px-tall landscape mode) the foot drops the category. Frame label nowrap. Landscape mode --lb-bottom 48px and rule bottom 18px give 17px from foot to marker.
- S9 lightbox rule (GE2-06): at ≥1024 × ≥561 the Marey rule is the current print's own rule: the photo's width, its line 24px under the foot (the marker clears the caption by 9.5px). Geometry comes from the print's layout in its slide (placeRule → --rule-x/y/w). On a slide change it glides and stretches (FLIP transform, 280ms, ease-flight). Phones and the short landscape mode keep it between the arrows.
- S10 kit (GE2-07): a ghost frame (accent .25) stands at the card's top-right corner at the inner padding (--kit-pad 22/32px). A full bag lands a separate solid flier on it from one hop back (24px, 16px arc), the ghost hides at touchdown, and the flier sticks. The title is capped at the card's 520px with padding-right pad + 52px (40px silhouette + 12px air); the critic's 56px would have let the title run under the silhouette.
- S10 band colour (GE2-08; amends 'the landing is accent' and '.42/.62'): the landing frame and the flier fill var(--fg) (navy-900, the numeral 3's solid). Ghost 2 is at .5 (FRAME_OPACITY.apex).
- S10 band ticks (GE2-09): BandSpec.ticks {apex, landing}; WIDE uses 428/837 band units (measured numeral centres range 426–440 and 834–852 from 1920 down to 640). The quadratic passes through the new hips and the apex stays the highest point. Tick-to-numeral error: ≤4px from 768 to 1920, ≤7px at 640.
- S10 leap motion (MD2-07): no title-landing wait. The primary-motion queue starts at the band's own IO. The failsafe can no longer be undone by a late play.

### Contact (S11) and booking sheet — round 2

- D-S11-25 · The finale flight is routed at play time around the title's and trust list's glyph boxes (Range rects). The rise stays under the line above (≤24px) and is skipped when the title top is off-screen. The figure drops straight under the mark until it clears every glyph between the mark and ghost 1, and only then travels back. The hop is a parabola; the dismount is a Catmull-Rom spline (buildFlight in doskok-path.ts).
- D-S11-26 · Take-off crossfade: the flier starts at exactly the mark's solid-frame ink size and centre, crossfades in place (DUR.tap) and then crouches. After touchdown the mark's solid settles at --ghost-3-o. Root cause of the old 2–2.5× pop: quickSetter on the 'scale' alias never applied; it now uses scaleX + scaleY setters.
- D-S11-27 · The salto is tucked (figure .9/.82) and small through the inverted part, over the empty gap under the title (turn −40 → −200). It opens out at full size only through the ghost frames (−330/−344/−354 → −360). No full-size inverted split frames.
- D-S11-28 · Phones (<640): the trust list sits under the privacy line, so the flight falls through empty navy and the button moves about 108px nearer the thumb. Supersedes the phone half of D-S11-19's 'trust column' note.
- D-S11-29 · ≥1024: the CTA panel hugs its content (align-self:start). The trust list keeps the trail room at trail-h+64px so ghost 1 clears the sash. The channels rise to 16px under the title's first line box (the „Pozovite“ row is level with „trening“), and the venue card aligns with the slab's floor. Supersedes the stretched slab of D-S11-15.
- D-S11-30 · ≥1024: #kontakt scroll-margin-top calc(-128px − cut), so every href="#kontakt" lands the title 16px under the 88px header line. On short laptops (max-height 820px) the title→panel gap is 24px. The doskok button is fully in view after the „Kontakt“ jump at 1024×768 … 1920×1080.
- D-S11-31 · Phone-number focus: a rounded 8px ring with a 3px background gap (box-shadow, transparent outline for forced colours). The number links carry 4px inline padding that negative margins offset.
- D-BK-8 (rev 3) · Error lines are 14/560 royal-600, led by a 16px filled „!“ disc (CSS mask). The disc shows on every invalid field, including the narrow Godište box. Still no red; supersedes 'the error line is navy text only'.
- D-BK-22 (rev) · The sheet has its own edge: a 1px lav-200/22% ring plus a static top highlight on the head. The phone backdrop is .74 (was .66); desktop stays .82.
- D-BK-25 · Short viewports (≤480px tall): the whole sheet still scrolls, but the action footer is sticky and compact (48px sends). From a 520px-wide footer the sends and the call link share one row. The head is compact (56px) but not sticky, to avoid the zoom peephole.
- MD2-02 (booking) · Keyframe-level timing functions in booking.css are literal values (takeoff cubic-bezier; wobble = rebound fallback, then the linear() list); var() there played linear in Chromium.

## TODO for the club (dosije §7) — nothing here is shown in the UI

1. Is the trial training free? → `FREE_TRIAL`
2. Parental consent for children's photos (and whether competitors' names may be shown) → `MINOR_PHOTOS`, `CAMP_GROUP_PHOTOS`
3. History wording 2007 / 2017 (Sokolsko društvo Kragujevac?) → `content/copy.ts`, `content/timeline.ts`
4. Does „08:30–10:30 ili 16:00–18:00“ depend on the school shift? → `SHOW_SHIFT_NOTE`
5. Trampoline (Instagram bio) and D program? → `SHOW_TRAMPOLINE` + copy in `content/programs.ts`
6. Seat address (GSS lists Cara Dušana 21) — the site shows only the training hall.
7. Who is who in photos 401/402; a portrait of Slađana Kovačević in club kit; one line per coach.
8. Who answers which phone; Viber / WhatsApp? → `SHOW_VIBER`
9. Membership fee public? → `SHOW_FEES` + `content/faq.ts`
10. 2023 finals: medal count and apparatus; which competition is photo 01 (Valjevo, 30. 5. 2026)?
11. Camp photos: Greece or another camp? Dates/price for 2027.
12. Facebook page and Google Business profile → `SHOW_FACEBOOK`
13. Domain (.rs / .org.rs) → `SITE_URL`
14. New uneven bars 2026 (Instagram only) → `SHOW_EQUIPMENT_2026`
15. May camp photo 16 (camp lunch) also appear in the S8 postcard stack? (§5 S8 lists 10 and 11 only.)
16. Approve a small-size logo lockup (script + silhouette without the micro-text) for the header at ≤56px; the header renders the full logo until then.
