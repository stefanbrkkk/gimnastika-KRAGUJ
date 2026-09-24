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
- **D-05 · Mona Sans via `next/font/google`** (`Mona_Sans`, axes `['wdth']`, latin + latin-ext).
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
