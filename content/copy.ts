/**
 * Section copy (§5). Serbian, Latin script, ekavica, formal "Vi" toward parents.
 * Quotes are always „…“. Coaches use feminine forms (trenerica, sutkinja, predsednica, članica).
 * Edit copy here — components only render it.
 */
import { CAMP_NOTE_UNTIL, PRIMARY_PHONE } from "./site";

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
  finalNote: "Konačnu grupu predlaže trenerica posle probnog treninga.",
  competitiveTitle: "Takmičarske grupe (A, B i C program)",
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

export interface Coach {
  name: string;
  /** Role lines, rendered in order. */
  roles: readonly string[];
  /** null → silhouette placeholder in a contact-sheet frame. */
  photoId: "06" | null;
  /** Stays empty — no invented bios. */
  bio?: string;
}

export const COACHES_COPY = {
  heading: "Trenerice",
  badge: "Licenca GSS",
  groupPhotoCaption: "Na takmičenju",
  portraitPending: "Portret uskoro",
} as const;

export const COACHES: readonly Coach[] = [
  {
    name: "Slađana Kovačević",
    roles: [
      "Predsednica kluba",
      "Licencirana trenerica sportske gimnastike (GSS)",
      "Licencirana sutkinja za žensku sportsku gimnastiku (GSS)",
    ],
    // TODO(klub): request a portrait in club kit (photo 07 excluded — beauty-studio rights).
    photoId: null,
  },
  {
    name: "Ivana Kovačević",
    roles: ["Licencirana trenerica sportske gimnastike (GSS)", "Članica upravnog odbora kluba"],
    photoId: "06",
  },
];

export const CAMP = {
  heading: "Gimnastički kamp",
  lead: "Leto sa ekipom: treninzi i druženje na gimnastičkom kampu.",
  /** Only while today (Europe/Belgrade) ≤ CAMP_NOTE_UNTIL. */
  note: `Prijave za kamp u Grčkoj 2027. su u toku — pozovite ${PRIMARY_PHONE.display}.`,
  noteUntil: CAMP_NOTE_UNTIL,
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
    group: "Grupa",
    note: "Napomena (opciono)",
  },
  privacy: "Sajt ne čuva vaše podatke — poruka ide direktno trenerici.",
  actions: {
    sms: "Pošaljite SMS",
    email: "Pošaljite email",
    call: "Pozovite",
    viber: "Viber",
  },
  emailSubject: "Probni trening",
  after: `Poruka je spremna — pošaljite je u aplikaciji. Ako vam se ne javimo, pozovite ${PRIMARY_PHONE.display}.`,
  viberFailed: `Viber se nije otvorio — pozovite ${PRIMARY_PHONE.display} ili pošaljite SMS.`,
  close: "Zatvorite",
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
  enableTilt: "Uključite nagib telefona",
} as const;

export const PHOTO_PLACEHOLDER = "Fotografija uskoro";
