# Plan: the gymnast figure system (less repetition, more gymnastics)

Status: **proposal, waiting for the owner's green light.** Nothing below is implemented yet.
Date: 2026-09-26. Evidence: `scratchpad/inventory`, `research-sites`, `research-ui`, `poses` (session d6bc08bd).

---

## 0. Plain-language summary (for the owner)

**The problem, measured.** A visitor sees the same split-leap girl **81–93 times** on one visit to
the page. That is not 20: the phone count is 81 and the desktop count up to 93 on the public site. On the worst screen (the quiz meeting
"Programi") she appears **18 times at once**, and on desktop there is no scroll position where
she is absent. Almost half of these (40) are the faint copies beside the 10 section titles. Most of
the rest are faint copies too: the "ghost" frames of a motion trail, and the "Fotografija uskoro"
placeholders, each of which contains her.

**What the best do.** Twenty federations and Olympic pictogram systems (World Gymnastics, British
Gymnastics, Gymnastics Australia, Tokyo 2020, Munich 1972, Milano Cortina 2026, and others) all
follow the same rules:
- the logo figure is the brand and appears in a few fixed places;
- every discipline gets its own pose (artistic gymnastics is almost always a handstand, beginners
  a roll, a star jump or a cartwheel);
- a motion trail shows *different phases* of one movement, never the same body copied.
Our trails copy the same body, which is why they feel repetitive rather than athletic.

**What we would do.**
1. **Keep the logo girl as the brand** in: the header logo, the hero, the mark beside every section
   title, the contact finale and the footer logo. Her faint copies beside the titles would only
   appear *while she jumps*, then fade, so at rest each title has one clean figure. This alone
   removes about 30 figures.
2. **Give each program its own movement**, drawn in the logo's style (same body, same head, same
   pointed feet):
   - Mlađa početna (3–8): a star jump, playful and grounded, as recommended for the youngest;
   - Starija početna: a cartwheel;
   - Takmičarke C: a handstand on the bar;
   - Takmičarke A i B: a handspring over the vault table;
   - Aerobna gimnastika: a high kick.
3. **Use other movements only where they mean something:**
   - the enrollment steps show a real cartwheel in phases, ending in the finishing salute ("postaje
     član kluba");
   - the missing coach portrait becomes one elegant balance (scale);
   - the 404 "page lost its balance" girl balances on the beam in a scale;
   - the "message sent" card in the booking form shows the salute.
4. **Remove her where she is only decoration:** the timeline, schedule chips, menu, footer trail,
   checklist card, the programs carousel trail, and all photo placeholders ("Fotografija uskoro"
   becomes a clean frame with no figure).

**Result.** About **36 figures instead of 93**, of which only about 25 are the logo girl. At most
about 8 on any screen (today 18), and the others are different movements. The hero and the
contact finale stay exactly as they are.

**How we make sure it looks right.** The new movements are drawn from the logo's own measured
proportions and head. Prototypes already exist, and the strongest ones (scale, handstand, star
jump, salute, high kick, cartwheel sequence) look like the same family. You approve the final
drawings on one sheet **before** anything on the site changes. A new automatic check keeps the
count from creeping back up.

---

## 1. What we measured (visible figures, final state after scrolling)

Counted with Playwright on the local build (photos of children on) and the live Vercel build
(placeholders), at 390×844 and 1440×900. Visible = rendered box, not hidden, effective opacity
> 0.05, not clipped. Classes: a solid, b ghost, c inside a logo, d placeholder, f title mark.

| | local 390 | local 1440 | live 390 | live 1440 |
|---|---|---|---|---|
| Static total | 81 | 88 | 83 | **93** |
| … of which title marks (f) | 40 | 40 | 40 | 40 |
| Motion-only extras | +5 | +6 | +1 | +6 |
| Max on one settled screen | 15 | 17 | 15 | **18** |
| Scroll positions with ≥1 figure on screen | 70% | 93% | 81% | **100%** |

Per section, live 1440 (static): header 1 · hero 7 (+1 runner) · quiz 11 · programs 11 (phones: 6,
plus 9 more by swiping) · schedule 8 · about 12 · coaches 8 · results 5 · camp 5 (+4 motion) ·
gallery 5 · enrollment 8 (+1) · contact 8 · footer 4 · menu sheet 4 · 404 page 5.

Of the 190 `href="#leap"` in the HTML, most are never visible:
- inactive hero variant;
- no-JS quiz art;
- 7 quiz "occluder" copies drawn navy on navy;
- 20 schedule "now" markers;
- 15 of 18 menu here-marks;
- the inactive enrollment band variant.

Bug found in passing: the camp beam routine never plays on the live site at 390 (the placeholder
postcard layout leaves no lane for it).

## 2. What the research says (condensed)

- **One brand figure in fixed places.** None of the ~20 references repeats its logo figure as decoration:
  - World Gymnastics / MATTA: one master mark; each discipline gets a colour and a pattern world;
  - British Gymnastics: one cut-out athlete per screen;
  - Gymnastics Australia: the mark only in header and footer.
- **One pose per discipline, drawn to shared rules:**
  - Tokyo 2020 uses one navy limb vocabulary across 50 sports;
  - Munich 1972 uses a construction grid, corrected by eye;
  - Milano Cortina 2026 uses one line weight.
  - Artistic gymnastics = handstand (1992–2020); beam = balance/scale; vault = handspring;
    aerobic = high kick or V-support; beginners = roll, star jump, cartwheel.
- **Age-appropriate:** Gymnastics Canada's development plan (Active Start and FUNdamentals stages) says
  inverted bridges and headstands do not belong at ages 0–6.
- **Real chronophotography changes pose along the path** (Muybridge plate 522, Marey, *Gravity &
  Form* for Red Bull). Identical parallel copies read as a drop shadow.
- **Motion explains once, then rests** (Tokyo kinetic pictograms: fragments → freeze → hold).

## 3. The rules (figure grammar)

- **R1 Brand mark.** The logo split leap (`#leap`) appears only in:
  - the header logo;
  - the hero;
  - the section-title marks (one figure each at rest);
  - the quiz band's flight: the club's girl flies to the child's program, then lands in that program's pose (§5.3);
  - the contact doskok;
  - the footer logo;
  - the booking-sheet head;
  - favicon, OG image and app icons.
  - `data-figure` values: `brand:logo`, `brand:hero`, `brand:mark`, `brand:quiz`, `brand:doskok`, `brand:booking`.
- **R2 Pose family.** Every other figure is a pose from §4. It appears only where it stands for a
  program, an action or a state. The same pose appears at most once per page **at rest**. Exceptions:
  - the program detail sheet and the quiz result reuse the program's own pose;
  - a motion-only moment may reuse a pose, e.g. the camp routine lands in the scale that the coach plate shows at rest;
  - the 404 is a separate page.
- **R3 Trails show phases.** A ghost trail always shows different phases of one movement. Static
  trails stay only in the hero (existing phases), the enrollment band (cartwheel) and the contact
  doskok (existing) and the title marks, whose three ghost frames stay at rest (owner, 2026-09-26; DECISIONS D-43).
- **R4 One lead figure per screen** besides the title mark. The only exception is the program grid,
  where each card carries a different pose.
- **R5 No figure in UI chrome.** Chips, markers, rails, menu indicators and photo placeholders never
  use a figure.
- **R6 Age code.** Beginners are upright, grounded and playful; competitive is inverted or on
  apparatus. No bridge or headstand for the 3–8 group.
- **R7 Drawing rules.**
  - One filled path per pose, `fill: currentColor`.
  - The logo's own profile head where the pose allows it.
  - Body height equal to the logo figure's 150-unit box.
  - Limb taper from the logo's measured profile (thigh root 18–23, knee 12.6, ankle 7.6, wrist 6).
  - Pointed slipper feet.
  - Exact floor or apparatus contact, which a test checks.
  - Size ≤ 0.6 KB gzipped per pose.
  - `aria-hidden` wherever the pose is decoration.

## 4. The pose family

**Technique: B (hand-authored silhouettes from the calibrated skeleton), not A (re-cutting the
logo rig).** The prototype comparison (`poses/sheet-avsb.png`) found:
- A keeps the logo contour but breaks anatomy for every non-split pose: hip lump, standing on the toe tip,
  fingertip hands, no arched back;
- B rebuilds the logo's own leap at IoU 0.76 and is indistinguishable from it at 60–96 px (`poses/calib2.png`).

| Id | Pose | Used in | Prototype verdict (my review) |
|---|---|---|---|
| P1 | Star / straddle jump, arms V ("raznožni skok") | Mlađa početna card, sheet, quiz result | Strong; reads at 60 px |
| P2 | Cartwheel, inverted star ("zvezda") | Starija početna card, sheet, quiz result | Good at ≥96 px; frontal head slightly pictogram-like → refine head |
| P2s | Cartwheel sequence: 3 phases → P6 salute | Enrollment band | Beautiful at 160 px (`poses/sheet-chrono.png`) |
| P3 | Handstand on the high bar ("stoj na pritci") | Takmičarke C card, sheet, quiz result | **New composition needed.** The swing prototype reads like a diver, so it is rejected; the handstand prototype reads strongly |
| P4 | Handspring over the vault table ("premet") | Takmičarke A i B card, sheet, quiz result | Good with the table; weak alone, so always drawn with the table |
| P5 | Aerobic high kick ("visoki zamah") | Aerobna gimnastika card, sheet, quiz result | Good; raise the kick toward 170° |
| P6 | Salute, arms V ("pozdrav") | Enrollment step 3 finish, booking "sent" card | Strong frontal V; the profile arms-up version is rejected (reads as "rabbit ears") |
| P7 | Scale / arabesque ("vaga") | Coach plate (Slađana), 404 beam, camp beam balance | The most elegant of the set; flat support foot, correct technique |
| P8 | Split handstand on the beam | Fallback for P3 if the bar composition fails review | Strong |

Rejected poses, with reasons:
- **Forward roll:** the tuck phase is a blob in any silhouette technique.
- **Bridge:** not suitable for the youngest group (R6), and no content maps to it.
- **Push-up:** reads as lying down.
- **Bar swing:** reads like a diver.
- **Profile podium arms-up:** reads as "rabbit ears".

## 5. Section by section (before → after, live 1440 static counts)

Each change is tested against the owner's six questions:
- **D** = improves the design;
- **A** = aesthetically pleasing;
- **F** = fits the website;
- **Fn** = how it functions;
- **Do** = doable;
- **CQ** = effect on code quality (+ better, 0 neutral, − worse).

### 5.1 Section-title marks (10 titles): 40 → 10
**Change:** the mark stays beside every title and still hops and sticks its landing. Its 3 ghosts are
shown only while it flies (each develops as the flier passes, then fades out 400 ms after the
landing), like the hero. Reduced motion and no-JS show the solid figure only.
- Files: `components/ui/ChronoMark.tsx` (ghosts stay in the markup, no API change),
  `styles/ui.css` (ghost opacity only under `[data-landing]:not([data-landed-rest])`),
  `components/ui/HeadingLandings.tsx` (sets `data-landed-rest` 400 ms after `data-landed`).
- **D ✓** biggest single cut, 30 figures. **A ✓** clean titles; the trail becomes motion, as Tokyo's
  pictograms do. **F ✓** the mark stays where the owner wants it. **Fn** a CSS state change, no new JS
  timer except one timeout per mark. **Do ✓** small. **CQ 0/+** slightly simpler static CSS.
- **Owner decision (§10.1):** the alternative is to keep 2 faint phase frames at rest (30 instead of 10).

### 5.2 Hero: 7 (+1) → unchanged
Kept exactly: it is the brand's signature, and its trail already shows real phases (bound, take-off,
flight, landing).

### 5.3 Quiz: 11 → 4
**Change:**
- The band keeps the brand girl's flight, but with 2 faint phase exposures instead of 6: take-off at 01,
  apex over 02.
- She now lands **in the recommended program's pose on its apparatus** (P1–P5): the quiz answer
  becomes the child's movement.
- The 7 invisible navy "occluder" copies are removed, because the new apparatus drawings are built so
  nothing needs masking.
- Files:
  - `components/sections/quiz/QuizBandArt.tsx` (exposures, landing poses, occluders out);
  - `components/sections/quiz/geometry.ts` (landing anchors per pose);
  - `styles/sections/quiz.css`;
  - `tests/quiz.test.ts` (anchors and floor contact per pose);
  - `QuizGuide.tsx` (no-JS art).
- **D ✓** removes the worst screen's clutter and adds meaning. **A ✓** a landing that differs per answer.
  **F ✓** the same band, the same flight. **Fn** a crossfade from the leap to the pose at touchdown (a
  chronophotograph cut; no in-between frames needed). **Do ~** moderate: 5 landing compositions to tune.
  **CQ +** the occluder hack goes away.

### 5.4 Programs: 11 → 6 (phones 6 + 9 by swiping → 6)
**Change:** each card's plate shows its own pose on its apparatus (P1–P5), replacing the same leap
posed five ways. The program detail sheet uses the same pose, larger. The phone-only 3-figure trail
under the KR-04 photo and the leap in the rail indicator are removed; the rail flier becomes a
lavender dot that slides.
- Files:
  - `components/sections/programs/ProgramIcon.tsx` (`PosedFigure` → pose paths, per-apparatus placement);
  - `leap-icon.ts` → `pose-icons.ts` (the latent print the quiz reads becomes the program's pose path);
  - `Programs.tsx:76` (trail out);
  - `ProgramsBrowser.tsx:400-402` (rail flier);
  - `ProgramSheet.tsx` (scene);
  - `styles/sections/programs.css` (perform animations re-anchored per pose);
  - `tests/programs.test.ts`.
- **D ✓** five different movements where parents choose a program. **A ✓** the scenes sheet
  (`poses/sheet-scenes.png`) is the strongest prototype. **F ✓** the same plates, apparatus and
  colours. **Fn** the apparatus "perform" motions (beam flex, board spring, bar flex) stay and act on
  the new poses. **Do ~** moderate (P3 needs a new composition). **CQ +** removes two decorative
  families.

### 5.5 Schedule: 8 → 1
**Change:**
- The 22 px leap inside each "danas u 18:00" chip becomes the existing clock icon (`.ui-icon`).
- The "now" row marker becomes a small lavender dot on the time line.
- The weekend empty-day ChronoMark is removed; the message stays.
- Files: `NextTraining.tsx:26-28`, `ScheduleViews.tsx:345-346, 366`, `styles/sections/schedule.css`.
- **D ✓ A ✓ F ✓** (UI chrome, R5). **Fn** unchanged behaviour. **Do ✓** trivial. **CQ +** less markup
  (20 hidden markers go away).

### 5.6 About / Hronologija: 12 → 1
**Change:** the year nodes become ringed dots on the rail; the travelling flier becomes a lavender
bead with the same stuck-landing easing. The 2007 → 2017 axis break and the KR-17 print stay.
- Files: `components/sections/about/Timeline.tsx` (`Leap` nodes and flier), `timeline-motion.ts`,
  `styles/sections/about.css`.
- **D ✓** removes 8 figures from one column. **A ✓** a calmer, more legible timeline. **F ✓** the rail,
  the dark band and the motion stay. **Fn** the same progress logic; the bead replaces the figure.
  **Do ✓** small. **CQ +**.
- Considered and **rejected:** a different pose per year ("from the first roll to the podium").
  It is charming, but it puts 7 figures back into one column (R4) and ties made-up skills to real
  dates (SOURCE RULE risk).

### 5.7 Coaches: 8 → 2
**Change:** the placeholder plate beside Slađana Kovačević (4 leap exposures) becomes one P7 scale
on the navy plate, with a thin mat line. When the club sends her portrait, the photo replaces it.
- Files: `components/sections/coaches/Coaches.tsx:47-66`, `coaches-motion.ts` (the plate reveal
  becomes one fade), `styles/sections/coaches.css`.
- **D ✓ A ✓** (the most elegant pose, and balance suits a judge). **F ✓**. **Fn** static plate plus the
  stamp press as today. **Do ✓**. **CQ +**.

### 5.8 Results: 5 → 1 · Gallery: 5 → 1 · Camp: 5 (+4) → 1 (+3)
**Change:**
- Photo placeholders lose the figure (see 5.12).
- Camp beam routine:
  - the flier lands in P7 scale for the balance wobble, with 2 phase ghosts instead of 3;
  - the live-390 no-lane bug gets fixed: when no lane fits, the routine plays over the beam's free
    span above the sea.
- Files: `camp-beam.ts:239-267`, `styles/sections/camp.css`.
- **D ✓ A ✓ F ✓**. **Fn** the same trigger and queue. **Do ✓**. **CQ 0**.

### 5.9 Enrollment: 8 (+1) → 5
**Change:**
- The band's three leap frames (take-off, apex, landing) become a real **cartwheel** in phases across
  the three steps (P2s), finishing in the **P6 salute** over step 3 ("postaje član kluba"): a
  routine ends with a salute.
- The motion keeps today's mechanics: the flier travels, each phase develops as it passes, and the
  landing sticks.
- The checklist card's ghost and flier are removed.
- Files:
  - `components/sections/enrollment/leap-band.ts` (frames → cartwheel phases, trajectory);
  - `LeapBand.tsx`;
  - `leap-motion.ts`;
  - `Enrollment.tsx:102-110` (checklist figure out);
  - `styles/sections/enrollment.css`.
- **D ✓** the page's one deliberate motion study, with a real movement. **A ✓** (the prototype is
  the best image of the set). **F ✓** the ghost tokens and the band stay. **Fn** the same trigger; the
  phases replace frames. **Do ~** moderate (the phase spacing must follow the ~70% figure-width rule
  from the prototype). **CQ 0**.

### 5.10 Contact: 8 → 5
Kept as the owner asked: the doskok back salto onto the button and its trail. Only the title mark
changes (5.1).

### 5.11 Footer: 4 → 1 · Menu sheet: 4 → 1 · 404: 5 → 2
**Changes:**
- **Footer:** the take-off ghost stream is removed; the static logo stays. Files: `LeapTrail.tsx:69-78`,
  `chrome-motion.ts` (footer take-off out), `styles/sections/header.css`.
- **Menu sheet:** the "you are here" silhouette with its two frames becomes a lavender bar beside the
  current row. Files: `LeapTrail.tsx:30,35`, `MenuSheetBody.tsx:24`, `header.css`.
- **404:** the balancing figure becomes P7 scale on the beam (the page "lost its balance"). The
  torso-only ghost clones go. The spring, the pointer lean and the judges' board stay. Files:
  `components/notfound/BeamScene.tsx:61-76`, `tilt.ts` (pivot at the support foot),
  `styles/sections/notfound.css`.
- **D ✓ A ✓ F ✓.** **Fn** 404 physics: only the pivot point moves. **Do ✓.** **CQ +** (the footer and
  menu families shrink).

### 5.12 Photo placeholders ("Fotografija uskoro")
**Change:** no figure. The navy frame keeps its KR frame code and the caption, plus a small 1.5 px
aperture line icon from the `.ui-icon` set. File: `components/ui/Picture.tsx:79-81`.
- **D ✓** these are temporary and read as broken images when they carry a mascot. **A ✓ F ✓** (contact-sheet
  language). **Do ✓.** **CQ +**.

### 5.13 Booking sheet
The head keeps the brand girl. The "message sent" card figure becomes the P6 salute.
File: `BookingDialog.tsx:713`.
**D ✓ A ✓ F ✓ Do ✓ CQ 0**.

### Totals (live 1440, static)

| | Today | After |
|---|---|---|
| All figures | 93 | **≈36** |
| Logo split leap | ≈85 | **≈25** |
| Other movements | 0 | **≈11** (all different) |
| Max on one screen | 18 | **≈8** |

## 6. Ideas considered and not adopted

| Idea | Why not (by the six questions) |
|---|---|
| Re-pose the logo rig for new movements (technique A) | A ✗: anatomy breaks outside the split family (hip lump, toe-tip standing); CQ −: 7 clipped `<use>` per figure |
| Trace poses from the club's training photos | Privacy: those photos show minors (MINOR_PHOTOS must stay false on the public URL) |
| A second "Marey line" figure style for small UI | F ✗: two figure styles on one page need a rulebook; R5 removes small-UI figures instead |
| A pose per year in the timeline | R4 and SOURCE RULE, see 5.6 |
| A Muybridge-style contact-sheet grid of frames | F ~: reads as an image-loading placeholder next to our real contact sheet (gallery) |
| Remove the title marks entirely | Against the owner's brief; 5.1 keeps them and still removes 30 figures |

## 7. Implementation phases (after the green light)

### Phase 0: guardrail (first, so the result is measurable)
- `qa/figures.mjs` (new): the inventory probe as a QA check. It fails if:
  - more than 40 figures are visible statically, or
  - more than 9 are on one screen at 390/1440, or
  - any `#leap` appears outside the R1 allow-list (by `data-figure="brand|pose"` attribute).
- Add it to `qa/run-all.mjs`. Baseline run: expect FAIL (93).
- Every rendered figure gets `data-figure="brand"` or `data-figure="pose:<id>"`, so the check is a
  precise selector, not a heuristic.

### Phase 1: the pose family (**owner approves the sheet before Phase 3**)
1. `assets-source/poses/*.svg`: P1–P8 and the P2s phase frames, one filled path each. They are
   authored with the prototype generator (skeleton + logo head + taper + exact contact) and then
   hand-refined: raise the P5 kick, fix the P2 head, lengthen the bridge-free P7 arms, and compose P3
   on the bar.
2. `scripts/svg.mjs`: extend the existing logo pipeline to optimise the pose SVGs into
   `components/brand/poses.generated.ts` (path data plus a viewBox per pose). This is the same
   pattern as `sprite-paths.generated.ts`, so no new tooling enters the repo; the Python generator
   stays outside as an authoring tool.
3. `components/brand/Pose.tsx`: a server component with props `{ id, className, title? }`. It renders
   an inline `<svg>` with the path, `aria-hidden` unless `title` is given. Poses are **not** added to
   the global sprite, so first-load HTML stays light; each is used at most twice.
4. `tests/poses.test.ts`:
   - every pose has a closed path;
   - the bounding box is within its viewBox;
   - the lowest ink is on the floor line (±0.5 unit) for standing poses;
   - hand or foot contact is within ±0.5 unit of the apparatus anchor for P3, P4 and P7;
   - gzipped size ≤ 600 B each.
5. `docs/poses-sheet.png`, the approval sheet:
   - every pose at 60, 96 and 160 px;
   - navy on chalk and white on navy;
   - the cartwheel sequence;
   - side by side with the logo figure.

   **Checkpoint: the owner signs it off.**

### Phase 2: removals and simplifications (no new art; can ship alone)
5.1 title-mark ghosts, 5.5 schedule, 5.6 timeline, 5.11 footer and menu, 5.12 placeholders, the
quiz exposures 6 → 2 (5.3, part 1), the programs trail and rail (5.4, part 1), and the checklist
figure (5.9, part 1).
Run the full QA, including `qa/figures.mjs` (expected ≈ 45 at this point).

### Phase 3: new poses in place
5.4 program plates and sheet, 5.3 quiz landings, 5.7 coach plate, 5.9 enrollment cartwheel band,
5.8 camp balance and the lane fix, 5.11 404 scale, 5.13 booking salute.

### Phase 4: motion retune
- Per-apparatus perform animations re-anchored to the new poses (literal keyframe easings, MD2-01).
- The quiz landing crossfade.
- The enrollment phase-develop timing.
- The camp routine.
- The 404 pivot.
- Reduced-motion and no-JS static states checked for every changed family.

### Phase 5: verification and release
- The full `npm run qa` (lint, tsc, unit tests, bundle, content, shots, trace, behavior, axe,
  Lighthouse) plus `qa/figures.mjs` (target ≤ 40 static, ≤ 9 per screen).
- Screenshots at 10 viewports.
- One critic pass (design + motion) on the frozen build.
- Commit, then push to `main`; Vercel deploys automatically with MINOR_PHOTOS=false kept.

## 8. Guardrails and budgets (unchanged)

- LCP ≤ 2.0 s: it is 1.95 s today, so poses are inline only below the fold, and none enters the hero.
- First-load JS ≤ 160 KB gzipped; initial animation chunk ≤ 45 KB.
- CLS 0.
- Every new figure is `aria-hidden` decoration. Program cards keep their `role=img` labels.
- Reduced motion and no-JS show the final composition.
- MINOR_PHOTOS=false stays on the public URL; no pose is traced from photos of children.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| New poses look less refined than the hand-traced logo at large sizes | No pose above 200 px; approval sheet (Phase 1); fallback P8 for P3 |
| P3 (handstand on the bar) composition fails | Swap to P8 (split handstand on the beam) and change the C card's apparatus to beam; the owner decides at the sheet |
| Quiz and programs tests pin anchors | Update the expected anchors in the same change, never loosen a check |
| LCP creep from inline paths | Budget ~0.5 KB gz per pose, below the fold only; verify with Lighthouse in Phase 5 |
| Figure count creeps back later | `qa/figures.mjs` in the standard QA run |

**Rollback:** each phase is its own commit; reverting a phase restores the previous figures.

## 10. Decisions for the owner

1. **Title marks** (5.1): figures beside titles only while they jump (**recommended**, −30), or keep 2
   faint phase frames at rest (−10).
2. **Takmičarke C pose:** handstand on the bar (**recommended**, matches the razboj icon), or the split
   handstand on the beam (the stronger drawing, but it changes the card's apparatus).
3. **The approval sheet** (Phase 1): you see every new movement before it goes on the site.
