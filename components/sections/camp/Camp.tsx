import { Picture, isPhotoPlaceholder, isPhotoVisible } from "@/components/ui/Picture";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CAMP } from "@/content/copy";
import type { PhotoId } from "@/content/photos";
import { PRIMARY_PHONE } from "@/content/site";
import { telHref } from "@/lib/links";
import { belgradeNow } from "@/lib/time";
import { typesetSr } from "@/lib/typeset";
import { postcardCounter } from "./camp-copy";
import { CampIsland } from "./CampIsland";
import { BAR_D, ECHO_DS, HORIZON_VIEWBOX, LEGS_D, WAVE_D } from "./horizon";

/**
 * Postcards in stack order (top first). 09 only when CAMP_GROUP_PHOTOS allows it.
 * TODO(club): may photo 16 (camp lunch, already public in S9 „Kampovi“) join as a third card?
 * §5 S8 lists 10 and 11 only, so it stays out until the club says yes (design review RC-14).
 * No captions: nothing may imply that a photo was taken in Greece (§5 S8).
 * `sizes` = the card's CSS width in the stack (see styles/sections/camp.css).
 */
const POSTCARDS: readonly { id: PhotoId; orient: "landscape" | "portrait"; sizes: string }[] = [
  { id: "10", orient: "landscape", sizes: "(min-width: 1024px) 520px, (min-width: 640px) 70vw, 84vw" },
  { id: "11", orient: "portrait", sizes: "(min-width: 1024px) 350px, (min-width: 640px) 48vw, 60vw" },
  { id: "09", orient: "landscape", sizes: "(min-width: 1024px) 520px, (min-width: 640px) 70vw, 84vw" },
];

/**
 * The camp note with the phone number as a tel: link (text stays exactly as in content/copy.ts;
 * split first, then each part is typeset for display: the dash never starts a line, the number
 * never breaks). It belongs to the postcard world: a postmark with the sun, not an info icon.
 */
function CampNote() {
  const [before = "", after] = CAMP.note.split(PRIMARY_PHONE.display);
  const hasPhone = after !== undefined;
  return (
    <p className="camp__note" data-camp-note="" data-until={CAMP.noteUntil}>
      <svg className="camp__postmark" viewBox="0 0 44 44" aria-hidden="true" focusable="false">
        <circle className="camp__postmark-ring" cx="22" cy="22" r="20" />
        <g className="camp__note-icon ui-icon" transform="translate(10 10)">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
        </g>
      </svg>
      <span>
        {hasPhone ? (
          <>
            {typesetSr(before)}
            <a className="link camp__tel" href={telHref(PRIMARY_PHONE.e164)}>
              {typesetSr(PRIMARY_PHONE.display)}
            </a>
            {typesetSr(after)}
          </>
        ) : (
          typesetSr(CAMP.note)
        )}
      </span>
    </p>
  );
}

/**
 * Display lead (presentation only; the copy in content/ is unchanged): a short preposition
 * never ends a line („na / gimnastičkom“), a coordinated pair is one idea and never splits
 * („treninzi i druženje“, RC2-05), and the last word never stands alone („kampu.“). The lead
 * then breaks only after „Leto“, after „ekipom:“ and before „na“. typesetSr has already glued
 * „i“ to the next word, so the pair's second space may be a no-break one (\S never matches it).
 */
const keepPrepositions = (text: string): string =>
  text
    .replace(/(?<=^|\s)(na|sa|za|od|do|po|iz) /g, "$1\u00A0")
    .replace(/(\S+) i[ \u00A0](\S+)/g, "$1\u00A0i\u00A0$2")
    .replace(/ (\S+)$/, "\u00A0$1");

function Arrow({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="postcards__arrow ui-icon">
      <path d={dir === "prev" ? "M14.5 5.5 8 12l6.5 6.5" : "M9.5 5.5 16 12l-6.5 6.5"} />
    </svg>
  );
}

/**
 * S8 — „Gimnastički kamp“ (§5 S8, §4 Camp). Light theme.
 * - Postcards: a scroll-snap row without JS; with JS (html.js, set before first paint)
 *   a stack that can be flicked sideways (Draggable x + Inertia, loaded when near)
 *   plus prev/next buttons (WCAG 2.5.7). Vertical page scroll stays native.
 * - Horizon: the season's last beam routine — a leap lands on the beam, the gymnast finds
 *   her balance, then the beam lets go and becomes the summer sea (a one-shot on every
 *   device when motion is allowed; camp-beam.ts). The static state is the wave + its echoes.
 * - Camp note: rendered while the BUILD date ≤ CAMP_NOTE_UNTIL and hidden after mount
 *   when the visitor's Europe/Belgrade date is past it (DECISIONS D-19).
 */
export function Camp() {
  // Never a stack of identical „Fotografija uskoro“ cards to flick through: placeholders
  // (MINOR_PHOTOS=false) drop out while a real photo remains, else ONE placeholder stays.
  const visible = POSTCARDS.filter((c) => isPhotoVisible(c.id));
  const real = visible.filter((c) => !isPhotoPlaceholder(c.id));
  const cards = real.length > 0 ? real : visible.slice(0, 1);
  const showNote = belgradeNow().ymd <= CAMP.noteUntil;
  const multiple = cards.length > 1;

  return (
    <Section id="kamp" theme="light" labelledBy="kamp-title" className="camp">
      <div className="container-site">
        <SectionHeading id="kamp-title" title={typesetSr(CAMP.heading)} align="left" />

        <div className="camp__layout" data-camp="">
          <div className="camp__text">
            <p className="camp__lead measure">{keepPrepositions(typesetSr(CAMP.lead))}</p>
            {showNote ? <CampNote /> : null}
          </div>

          <ul className="postcards" id="kamp-razglednice" data-postcards="" data-count={cards.length}>
            {cards.map((c, i) => (
              <li key={c.id} className="postcard" data-postcard="" data-orient={c.orient} data-slot={i}>
                <Picture id={c.id} sizes={c.sizes} frame className="postcard__frame" />
              </li>
            ))}
          </ul>

          <svg
            className="camp__horizon"
            viewBox={`0 0 ${HORIZON_VIEWBOX.width} ${HORIZON_VIEWBOX.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
            data-horizon=""
          >
            <defs>
              {ECHO_DS.map((_, i) => (
                <clipPath key={i} id={`kamp-echo-${i}`} clipPathUnits="userSpaceOnUse">
                  <rect x="-120" y="-40" width={HORIZON_VIEWBOX.width + 240} height="200" data-horizon-echo-clip="" />
                </clipPath>
              ))}
            </defs>
            {ECHO_DS.map((d, i) => (
              <path key={i} className={`camp__horizon-echo camp__horizon-echo--${i + 1}`} d={d} clipPath={`url(#kamp-echo-${i})`} />
            ))}
            <path className="camp__horizon-legs" d={LEGS_D} opacity="0" data-horizon-legs="" />
            <g data-horizon-beam="">
              <path className="camp__horizon-bar" d={BAR_D} opacity="0" data-horizon-bar="" />
              <path className="camp__horizon-line" d={WAVE_D} data-horizon-line="" />
            </g>
          </svg>

          {multiple ? (
            <div className="postcards__controls" data-postcards-controls="">
              <button type="button" className="icon-btn postcards__btn" data-postcards-dir="prev" aria-controls="kamp-razglednice">
                <Arrow dir="prev" />
                <span className="sr-only">{CAMP.prev}</span>
              </button>
              <p className="postcards__count label-caps tabular">
                <span aria-hidden="true">
                  <span data-postcards-index="">1</span> / {cards.length}
                </span>
                <span className="sr-only" aria-live="polite" data-postcards-live="">
                  {postcardCounter(1, cards.length)}
                </span>
              </p>
              <button type="button" className="icon-btn postcards__btn" data-postcards-dir="next" aria-controls="kamp-razglednice">
                <span className="sr-only">{CAMP.next}</span>
                <Arrow dir="next" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <CampIsland />
    </Section>
  );
}
