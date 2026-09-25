import { Fragment, type CSSProperties } from "react";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { BOOKING, CONTACT, HERO } from "@/content/copy";
import { SCHEDULE_UI } from "@/content/schedule";
import { CTA, EMAIL, FLAGS, PHONES, PRIMARY_PHONE, SOCIAL, VENUE } from "@/content/site";
import { mailtoHref, smsHref, telHref } from "@/lib/links";
import { typesetSr } from "@/lib/typeset";
import { ContactDoskok } from "./ContactDoskok";
import { ContactIcon, type ContactIconName } from "./ContactIcon";

/** Leap box (components/brand/Sprite.tsx, symbol #leap) — kept in the same aspect. */
const LEAP_W = 230;
const LEAP_H = 150;

/**
 * „Doskok“ chronophotograph — the last three frames of the finale's dismount (a back
 * salto opening out of its rotation) and the solid landed frame on the button's top edge.
 * Positions and tilts live in contact.css (per breakpoint); this static composition IS
 * the no-JS / reduced-motion final state. ContactDoskok flies the silhouette from the
 * title's mark through exactly these frames onto the button.
 */
const GHOSTS = [1, 2, 3] as const;

function Leap({ className, style, ...data }: { className: string; style?: CSSProperties } & Record<`data-${string}`, string>) {
  return (
    <svg className={className} style={style} viewBox={`0 0 ${LEAP_W} ${LEAP_H}`} aria-hidden="true" focusable="false" {...data}>
      <use href="#leap" width={LEAP_W} height={LEAP_H} />
    </svg>
  );
}

interface Row {
  icon: ContactIconName;
  label: string;
  value: string;
  href: string;
  external?: boolean;
}

// The other channels (the two phones share one „Pozovite“ row, see below).
const rows: Row[] = [
  { icon: "mail", label: CONTACT.emailLabel, value: EMAIL, href: mailtoHref(EMAIL) },
  { icon: "instagram", label: CONTACT.instagramLabel, value: SOCIAL.instagramHandle, href: SOCIAL.instagram, external: true },
  ...(FLAGS.SHOW_FACEBOOK
    ? [{ icon: "facebook", label: CONTACT.facebookLabel, value: "sportskagimnastika.kraguj", href: SOCIAL.facebook, external: true } satisfies Row]
    : []),
];

const NEW_WINDOW = "(otvara se u novom prozoru)";

/**
 * The doskok button's own href — what it does WITHOUT JS (or if the booking sheet
 * cannot load): a text message to the coach that starts with the §5 intro, the
 * same hand-off the sheet makes. With JS, BookingSheet intercepts [data-booking]
 * and opens the sheet instead. (Every other booking CTA keeps href="#kontakt",
 * which lands right here.)
 */
const NO_JS_TRIAL_HREF = smsHref(PRIMARY_PHONE.e164, BOOKING.message.intro);

/**
 * Long e-mail / handle values wrap at „@“ and after „_“ on 360px screens, never mid-word.
 * Display typesetting (lib/typeset): a phone number never splits between its digit groups.
 */
function breakable(value: string) {
  const parts = typesetSr(value).split(/(?=@)|(?<=_)/);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 ? <wbr /> : null}
      {part}
    </Fragment>
  ));
}

/**
 * S11 — Contact + final CTA „doskok“ (§5 S11, §4 Final CTA). Dark theme, top edge cut
 * on the floor diagonal. Self-sufficient without JS: every other booking CTA lands here
 * (href="#kontakt"), the doskok button texts the coach, the call / e-mail rows are links.
 *
 * [data-contact-block] wraps the heading, the CTA panel and the contact channels —
 * NOT the venue card: the mobile sticky bar (StickyBarBehavior) hides while any of
 * that block is on screen and comes back once only the venue card and the footer
 * are left, so a one-tap call stays in reach at the end of the page.
 * Layout ≥640: the wrapper is a subgrid of .contact__grid. ≥1024 the panel stands in
 * the right 7 columns, straight under the right-aligned title, so the finale reads
 * title → panel → button in one column and the leap drops from the title's mark onto
 * the button; phones, e-mail, Instagram and the venue take the left 5 columns.
 *
 * The finale title is set on the §3 display step (contact.css); its chronophotograph
 * mark is static (land={false}) — it is the take-off frame of the doskok flight.
 * Visible copy goes through typesetSr() (display only; content/* stays raw).
 */
export function Contact() {
  const [primaryPhone, ...otherPhones] = PHONES;
  return (
    <Section id="kontakt" theme="dark" edge="up" labelledBy="kontakt-title" className="contact">
      <div className="container-site contact__grid">
        <div className="contact__block" data-contact-block="">
          <SectionHeading id="kontakt-title" title={typesetSr(CONTACT.heading)} align="right" land={false} className="contact__heading" />

          {/* The CTA panel: a navy slab with a leotard-gradient sash (≥640) or mat band (<640).
              Text only ever sits on the navy. */}
          <div className="cta-panel">
            <div className="cta-panel__slab">
              <ul className="cta-panel__trust">
                {HERO.trust.map((item) => (
                  <li key={item}>
                    <svg className="ui-icon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
                      <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{typesetSr(item)}</span>
                  </li>
                ))}
              </ul>

              <div className="doskok" data-doskok="">
                <div className="doskok__arc" aria-hidden="true" data-doskok-arc="">
                  {GHOSTS.map((n) => (
                    <Leap key={n} className={`doskok__frame doskok__ghost doskok__ghost--${n}`} data-doskok-ghost={String(n)} />
                  ))}
                </div>
                <div className="doskok__body" data-doskok-body="">
                  <Leap className="doskok__frame doskok__landed" data-doskok-leap="" />
                  <a href={NO_JS_TRIAL_HREF} data-booking="" className="btn btn-primary doskok__btn">
                    {typesetSr(CTA.trial)}
                  </a>
                </div>
              </div>

              <p className="cta-panel__privacy">{typesetSr(BOOKING.privacy)}</p>
            </div>
          </div>

          <address className="contact-channels">
            <ul className="contact-list">
              {/* Both numbers under ONE „Pozovite“ (§5: no role labels until the club says
                  who answers which) — two separate tel: links, the first one larger. */}
              {primaryPhone ? (
                <li>
                  <div className="contact-row contact-row--phones">
                    <span className="contact-row__icon">
                      <ContactIcon name="phone" />
                    </span>
                    <span className="contact-row__text">
                      {/* Shown once; each link carries it for screen readers („Pozovite 060 028 7631“). */}
                      <span className="contact-row__label label-caps" aria-hidden="true">
                        {typesetSr(CONTACT.callLabel)}
                      </span>
                      <span className="contact-phones">
                        {[primaryPhone, ...otherPhones].map((p, i) => (
                          <a
                            key={p.e164}
                            className={["contact-phone", i === 0 ? "contact-phone--primary" : ""].filter(Boolean).join(" ")}
                            href={telHref(p.e164)}
                          >
                            <span className="sr-only">{CONTACT.callLabel} </span>
                            {typesetSr(p.display)}
                          </a>
                        ))}
                      </span>
                    </span>
                  </div>
                </li>
              ) : null}
              {rows.map((r) => (
                <li key={r.href}>
                  <a
                    className="contact-row"
                    href={r.href}
                    {...(r.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    <span className="contact-row__icon">
                      <ContactIcon name={r.icon} />
                    </span>
                    <span className="contact-row__text">
                      <span className="contact-row__label label-caps">{typesetSr(r.label)}</span>
                      <span className="contact-row__value">{breakable(r.value)}</span>
                      {r.external ? <span className="sr-only">{NEW_WINDOW}</span> : null}
                    </span>
                    {/* Only the external link gets a trailing glyph (↗ = leaves the site);
                        the leading pictogram already names what a call / e-mail row does. */}
                    {r.external ? (
                      <span className="contact-row__go">
                        <ContactIcon name="external" />
                      </span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          </address>
        </div>

        {/* The training venue: a place, not contact information — so outside <address>. */}
        <div className="contact-venue">
          <p className="contact-row__label label-caps">{typesetSr(CONTACT.addressLabel)}</p>
          <p className="contact-venue__name">{typesetSr(VENUE.name)}</p>
          {/* Wayfinding: how Kragujevac knows the school (the S4 location card's line). */}
          <p className="contact-venue__aka">{typesetSr(`${SCHEDULE_UI.nicknamePrefix} ${VENUE.nickname}`)}</p>
          <p className="contact-venue__street">
            <span className="whitespace-nowrap">{typesetSr(VENUE.street)},</span>{" "}
            <span className="whitespace-nowrap">{typesetSr(`${VENUE.postalCode} ${VENUE.city}`)}</span>
          </p>
          <a className="btn btn-secondary contact-venue__maps" href={VENUE.mapsUrl} target="_blank" rel="noopener noreferrer">
            <ContactIcon name="pin" />
            <span>{typesetSr(CONTACT.mapsCta)}</span>
            <span className="sr-only">{NEW_WINDOW}</span>
          </a>
        </div>
      </div>
      <ContactDoskok />
    </Section>
  );
}
