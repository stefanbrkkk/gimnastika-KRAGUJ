import { Fragment, type CSSProperties } from "react";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { BOOKING, CONTACT, HERO } from "@/content/copy";
import { CTA, EMAIL, FLAGS, PHONES, SOCIAL, VENUE } from "@/content/site";
import { mailtoHref, telHref } from "@/lib/links";
import { ContactDoskok } from "./ContactDoskok";
import { ContactIcon, type ContactIconName } from "./ContactIcon";

/** Leap box (components/brand/Sprite.tsx, symbol #leap) — kept in the same aspect. */
const LEAP_W = 230;
const LEAP_H = 150;

/**
 * „Doskok“ chronophotograph: three ghost frames of a short hop along the button's
 * top edge (x = % of the button width, y = % of the arc box height), then the solid
 * landed frame. This static composition IS the no-JS / reduced-motion final state;
 * ContactDoskok animates the hop through exactly these points when the CTA enters.
 */
const HOP = [
  { x: 0, y: 18, o: 0.16 },
  { x: 17, y: 50, o: 0.26 },
  { x: 34, y: 44, o: 0.38 },
] as const;
const LANDED_X = 52;

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
  tabular?: boolean;
}

const rows: Row[] = [
  ...PHONES.map<Row>((p) => ({ icon: "phone", label: CONTACT.callLabel, value: p.display, href: telHref(p.e164), tabular: true })),
  { icon: "mail", label: CONTACT.emailLabel, value: EMAIL, href: mailtoHref(EMAIL) },
  { icon: "instagram", label: CONTACT.instagramLabel, value: SOCIAL.instagramHandle, href: SOCIAL.instagram, external: true },
  ...(FLAGS.SHOW_FACEBOOK
    ? [{ icon: "facebook", label: CONTACT.facebookLabel, value: "sportskagimnastika.kraguj", href: SOCIAL.facebook, external: true } satisfies Row]
    : []),
];

const NEW_WINDOW = "(otvara se u novom prozoru)";

/** Long e-mail / handle values wrap at „@“ and after „_“ on 360px screens, never mid-word. */
function breakable(value: string) {
  const parts = value.split(/(?=@)|(?<=_)/);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 ? <wbr /> : null}
      {part}
    </Fragment>
  ));
}

/**
 * S11 — Contact + final CTA „doskok“ (§5 S11, §4 Final CTA). Dark theme.
 * The contact block is self-sufficient without JS: it is where every booking CTA
 * lands when JS is off (href="#kontakt"). The sticky bottom bar hides while
 * [data-contact-block] is visible.
 */
export function Contact() {
  return (
    <Section id="kontakt" theme="dark" labelledBy="kontakt-title" className="contact">
      <div className="container-site">
        <SectionHeading id="kontakt-title" title={CONTACT.heading} align="right" />

        <div className="contact__layout">
          {/* Leotard-gradient CTA panel: text only ever sits on the solid navy slab. */}
          <div className="cta-panel">
            <div className="cta-panel__slab">
              <ul className="cta-panel__trust">
                {HERO.trust.map((item) => (
                  <li key={item}>
                    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
                      <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="cta-panel__foot">
                <div className="doskok" data-doskok="">
                  <div className="doskok__arc" aria-hidden="true">
                    {HOP.map((f, i) => (
                      <Leap
                        key={i}
                        className="doskok__frame doskok__ghost"
                        style={{ ["--x" as string]: `${f.x}%`, ["--y" as string]: `${f.y}%`, ["--o" as string]: f.o }}
                        data-doskok-ghost={String(f.o)}
                      />
                    ))}
                  </div>
                  <div className="doskok__body" data-doskok-body="">
                    <Leap
                      className="doskok__frame doskok__landed"
                      style={{ ["--x" as string]: `${LANDED_X}%` }}
                      data-doskok-leap=""
                    />
                    <a href="#kontakt" data-booking="" className="btn btn-primary doskok__btn">
                      {CTA.trial}
                    </a>
                  </div>
                </div>
                <p className="cta-panel__privacy">{BOOKING.privacy}</p>
              </div>
            </div>
          </div>

          <address className="contact-block" data-contact-block="">
            <ul className="contact-list">
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
                      <span className="contact-row__label label-caps">{r.label}</span>
                      <span className={["contact-row__value", r.icon === "phone" ? "contact-row__value--phone" : "", r.tabular ? "tabular" : ""].filter(Boolean).join(" ")}>
                        {breakable(r.value)}
                      </span>
                      {r.external ? <span className="sr-only">{NEW_WINDOW}</span> : null}
                    </span>
                    <span className="contact-row__go">
                      <ContactIcon name={r.external ? "external" : "arrow"} />
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            <div className="contact-venue">
              <p className="contact-row__label label-caps">{CONTACT.addressLabel}</p>
              <p className="contact-venue__name">{VENUE.name}</p>
              <p className="contact-venue__street">
                <span className="whitespace-nowrap">{VENUE.street},</span>{" "}
                <span className="whitespace-nowrap">
                  {VENUE.postalCode} {VENUE.city}
                </span>
              </p>
              <a className="btn btn-secondary contact-venue__maps" href={VENUE.mapsUrl} target="_blank" rel="noopener noreferrer">
                <ContactIcon name="pin" />
                <span>{CONTACT.mapsCta}</span>
                <span className="sr-only">{NEW_WINDOW}</span>
              </a>
            </div>
          </address>
        </div>
      </div>
      <ContactDoskok />
    </Section>
  );
}
