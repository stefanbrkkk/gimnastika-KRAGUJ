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
- D-Q6 · The „result card carries the silhouette“ idea is built as one card with a darkroom strip on top: a Marey-style chronophotograph with a faint measuring grid, the mat line and frames 01/02/03. The same #leap path moves one frame per answer (takeoff → flight → landing) and leaves ghost frames in #cfe6ff and #c9b8ff. Motion is transform/opacity only, 600ms ease-stick, pivot set by nested <g> (no transform-box on <use>). Under reduced motion, Save-Data and no-JS it is the static final composition.
- D-Q7 · Booking prefill labels: program titles for beginner results. „Mlađa početna grupa / Starija početna grupa“ for the age-8 beginner result. QUIZ.competitiveTitle for the competitive result. The booking dialog adds unknown labels as their own option.
- D-Q8 · The competitive result lists its three schedule groups by their S4 names (Takmičarke — A i B program; C program, starije; C program, mlađe) as h4 under the title. Beginner results use the program title plus its age line („3–8 godina“ / „od 8 godina“).
- D-Q9 · The answers so far appear as an edge print on the strip („9 GOD. · TEK POČINJE“). This replaces a kicker above the result heading (the craft floor bans eyebrows); the strip is aria-hidden.
- D-Q10 · Frame numbers use full-contrast steel-300 / white on navy, never dimmed with opacity (axe color-contrast). Upcoming frames are lighter in weight, and a skipped frame 02 is struck through.
- D-Q11 · Desktop layout: the heading sits sticky in columns 1–4 (top 112px) and the card in columns 5–12. This follows the page's left/right title rhythm. Below 1024px they stack.

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

- S5 uses theme „ice“ (D-20, page.tsx, task) although master §5 says „light“; ice is the light variant, so CTA and focus colours are unchanged.
- S5 order: mobile mission → photo 03 → history → timeline; desktop photo 03 in cols 1–5, text in cols 7–12, timeline in cols 5–12 with a sticky „Hronologija“ h3 in cols 1–4.
- Timeline years with several entries (2024) share one node and render as a nested list.
- Timeline motion is driven by IntersectionObserver: the line moves one node at a time as each year crosses 65% of the viewport. Not a scrub: no scroll listener, no rAF loop, same on mobile. Years already scrolled past show as reached without animation.
- Timeline line keeps going past the last year and fades out (static mask) — the club's story continues.
- Photo 17 (cake) is its own list item after 2017 with no year node, so no date is claimed.
- Coach cards use a container query: side by side at card width ≥540 px (768 stacked; 1280/1440 two columns), stacked at 360 and at 1024 (two narrow columns).
- Slađana's placeholder reuses the site's navy .photo-placeholder in the same 4:5 frame as Ivana's portrait. The frame label reads „Portret uskoro“ (COACHES_COPY.portraitPending).
- „Licenca GSS“ badge: round stamp in the accent colour (royal-600 on white, 6.46:1) with „LICENCA“ on the arc and „GSS“ in the centre. No club or GSS logo, so it can't pass as an official GSS seal. Its final rotation is 0° per §4.
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
- S9 layout: 2-column masonry under 640px, 3 columns from 640px. The frame caption shows the category (a text cue for the filter) and is hidden under 480px to keep narrow frames clean.
- S9 swipe-down closes above 110px drag or 900px/s release velocity. During the drag the photo follows the finger, scales down to 0.9 at most, and the scrim fades toward the page.
- S10 steps are three frames of one leap (ghost takeoff, ghost apex, solid landing on the mat line = „postaje član kluba“), with outline numerals for steps 1–2 and a solid numeral for 3.
- S10 adds a booking CTA („Zakažite probni trening“, data-booking="") and a secondary call button („Pozovite 060 028 7631“) under the steps, reusing existing copy (CTA.trial, HERO.ctaSecondary), so a parent can act right where step 1 says „Javite se“. Never two filled buttons side by side.
- S10 shows „Upis traje tokom cele godine.“ next to a decorative, aria-hidden row of 12 filled dots (all months open), echoing the schedule's week-dot rows.
- S10 FAQ is not an exclusive accordion (no `name` attribute), so parents can open several answers. The height animation uses ::details-content grid rows plus content-visibility allow-discrete where supported, and is instant elsewhere.
- S10 checklist items are rendered lowercase exactly as in content/copy.ts (no CSS capitalisation).
- S10 FAQ last line: only the number is the tel link, not the whole sentence.

### Contact (S11) and booking sheet

- D-S11-1: The S11 CTA panel is a leotard-gradient frame (10/14/16px) around a solid navy-950 slab, so no text ever sits on the gradient. Desktop splits 7/5 (panel left, contacts right under the right-aligned title); mobile stacks panel then contacts.
- D-S11-2: The slab repeats the hero trust points (HERO.trust) as the closing argument and puts BOOKING.privacy under the button. No new copy was invented.
- D-S11-3: The „doskok“ is shown as a static chronophotograph: 3 steel-300 ghost frames plus a white landed frame doing a split on the button's top edge. This is the no-JS and reduced-motion final state. JS replays the hop through exactly those positions.
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
