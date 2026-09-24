import type { CSSProperties } from "react";
import { LEAP_VIEWBOX } from "@/components/brand/sprite-paths.generated";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ENROLLMENT, HERO } from "@/content/copy";
import { FAQ_COPY, visibleFaq } from "@/content/faq";
import { CTA, PRIMARY_PHONE } from "@/content/site";
import { telHref } from "@/lib/links";
import { ChecklistTicks } from "./ChecklistTicks";

const CHECKLIST_ID = "upis-checklist";
const KIT_TITLE_ID = "upis-kit-title";
const FAQ_TITLE_ID = "upis-faq-title";

/** Three frames of one leap: takeoff (ghost) → apex (ghost) → landing (solid) = „postaje član kluba“. */
const LEAP_FRAMES = [
  { kind: "ghost", o: 0.22 },
  { kind: "ghost", o: 0.4 },
  { kind: "solid", o: 1 },
] as const;

/** Splits "Niste našli odgovor? Pozovite 060 028 7631." around the number (the number becomes the tel link). */
function splitAtPhone(line: string, phone: string): [string, string] {
  const at = line.indexOf(phone);
  return at < 0 ? [line, ""] : [line.slice(0, at), line.slice(at + phone.length)];
}

/**
 * S10 „Upis i prvi trening“ (§5 S10). Server-rendered, complete without JS.
 * - Three steps as three frames of one leap (ghost → ghost → landed silhouette).
 * - „Šta poneti na prvi trening“: the ticks draw in once on enter (CSS
 *   stroke-dashoffset, triggered by the tiny ChecklistTicks island; static
 *   without JS / under reduced motion).
 * - FAQ „Pitanja roditelja“: native <details>; + turns into ×; the answer opens
 *   0fr → 1fr in 280ms where ::details-content is supported (CSS only).
 * FAQPage JSON-LD is emitted by the SEO layer (components/seo), not here.
 */
export function Enrollment() {
  const faq = visibleFaq();
  const [lastBefore, lastAfter] = splitAtPhone(FAQ_COPY.lastLine, PRIMARY_PHONE.display);
  const { width: lw, height: lh } = LEAP_VIEWBOX;

  return (
    <Section id="upis" theme="light" labelledBy="upis-title" className="enrollment">
      <div className="container-site">
        <SectionHeading id="upis-title" title={ENROLLMENT.heading} align="left" />

        <ol className="en-steps" role="list">
          {ENROLLMENT.steps.map((step, i) => {
            const frame = LEAP_FRAMES[i] ?? LEAP_FRAMES[2];
            return (
              <li key={step} className="en-step" data-frame={frame.kind} style={{ "--i": i, "--o": frame.o } as CSSProperties}>
                <svg className="en-step__leap" viewBox={`0 0 ${lw} ${lh}`} aria-hidden="true" focusable="false">
                  <use href="#leap" width={lw} height={lh} />
                </svg>
                <span className="en-step__num tabular">{i + 1}</span>
                <p className="en-step__text">{step}</p>
              </li>
            );
          })}
        </ol>

        <div className="en-year">
          <p className="en-year__line">
            <span className="en-year__months" aria-hidden="true">
              {Array.from({ length: 12 }, (_, m) => (
                <i key={m} />
              ))}
            </span>
            {ENROLLMENT.yearRound}
          </p>
          <div className="en-actions">
            <a href="#kontakt" data-booking="" className="btn btn-primary">
              {CTA.trial}
            </a>
            <a href={telHref(PRIMARY_PHONE.e164)} className="btn btn-secondary">
              {HERO.ctaSecondary}
            </a>
          </div>
        </div>

        <div className="en-lower">
          <div className="en-kit" role="group" aria-labelledby={KIT_TITLE_ID}>
            <h3 id={KIT_TITLE_ID} className="en-kit__title text-h3">
              {ENROLLMENT.checklistHeading}
            </h3>
            <ul className="en-check" id={CHECKLIST_ID} role="list">
              {ENROLLMENT.checklist.map((item, i) => (
                <li key={item} className="en-check__item" style={{ "--i": i } as CSSProperties}>
                  <svg className="en-check__box" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
                    <rect className="en-check__frame" x="1.5" y="1.5" width="25" height="25" rx="7" />
                    <path className="en-check__tick" pathLength={1} d="M8 14.5l4.2 4.2L20.5 9.5" />
                  </svg>
                  <span className="en-check__label">{item}</span>
                </li>
              ))}
            </ul>
            <p className="en-kit__note">{ENROLLMENT.checklistNote}</p>
          </div>

          <div className="en-faq">
            <h3 id={FAQ_TITLE_ID} className="en-faq__title text-h3">
              {FAQ_COPY.heading}
            </h3>
            <div className="faq">
              {faq.map((item) => (
                <details key={item.q} className="faq__item">
                  <summary className="faq__q">
                    <span className="faq__q-text">{item.q}</span>
                    <span className="faq__icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M12 5.5v13M5.5 12h13" />
                      </svg>
                    </span>
                  </summary>
                  <div className="faq__a">
                    <p>{item.a}</p>
                  </div>
                </details>
              ))}
            </div>
            <p className="faq__last">
              {lastBefore}
              <a className="faq__tel" href={telHref(PRIMARY_PHONE.e164)}>
                {PRIMARY_PHONE.display}
              </a>
              {lastAfter}
            </p>
          </div>
        </div>
      </div>
      <ChecklistTicks targetId={CHECKLIST_ID} />
    </Section>
  );
}
