/**
 * "Pitanja roditelja" (§5 S10). Also emitted as FAQPage JSON-LD.
 */
import { FLAGS } from "./site";

export interface FaqItem {
  q: string;
  a: string;
  flag?: "SHOW_FEES" | "FREE_TRIAL";
}

export const FAQ: readonly FaqItem[] = [
  { q: "Od koliko godina dete može da počne?", a: "Već od 3. godine, u mlađoj početnoj grupi (3–8 godina)." },
  { q: "Kada može da se upiše?", a: "Tokom cele godine." },
  {
    q: "Kako izgleda prvi trening?",
    a: "Dete dolazi na probni trening, a ako mu se dopadne, postaje član kluba.",
  },
  {
    q: "Šta dete treba da ponese?",
    a: "Helanke, majicu, čarape i flašicu vode. Kosa treba da bude vezana, a odeća uska.",
  },
  {
    q: "Gde se održavaju treninzi?",
    a: "U sali Trgovinsko-ugostiteljske škole „Toza Dragović“ (poznata kao „ŠUP“), Save Kovačevića 25, Kragujevac.",
  },
  {
    q: "Da li su trenerice licencirane?",
    a: "Da. Obe trenerice imaju licencu Gimnastičkog saveza Srbije, a predsednica kluba je i licencirana sutkinja za žensku sportsku gimnastiku.",
  },
  {
    q: "Da li klub ide na takmičenja?",
    a: "Da. Takmičarke nastupaju na takmičenjima Gimnastičkog saveza Srbije u sportskoj i aerobnoj gimnastici.",
  },
  // TODO(klub): fee amount not provided — answer stays empty until SHOW_FEES and copy exist.
  { q: "Koliko košta članarina?", a: "", flag: "SHOW_FEES" },
  // TODO(klub): confirm whether the trial is free before enabling FREE_TRIAL.
  { q: "Da li je probni trening besplatan?", a: "", flag: "FREE_TRIAL" },
];

/** FAQ items visible under the current flags (flagged items also need copy). */
export const visibleFaq = (): readonly FaqItem[] =>
  FAQ.filter((item) => (item.flag ? FLAGS[item.flag] && item.a !== "" : true));

export const FAQ_COPY = {
  heading: "Pitanja roditelja",
  lastLine: "Niste našli odgovor? Pozovite 060 028 7631.",
} as const;
