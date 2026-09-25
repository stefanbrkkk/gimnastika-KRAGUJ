import type { CSSProperties } from "react";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ENROLLMENT, HERO } from "@/content/copy";
import { FAQ_COPY, visibleFaq } from "@/content/faq";
import { SCHEDULE_UI } from "@/content/schedule";
import { CTA, PRIMARY_PHONE } from "@/content/site";
import { telHref } from "@/lib/links";
import { typesetSr } from "@/lib/typeset";
import { LEAP_SYMBOL, NARROW, WIDE } from "./leap-band";
import { LeapBand } from "./LeapBand";
import { LeapBandPlayer } from "./LeapBandPlayer";

const LEAP_ROOT_ID = "upis-skok";
const KIT_TITLE_ID = "upis-kit-title";
const FAQ_TITLE_ID = "upis-faq-title";

/** Frame of each step in the leap band: takeoff → apex → landing (= „postaje član kluba“). */
const STEP_FRAMES = ["takeoff", "apex", "landing"] as const;

/** Month initials under the year strip (J F M A M J J A S O N D — the same in Serbian). Aria-hidden. */
const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"] as const;

/** Splits "Niste našli odgovor? Pozovite 060 028 7631." around the number (the number becomes the tel link). */
function splitAtPhone(line: string, phone: string): [string, string] {
  const at = line.indexOf(phone);
  return at < 0 ? [line, ""] : [line.slice(0, at), line.slice(at + phone.length)];
}

/**
 * S10 „Upis i prvi trening“ (§5 S10). Server-rendered, complete without JS.
 * - „Jedan skok, tri kadra“: one chronophotograph band above the three steps —
 *   takeoff, apex and the stuck landing on step 3 („postaje član kluba“). The
 *   numerals follow the same ghost → solid progression. S10's primary motion
 *   (LeapBandPlayer → lazy chunk) flies the leap once, then the twelve month
 *   lamps light like a scoreboard.
 * - „Šta poneti na prvi trening“: a real packing list — unticked checkboxes a
 *   parent can tick the evening before; each tick draws with a small box squash
 *   (CSS), and a full bag sends a silhouette onto the card's edge (CSS :has()).
 * - FAQ „Pitanja roditelja“: native <details>; + turns into ×; the answer opens
 *   0fr → 1fr in 280ms and settles in (CSS only); two answers end with their
 *   next action (maps, schedule).
 * FAQPage JSON-LD is emitted by the SEO layer (components/seo), not here.
 */
export function Enrollment() {
  const faq = visibleFaq();
  const [lastBefore, lastAfter] = splitAtPhone(FAQ_COPY.lastLine, PRIMARY_PHONE.display);

  return (
    <Section id="upis" theme="light" labelledBy="upis-title" className="enrollment">
      <div className="container-site">
        <SectionHeading id="upis-title" title={typesetSr(ENROLLMENT.heading)} align="left" />

        <div className="en-leap" id={LEAP_ROOT_ID}>
          <LeapBand spec={WIDE} variant="wide" />
          <LeapBand spec={NARROW} variant="narrow" />

          {/* The numerals are part of the chronophotograph (aria-hidden); the list conveys the order. */}
          <ol className="en-steps" role="list">
            {ENROLLMENT.steps.map((step, i) => (
              <li key={step} className="en-step" data-frame={STEP_FRAMES[i] ?? "landing"}>
                <span className="en-step__num" aria-hidden="true">
                  {i + 1}
                </span>
                <p className="en-step__text">{typesetSr(step)}</p>
              </li>
            ))}
          </ol>

          <div className="en-year">
            <p className="en-year__line">
              <span className="en-year__months" aria-hidden="true">
                {MONTH_INITIALS.map((m, i) => (
                  <span key={i} className="en-month" style={{ "--m": i } as CSSProperties}>
                    <i className="en-month__lamp" />
                    <span className="en-month__init">{m}</span>
                  </span>
                ))}
              </span>
              <span className="en-year__text">{typesetSr(ENROLLMENT.yearRound)}</span>
            </p>
            <div className="en-actions">
              <a href="#kontakt" data-booking="" className="btn btn-primary">
                {typesetSr(CTA.trial)}
              </a>
              <a href={telHref(PRIMARY_PHONE.e164)} className="btn btn-secondary">
                {typesetSr(HERO.ctaSecondary)}
              </a>
            </div>
          </div>
        </div>

        <div className="en-lower">
          <div className="en-kit" role="group" aria-labelledby={KIT_TITLE_ID}>
            <h3 id={KIT_TITLE_ID} className="en-kit__title text-h3">
              {typesetSr(ENROLLMENT.checklistHeading)}
            </h3>
            <div className="en-kit__card">
              {/* A full bag = a stuck landing: this silhouette hops onto the card's edge (CSS). */}
              <svg
                className="en-kit__flier"
                viewBox={`${LEAP_SYMBOL.x} ${LEAP_SYMBOL.y} ${LEAP_SYMBOL.width} ${LEAP_SYMBOL.height}`}
                aria-hidden="true"
                focusable="false"
              >
                <use href="#leap" x={LEAP_SYMBOL.x} y={LEAP_SYMBOL.y} width={LEAP_SYMBOL.width} height={LEAP_SYMBOL.height} />
              </svg>
              <ul className="en-check" role="list">
                {ENROLLMENT.checklist.map((item) => (
                  <li key={item}>
                    <label className="en-check__item">
                      <input type="checkbox" className="en-check__input" />
                      <svg className="en-check__box" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
                        <rect className="en-check__frame" x="1.5" y="1.5" width="25" height="25" rx="7" />
                        <path className="en-check__tick" pathLength={1} d="M8 14.5l4.2 4.2L20.5 9.5" />
                      </svg>
                      <span className="en-check__label">{typesetSr(item)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="en-kit__note">{typesetSr(ENROLLMENT.checklistNote)}</p>
            </div>
          </div>

          <div className="en-faq">
            <h3 id={FAQ_TITLE_ID} className="en-faq__title text-h3">
              {typesetSr(FAQ_COPY.heading)}
            </h3>
            <div className="en-faq__body">
              <div className="faq">
                {faq.map((item) => {
                  const link = item.link;
                  return (
                    <details key={item.q} className="faq__item">
                      <summary className="faq__q">
                        <span className="faq__q-text">{typesetSr(item.q)}</span>
                        <span className="faq__icon" aria-hidden="true">
                          <svg className="ui-icon" viewBox="0 0 24 24" focusable="false">
                            <path d="M12 5.5v13M5.5 12h13" />
                          </svg>
                        </span>
                      </summary>
                      <div className="faq__a">
                        <div className="faq__a-in">
                          <p>{typesetSr(item.a)}</p>
                          {link ? (
                            <a
                              className="faq__more"
                              href={link.href}
                              {...(link.program ? { "data-schedule-program": link.program } : {})}
                              {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                            >
                              {typesetSr(link.label)}
                              {link.external ? (
                                <>
                                  <span aria-hidden="true">&nbsp;↗</span>
                                  <span className="sr-only"> {SCHEDULE_UI.newTab}</span>
                                </>
                              ) : null}
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
              <p className="faq__last">
                {typesetSr(lastBefore)}
                <a className="faq__tel" href={telHref(PRIMARY_PHONE.e164)}>
                  {typesetSr(PRIMARY_PHONE.display)}
                </a>
                {typesetSr(lastAfter)}
              </p>
            </div>
          </div>
        </div>
      </div>
      <LeapBandPlayer rootId={LEAP_ROOT_ID} />
    </Section>
  );
}
