/**
 * Serbian typesetting for running copy — DISPLAY ONLY. Content strings in content/
 * stay unchanged; components pass visible text through typesetSr() when rendering
 * (server side, so no bytes reach the client unless a client component imports it).
 *
 * Rules (NBSP = U+00A0), as in D-HERO-21, now site-wide:
 *  a) a spaced dash (– or —) never starts a line: it is glued to the word before it;
 *  b) a one-letter word (a i o u s k v z, the programme letters A–D, Roman I) never
 *     ends a line: it is glued to the next word (chains like „A i B program“ hold);
 *  c) a number stays with the word after it („42 registrovane“, „3. godine“);
 *  d) a date „2. 12. 2023.“ never breaks;
 *  e) a phone number „060 028 7631“ never breaks;
 *  f) the school's and the street's names never split.
 */
const NB = " ";

export function typesetSr(input: string): string {
  let s = input;
  // f) fixed names that must not split („Toza Dragović“, „Save Kovačevića 25“)
  s = s.replace(/Toza Dragović/g, `Toza${NB}Dragović`).replace(/Save Kovačevića (\d+)/g, `Save${NB}Kovačevića${NB}$1`);
  // e) phone numbers: 3–3–3/4 digit groups
  s = s.replace(/\b(\d{3}) (\d{3}) (\d{3,4})\b/g, `$1${NB}$2${NB}$3`);
  // d) dates d. m. yyyy(.)
  s = s.replace(/\b(\d{1,2}\.) (\d{1,2}\.) (\d{4})/g, `$1${NB}$2${NB}$3`);
  // a) spaced dashes glued to the previous word
  s = s.replace(/ ([–—])(?= )/g, `${NB}$1`);
  // b) one-letter words glued to the next word (lookbehind → chains work)
  s = s.replace(/(?<=^|[\s„"(])([aiousvkzAIOUSVKZBCD]) (?=\S)/g, `$1${NB}`);
  // c) a number (optionally ordinal „3.“) glued to the following word
  s = s.replace(/(?<=^|[\s„"(])(\d+\.?) (?=\p{L})/gu, `$1${NB}`);
  return s;
}
