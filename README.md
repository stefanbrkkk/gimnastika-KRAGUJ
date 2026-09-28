# Gimnastički klub Kraguj — sajt

Zvanični sajt Gimnastičkog sportskog udruženja „Kraguj“ iz Kragujevca: jedna stranica i
posebna 404 stranica. Statički izvoz (Next.js 16, `output: 'export'`), bez servera, baze, kolačića
i analitike.

- Specifikacija: `docs/master-prompt.md`
- Činjenice i izvori: `docs/dosije.md`
- Odluke i pretpostavke: `DECISIONS.md`
- Opis proizvoda: `PRODUCT.md`

## Pokretanje

Potrebno: Node.js ≥ 22.18 (zbog `scripts/prune-out.ts`) i npm.

```bash
npm install
npm run dev          # razvoj: http://localhost:3000
npm run lint         # ESLint (next build više ne pokreće lint)
npm test             # Vitest (kviz, raspored, .ics, linkovi, SEO, sadržaj, slike)
npm run build        # statički sajt u out/ (Turbopack; prebuild generiše samo odobrene fotografije, postbuild uklanja skrivene iz out/)
npm start            # služi out/ na http://localhost:4173
npm run qa           # cela provera iz master prompta §10: lint, testovi, 3 builda, bundle,
                     # sadržaj/EXIF, screenshotovi, trace, axe, Lighthouse (vidi qa/README-qa.md)
```

## Kako se menja sadržaj

Tekstovi i podaci su u `content/`. Komponente nije potrebno dirati.

| Fajl | Šta sadrži |
|---|---|
| `content/site.ts` | prekidači (flagovi), telefoni, email, mreže, adresa sale, izvori, SEO naslov i opis, meni |
| `content/copy.ts` | tekstovi sekcija: hero, kviz, o nama, trenerice, kamp, upis, kontakt, forma za probni trening, footer, 404 |
| `content/programs.ts` | programi (naziv, uzrast, opis, boja, ikonica sprave, grupe) |
| `content/schedule.ts` | raspored treninga po grupama |
| `content/timeline.ts` | hronologija u sekciji „O nama“ |
| `content/results.ts` | medalje, nastupi, brojke i izvori |
| `content/faq.ts` | pitanja roditelja |
| `content/gallery.ts` | galerija: koja fotografija ide u koju kategoriju |
| `content/photos.ts` | registar fotografija: alt tekst, oznaka kadra, da li su na njoj deca |

Pravilo izvora: na sajtu stoje samo činjenice potvrđene u `docs/dosije.md`. Za novu tvrdnju
(medalja, broj, godina) prvo upišite izvor u dosije.

## Fotografije

Originali (bez EXIF-a) su u `assets-source/slike/web` i `assets-source/slike/rezerva`.

```bash
npm run images   # AVIF + WebP u 480/960/1600 px (nikad šire od originala) + blur + grain
npm run svg      # optimizuje logo (svgo) i pravi putanje za SVG sprite
```

Nova fotografija se dodaje u `content/photos.ts`: `slug`, `file`, `frame`, `alt` bez imena,
`hasMinors`. Zatim pokrenite `npm run images`. Skripta čita isključivo fajlove navedene u registru.

## Fontovi

Mona Sans i Doto su u `fonts/` kao podskupovi (samo znakovi koje sajt koristi). Ako tekst dobije
novi znak (npr. ö, ü), dodajte ga u `scripts/fonts.sh` i pokrenite je (potreban je Python
`fonttools`; uputstvo je u zaglavlju skripte).

## Prekidači (`content/site.ts`)

Svaki prekidač ima podrazumevanu vrednost u `content/site.ts`. Za jednokratni build može se
zadati i kroz promenljivu okruženja: `NEXT_PUBLIC_<IME>=true|false npm run build`.

| Prekidač | Podrazumevano | Šta radi |
|---|---|---|
| `FREE_TRIAL` | `true` | Probni trening je potvrđeno besplatan; FAQ i CTA ga navode bez obećanja trajanja ili rezervacije. |
| `SHOW_SHIFT_NOTE` | `true` | Objašnjava da se opcija „08:30–10:30 ili 16:00–18:00“ bira prema školskoj smeni. |
| `SHOW_TRAMPOLINE` | `false` | Program „Trampolina“ (pominje se samo u Instagram biu). Traži i opis u `content/programs.ts`. |
| `SHOW_FEES` | `false` | FAQ o članarini (traži i odgovor u `content/faq.ts`). |
| `SHOW_VIBER` | `true` | Klub uglavnom koristi Viber. Direktan Viber link se prikazuje tek kada `NEXT_PUBLIC_VIBER_PHONE_E164` potvrdi stvarni javni broj; do tada je vidljiv poziv/SMS fallback. |
| `SHOW_FACEBOOK` | `false` | Link ka Facebook stranici (i u JSON-LD `sameAs`). |
| `SHOW_EQUIPMENT_2026` | `false` | Stavka „novi dvovisinski razboj uz podršku Grada“ u hronologiji. |
| `MINOR_PHOTOS` | `false` | Dodatna globalna kapija za fotografije dece. Objavljuju se samo konkretni kadrovi sa `publication: "approved"`; svi ostali ostaju placeholderi i ne ulaze u `out/`. |
| `CAMP_GROUP_PHOTOS` | `false` | Dodatna kapija za pojedinačno odobrene kamp kadrove; 02 i 09 su trajno isključeni jer mešaju klubove. |
| `INDEXABLE` | `false` | Samo `<meta name="robots">`, `robots.txt` i `sitemap.xml`. `false` → `noindex, nofollow, noimageindex`; `robots.txt` dozvoljava HTML (da bi pretraživač video `noindex`), ali zabranjuje `/img/`; bez linije `Sitemap`; prazan `sitemap.xml`. `true` → `index, follow`; `robots.txt` sa `Sitemap`; `sitemap.xml` sadrži `SITE_URL/`. |
| `SITE_URL` (env) | `https://gimnastikakraguj.rs` | Kanonska adresa (domen još nije kupljen). |
| `CREDIT_NAME` | `Stefan Brkljačić` | Ime u footeru („Izrada sajta: …“). |
| `CREDIT_URL` | `""` | Opcioni link iza imena u footeru; prazno = bez linka. |

> **Pravilo saglasnosti — obavezno.** Javni URL (uključujući `*.pages.dev`) sme da emituje samo
> fotografije sa `publication: "approved"`, uz uključene odgovarajuće kapije. Saglasnost za
> jednu konkretnu fotografiju ne odobrava druge kadrove (ZZPL: za dete mlađe od 15 godina
> saglasnost daje roditelj).
> `noindex` **nije** saglasnost: stranica sa `noindex` je i dalje javno dostupna.

## Objavljivanje na Cloudflare Pages

Ovaj build **nije** objavljen. Kad klub potvrdi prekidače:

1. Cloudflare dashboard → Workers & Pages → Create → Pages → poveži Git repozitorijum.
2. Build command: `npm run build` · Build output directory: `out` · Environment: `NODE_VERSION=22.18.0` (ili noviji; postbuild pokreće `.ts` skriptu preko Node-ovog type strippinga, koji postoji od 22.18).
3. Po potrebi dodajte `NEXT_PUBLIC_SITE_URL` (pravi domen) i prekidače kao env promenljive.
4. Za privatni pregled pre objave: Zero Trust → Access → Applications → zaštitite
   `<projekat>.pages.dev` (i preview URL-ove) pravilom „emails: …“. Tako pregled nije javan.
5. Domen: Custom domains → dodajte domen, pa podesite DNS kod registra (.rs domen se kupuje
   preko registra ovlašćenog od RNIDS-a).

Cloudflare Pages automatski služi `out/404.html` za nepostojeće adrese.

Šta build generiše pored stranice: `out/og.png` (slika za deljenje, 1200×630), `out/icons/*`
(favicon i ikonice aplikacije iz siluete), `out/manifest.webmanifest`, `out/kalendar/*.ics`
(raspored po grupama za kalendar), `out/robots.txt`, `out/sitemap.xml`, `out/404.html`.
OG slika i ikonice nastaju pri buildu (`app/og.png/route.tsx`, `app/icons/[file]/route.tsx`);
tekst na OG slici koristi Mona Sans TTF instance iz `components/seo/fonts` (OFL, samo za build).

## Javni repozitorijum

Ako repozitorijum postane javan, dodajte u `.gitignore` (linije su već pripremljene i
zakomentarisane): `docs/dosije.md` (interne beleške, treća lica) i `assets-source/logo/*original*`.

## Struktura

```
app/            layout, stranica, 404, SEO rute (robots, sitemap, ikonice, OG slika)
components/     sekcije (components/sections/*), forma (components/booking), UI primitivi
content/        sav sadržaj i prekidači
lib/            logika (kviz, raspored, .ics, linkovi, vreme, motion)
styles/         CSS po sekciji
scripts/        slike, SVG, čišćenje out/
tests/          Vitest testovi
qa/             Playwright / axe / Lighthouse provere
```

Izrada sajta: Stefan Brkljačić.
