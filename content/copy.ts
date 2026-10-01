/**
 * Section copy (§5). Serbian, Latin script, ekavica, formal "Vi" toward parents.
 * Quotes are always „…“. Coaches use feminine forms (trenerica, sutkinja, predsednica, članica).
 * Edit copy here — components only render it.
 */
import { PRIMARY_PHONE, SOURCES } from "./site";

export const SKIP_LINK = "Preskoči na sadržaj";

export const HERO = {
  eyebrow: "Gimnastičko sportsko udruženje „Kraguj“ · Kragujevac · od 2007.",
  h1: "Sportska gimnastika za decu u Kragujevcu",
  sub: "Od prvog koluta do postolja — licencirane trenerice, takmičarski programi Gimnastičkog saveza Srbije i porodična atmosfera, za decu već od 3. godine.",
  ctaPrimary: "Zakažite probni trening",
  ctaSecondary: `Pozovite ${PRIMARY_PHONE.display}`,
  trust: [
    "Član Gimnastičkog saveza Srbije",
    "Licencirane trenerice GSS",
    "Upis tokom cele godine",
  ],
  easterEgg: {
    scoreFrom: "10.00",
    scoreTo: "1.00",
    tooltip:
      "Kad je Nadia Comăneci 1976. dobila prvu savršenu desetku, semafor nije mogao da prikaže 10 — pisalo je 1.00.",
  },
} as const;

export const QUIZ = {
  heading: "Koji program je za vaše dete?",
  step1: "Koliko godina ima vaše dete?",
  step2: "Da li je već treniralo gimnastiku?",
  experience: ["Tek počinje", "Treniralo je rekreativno", "Takmičilo se"] as const,
  ageMin: 3,
  ageMax: 18,
  /** Shown for age 8 + "Tek počinje" (both beginner groups). */
  noteAge8: "Za uzrast od 8 godina trenerica predlaže grupu na probnom treningu.",
  /** Shown for competitive recommendations. */
  noteCompetitive: "Grupu predlaže trenerica posle probnog treninga.",
  /** Every result. */
  aerobicHint: "Pitajte trenericu i za aerobnu gimnastiku.",
  resultCta: "Zakažite probni trening za ovu grupu",
  /** Shown when the result recommends 2+ groups (age 8 beginner, competitive). */
  resultCtaPlural: "Zakažite probni trening za ove grupe",
  finalNote: "Konačnu grupu predlaže trenerica posle probnog treninga.",
  competitiveTitle: "Takmičarske grupe (A, B i C program)",
  back: "Nazad",
  restart: "Počnite ponovo",
  /** Age unit, as in the schedule's „(3–8 god.)“. */
  ageUnit: "god.",
} as const;

export type Experience = (typeof QUIZ.experience)[number];

export const ABOUT = {
  heading: "O nama",
  mission:
    "Naša misija je da kroz gimnastiku podržimo pravilan fizički, mentalni i emotivni razvoj dece i mladih. Posvećeni smo stvaranju bezbednog, stimulativnog i pozitivnog okruženja u kom svaki član razvija disciplinu, samopouzdanje i ljubav prema zdravom životu. Misija našeg kluba je i pružanje najvišeg nivoa trenažnog procesa u gimnastici — od prvih koraka u rekreativnom sportu do vrhunskih takmičarskih rezultata. Kroz stručan rad i individualan pristup nastojimo da izgradimo ne samo vrhunske sportiste, nego i snažne ličnosti.",
  history:
    "Počeli smo 2007. godine sa jasnim ciljem da postanemo dom svih ljubitelja gimnastike u našem gradu i okolini. Od tada su kroz našu salu prošle generacije dece — mnoga su osvojila medalje, a pre svega izrasla u zdrave i ostvarene ljude. Od skromnih početaka do opremljene sale i licenciranog trenerskog tima, rasli smo zajedno sa našim članovima. Ponosni smo na svoju tradiciju, osvojene medalje i porodičnu atmosferu po kojoj nas prepoznaju generacije.",
  missionLabel: "Misija",
  historyLabel: "Istorijat",
  timelineLabel: "Hronologija",
} as const;

export interface CoachRole {
  text: string;
  /** ✅ source for licence claims (GSS lists, docs/dosije.md §3). */
  sourceUrl?: string;
}

export interface Coach {
  name: string;
  /** Role lines, rendered in order. */
  roles: readonly CoachRole[];
  /** null → silhouette placeholder in a contact-sheet frame. */
  photoId: "06" | "07" | null;
  /** Stays empty — no invented bios. */
  bio?: string;
}

export const COACHES_COPY = {
  heading: "Trenerice",
  badge: "Licenca GSS",
  groupPhotoCaption: "Na takmičenju",
  /** Frame label of the silhouette placeholder: the empty slot of the excluded photo 07 (no promise in the UI). */
  portraitFrame: "KR-07",
} as const;

export const COACHES: readonly Coach[] = [
  {
    name: "Slađana Kovačević",
    roles: [
      { text: "Predsednica kluba" },
      { text: "Licencirana trenerica sportske gimnastike (GSS)", sourceUrl: SOURCES.coachLicences },
      { text: "Licencirana sutkinja za žensku sportsku gimnastiku (GSS)", sourceUrl: SOURCES.judgeLicences },
    ],
    // Club-kit portrait received 1 Oct 2026 (was photo 07 placeholder — beauty-studio rights).
    photoId: "07",
  },
  {
    name: "Ivana Kovačević",
    roles: [
      { text: "Licencirana trenerica sportske gimnastike (GSS)", sourceUrl: SOURCES.coachLicences },
      { text: "Članica upravnog odbora kluba" },
    ],
    photoId: "06",
  },
];

export const CAMP = {
  heading: "Gimnastički kamp",
  lead: "Leto sa ekipom: treninzi i druženje na gimnastičkom kampu.",
  note: `Za informacije o narednom kampu pozovite ${PRIMARY_PHONE.display}.`,
  inquiry: "Pošaljite pitanje o kampu",
  inquirySubject: "Pitanje o gimnastičkom kampu",
  inquiryBody: "Dobar dan, zanimaju me informacije o gimnastičkom kampu.",
  prev: "Prethodna fotografija",
  next: "Sledeća fotografija",
} as const;

export const ENROLLMENT = {
  heading: "Upis i prvi trening",
  steps: [
    "Javite se telefonom ili porukom",
    "Dođite na probni trening",
    "Ako se detetu dopadne, postaje član kluba",
  ],
  yearRound: "Upis traje tokom cele godine.",
  checklistHeading: "Šta poneti na prvi trening",
  checklist: ["helanke", "majica", "čarape", "flašica vode", "vezana kosa"],
  checklistNote: "Odeća treba da bude uska. Takmičarke treniraju u klupskoj opremi i trikoima.",
} as const;

export const CONTACT = {
  heading: "Dođite na probni trening",
  callLabel: "Pozovite",
  emailLabel: "Email",
  instagramLabel: "Instagram",
  facebookLabel: "Facebook",
  addressLabel: "Adresa sale",
  mapsCta: "Otvorite u mapama",
} as const;

export const BOOKING = {
  title: "Zakažite probni trening",
  fields: {
    parent: "Ime roditelja",
    phone: "Telefon",
    phoneHint: "+381…",
    child: "Ime deteta (opciono)",
    birthYear: "Godište deteta",
    /** Empty first option of the Godište select. */
    birthYearPlaceholder: "Izaberite",
    group: "Grupa",
    note: "Napomena (opciono)",
  },
  /** Quiet text button that reveals the (collapsed) Napomena field; a drawn „+“ icon precedes it. */
  addNote: "Dodajte napomenu",
  privacy: "Sajt ne čuva vaše podatke — poruka ide direktno trenerici.",
  actions: {
    sms: "Otvorite SMS",
    email: "Otvorite email",
    call: "Pozovite",
    viber: "Viber",
  },
  emailSubject: "Probni trening",
  /** Parts of the §5 message: "Dobar dan, … Roditelj: …, tel: …; dete: …, godište …; grupa: …; napomena: …" */
  message: {
    intro: "Dobar dan, želim da prijavim dete na probni trening.",
    parent: "Roditelj",
    phone: "tel",
    child: "dete",
    birthYear: "godište",
    group: "grupa",
    note: "napomena",
  },
  after: `Poruka je spremna — pošaljite je u aplikaciji. Termin dogovarate sa trenericom. Ako vam se ne javimo, pozovite ${PRIMARY_PHONE.display}.`,
  viberFailed: `Viber se nije otvorio — pozovite ${PRIMARY_PHONE.display} ili pošaljite SMS.`,
  viberPending: "Klub uglavnom koristi Viber. Za tačan broj pozovite klub.",
  close: "Zatvorite",
  /** "Grupa" select option when the parent has not chosen a group. */
  groupUndecided: "Neka trenerica predloži",
  /** How the undecided group reads inside the message. */
  groupUndecidedMessage: "neka trenerica predloži",
  errors: {
    parent: "Upišite ime roditelja.",
    phoneMissing: "Upišite broj telefona.",
    phoneInvalid: "Proverite broj telefona — dozvoljene su cifre, razmaci i „+“ na početku.",
    birthYearMissing: "Izaberite godište deteta.",
  },
} as const;

export const STICKY_BAR = { call: "Pozovite", sms: "SMS", viber: "Viber", schedule: "Raspored" } as const;

export const FOOTER = {
  line: "Gimnastičko sportsko udruženje „Kraguj“ · Kragujevac",
  gss: "Član Gimnastičkog saveza Srbije",
  copyright: "© 2026",
  creditPrefix: "Izrada sajta:",
} as const;

export const NOT_FOUND = {
  title: "Ups — ova stranica je izgubila ravnotežu.",
  cta: "Nazad na početnu",
  enableTilt: "Uključite senzor pokreta",
} as const;

export const PHOTO_PLACEHOLDER = "Fotografija uskoro";
