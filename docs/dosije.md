# GSU „Kraguj“ — dosije za izradu sajta

Stanje: 24. 9. 2026.
Izvori:
- mejlovi od Slađane Kovačević, 21–24. 9. 2026: thread „Upit za sajt“ i thread sa gscssrbija@gmail.com
- 29 slika (28 preuzeto)
- 3 research agenta i nezavisna provera činjenica (fact-check)
- 3 agenta za UI istraživanje

Legenda statusa: ✅ potvrđeno (zvaničan izvor ili 2 nezavisna) · 🟡 jedan izvor ili tvrdnja kluba · ⚠️ nesigurno ili u konfliktu · ❌ nije pronađeno

---

## 0. Presuda (ukratko)

**Šta imamo:** materijala ima dovoljno za sajt vrhunskog nivoa.
- Pravi podaci: raspored, grupe, treneri, upis, kontakt.
- Proverljivi dokazi kredibiliteta: GSS članstvo, licence, registrovane takmičarke, medalje, podrška grada.
- **Vektorski logo i silueta** (očišćeni iz originala).
- 11 upotrebljivih fotografija.
- Konkurencija u Kragujevcu nema sajt koji se rangira na Google-u.

**Pet stvari koje treba razrešiti pre objave** (u master promptu su to prekidači: `FREE_TRIAL`, `MINOR_PHOTOS`, `CAMP_GROUP_PHOTOS`, `SHOW_VIBER`, `SHOW_FACEBOOK`, `SHOW_TRAMPOLINE`, `SHOW_SHIFT_NOTE`) (ne blokiraju izradu, gradi se sa pretpostavkama):
1. **Da li je probni trening besplatan?** Klijentkinja to nigde ne kaže. Na sajtu zato stoji „probni trening“, ne „besplatan“.
2. **Saglasnost roditelja** za objavu fotografija dece (ZZPL: za dete mlađe od 15 godina saglasnost daje roditelj).
3. **Istorija:** „od 2007. pod nazivom Sokolsko društvo Kragujevac“ ne može biti tačno u toj formi. Sokolsko društvo Kragujevac je posebno udruženje, obnovljeno 1996. Predložena formulacija je u odeljku 2.
4. **Adresa:** GSS vodi klub na adresi **Cara Dušana 21** (verovatno sedište). Treninzi su u školi na adresi **Save Kovačevića 25**.
5. **Trampolina** se pominje u Instagram biu, a klijentkinja je ne navodi.

**Sporedni nedostaci:**
- Portret Slađane u klupskoj opremi. Postojeći je iz beauty studija, sa njihovim vodenim žigom, i isključen je.
- Tačan broj medalja sa PS 2023. Znamo da ih je bilo bar sedam, ali sprave nisu sigurne.
- Slika 11011.jpg (6,5 MB) je prevelika za Drive konektor.

---

## 1. Šta website builder traži

U ovom okruženju ne postoji skill koji se zove tačno „website-builder“; on je verovatno u tvom lokalnom Claude Code-u i odavde ga ne vidim. Ulazi koji su mu potrebni izvedeni su iz skillova koje vidim: **web-craft** (frontend-design, GSAP, ui-review), **demo-site** (istraživanje firme i sajt) i **master-prompt** (pakovanje za Claude Code).

| # | Šta builder mora da dobije | Pravilo | Status |
|---|---|---|---|
| 1 | Tabela činjenica, jedan izvor po činjenici | Nepotvrđeno ide kao `[proveriti]`. Nikad ne izmišljati cene, nagrade, godine ni recenzije. | ✅ odeljak 2 + 3 |
| 2 | Naziv, kategorija, adresa, telefon, radno vreme / raspored, mreže | | ✅ |
| 3 | „Glavni razlog zašto ih biraju“ (hero poruka) | Iz recenzija ili dokaza | ✅ iz dokaza (GSS, licence, medalje). Google recenzija nema. |
| 4 | Usluge / programi, opisi | Iz činjenica, ne generički | ✅ 6 grupa |
| 5 | Kredibilitet / „zašto mi“ | Parafrazirano, sa izvorom | ✅ odeljak 3 |
| 6 | Kontakt dugmad (poziv / Viber / WhatsApp), mapa kao običan link, CTA za zakazivanje | | ✅ (WhatsApp nije potvrđen) |
| 7 | Brend: logo (SVG), boje, tipografija, ton | | ✅ vektorizovan logo + tokeni u odeljku 6 |
| 8 | Prave fotografije sa pravom korišćenja; lista fotografija koje treba tražiti | Nikad ne kopirati sa Google-a ili IG bez dozvole | ✅ 11 + rezerva; ⚠️ saglasnost roditelja |
| 9 | Jezik | Srpski, latinica, ekavica, č ć š ž đ; fontovi sa `latin-ext` | ✅ |
| 10 | Tehnička pravila | Mobile-first (360 px), `prefers-reduced-motion`, a11y (`lang`, alt, kontrast ≥ 4,5:1), pregled uživo pre predaje | ✅ u master promptu |
| 11 | Stack i deploy | Next.js + Tailwind + GSAP (tvoj standard); Cloudflare Pages (besplatno, dozvoljena komercijalna upotreba; Vercel Hobby zabranjuje komercijalno) | ✅ |
| 12 | Struktura master prompta | Cilj i DoD, kontekst, zahtevi sa kriterijumima prihvatanja, plan sa checkpointima, ograničenja (bez pitanja, pretpostavke u DECISIONS.md), verifikacija, format završnog izveštaja | ✅ fajl `gsu-kraguj-master-prompt.md` |

---

## 2. Podaci od kluba (mejl od 24. 9. 2026, 14:36), očišćeno

**Naziv:** Gimnastičko sportsko udruženje „Kraguj“ (GSU „Kraguj“). Brend na logou i banneru je „Gimnastički klub Kraguj“, a na Instagramu „Sportska Gimnastika Kraguj“.

**Misija** (lektorisano, sadržaj netaknut):
> Naša misija je da kroz gimnastiku podržimo pravilan fizički, mentalni i emotivni razvoj dece i mladih. Posvećeni smo stvaranju bezbednog, stimulativnog i pozitivnog okruženja u kom svaki član razvija disciplinu, samopouzdanje i ljubav prema zdravom životu. Misija našeg kluba je i pružanje najvišeg nivoa trenažnog procesa u gimnastici — od prvih koraka u rekreativnom sportu do vrhunskih takmičarskih rezultata. Kroz stručan rad i individualan pristup nastojimo da izgradimo ne samo vrhunske sportiste, nego i snažne ličnosti.

**Istorijat.** Predlog verzije za sajt; izmene u odnosu na original su obeležene:
> Gimnastički klub Kraguj osnovan je 2007. godine sa jasnim ciljem da postane dom svih ljubitelja gimnastike u našem gradu i okolini. Tokom 19 godina ~~više od 19 godina~~ kroz našu salu prošle su **generacije dece** ~~stotine dece~~, od kojih su mnoge postale osvajačice medalja, ali pre svega zdravi i ostvareni ljudi. Od skromnih početaka do **opremljene sale** ~~savremeno opremljene sale~~ i licenciranog trenerskog tima, rasli smo zajedno sa našim članovima. Ponosni smo na svoju tradiciju, osvojene medalje i porodičnu atmosferu po kojoj nas prepoznaju generacije.

Razlozi za izmene:
- 2007–2026 je tačno 19 godina.
- Glas Šumadije je 2024. naveo „oko 120 članova“, pa „stotine“ nije dokazivo.
- Klub trenira u školskoj sali, pa je „savremeno“ rizična reč.

Ako klijentkinja potvrdi originalne formulacije, vraćaju se.

**Rečenica o nastanku.** Original: „od 2007. pod nazivom Sokolsko društvo Kragujevac, od 2017. pod ovim nazivom“. Predlog:
> „Počeli smo 2007. godine u okviru Sokolskog društva Kragujevac, a od 2017. radimo samostalno kao Gimnastičko sportsko udruženje „Kraguj“.“

⚠️ Ovu formulaciju treba potvrditi sa klubom.

**Gde treniramo:** Trgovinsko-ugostiteljska škola „Toza Dragović“ (TUŠ, u gradu poznata kao „ŠUP“), Save Kovačevića 25, 34000 Kragujevac.
- Adresa je ✅ potvrđena (tozadragovic.edu.rs/kontakt).
- Klijentkinja je napisala „TUS“; tačan naziv je Trgovinsko-ugostiteljska škola, tj. TUŠ.

**Grupe i raspored:**

| Grupa | Dani | Vreme |
|---|---|---|
| Takmičarska grupa — A i B program | pon, sre, pet | 08:30–10:30 **ili** 16:00–18:00 |
| | uto, čet | 17:30–19:30 |
| Starije takmičarke — C program | pon, sre, pet | 08:30–10:30 **ili** 16:00–18:00 |
| Mlađe takmičarke — C program | uto, čet | 19:30–21:30 |
| | pet | 08:30–10:30 **ili** 16:00–18:00 |
| Mlađa početna grupa (3–8 god.) | pon, sre, pet | 18:00–19:00 |
| Starija početna grupa (8+ god.) | pon, sre, pet | 19:00–20:00 |
| Aerobna gimnastika | pon, sre, pet | 20:00–21:30 |

Pretpostavka: „ili“ znači „u zavisnosti od školske smene“ (prepodnevna ili popodnevna). ⚠️ Potvrditi.

**Treneri:**
- **Slađana Kovačević:** predsednica kluba, licencirani trener sportske gimnastike, sudija za žensku sportsku gimnastiku.
- **Ivana Kovačević:** licencirani trener sportske gimnastike, članica upravnog odbora kluba.
- Datume rođenja iz mejla **ne objavljivati** (lični podatak koji sajtu ne treba).

**Upis:** moguć tokom cele godine. Dete dolazi na prvi probni trening; ako mu se dopadne, postaje član kluba.

**Na prvi trening poneti:** helanke, majicu, čarape, vezanu kosu i flašicu vode. Odeća treba da bude uska. Takmičarke treniraju u klupskoj opremi i trikoima.

**Kontakt:**
- Telefoni 060 028 7631 i 061 422 4386
- Email sladjanakovacevickg@gmail.com
- Instagram @gimnasticki_klub_kraguj

**Članarina:** nije dostavljena. ❌ Pitati da li želi javno.

**Kontekst:** Slađana je preko adrese gscssrbija@gmail.com (Gimnastički savez Centralne Srbije) iznela ponudu za sajt Saveza upravnom odboru. Preporuka za kontakt je stigla od Milene iz GK „Kami“ Šabac.

---

## 3. Provereni podaci sa interneta

Sve linkove je nezavisno otvorio agent za proveru (fact-check).

| Činjenica | Vrednost | Izvor | Status |
|---|---|---|---|
| Član Gimnastičkog saveza Srbije | GSU „Kraguj“ Kragujevac, ŽSG; adresa Cara Dušana 21; tel. 060/0287631; sladjanakovacevickg@gmail.com; sajt nije naveden | https://www.gssrb.rs/kragujevac/ · https://www.gssrb.rs/klubovi-gss/ | ✅ |
| Registrovane takmičarke ŽSG 2026 | **42** (A II: 6, B II: 5, C II: 31) | https://www.gssrb.rs/wp-content/uploads/2026/06/ZSG-Registrovane-takmicarke-I-rok-2026-azurirano-22.06.2026-1.pdf | ✅ |
| Registrovane takmičarke u aerobnoj gimnastici 2026 | **12** (program C) | https://www.gssrb.rs/wp-content/uploads/2026/06/AER-Registrovane-takmicarke-I-rok-2026-azurirano-22.6.2026.-.pdf | ✅ |
| Rast registracija ŽSG | 2024: 14 · 2025: 17 · 2026: 42 | GSS PDF-ovi za 2024 i 2025 (ranije liste) | 🟡 (proverio jedan agent) |
| Slađana Kovačević, licencirani trener | GSS licenca ŽSG98/18, zvanje „OT“, žuta dozvola, važi 1. 3. 2024 – 1. 3. 2027 | https://www.gssrb.rs/wp-content/uploads/2026/09/ЖСГ-Ажирирани-списак-регистрованих-тренера-септембар-2026.pdf | ✅ |
| Ivana Kovačević, licencirani trener | ŽSG150/21, „SOT“, žuta dozvola, važi do 1. 3. 2027 | isti PDF | ✅ |
| Slađana Kovačević, licencirana sutkinja ŽSG | S56/19, Kragujevac, kategorija IV | https://www.gssrb.rs/wp-content/uploads/2026/09/Licencirane-sutkinje-2026.pdf | ✅ |
| Godišnji program kluba za 2026. na listi vrednovanja Grada | „Sportska gimnastika za devojčice“, 78 bodova, 23. mesto. To je lista vrednovanja i rangiranja, a ne dokaz o finansiranju, pa na sajtu ne pisati „Grad finansira program“. | https://kragujevac.ls.gov.rs/extfile/sr/117394/Službeni%20list%20grada%20Kragujevca%20broj%2026%20od%2023.%20decembra%202025..pdf | ✅ |
| Grad pomogao nabavku opreme (2024); oko 17 godina rada; oko 120 članova; trening u TUŠ „Toza Dragović“; predsednica Slađana Kovačević | citat: „postoji već 17 godina i broji oko 120 članova … sjajne rezultate, posebno u B programu“ | https://www.glassumadije.rs/grad-podrzava-gimnasticki-klub-kraguj-u-nabavci-sportske-opreme/ (13. 9. 2024) | ✅ (jedan medij, ali se slaže sa klijentom) |
| Nov dvostruki visinski razboj uz podršku lokalne samouprave (2026) | Objava @predragstevovic (član Gradskog veća za sport); klub je koautor | https://imginn.com/p/DdmZf_Jujv2/ (ogledalo Instagram-a) | 🟡 |
| **Finale Prvenstva Srbije u B programu, Beograd, 2. 12. 2023** | Kraguj: **2 zlata, 1 srebro, najmanje 4 bronze** (finala sa 4–6 takmičarki) | https://www.gssrb.rs/wp-content/uploads/2024/02/BILTEN-PRVENSTVO-SRBIJE-B-PROGRAM-FINALE-naslov.pdf | ✅ da su medalje osvojene · ⚠️ sprave i tačan broj bronzi (PDF se čita izmešano) |
| I kolo B programa, Kostolac, 29. 5. 2022 | **1. mesto ekipno** (61,600 prema 60,300 za GK Zaječar). Oznaka kategorije ne postoji u tom delu biltena. | https://www.gssrb.rs/wp-content/uploads/2022/05/Bilten-I-kolo-B-Program-ZSG-GSS-2022.pdf | ✅ rezultat · ⚠️ kategorija |
| Prvenstvo Srbije u apsolutnoj kategoriji ŽSG, Kostolac, 30. 11. – 1. 12. 2024 | ekipni nastup (9. od 9) | https://www.gssrb.rs/wp-content/uploads/2024/12/BILTEN-PRVENSTVO-SRBIJE-U-APSOLUTNOJ-KATEGORIJI-2024.-ZSG.pdf | ✅ (prikazivati kao učešće, ne kao plasman) |
| Prvenstvo Srbije u aerobnoj gimnastici, Ruma, 13. 12. 2025 | učešće („5. ГСУ Крагуј, Крагујевац“) | https://www.gssrb.rs/wp-content/uploads/2025/12/Bilten-AER-SRB-2025.pdf | ✅ učešće · ⚠️ plasman |
| Promotivno takmičenje u aerobnoj i kreativnoj gimnastici, Negotin, 15. 5. 2026 | učešće | https://www.gssrb.rs/meduklupsko-promotivno-takmicenje-negotin-2026/ · https://www.ngportal.rs/festival-kreativne-gimnastike-u-negotinu-pokret-muzika-i-osmeh/ | ✅ |
| Instagram | @gimnasticki_klub_kraguj, ime „Sportska Gimnastika Kraguj“, bio „Sportska gimnastika · Aerobna gimnastika · Trampolina · Kragujevac“, oko 1K pratilaca, link u biu ne postoji | https://www.instagram.com/gimnasticki_klub_kraguj/ (čitano preko imginn/pictame) | ✅ |
| Kamp u Grčkoj 2026; prijave za 2027. u toku; tel. 0600287631 | objava od 16. 9. 2026 | https://imginn.com/p/DdWq6VHNNQ7/ | 🟡 (objava samog kluba) |
| Facebook | „Sportska Gimnastika Kraguj“ | https://www.facebook.com/sportskagimnastika.kraguj/ | 🟡 samo indeks pretrage; stranica se ne može otvoriti |
| Postojeći sajt | **NEMA.** Ne postoji u GSS imeniku ni u IG biu; nijedan logičan domen se ne resolvuje. | DNS provera: kraguj.rs, gsukraguj.rs, gkkraguj.rs, gimnastikakraguj.rs … | ✅ |
| Google Business profil | nije pronađen, nije proverljivo alatima | — | ❌ proveriti ručno; ako ne postoji, napraviti (veliki SEO dobitak) |
| Škola u kojoj se trenira | Trgovinsko-ugostiteljska škola „Toza Dragović“, Save Kovačevića 25 | https://www.tozadragovic.edu.rs/kontakt/ | ✅ |

**Konkurencija u Kragujevcu** (nijedan klub nema sajt koji se rangira):

| Klub | Disciplina | Izvor |
|---|---|---|
| GK „Radnički“ | ŽSG | gssrb.rs |
| „Ritmiko“ | ritmička gimnastika | gssrb.rs, FB |
| GK „Puma“ | ŽSG | gssrb.rs/klubovi-gss |

**SEO fraze:** gimnastika za decu Kragujevac · sportska gimnastika Kragujevac · gimnastički klub Kragujevac · upis na gimnastiku Kragujevac · aerobna gimnastika Kragujevac · gimnastika za predškolce Kragujevac · gimnastički kamp Grčka

**Značenje oznaka:**
- „Žuta“ dozvola za rad je prvi nivo po GSS pravilniku, čl. 20. Slede zelena, plava i crvena.
- „OT“ i „SOT“ nisu definisani ni u jednom dokumentu, pa na sajtu stoji samo „licencirani trener GSS“.
- Kategorija sutkinje IV je najniža numerisana nacionalna kategorija. Na sajtu: „licencirana sutkinja GSS za žensku sportsku gimnastiku“, bez kategorije.

**Na sajt ne ide:**
- imena maloletnih takmičarki iz biltena (bez saglasnosti)
- datumi rođenja
- MB, PIB i sedište (dok klub ne pošalje rešenje APR-a)
- „Gimnastički savez Centralne Srbije“ (nema javnog traga)
- „ŠUP“ kao zvaničan naziv
- tačne sprave i brojevi medalja sa PS 2023 (dok ih klub ne potvrdi)

---

## 4. Slike: izbor

Pregled celog izbora: `pregled-izbora.jpg` u paketu. U web verzijama je uklonjen EXIF (uređaj, datum; GPS je ionako bio prazan). Najduža ivica je do 2400 px, a formati su JPG q82 i WebP.

**Logo:** original je stigao kao 490 × 213 px JPG. Vektorizovao sam ga u **čist SVG**: navy, beli, crni i `currentColor` varijanta (oko 16 KB gz). Iz njega sam izdvojio:
- **samostalnu siluetu skoka** (`kraguj-silueta.svg`, `fill=currentColor`, oko 3,9 KB gz)
- **wordmark bez siluete** (`kraguj-wordmark.svg`)

Kad se silueta postavi preko wordmark-a, dobija se tačan logo. Na tome počiva ideja „logo se sklapa iz pokreta“.

**Paket ne sadrži originale fotografija** (EXIF, vodeni žig). Oni ostaju kod tebe u mejlu i na Drive-u.

| Fajl | Original | Uloga | Kvalitet | Napomena |
|---|---|---|---|---|
| 01-uspeh-medalje-ekipa | 9230.jpg (30. 5. 2026) | Uspesi / hero sekcije uspeha | ★★★ 4000 px, oštra | Valjevo, šest takmičarki sa medaljama i trenerom. Koje je takmičenje, pitati. |
| 02-zajednica-kamp-grupa | 12150.jpg | O nama / „porodica“ | ★★☆ 1600 px | Oko 40 devojčica u majicama „Gimnastički kamp“ sa sertifikatima. Moguće da su i iz drugih klubova, pa je slika iza prekidača `CAMP_GROUP_PHOTOS=false`. |
| 03-hala-ceo-klub-baner | 416 (webp) | O nama / hala | ★★☆ 1066 px, samo do ~540 px prikaza | Ceo klub pod banerom. Muškarac je verovatno član Gradskog veća (poseta 2024), ⚠️ potvrditi. |
| 04-trening-airtrack-skok | 418 (webp) | Programi / trening | ★★☆ 1066 px | Pokret, skok na airtracku, baner |
| 05-treneri-zajedno | 427.jpg | Treneri | ★★☆ | Dve trenerice u klupskim jaknama na takmičenju |
| 06-trener-portret-mladja | 401.jpg | Treneri | ★★★ | Verovatno Ivana (klupska jakna). ⚠️ Potvrditi ko je ko. |
| ~~07~~ | 402.jpg | — | — | **Isključeno** posle završne ocene: portret iz beauty studija sa njihovim vodenim žigom. Prava pripadaju studiju, a kontekst je privatan. Slađanina kartica dobija siluetu dok ne stigne portret u klupskoj opremi. |
| 08-aerobik-tim-selfie | 3768.jpg (13. 12. 2025, dan PS u Rumi) | Aerobna gimnastika | ★★☆, posvetljeno | Jedno lice je klub već zamutio. Na tom mestu je dodata **jaka pikselizacija** (zamućenje je bilo slabo). Nikad ga ne otkrivati. |
| 09-kamp-hala-sertifikati | 12141.jpg (20. 9. 2026) | Kamp | ★★★ | Pitati da li je ovo kamp u Grčkoj ili drugi kamp. Isto kao 02, iza prekidača `CAMP_GROUP_PHOTOS`. |
| 10-kamp-selfie-park | 11453.jpg (29. 8. 2026) | Kamp / atmosfera | ★★★ | |
| 11-kamp-penjanje | 11009.jpg (7. 8. 2026) | Kamp | ★★★ | |
| 12-greda-mural-poze | 12048.jpg (18. 9. 2026) | Galerija / zabava | ★★★ | Šaren mural se bori sa paletom. Koristiti u galeriji, ne u hero-u. |

**Rezerva** (u `slike/rezerva/`):
- 13 treneri i sutkinja
- 14 greda i mural sa trenerom
- 15 razboj (mutna)
- 16 ručak na kampu
- 17 torta „Srećan rođendan Kraguj“ (2019, za tajmlajn)
- 18 medalje 2018 (loš kvalitet)
- 19 kolačići sa logom

**Isključene:**
- 10999 i 11015: devojčice u kupaćim kostimima. Maloletnice u kupaćim ne idu na javni sajt.
- 5657: screenshot Instagram-a.
- 3772: potpuno mutna.
- 1086: mutan duplikat.
- 10958: slabiji duplikat.

**Nedostaje:**
- 11011.jpg: 6,5 MB je iznad limita Drive konektora. Ako je bitna, pošalji je kompresovanu.
- Portret Slađane u klupskoj opremi.
- Poželjno: 5–10 s slow-mo snimak skoka (ili burst ili Live Photo) jedne takmičarke u hali, uz pisanu saglasnost roditelja. To je „pro“ verzija hero animacije, ali sajt radi i bez toga (koristi se vektorska silueta).

---

## 5. UI istraživanje po izvorima

**styles.refero.design**
- Biblioteka od oko 200 dizajn sistema izvučenih sa pravih sajtova. Svaki ima tokene (boje, tipografiju, radijuse, senke) i izvoz `DESIGN.md`. Kategorija za sport ili ples ne postoji.
- Najkorisnije reference:

| Referenca | Šta uzeti |
|---|---|
| Nike | 2×2 full-bleed grid kategorija za programe; samo jedna varijanta CTA dugmeta |
| Calendly | Navy kao boja teksta umesto crne; senke tonirane plavom u 3 sloja; booking tok |
| Skillshare | Kartica instruktora sa gradijentom preko donjih 40 %; stat kartica |
| Headspace | Filter pilule za raspored |
| Duolingo | „Sticker“ čipovi (border 2 px, radius 12) za kviz uzrasta |
| Whimsical | Lavanda i ice-blue kao boje površina, poklapaju se sa trikoima |
| Slush | Traka koja prolazi iza naslova; kod nas je to brush potez sa rukava jakne |
| GSAP | Stroga taksonomija boja: jedna boja = jedan program |
| Apple | Tekst 17 px; par filled + outline pill; nikad dva filled dugmeta |

- Upozorenje: vrednosti su automatski izvučene, proveriti ih u DevTools-u.

**mobbin.com**
- Iza logina (403), pa su obrasci opisani iz poznavanja aplikacija. Peloton i Apple Fitness+ su provereni javno.

| Obrazac | Uzor |
|---|---|
| Nedeljni raspored kao „7 tačkica“ po grupi | Apple Fitness / Streaks |
| Raspored po danu | ClassPass (traka sa danima + lista) |
| Zakazivanje | Calendly („3 sledeća termina“ umesto celog kalendara) |
| Kviz uzrasta | Duolingo (jedno pitanje po ekranu) |
| Profili trenera | Peloton (moto, „kako motivišem“) |
| Zid medalja | Apple Fitness (flip bedževi) |
| Galerija | Airbnb (photo tour → lightbox) |
| Sticky donji CTA | Airbnb |
| FAQ harmonika | Apple Fitness+ („Pitanja roditelja“) |

**ui.aceternity.com**
- 112+ besplatnih komponenti (`npx shadcn add @aceternity/…`); zavise od `motion`.
- Sistemski problemi:
  - `<img>` umesto `next/image`
  - skoro nigde nema `prefers-reduced-motion`
  - mnogo efekata radi samo na hover, što je nula za telefon
  - cyan/ljubičasta paleta (#18CCFC, #6344F5) odaje „AI template“
- **Adaptirati:**
  - Timeline (sa `scaleY` i ResizeObserver)
  - Apple Cards Carousel (dodati scroll-snap i focus trap)
  - Expandable Cards (treneri)
  - Animated Testimonials (bez blura)
  - Sticky Banner
  - Floating Navbar
  - `<Highlight>` marker
  - Pointer Highlight kao brush krug
- **Izbeći:**
  - sve pozadine (aurora, beams, sparkles, lamp, spotlight, meteors)
  - Hero Parallax, Container/Macbook Scroll, 3D Marquee
  - hover-only kartice
  - text-generate, flip-words, typewriter
  - glass navbar

**motionsites.ai**
- Plaćena biblioteka AI promptova (Vite + Framer Motion), a ne galerija sajtova. Estetika: AI video pozadine i liquid glass, dakle ono od čega se ovde razlikujemo.
- Dve korisne tehnike:
  1. Scroll-scrub sekvenca kadrova na canvasu sa lerp 0,12.
  2. Sticky full-bleed poster ili video.

**Pinterest**
- Gimnastička niša je ili „glitter + swoosh silueta“, ili tamni neon fitness šabloni. Oba su pogrešna.
- **Neiskorišćen i najjači vajb je hronofotografija** (Marey, Muybridge, Edgerton; table na Pinterestu lwoods/chronophotography, ned_knight/chronophotography) i kinetička tipografija.
- Kultura roditelja: ime deteta i sjaj (posteri, značke). Ideja: bedževi i „sertifikat posle probnog treninga“.

**Ostalo** (Awwwards 2025–26, olimpijski dizajn, federacije):

| Referenca | Šta uzeti |
|---|---|
| landonorris.com (SOTD) | Ručne anotacije preko fotografija, jedna akcentna boja |
| champions4good.club (SOTD 2026) | Ljubičasto-lila sportska energija |
| fondation.canadiens.com | Ton prema roditeljima |
| memorial.fcporto.pt | Navy + svetla podloga kao premium |
| theimmortals.world | Raspored u stilu semafora |
| thelittlegym.com | „Free Intro“ + progresija veština |
| gymcan.org | Blok „Safe sport“ |
| Mexico 68 / Munich 72 (Aicher) / Milano Cortina 2026 | Linije, piktogrami, gest jednim potezom |
| Nadia Comăneci „1.00“ | Priča o semaforu |

- Institucionalni sajtovi federacija (USA, UK) su dosadni, pa je prostor za diferencijaciju otvoren.

**Klišei 2025–26 koje izbegavamo:**
- preloader 0–100 %
- Lenis + split-text na svakom naslovu
- marquee trake
- custom kursor
- bento za sve
- glassmorphism
- aurora i mesh gradijenti
- 3D blobovi
- pinovan horizontalni scroll na telefonu
- AI video pozadine
- topla krem „papir“ podloga + serif italic (izgled AI startupa)
- brojači 0 → 120+
- „gym“ tipografija (Bebas/Oswald, neon)
- ikonografija ritmičke gimnastike (traka, obruč), jer je Kraguj sportska gimnastika

---

## 6. Koncept: „LET KRAGUJA“ (preporučeni pravac)

**Ideja u jednoj rečenici.** Sajt je hronofotografija: skrol je zatvarač foto-aparata, a silueta iz logoa leti kroz stranicu u kadrovima-duhovima (kao Mareyeve studije pokreta). Svaki let se završava „doskokom“ na sledeći naslov i, na kraju, na dugme „Zakaži probni trening“.

**Zašto baš ovo:**
- Spaja četiri stvari koje klub već ima:
  - ime: kraguj je ptica, dakle let
  - logo: skok u špagi
  - sport: pokret
  - pravu siluetu koju sad imamo kao vektor
- Niko u sportu nije napravio hronofotografiju kao interaktivni web sistem, pa je to jaka priča za portfolio i case study.
- Pretvara glavnu slabost (prosečne fotografije sa telefona) u materijal: kontakt-list kadrovi, brojevi kadrova, anotacije.
- Nezavisno su do iste ideje došla dva različita agenta (art direkcija i motion).

**Pozajmice iz druga dva pravca:**
- iz „Savršena desetka“ (semafor): brojke u dot-matrix fontu **Doto** za statistiku; easter egg „1.00“ (Komăneci, 1976)
- iz „Kristal i kist“: gradijent trikoa (ice → lavanda → ljubičasta) samo na 3 mesta; beli brush potez sa rukava jakne kao živa anotacija

### Tokeni

**Boje:** kontrasti su izračunati.

| Token | Vrednost | Upotreba |
|---|---|---|
| navy-950 | #0a1a38 | najtamnije sekcije |
| navy-900 | #112d5f | „mračna komora“ (hero, uspesi); tekst na svetlom (13,4:1) |
| navy-800 | #1e4175 | površine u tamnom |
| royal-600 | #306098 | linkovi, aktivno (6,46:1 na belom) |
| royal-500 | #457cb3 | samo za tekst ≥ 24 px i ikone (4,39:1) |
| steel-300 | #8da9c6 | sporedni tekst na navy (5,51:1); kadrovi-duhovi |
| chalk | #f6f8fc | podloga („kreda“, hladna; ne krem) |
| ice-50 | #eef3fa | |
| line | #d5e0ee | |
| slate-600 | #4a5f80 | sporedni tekst na svetlom (6,1:1) |
| lav-200 | #c9b8ff | CTA na tamnom, navy tekst (7,53:1) |
| violet-600 | #6b4fd8 | focus ring (5,62:1) |
| iceblue-200 | #cfe6ff | |
| gold / silver / bronze | #c9a13b / #a7b1bf / #b0703a | samo medalje |

- `--grad-leotard: linear-gradient(118deg,#cfe6ff 0%,#c9b8ff 38%,#8e78f0 68%,#306098 100%)` ide samo na tri mesta: kadrovi siluete u hero-u, kartica probnog treninga, zaglavlje zida medalja.
- Tekst nikad direktno na gradijentu.

**Tipografija:**
- **Mona Sans** (variable; wdth 75–125, wght 200–900; latin-ext ✅) za sve, u jednom fajlu.
- **Doto** (dot-matrix; latin-ext ✅) samo za brojeve u stilu semafora, najmanje 32 px.
- Brush „Kraguj“ postoji **samo kao SVG logo**. Drugo script pismo se ne uvodi.
- Na mobilnom wdth 100–110 (srpske reči su duge), na desktopu 118–125.
- Veličine:
  - body 17 px / 1,55
  - label 13 px caps +0,08em
  - display-xl `clamp(2.75rem,.5rem+9.5vw,9rem)`, lh 0,88, −0,045em

**Oblici:**
- radijusi 0 / 8 / 14 / 20 / 28 / 999
- senke tonirane navy bojom, npr. `0 8px 16px -4px rgba(17,45,95,.08), 0 30px 50px -12px rgba(17,45,95,.18)`
- grid 4 / 8 / 12 kolona
- margine 20 / 32 / 48
- kontejner 1320 px
- touch target najmanje 48 px

**Pokret** (faze skoka):
- `--ease-stick` (doskok) `cubic-bezier(.16,1,.3,1)`
- `--ease-takeoff` (odraz) `cubic-bezier(.7,0,.84,0)`
- `--ease-flight` (let) `cubic-bezier(.45,0,.55,1)`
- `--ease-rebound` (odskok) `cubic-bezier(.34,1.56,.64,1)`
- GSAP CustomEase „hang“ (lebdenje na vrhu skoka)
- Trajanja: 100 / 180 / 280 / 600 / 900 ms; hero najviše 1,9 s.
- Pravilo: **jedan glavni pokret po ekranu.**

### Motion po sekcijama

| Sekcija | Interakcija |
|---|---|
| **Hero** (navy, 100svh) | H1 i dugmad **vidljivi od prvog frejma** (LCP). Linija strunjače se iscrta; silueta leti po paraboli (MotionPath + „hang“) i ostavlja 6 kadrova-duhova (ice → lavanda → ljubičasta, opacity 0,10–0,28); zatim se ispiše logo. Desktop: pin + scrub, duhovi nestaju, linija pada u dijagonalu ka programima. Telefon: bez pina. |
| Kviz „Koji program je za vaše dete?“ | Čipovi uzrasta 3–18 → „Da li je već trenirala?“ → kartica preporučene grupe sa mini-rasporedom i CTA. Silueta menja pozu po koraku. |
| Programi | Swipe kartice sa scroll-snap; linijska ikona sprave se iscrta pri ulasku. Tap otvara detalj (shared element). Filteri preko Flip-a. |
| Raspored | **Jasnoća pre svega.** Prikaz po grupi (7 tačkica nedelje) ili po danu (pilula dana; „danas“ unapred izabran, Europe/Belgrade). Red nudi .ics + poziv. |
| Treneri | Portret se otkriva „iz čučnja“ (clip-path); bedž licence se „udari kao pečat“. |
| Uspesi | „Sudijski semafor“: statične Doto brojke kod kojih se samo poslednja cifra jednom „prevrne“ (bez brojanja od nule). Svaki rezultat ima mali link „izvor“ ka biltenu GSS. Postolje od 3 linije. Podela na „Medalje“ i „Nastupe“. |
| Kamp | Linija grede se morfuje u talas mora; „razglednice“ se bacaju (Draggable, samo po x). |
| Galerija | Masonry → lightbox preko Flip-a, swipe, swipe nadole zatvara. Kadrovi sa brojem („KR-017“). |
| CTA / footer | „Doskok“: mala silueta sleti na dugme, dugme se spljošti (squash). Sticky donja traka na telefonu: Pozovi · Viber · Raspored. |
| 404 | „Ravnoteža na gredi“ preko žiroskopa telefona (easter egg). |

**Reduced motion:** hero se prikazuje kao gotova statična hronofotografija (sam po sebi lep kadar). Bez pina, scrub-a i brojača; ostaju samo fade prelazi do 150 ms.

**Perf budžet** (Galaxy A15/A25):
- LCP ≤ 2,0 s (granica 2,5 s)
- INP ≤ 150 ms, CLS ≤ 0,05
- JS za „/“ ≤ 160 KB gz
- animira se samo transform, opacity, clip-path i stroke-dashoffset
- bez blur ili backdrop-filter pri skrolu
- slike ≤ 100 KB (hero poster), 45 KB (thumb), 180 KB (lightbox)

**Alternativni pravci** (ako ne želiš „Let“):
- **B „Savršena desetka“:** semafor i grid sprava. Tehnički je impresivan, ali hladniji i najlakše se kopira.
- **C „Kristal i kist“:** trikoi, sjaj i brush. Najtopliji je, ali najbliži kiču.

---

## 7. Pitanja za klub (spremno za mejl)

1. Da li je prvi probni trening besplatan?
2. Da li imate saglasnost roditelja za objavu fotografija dece na sajtu? Da li se na sajtu mogu navoditi imena takmičarki (npr. uz medalje) ili samo ime kluba?
3. Kako da napišemo nastanak kluba? Predlog: „Počeli smo 2007. u okviru Sokolskog društva Kragujevac, a od 2017. radimo samostalno kao GSU „Kraguj“.“
4. Da li „8:30–10:30 ili 16–18“ zavisi od školske smene?
5. Da li trenirate i trampolinu (piše u Instagram biu)? A D program?
6. Koja je adresa sedišta (Savez vodi Cara Dušana 21)? Da li na sajt stavljamo samo adresu sale?
7. Na slikama 401 i 402: da li je to Ivana i Slađana? Možete li poslati Slađanin portret u klupskoj jakni? Kratka rečenica o svakoj trenerici: od kada trenira i šta najviše voli kod rada sa decom.
8. Ko se javlja na koji broj (060 028 7631 i 061 422 4386)? Da li koristite Viber ili WhatsApp?
9. Članarina: da li je objavljujemo?
10. Medalje na finalu Prvenstva Srbije u B programu 2023: koliko ih je bilo i na kojim spravama? Sa kog takmičenja je slika sa medaljama u Valjevu (30. 5. 2026)?
11. Kampovi: da li su slike sa majicama „Gimnastički kamp“ (18–20. 9.) sa kampa u Grčkoj ili sa drugog kampa? Termin i cena za 2027?
12. Da li imate Facebook stranicu „Sportska Gimnastika Kraguj“? Da li imate Google Maps profil?
13. Domen: .rs ili .org.rs? Predlog: gimnastikakraguj.rs. DNS se ne resolvuje, ali dostupnost domena treba proveriti kod RNIDS-a ili registra.

---

## 8. Završna ocena (nezavisni „sudija“) i šta je ispravljeno u v2

Pre predaje je nezavisni agent proverio dosije, master prompt i originalni mejl.

**Tačno bez ispravki:** raspored, telefoni, `tel:`/`sms:` formati, izvori i imena.

**Ispravljeno u v2:**
1. **Deca na fotografijama.**
   - Uvedeni su prekidači `MINOR_PHOTOS` i `CAMP_GROUP_PHOTOS`.
   - noindex više ne važi kao saglasnost.
   - Lice na slici 08 je pikselizovano.
   - Originali su izbačeni iz paketa.
2. **Foto 07 (beauty studio) izbačena**, jer prava pripadaju studiju.
3. **2007 više nije „godina osnivanja“, nego „početak rada“.**
   - Tekst istorijata sada počinje sa „Počeli smo 2007.“.
   - `foundingDate` je izbačen iz JSON-LD.
4. **Pravilo izvora:** u UI ide samo ✅. 🟡 stavke idu iza prekidača: Facebook, razboj 2026, napomena o kampu sa rokom.
5. **Viber je isključen dok klub ne potvrdi.** Glavni kanal je SMS sa `encodeURIComponent`.
6. **Hero:**
   - pravilo protiv „bljeska“ (klasa na `<html>` pre prvog iscrtavanja);
   - CTA radi i bez JS-a (`#kontakt`);
   - budžet za SVG realno postavljen na ≤22 KB gz;
   - silueta ima `currentColor`;
   - wordmark se otkriva clip-path brisanjem.
7. **Kviz ima redosled pravila;** aerobik više nema izmišljenu starosnu granicu.
8. **Raspored:**
   - skraćenice Po/Ut/Sr/Če/Pe/Su/Ne;
   - „danas“ se računa tek posle učitavanja;
   - .ics sa VTIMEZONE + link za Google Kalendar (Android ne uvozi .ics);
   - test poredi raspored sa tvrdo upisanom kopijom.
9. **Pristupačnost:** fokus prsten u tamnim sekcijama je lavanda (ljubičasta na navy ima samo 2,4:1); dugmad za razglednice.
10. **Jezik:**
    - dosledno obraćanje sa „Vi“;
    - ženski rod za trenerice;
    - „već od 3. godine“;
    - „oko 120“;
    - tačan naziv takmičenja u Negotinu;
    - „dvovisinski razboj“;
    - poruka posle slanja više ne obećava odgovor.
11. **Uspesi su podeljeni** na „Medalje“ i „Nastupe“, pa 9. mesto i festival nisu predstavljeni kao uspeh.
12. **Tehnika (Next 16):**
    - `npm run lint` se pokreće posebno;
    - Mona Sans sa `axes:['wdth']` + lokalni fallback;
    - Doto kao lokalni podskup;
    - merenje JS-a iz `out/`;
    - Lighthouse preko Playwright Chromium-a.

**Preostali rizici:**
- zavisnost od odgovora kluba (odeljak 7);
- hero treba testirati na pravom Android telefonu;
- Viber i SMS tokove proveriti na pravom uređaju.
