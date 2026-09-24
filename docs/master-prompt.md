# MASTER PROMPT — GSU „Kraguj“ website (za /website-builder u Claude Code) · v2, posle završne ocene

> Kako se koristi:
> 1. Raspakuj `gsu-kraguj-materijali.zip` u prazan folder projekta kao `assets-source/`.
> 2. `gsu-kraguj-dosije.md` stavi u `docs/dosije.md`. Ako je repo javan, dodaj ga u `.gitignore`, jer sadrži interne beleške i treća lica.
> 3. Ceo blok ispod nalepi u Claude Code (uz /website-builder).
>
> Pretpostavke (§0) su prekidači u `content/site.ts`. Kad klub odgovori na pitanja iz dosijea (odeljak 7), menjaju se samo prekidači.

```text
You are building the official website of a real Serbian gymnastics club: Gimnastičko sportsko udruženje „Kraguj“ (GSU „Kraguj“), Kragujevac. The brand name on the logo is "Gimnastički klub Kraguj". The site must be award-level in UI and motion (a portfolio piece for the developer, Stefan Brkljačić) AND convert parents on cheap Android phones. Work autonomously end-to-end. Do not ask me questions: decide, and log every decision and assumption in DECISIONS.md.

Use these skills/tools if available: /website-builder, web-craft (read frontend-design/GUIDE.md, coding-rules.md, gsap/core.md, gsap/timeline.md, gsap/scrolltrigger.md, gsap/plugins.md, gsap/react.md, gsap/performance.md, ui-review/guidelines.md), impeccable, gsap-skills, Playwright MCP (screenshots), Context7 (current docs for Next.js 16, Tailwind v4, GSAP 3.15).

=====================================================================
0. ASSUMPTIONS = FLAGS (content/site.ts, all editable, all documented in README)
=====================================================================
FREE_TRIAL=false      The club never said the trial training is free. Copy says "probni trening", never "besplatan/besplatno".
SHOW_SHIFT_NOTE=false If true, append " · po školskoj smeni" to the "08:30–10:30 ili 16:00–18:00" slots. If false, show the slot text only.
SHOW_TRAMPOLINE=false Trampolina is mentioned only in the Instagram bio; not confirmed by the club.
SHOW_FEES=false       Membership fee not provided.
SHOW_VIBER=false      Viber not confirmed. When false, messaging uses SMS. When true, see §5 BOOKING for Viber behaviour.
SHOW_FACEBOOK=false   The Facebook page is only confirmed via the search index.
SHOW_EQUIPMENT_2026=false  The new uneven bars (2026) are sourced only from an Instagram post.
CAMP_NOTE_UNTIL="2027-06-30"  After this date, hide the sentence about 2027 camp registrations.
MINOR_PHOTOS=true     Photos showing children render normally in local/dev builds. When false, every photo with a minor renders as a navy contact-sheet placeholder (silhouette + "Fotografija uskoro"). The README must state that a public URL (including *.pages.dev) is allowed only with MINOR_PHOTOS=false OR after the club confirms parental consent.
CAMP_GROUP_PHOTOS=false  Photos 02 and 09 (camp groups, about 40 girls, possibly from other clubs) are hidden by default.
INDEXABLE=false       Controls only <meta name="robots" content="noindex">, robots.txt and sitemap. noindex is NOT consent.
SITE_URL              env var, default https://gimnastikakraguj.rs (domain not bought yet).
CREDIT_NAME="Stefan Brkljačić", CREDIT_URL="" (optional link).
Wording rules:
- Audience: "deca" in general copy; "takmičarke" for competitive groups (whether boys join beginner/aerobic groups is unconfirmed).
- Coaches: consistently feminine forms (trenerica, sutkinja, predsednica, članica). Log this in DECISIONS.md; the club may revert.

=====================================================================
1. GOAL & DEFINITION OF DONE
=====================================================================
Goal: a one-page site plus a custom 404 page. A parent in Kragujevac must be able to:
(1) understand which group fits their child,
(2) see the weekly schedule instantly,
(3) trust the club (federation, licences, verified results),
(4) call or message in ≤2 taps from anywhere.

Creative concept: "LET KRAGUJA" — the site is a chronophotograph. Scroll is the camera shutter. The leaping gymnast silhouette from the club logo flies through the page in ghost frames (Marey/Muybridge motion studies), "landing" on section titles and finally on the trial-training CTA.

Done = every acceptance criterion in §7 passes, verified by you with screenshots and measurements, plus a final report in the §11 format.

=====================================================================
2. INPUTS (already in the repo)
=====================================================================
assets-source/logo/
  kraguj-logo-{navy,white,black,currentcolor}.svg — official logo, vectorized, viewBox 0 0 490 213, one evenodd path (~16KB gz).
  kraguj-wordmark.svg — logo WITHOUT the silhouette (fill currentColor). It has a small gap in the "j" where the leg crosses it, and the silhouette covers that gap, so the final state always shows wordmark + silhouette together.
  kraguj-silueta.svg — the leaping gymnast alone: <path id="leap" fill="currentColor">, viewBox "262 48 230 150" (~3.9KB gz). Placed at that viewBox position over the wordmark, it reproduces the full logo exactly. THIS is the hero motion asset.
  *.png, baner-kluba-original.jpg (club banner, color reference only), logo-original-490px.jpg.
assets-source/slike/web/ — 11 selected photos (JPG + WebP, EXIF already stripped):
  01-uspeh-medalje-ekipa — results
  02-zajednica-kamp-grupa — camp group; behind CAMP_GROUP_PHOTOS
  03-hala-ceo-klub-baner — about; 1066px
  04-trening-airtrack-skok — programs; 1066px
  05-treneri-zajedno — coaches; adults only
  06-trener-portret-mladja — Ivana Kovačević; adult
  08-aerobik-tim-selfie — aerobic. One face is already strongly pixelated: never un-blur it, and never crop in a way that makes the pixelation look accidental.
  09-kamp-hala-sertifikati — camp group; behind CAMP_GROUP_PHOTOS
  10-kamp-selfie-park, 11-kamp-penjanje
  12-greda-mural-poze — gallery only
  There is NO usable portrait of Slađana Kovačević: her coach card uses a silhouette placeholder + TODO.
assets-source/slike/rezerva/13…19 — gallery-only extras.
docs/dosije.md — facts with source URLs and statuses (✅ confirmed, 🟡 single source, ⚠️ uncertain, ❌ not found).
SOURCE RULE: the UI may show only (a) facts marked ✅ in docs/dosije.md, (b) text written in this prompt, (c) 🟡 items behind their flags above. Nothing else. For missing info, put a TODO in content files and DECISIONS.md, never in the UI.

=====================================================================
3. DESIGN SYSTEM
=====================================================================
Colors (contrast verified):
  --navy-950 #0a1a38 · --navy-900 #112d5f (text on light 13.4:1; "darkroom" sections) · --navy-800 #1e4175
  --royal-600 #306098 (links/active, 6.46:1 on white) · --royal-500 #457cb3 (only text ≥24px/icons)
  --steel-300 #8da9c6 (muted text on navy 5.5:1; ghost frames) · --chalk #f6f8fc (page bg: cool chalk, NOT warm cream)
  --ice-50 #eef3fa · --line #d5e0ee · --slate-600 #4a5f80 (muted text on light 6.1:1)
  --lav-200 #c9b8ff (CTA on dark with navy text, 7.5:1) · --violet-600 #6b4fd8 (focus ring on LIGHT only) · --iceblue-200 #cfe6ff
  medals only: --gold #c9a13b --silver #a7b1bf --bronze #b0703a
  --grad-leotard: linear-gradient(118deg,#cfe6ff 0%,#c9b8ff 38%,#8e78f0 68%,#306098 100%)
    Used ONLY in 3 places: (1) hero ghost frames, (2) the trial-training CTA panel in S11, (3) the header band of the "Medalje" block in S7. Never put text directly on it.
  Section themes:
    Light: bg chalk, fg navy-900, CTA = navy pill + white text.
    Dark: bg navy-900/950, fg #eef3fa, CTA = lav-200 pill + navy text.
  Focus ring:
    Light: "0 0 0 3px var(--bg), 0 0 0 5px var(--violet-600)".
    Dark: same with --lav-200 (violet on navy is only 2.4:1).
Type:
  Mona Sans variable (wght 200–900, wdth 75–125), subsets ['latin','latin-ext'], axes ['wdth']:
    via next/font/google `Mona_Sans` (exists in Next 16);
    fallback next/font/local with the OFL woff2 from github.com/github/mona-sans (Google builds need network).
  Doto (dot-matrix) ONLY for scoreboard numerals and the easter egg:
    ≥32px, tabular;
    loaded via next/font/local from a pyftsubset subset (digits . : – ~).
  The brush "Kraguj" exists only inside the SVG logo. Never add another script/brush font.
  Scale (fluid 360→1440):
    display-xl: clamp(2.75rem,.5rem+9.5vw,9rem), lh .88, ls -.045em, wght 800, wdth 105→125
    display: clamp(2.25rem,1rem+5.4vw,6rem)
    h2: clamp(1.625rem,1.2rem+1.9vw,2.75rem)
    h3: clamp(1.25rem,1.05rem+.9vw,1.75rem)
    body 17px/1.55 · small 15px
    label: 13px caps, +.08em, wght 600
    time: 20px, 700, tabular-nums
    button: 16px, 650, min-height 52px
  wdth: mobile 100–110 (Serbian words are long: "Gimnastičko"), desktop 118–125.
  Č č Ć ć Š š Ž ž Đ đ must render in every weight used. Quotes in UI text are always „…“.
Shape:
  Radii: 0 (full-bleed photos) / 8 / 14 / 20 (cards) / 28 (sheets) / 999 (pills).
  Shadows are navy-tinted, never grey:
    sh-2 "0 4px 8px -2px rgba(17,45,95,.08), 0 12px 24px -6px rgba(17,45,95,.10)"
    sh-3 "0 8px 16px -4px rgba(17,45,95,.08), 0 30px 50px -12px rgba(17,45,95,.18)"
  Press: translateY(2px) + "0 2px 0 0 rgba(17,45,95,.28)" → 0.
Grid:
  4/8/12 columns at 360/640/1024+; margins 20/32/48; gutters 12/16/24.
  Container 1320px; text ≤64ch.
  Section spacing: 72px mobile / 144px desktop.
  Touch targets ≥48×48.
  scroll-padding-top: 88px; scroll-padding-bottom: calc(64px + env(safe-area-inset-bottom)).
Photo treatment ("contact sheet"):
  Thin frames with a small frame label "KR-01"…"KR-19" (no years).
  Consistent subtle grade: very light cool tone + 3–4% grain as a static overlay.
  Never render a photo wider than its native pixels / 2 in CSS px. 03, 04 and 06 are ≤1170px wide, so ≤585 CSS px.
  White brush-stroke annotations (echoing the white strokes on the club-jacket sleeves): max 2 on the whole page, drawn with DrawSVG on hand-drawn stroke paths.

=====================================================================
4. MOTION SYSTEM — "phases of a leap"
=====================================================================
Tokens (Tailwind v4 @theme + GSAP CustomEase with the same names):
  --ease-stick (landing) cubic-bezier(.16,1,.3,1) — entrances/reveals
  --ease-takeoff cubic-bezier(.7,0,.84,0) — exits ≤200ms
  --ease-flight cubic-bezier(.45,0,.55,1) — paths
  --ease-rebound cubic-bezier(.34,1.56,.64,1) — badges, buttons, landing squash
  CustomEase "hang": "M0,0 C0.18,0.42 0.34,0.5 0.5,0.5 0.66,0.5 0.82,0.58 1,1"
  Durations: tap 100 · fast 180 · base 280 · reveal 600 · slow 900 · hero intro ≤1900ms total.
  Stagger: words .04 · lines .08 · cards .06, total ≤.36s. The only exception is the hero ghost frames.
  Offsets: y 16px mobile / 24px desktop. Prefer clip-path reveals.
  Rule: ONE primary motion per viewport.
  Animate only transform, opacity, clip-path, stroke-dashoffset. Never animate filter/backdrop-filter/box-shadow on scroll.
Architecture:
  Server Components by default. Client islands only where interaction is needed: hero motion, quiz, schedule, booking sheet, gallery lightbox, sticky bar.
  GSAP 3.15+ (free, all plugins in the `gsap` package, "Standard No-Charge" license) with @gsap/react useGSAP + gsap.matchMedia().
  Initial chunk: gsap core + MotionPathPlugin + CustomEase only.
  ScrollTrigger: loaded right after the intro on (min-width:1024px) and (pointer:fine); lazily everywhere else.
  Flip, SplitText, MorphSVG, DrawSVG, Draggable+Inertia, Observer: dynamic import when their section is ≤1 viewport away.
  No Motion/framer-motion unless an adapted component truly requires it (then LazyMotion + m).
  No Lenis on touch devices; optional on desktop only.
  ScrollTrigger.config({ ignoreMobileResize: true }); use 100svh.

HERO — signature moment (navy-900, 100svh):
  No-JS / first paint: the complete FINAL composition — H1, subline, CTAs, trust strip, full logo (wordmark + silhouette), mat line and 6 ghost frames. The page is complete and beautiful with no JS.
  Anti-flash rule:
    An inline <head> script adds class "js-motion" to <html> before first paint, only when motion is allowed (no reduced motion, no saveData).
    Only html.js-motion hides the DECORATIVE hero layer (ghosts, flying silhouette, wordmark reveal, mat line).
    H1, subline, CTAs and trust strip are NEVER hidden; the H1 is the LCP element.
    If the intro has not started 2.5s after load, force the final state.
  Intro (after hydration, ≤1.9s):
    (1) 0–0.35s: 1.5px mat line (steel-300 at 60%) draws left→right (stroke-dashoffset).
    (2) 0.2–1.2s: white silhouette (<use href="#leap">, color:#fff) flies a parabola (MotionPath, align, alignOrigin [.5,.6], ease "hang") and lands exactly at its logo position.
    (3) During the flight it leaves 6 ghost frames:
        gsap.set(motionPath {end: p}) for p in [.08, .15, .22, .29, .36, .45];
        fills step #cfe6ff → #c9b8ff → #8e78f0;
        opacity .10→.28, stagger .12.
    (4) 1.1–1.9s: wordmark reveals by clip-path wipe (inset(0 100% 0 0) → inset(0)). The logo assembles out of motion.
  Desktop only, (min-width:1024px) and (pointer:fine):
    pin end "+=80%", scrub .5;
    ghost frames fade one by one;
    the mat line extends and drops into a diagonal toward the next section. The floor-exercise diagonal is the page spine; section titles alternate left/right.
  Mobile: no pin, no scrub.
  Easter egg:
    Trigger: tapping the landed silhouette 3×.
    Shows a 40px Doto scoreboard "10.00" that flips to "1.00".
    Tooltip: "Kad je Nadia Comăneci 1976. dobila prvu savršenu desetku, semafor nije mogao da prikaže 10 — pisalo je 1.00."

PER SECTION (content in §5):
  Quiz: the result card's silhouette rotates/scales slightly per step (same path; no new poses unless you draw them).
  Programs:
    Cards in a CSS scroll-snap row (native momentum).
    Each card's apparatus line icon draws once on enter (.6s).
    Tap opens a detail sheet via Flip.
    Age chips filter/reorder via Flip ≤280ms.
  Schedule: clarity first, no scroll choreography. Sliding pill for tabs; Flip for filtering.
  Coaches:
    Portrait reveal "from a crouch": clip-path inset(100% 0 0 0)→inset(0) + scale 1.08→1, .6s ease-stick.
    "Licenca GSS" badge stamps in: scale 1.25→1, rotate −8°→0, ease-rebound .35s.
  Results:
    Static Doto numerals; only the LAST digit flips once on enter (no count-up).
    The podium line draws.
    SplitText line mask on the section title only.
    Sequence these, never overlap.
  Camp:
    The beam line morphs into a sea wave on scrub (MorphSVG, one path, desktop only).
    Photo "postcards" can be flicked sideways (Draggable type:"x" + Inertia) and also have prev/next buttons (WCAG 2.5.7).
    Vertical page scroll stays native.
  Gallery:
    CSS-columns masonry.
    Tap opens a fullscreen lightbox via Flip; native scroll-snap swipe inside.
    Closing: swipe-down (Observer + velocity threshold) or Esc/close button, with a Flip back.
  Final CTA "doskok":
    When the CTA enters, a small silhouette hops a short arc and lands on the button's top edge.
    The button squashes: scaleY .94 / scaleX 1.03 → 1, ease-rebound .35s.
    Same squash on :active for all buttons (CSS).
  404 "Ravnoteža na gredi":
    The silhouette on a beam tilts with DeviceOrientation: Android works without permission; iOS needs a tap-to-enable button.
    Static under reduced motion.
    Copy: "Ups — ova stranica je izgubila ravnotežu." / button "Nazad na početnu".
REDUCED MOTION (CSS media + gsap.matchMedia):
  The hero shows the final static composition.
  No intro, pin, scrub, parallax, flips, draws or particles.
  Flip: instant or a 150ms crossfade.
  SplitText off; no autoplay.
  Draggable stays, without inertia.
  saveData: same as reduced motion for decorative effects.
AVOID (reads as "AI template"):
  preloader 0–100%, count-up numbers, split-text on every heading, marquees
  custom cursor, bento-for-everything, glassmorphism / "liquid glass" nav
  aurora/mesh/beam/sparkle/lamp/spotlight backgrounds, 3D blobs
  pinned horizontal scroll on mobile, hover-only effects
  typewriter / flip-words / text-generate
  cyan→purple→magenta palettes, Bebas/Oswald "gym" type, neon
  rhythmic-gymnastics iconography (ribbon/hoop/ball) — this is ARTISTIC gymnastics
  stock photos, AI images or video

=====================================================================
5. INFORMATION ARCHITECTURE & COPY (Serbian, Latin, ekavica, formal "Vi" toward parents — use exactly; [ ] = conditional)
=====================================================================
<html lang="sr-Latn">. Skip link: "Preskoči na sadržaj".

HEADER
  Floating. Hides on scroll-down after 120px; reappears on scroll-up and on :focus-within.
  White logo on dark sections, navy logo on light.
  Links: Programi · Raspored · Treneri · Uspesi · Kamp · Kontakt.
  Pill button: "Zakažite probni trening".
  Mobile: menu sheet.
STICKY BOTTOM BAR (mobile)
  Appears after the hero CTAs leave the viewport (IntersectionObserver).
  Height 64px + safe-area.
  Buttons: [Pozovite] [SMS] [Raspored]; [Viber] replaces [SMS] only if SHOW_VIBER.
  Hides while the keyboard is open (visualViewport) and while the S11 contact block is visible.

S1 HERO (dark)
  Eyebrow: Gimnastičko sportsko udruženje „Kraguj“ · Kragujevac · od 2007.
  H1: Sportska gimnastika za decu u Kragujevcu
  Sub: Od prvog koluta do postolja — licencirane trenerice, takmičarski programi Gimnastičkog saveza Srbije i porodična atmosfera, za decu već od 3. godine.
  CTA primary: <a href="#kontakt">Zakažite probni trening</a>, enhanced by JS to open the booking sheet.
  CTA secondary: "Pozovite 060 028 7631" (tel:+381600287631).
  Trust strip: Član Gimnastičkog saveza Srbije · Licencirane trenerice GSS · Upis tokom cele godine

S2 QUIZ (light) — "Koji program je za vaše dete?"
  Step 1: "Koliko godina ima vaše dete?" → sticker chips 3…18 (2px border, radius 12, ≥56px).
  Step 2 (only if age ≥ 8): "Da li je već treniralo gimnastiku?" → "Tek počinje" / "Treniralo je rekreativno" / "Takmičilo se".
  Rules (first match wins):
    3–7 → Mlađa početna grupa.
    8 & "Tek počinje" → both beginner groups + "Za uzrast od 8 godina trenerica predlaže grupu na probnom treningu."
    ≥9 & "Tek počinje" → Starija početna grupa.
    ≥8 & ("Treniralo je rekreativno" | "Takmičilo se") → Takmičarske grupe (A, B i C program) + "Grupu predlaže trenerica posle probnog treninga."
  Every result also shows: "Pitajte trenericu i za aerobnu gimnastiku." (no age claim).
  Result card:
    the group's schedule chips;
    CTA "Zakažite probni trening za ovu grupu" (prefills the booking sheet);
    small line "Konačnu grupu predlaže trenerica posle probnog treninga.";
    announced via aria-live.

S3 PROGRAMS — "Programi"
  1 Mlađa početna grupa · 3–8 godina · Po, Sr, Pe 18:00–19:00
    "Prvi koraci u gimnastici: koordinacija, ravnoteža, gipkost i hrabrost — kroz igru, uz trenericu."
  2 Starija početna grupa · od 8 godina · Po, Sr, Pe 19:00–20:00
    "Za decu koja tek počinju, a imaju 8 i više godina: osnovni elementi na parteru i spravama, snaga i pravilno držanje."
  3 Takmičarke — C program · two groups:
    Starije: Po, Sr, Pe 08:30–10:30 ili 16:00–18:00
    Mlađe: Ut, Če 19:30–21:30; Pe 08:30–10:30 ili 16:00–18:00
    "Takmičarske grupe po C programu Gimnastičkog saveza Srbije."
  4 Takmičarke — A i B program · Po, Sr, Pe 08:30–10:30 ili 16:00–18:00; Ut, Če 17:30–19:30
    "Takmičarska grupa A i B programa Gimnastičkog saveza Srbije — treninzi pet dana u nedelji."
  5 Aerobna gimnastika · Po, Sr, Pe 20:00–21:30
    "Gimnastika uz muziku: koreografija, skokovi, snaga i izdržljivost. Nastupamo na takmičenjima Gimnastičkog saveza Srbije."
  [6 Trampolina — only if SHOW_TRAMPOLINE; copy TODO]
  Program colors (one color = one program, identical in S3, S4 and S9 filters; always paired with a text label):
    1 #cfe6ff · 2 #8da9c6 · 3 #457cb3 · 4 #112d5f · 5 #c9b8ff
  Each card:
    a simple line icon you draw: parter = square, greda = long line, dvovisinski razboj = two bars at different heights, preskok = vault table, aerobik = figure;
    title, age, days/times;
    buttons "Pogledajte raspored" + "Zakažite probni trening".

S4 SCHEDULE — "Raspored treninga"
  Sub: Sala Trgovinsko-ugostiteljske škole „Toza Dragović“ (u gradu poznata kao „ŠUP“), Save Kovačevića 25
  Segmented control: [Po grupi] (default) · [Po danu]. Filter pills per program.
  Data (content/schedule.ts):
    Takmičarke — A i B program: Po, Sr, Pe 08:30–10:30 ili 16:00–18:00; Ut, Če 17:30–19:30
    Takmičarke — C program, starije: Po, Sr, Pe 08:30–10:30 ili 16:00–18:00
    Takmičarke — C program, mlađe: Ut, Če 19:30–21:30; Pe 08:30–10:30 ili 16:00–18:00
    Mlađa početna grupa (3–8 god.): Po, Sr, Pe 18:00–19:00
    Starija početna grupa (8+ god.): Po, Sr, Pe 19:00–20:00
    Aerobna gimnastika: Po, Sr, Pe 20:00–21:30
  "Po grupi":
    a card per group with a 7-dot week row labelled Po Ut Sr Če Pe Su Ne (sr-only full day names), active days filled with the program color;
    times in tabular numerals.
  "Po danu":
    sticky day strip Po–Ne;
    today is selected AFTER mount (Europe/Belgrade); SSR renders no selection, to avoid hydration mismatch;
    weekend empty state: "Vikendom nema redovnih treninga. Vidimo se u ponedeljak!"
  "Sledeći trening" chip:
    only for fixed slots; computed after mount; updates every minute;
    forms: "danas u 18:00" / "sutra u 18:00" / "u ponedeljak/utorak/sredu/četvrtak/petak u 18:00".
  Calendar, per group:
    (a) "Dodajte u kalendar (.ics)" — fixed slots only:
        one VEVENT per time block;
        RRULE FREQ=WEEKLY;BYDAY=…;
        TZID Europe/Belgrade WITH a VTIMEZONE block;
        UID, DTSTAMP, CRLF, 75-octet folding.
    (b) "Google Kalendar" link: calendar.google.com/calendar/render?action=TEMPLATE&…&recur=RRULE:…&ctz=Europe/Belgrade (Android cannot import .ics).
  Location card: address + "Otvorite u mapama" → https://www.google.com/maps/search/?api=1&query=Trgovinsko-ugostiteljska+%C5%A1kola+Toza+Dragovi%C4%87%2C+Save+Kova%C4%8Devi%C4%87a+25%2C+Kragujevac

S5 ABOUT — "O nama" (light; photo 03 + photo 02 if CAMP_GROUP_PHOTOS)
  Mission (exact):
    "Naša misija je da kroz gimnastiku podržimo pravilan fizički, mentalni i emotivni razvoj dece i mladih. Posvećeni smo stvaranju bezbednog, stimulativnog i pozitivnog okruženja u kom svaki član razvija disciplinu, samopouzdanje i ljubav prema zdravom životu. Misija našeg kluba je i pružanje najvišeg nivoa trenažnog procesa u gimnastici — od prvih koraka u rekreativnom sportu do vrhunskih takmičarskih rezultata. Kroz stručan rad i individualan pristup nastojimo da izgradimo ne samo vrhunske sportiste, nego i snažne ličnosti."
  History (exact):
    "Počeli smo 2007. godine sa jasnim ciljem da postanemo dom svih ljubitelja gimnastike u našem gradu i okolini. Od tada su kroz našu salu prošle generacije dece — mnoga su osvojila medalje, a pre svega izrasla u zdrave i ostvarene ljude. Od skromnih početaka do opremljene sale i licenciranog trenerskog tima, rasli smo zajedno sa našim članovima. Ponosni smo na svoju tradiciju, osvojene medalje i porodičnu atmosferu po kojoj nas prepoznaju generacije."
  Timeline (content/timeline.ts):
    Built as a GSAP vertical line using scaleY + ResizeObserver.
    Each item links its source when it has one.
    2007 — Počeci kluba (izvor: https://www.glassumadije.rs/grad-podrzava-gimnasticki-klub-kraguj-u-nabavci-sportske-opreme/)
    2017 — Gimnastičko sportsko udruženje „Kraguj“: "Od 2017. radimo kao GSU „Kraguj“." (TODO confirm in DECISIONS.md; no marker in the UI)
    2022 — Prvo mesto ekipno u I kolu B programa, Kostolac → https://www.gssrb.rs/wp-content/uploads/2022/05/Bilten-I-kolo-B-Program-ZSG-GSS-2022.pdf
    2023 — Medalje na finalu Prvenstva Srbije u B programu, Beograd → https://www.gssrb.rs/wp-content/uploads/2024/02/BILTEN-PRVENSTVO-SRBIJE-B-PROGRAM-FINALE-naslov.pdf
    2024 — Nastup na Prvenstvu Srbije u apsolutnoj kategoriji, Kostolac → https://www.gssrb.rs/wp-content/uploads/2024/12/BILTEN-PRVENSTVO-SRBIJE-U-APSOLUTNOJ-KATEGORIJI-2024.-ZSG.pdf
           Grad Kragujevac pomogao nabavku sportske opreme → Glas Šumadije link above
    2025 — Aerobna gimnastika na Prvenstvu Srbije, Ruma → https://www.gssrb.rs/wp-content/uploads/2025/12/Bilten-AER-SRB-2025.pdf
    2026 — 42 registrovane takmičarke u sportskoj i 12 u aerobnoj gimnastici (links in S7)
           [+ "novi dvovisinski razboj uz podršku Grada" only if SHOW_EQUIPMENT_2026]

S6 COACHES — "Trenerice" (photos 06, 05)
  Slađana Kovačević — Predsednica kluba · Licencirana trenerica sportske gimnastike (GSS) · Licencirana sutkinja za žensku sportsku gimnastiku (GSS)
    Portrait: silhouette placeholder in a contact-sheet frame. TODO: request a portrait in club kit.
  Ivana Kovačević — Licencirana trenerica sportske gimnastike (GSS) · Članica upravnog odbora kluba (photo 06)
  Photo 05 appears as a wide "Na takmičenju" image under the cards (no names in the caption).
  `bio?: string` stays empty. No invented bios, birth dates or licence numbers.
  Each card gets a "Licenca GSS" stamp badge.

S7 RESULTS — "Uspesi" (dark "scoreboard"; photo 01)
  Stat tiles (static Doto numeral + label + small "izvor ↗"):
    2007 — početak rada → Glas Šumadije link
    42 — registrovane takmičarke u sportskoj gimnastici (GSS, 2026) → https://www.gssrb.rs/wp-content/uploads/2026/06/ZSG-Registrovane-takmicarke-I-rok-2026-azurirano-22.06.2026-1.pdf
    12 — registrovanih takmičarki u aerobnoj gimnastici (GSS, 2026) → https://www.gssrb.rs/wp-content/uploads/2026/06/AER-Registrovane-takmicarke-I-rok-2026-azurirano-22.6.2026.-.pdf
    oko 120 — članova (2024) → Glas Šumadije link
  Block "Medalje" (gradient header band):
    • Zlato, srebro i bronza na finalu Prvenstva Srbije u B programu — Beograd, 2. 12. 2023. → B-program bulletin link. NO medal counts, NO apparatus names.
    • 1. mesto ekipno — I kolo B programa, Kostolac, 29. 5. 2022. → 2022 bulletin link
  Block "Nastupi" (plain, smaller):
    • Prvenstvo Srbije u apsolutnoj kategoriji — Kostolac, 2024. → link
    • Prvenstvo Srbije u aerobnoj gimnastici — Ruma, 13. 12. 2025. → link
    • Međuklupsko promotivno takmičenje u aerobnoj i kreativnoj gimnastici — Negotin, 15. 5. 2026. → https://www.gssrb.rs/meduklupsko-promotivno-takmicenje-negotin-2026/
  Trust row:
    "Član Gimnastičkog saveza Srbije" → https://www.gssrb.rs/kragujevac/
    "Uz podršku Grada Kragujevca (2024)" → Glas Šumadije link
  Photo 01 caption: "Naše takmičarke sa medaljama" (no names, no event).

S8 CAMP — "Gimnastički kamp" (photos 10, 11; 09 only if CAMP_GROUP_PHOTOS)
  "Leto sa ekipom: treninzi i druženje na gimnastičkom kampu."
  [only while today ≤ CAMP_NOTE_UNTIL:] "Prijave za kamp u Grčkoj 2027. su u toku — pozovite 060 028 7631."
  No caption may imply that a specific photo was taken in Greece.

S9 GALLERY — "Galerija"
  Chips: Takmičenja · Treninzi · Kampovi.
  Mapping (content/gallery.ts):
    Takmičenja: 01, 05, 08
    Treninzi: 03, 04, 12, 14 (rezerva), 15 (rezerva)
    Kampovi: 10, 11, 16 (rezerva) [+ 02, 09 if CAMP_GROUP_PHOTOS]
  17 (the 2019 club birthday cake) may appear in the timeline between 2007 and 2022.
  Alt texts are descriptive and never contain names.

S10 ENROLLMENT + FAQ — "Upis i prvi trening"
  3 steps:
    1 "Javite se telefonom ili porukom"
    2 "Dođite na probni trening"
    3 "Ako se detetu dopadne, postaje član kluba"
  + "Upis traje tokom cele godine."
  "Šta poneti na prvi trening" (animated checklist): helanke · majica · čarape · flašica vode · vezana kosa
    Note: "Odeća treba da bude uska. Takmičarke treniraju u klupskoj opremi i trikoima."
  FAQ "Pitanja roditelja" (<details>; + rotates to ×; grid-rows 0fr→1fr 280ms; FAQPage JSON-LD):
    Od koliko godina dete može da počne? — Već od 3. godine, u mlađoj početnoj grupi (3–8 godina).
    Kada može da se upiše? — Tokom cele godine.
    Kako izgleda prvi trening? — Dete dolazi na probni trening, a ako mu se dopadne, postaje član kluba.
    Šta dete treba da ponese? — Helanke, majicu, čarape i flašicu vode. Kosa treba da bude vezana, a odeća uska.
    Gde se održavaju treninzi? — U sali Trgovinsko-ugostiteljske škole „Toza Dragović“ (poznata kao „ŠUP“), Save Kovačevića 25, Kragujevac.
    Da li su trenerice licencirane? — Da. Obe trenerice imaju licencu Gimnastičkog saveza Srbije, a predsednica kluba je i licencirana sutkinja za žensku sportsku gimnastiku.
    Da li klub ide na takmičenja? — Da. Takmičarke nastupaju na takmičenjima Gimnastičkog saveza Srbije u sportskoj i aerobnoj gimnastici.
    [Koliko košta članarina? — only if SHOW_FEES] [Da li je probni trening besplatan? — only if FREE_TRIAL]
    Last line: "Niste našli odgovor? Pozovite 060 028 7631."

S11 CONTACT + FINAL CTA (dark, id="kontakt") — "Dođite na probni trening"
  Contains the leotard-gradient CTA panel and the "doskok" button.
  060 028 7631 (tel:+381600287631) · 061 422 4386 (tel:+381614224386) — both labelled "Pozovite" (no role labels until the club says who answers which).
  Email: sladjanakovacevickg@gmail.com
  Instagram: https://www.instagram.com/gimnasticki_klub_kraguj/
  [Facebook: https://www.facebook.com/sportskagimnastika.kraguj/ — only if SHOW_FACEBOOK]
  Address card + maps link.
  This block is also the no-JS fallback target of the booking CTA, so it must be self-sufficient.
BOOKING SHEET (bottom sheet on mobile, dialog on desktop; focus trap, Esc, return focus)
  Fields:
    Ime roditelja
    Telefon (type=tel, inputmode=tel, hint "+381…")
    Ime deteta (opciono)
    Godište deteta
    Grupa (prefilled from the quiz/program)
    Napomena (opciono)
  Small line: "Sajt ne čuva vaše podatke — poruka ide direktno trenerici."
  Message: "Dobar dan, želim da prijavim dete na probni trening. Roditelj: …, tel: …; dete: …, godište …; grupa: …; napomena: …"
    Encode with encodeURIComponent, never URLSearchParams.
  Actions:
    [Pošaljite SMS] → sms:+381600287631?&body=<encoded>
    [Pošaljite email] → mailto:sladjanakovacevickg@gmail.com?subject=Probni%20trening&body=<encoded>
    [Pozovite] → tel
    [Viber] (only if SHOW_VIBER):
      write the clipboard synchronously in the click handler, then navigate to viber://chat?number=%2B381600287631;
      if the document is still visible 1500ms later, toast "Viber se nije otvorio — pozovite 060 028 7631 ili pošaljite SMS.";
      on desktop, show the number instead.
  After an action: "Poruka je spremna — pošaljite je u aplikaciji. Ako vam se ne javimo, pozovite 060 028 7631."
FOOTER: white logo · "Gimnastičko sportsko udruženje „Kraguj“ · Kragujevac" · "Član Gimnastičkog saveza Srbije" (link) · socials · "© 2026" · "Izrada sajta: {CREDIT_NAME}".

SEO:
  title: "Gimnastički klub Kraguj — sportska gimnastika za decu u Kragujevcu"
  description: "Sportska gimnastika za decu od 3. godine i aerobna gimnastika u Kragujevcu. Licencirane trenerice, član Gimnastičkog saveza Srbije, upis tokom cele godine. Zakažite probni trening."
  canonical from SITE_URL.
  OG/Twitter image generated at build (1200×630: navy, white logo, ghost-frame silhouettes).
  Favicon/app icons from the silhouette.
  JSON-LD SportsClub:
    name "Gimnastičko sportsko udruženje „Kraguj“"
    alternateName ["Gimnastički klub Kraguj","Sportska Gimnastika Kraguj"]
    telephone "+381600287631", email
    location/address Save Kovačevića 25, 34000 Kragujevac, RS
    sameAs [Instagram] (+FB only if SHOW_FACEBOOK)
    memberOf {SportsOrganization "Gimnastički savez Srbije", url "https://www.gssrb.rs"}
    NO foundingDate
  Plus FAQPage JSON-LD.
  Headings naturally include: sportska gimnastika, gimnastika za decu, Kragujevac, aerobna gimnastika, upis.

=====================================================================
6. TECHNICAL REQUIREMENTS
=====================================================================
Stack & scripts:
  Next.js 16 (App Router, TypeScript strict), output: 'export', Tailwind CSS v4 (@theme tokens), GSAP 3.15+ with @gsap/react, ESLint flat config.
  Scripts: "lint": "eslint .", "test": vitest, "images", "qa". `next build` no longer lints, so run both.
  No other runtime deps without a DECISIONS.md line explaining why.
Content: typed files in content/:
  site.ts (flags, contacts, SEO), programs.ts, schedule.ts, timeline.ts, results.ts ({text, date, sourceUrl, kind: "medalja"|"nastup"}), faq.ts, gallery.ts.
  The club can later edit copy there without touching components.
Images:
  scripts/images.mjs (sharp) reads ONLY assets-source/slike/{web,rezerva}.
  Outputs AVIF + WebP at 480/960/1600 (never above native width), with width/height and a tiny inline blur placeholder.
  Never call withMetadata/keepExif.
  Rendered via a <Picture> component with correct `sizes`. The hero uses no photo; below-the-fold photos are lazy.
SVG:
  svgo (floatPrecision 1) on the logo SVGs.
  Inline sprite with <symbol id="leap"> (from kraguj-silueta.svg) + <symbol id="wordmark">.
  Hero SVG total ≤22KB gz.
Accessibility (WCAG 2.2 AA):
  landmarks, one H1, logical headings;
  visible focus rings (see §3), labels on all controls;
  focus trap in dialogs/sheets; aria-live for the quiz result and toasts;
  color never the only signal;
  all motion respects reduced motion; nothing flashes >3×/s;
  sticky header/bottom bar never hide the focused element (2.4.11).
Performance (mid-range Android, Lighthouse mobile):
  LCP ≤2.0s (hard ≤2.5s), CLS ≤0.05, TBT ≤150ms.
  First-load JS for "/" ≤160KB gz, measured by a qa/ script as the sum of gzip sizes of the <script src> files referenced by out/index.html.
  Initial animation chunk ≤45KB gz.
  ≤1 rAF loop at a time, paused off-screen.
Time: all time logic uses Europe/Belgrade. Anything time-dependent renders after mount (no hydration mismatch).
Indexing: robots/noindex/sitemap driven by INDEXABLE.
README: run, edit content, regenerate images, every flag (with the consent rule), deploy to Cloudflare Pages (build `npm run build`, output `out/`; use Cloudflare Access for private previews). Do NOT deploy.
Public repo: if the repo will be public, .gitignore docs/dosije.md and assets-source/logo/*original*.

=====================================================================
7. ACCEPTANCE CRITERIA (all must be true)
=====================================================================
Build & layout
[ ] `npm run lint`, `npm test` and `npm run build` pass with zero errors; out/ exists.
[ ] At 360×800, 390×844, 768×1024 and 1440×900: no horizontal scroll, no overlapping/cut text, tap targets ≥48px. Screenshots saved in /qa.
[ ] JS disabled: the page is complete. The hero shows the final composition, the CTA jumps to #kontakt, and the schedule and contacts are readable.
Motion
[ ] Reduced-motion emulation: no intro/pin/scrub/flip; the hero shows the static composition (screenshot).
[ ] Hero: the H1 is visible in the first paint, with no flash of hidden content when JS runs (Playwright trace/filmstrip). The intro completes in ≤1.9s. The pin runs only on (min-width:1024px) and (pointer:fine).
[ ] The sticky bottom bar appears after the hero CTAs leave view, and hides over #kontakt and while the keyboard is open.
Logic & links
[ ] Quiz unit tests pass:
    (3) → Mlađa
    (7) → Mlađa
    (8, Tek počinje) → both beginner groups
    (8, Takmičilo se) → Takmičarske
    (9, Tek počinje) → Starija
    (12, Treniralo je rekreativno) → Takmičarske
    (16, Tek počinje) → Starija
[ ] The schedule unit test compares content/schedule.ts against a HARD-CODED copy of the table in §5, not against itself.
[ ] "Sledeći trening" is correct for mocked Europe/Belgrade dates, including Friday evening → "u ponedeljak".
[ ] Every generated .ics parses with ical.js and contains a VTIMEZONE. Google Calendar links are well-formed.
[ ] Link test: tel/sms/mailto/viber formats are correct; SMS bodies use encodeURIComponent; every source URL in the UI also appears in docs/dosije.md.
Content, images & privacy
[ ] Content test on out/ confirms:
    no "besplatan/besplatno" while FREE_TRIAL=false;
    no minors' names and no birth dates;
    no 2023 medal counts or apparatus names;
    no foundingDate;
    no Facebook link while SHOW_FACEBOOK=false.
[ ] Image test: no file in out/ contains EXIF. Photo 08's face stays pixelated. No photo renders wider than native px / 2 at DPR 2.
[ ] With MINOR_PHOTOS=false, all minor photos are placeholders (screenshot). With CAMP_GROUP_PHOTOS=false, 02 and 09 are absent.
Quality
[ ] Lighthouse mobile (Playwright's Chromium via CHROME_PATH, --chrome-flags="--headless=new --no-sandbox"): Performance ≥90, Accessibility 100, Best Practices ≥95, SEO 100 (SEO measured once with INDEXABLE=true). axe-core: 0 serious/critical.
[ ] Č č Ć ć Š š Ž ž Đ đ render in all used weights (screenshot of a test string).
[ ] Zero console errors/warnings in Chromium on load and during a full scroll, including hydration warnings.
[ ] JSON-LD parses and matches §5.

=====================================================================
8. PLAN (commit after each milestone with a clear message)
=====================================================================
M0 Scaffold: deps, fonts (Mona Sans + Doto subset), Tailwind tokens, image script, svgo + SVG sprite, content files, flags → build passes.
M1 All sections static with full copy and responsive layout, no animation → screenshots at 4 sizes → fix.
M2 Booking sheet, quiz, schedule logic, .ics + Google link, sticky bar, flags → unit tests pass.
M3 Hero: no-JS final state → anti-flash class → intro → desktop pin → filmstrip trace + reduced-motion screenshot.
M4 Section motions (§4) with lazy plugin loading → Playwright performance trace at 4× CPU throttle; no long tasks >50ms during scroll.
M5 SEO, JSON-LD, OG image, 404 page, README (flags + consent rule).
M6 QA: every §7 box, Lighthouse, axe, link/content/image tests. Fix and re-run until everything passes.

=====================================================================
9. CONSTRAINTS
=====================================================================
- Follow the SOURCE RULE (§2). Never invent facts, prices, awards, dates, testimonials, reviews, bios or quotes.
- Never copy photos from Instagram/Google; never add stock or AI imagery.
- Scope: one page + 404. No CMS, backend, analytics, cookies or third-party embeds (maps are a link only).
- No secrets in code. Keep diffs surgical. Follow coding-rules.md.

=====================================================================
10. VERIFICATION COMMANDS
=====================================================================
npm run lint && npm test && npm run build && npx serve out -l 4173
node qa/shots.mjs      # Playwright: 4 sizes + reduced-motion + JS-disabled + MINOR_PHOTOS=false build → /qa. Look at every screenshot yourself.
node qa/trace.mjs      # hero filmstrip (no flash) + long-task check during scroll at 4× CPU throttle
node qa/bundle.mjs     # gz size of first-load JS for "/"
node qa/content.mjs    # content / EXIF / link checks on out/
CHROME_PATH=$(node -e "console.log(require('playwright').chromium.executablePath())") npx lighthouse http://localhost:4173 --form-factor=mobile --chrome-flags="--headless=new --no-sandbox" --output=html --output=json --output-path=qa/lh
axe via @axe-core/playwright on / and /404.

=====================================================================
11. FINAL REPORT (in Serbian, this format)
=====================================================================
1. Šta je napravljeno (sekcije, ključni efekti) + putanja do /qa
2. Kako se pokreće, kako se menja sadržaj i šta radi koji prekidač
3. Rezultati: Lighthouse (4 broja), axe, testovi, JS za "/" (gz)
4. Pretpostavke i odluke (DECISIONS.md) + TODO lista za klub
5. Šta bih sledeće unapredio (najviše 5 stavki)
```

**Posle pokretanja proveri:**
- hero na pravom Android telefonu (tajming, bez seckanja)
- da prekidači odgovaraju odgovorima kluba
- da nijedna fotografija dece ne ide na javni URL pre potvrde saglasnosti
