# Product

<!-- impeccable:product-schema 1 -->

> Source: docs/master-prompt.md (binding spec) and docs/dosije.md (facts with statuses).
> The master prompt forbids questions to the user, so this record is derived from those
> files instead of an interview. Items marked *(inferred)* are my reading of the brief.

## Platform

web

## Stack

Delegated in the brief itself (docs/master-prompt.md §6): Next.js 16 App Router, TypeScript strict,
`output: 'export'` (static), Tailwind CSS v4, GSAP 3.15 + @gsap/react, Vitest, Playwright.
Deploy target: Cloudflare Pages (documented in README, not deployed by this build).

## Users

- **Primary: parents in Kragujevac** choosing a sport for a child aged 3–18, mostly on a
  cheap Android phone *(the brief's performance target: mid-range Android, Galaxy A15/A25)*.
  Job: find out which group fits their child, see the weekly schedule, trust the club, and
  call or message in ≤2 taps.
- **Secondary:** existing members' families checking the schedule; the Gymnastics
  Federation of Serbia (GSS) and the city, who judge the club's credibility.
- **Tertiary:** the developer's portfolio audience (award-level UI and motion).

## Product Purpose

The official one-page website of Gimnastičko sportsko udruženje „Kraguj“ (GSU „Kraguj“),
Kragujevac — artistic (sportska) gymnastics and aerobic gymnastics for children from age 3.
Success = a parent books a trial training (probni trening) by phone, SMS or email; the club
had no website before.

## Positioning

- Verified credibility no local competitor shows online: GSS membership, GSS-licensed
  coaches (the president is also a licensed judge), 42 + 12 registered competitors (2026),
  documented medals and appearances with links to GSS bulletins.
- Year-round enrolment, children from age 3, competitive A/B/C programs of the GSS.
- No competitor in Kragujevac has a website that ranks (dosije §3).

## Operating Context

- Trainings take place in the hall of Trgovinsko-ugostiteljska škola „Toza Dragović“
  (known locally as „ŠUP“), Save Kovačevića 25, Kragujevac.
- Booking is a message, not a system: the site composes an SMS/email and never stores data.
- Some slots ("08:30–10:30 ili 16:00–18:00") depend on the school shift *(assumption, flag
  SHOW_SHIFT_NOTE)*.

## Capabilities and Constraints

- One page + custom 404. No CMS, backend, analytics, cookies or third-party embeds.
- Copy lives in typed files under `content/`; unconfirmed facts sit behind flags in
  `content/site.ts` (FREE_TRIAL, SHOW_VIBER, SHOW_FACEBOOK, SHOW_TRAMPOLINE, SHOW_FEES,
  SHOW_SHIFT_NOTE, SHOW_EQUIPMENT_2026, MINOR_PHOTOS, CAMP_GROUP_PHOTOS, INDEXABLE).
- SOURCE RULE: the UI shows only ✅ facts from docs/dosije.md, text written in the master
  prompt, or 🟡 items behind their flags.
- Undecided (club to answer, dosije §7): free trial, parental photo consent, 2007/2017 history
  wording, shift meaning, trampoline, fees, who answers which phone, Viber/Facebook, domain.

## Brand Commitments

- Name on the logo: „Gimnastički klub Kraguj“; legal name GSU „Kraguj“.
- Official vector logo (wordmark + leaping-gymnast silhouette), navy club color, club kit
  with white brush strokes on the sleeves.
- Language: Serbian, Latin script, ekavica, formal „Vi“ toward parents, quotes „…“.
  Coaches in feminine forms (trenerica, sutkinja, predsednica, članica).
- Artistic gymnastics — never rhythmic-gymnastics iconography.

## Evidence on Hand

- Logo SVGs: `assets-source/logo/`. 11 web photos + 7 reserve photos: `assets-source/slike/`.
- Verified facts and source URLs: `docs/dosije.md` §3.
- Absent, never to be fabricated: testimonials/reviews, prices, medal counts and apparatus for
  2023, coach bios, a portrait of Slađana Kovačević, minors' names, birth dates.

## Product Principles

1. A parent can act in ≤2 taps from anywhere on the page.
2. Every claim is verifiable — sources are linked, unconfirmed facts stay behind flags.
3. Children's privacy before polish: no child photo on a public URL without consent.
4. Fast on a cheap Android phone first; motion is earned, never at the cost of LCP.
5. The club can edit copy without touching components.

## Accessibility & Inclusion

WCAG 2.2 AA (§6): landmarks, one H1, visible focus rings, labels, focus traps in sheets,
aria-live for quiz/toasts, color never the only signal, reduced motion respected everywhere,
sticky UI never hides the focused element (2.4.11), touch targets ≥48px.
