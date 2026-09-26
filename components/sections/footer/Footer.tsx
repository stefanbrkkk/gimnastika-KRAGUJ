import { MENU_INDEX_ID } from "@/components/sections/header/chrome";
import { ArrowIcon, ExternalIcon, FacebookIcon, InstagramIcon } from "@/components/sections/header/icons";
import { HEADER_COPY } from "@/components/sections/header/header-copy";
import { HEADER_LAND_SCRIPT } from "@/components/sections/header/header-tone";
import { FooterMark } from "@/components/sections/header/LeapTrail";
import { CONTACT, FOOTER } from "@/content/copy";
import { CLUB, CREDIT_NAME, CREDIT_URL, CTA, FLAGS, GSS, NAV, PRIMARY_PHONE, SOCIAL } from "@/content/site";
import { telHref } from "@/lib/links";
import { typesetSr } from "@/lib/typeset";

/** Display typesetting, plus: a „ · “ separator never starts a line (glued to the word before). */
const typeset = (text: string) => typesetSr(text).replace(/ · /g, "\u00a0· ");

/**
 * Footer (§5 FOOTER), darkroom navy-950. The white logo is the last frame of
 * the page's chronophotograph: the leap takes off again past the logo in fading
 * ghost frames. On mobile the bottom padding clears the sticky bottom bar.
 *
 * #meni — a compact page index mirroring the menu sheet (the six NAV links, the
 * trial CTA, the call — as quiet index links, so the doskok stays the finale). It is where the header's "Meni" leads without JS and
 * before hydration, and it gives parents a way on from the bottom of the page.
 *
 * The inline script at the very end tells the header's tone script that the page is
 * parsed: a reload or history arrival that the browser restores only after parsing
 * (WebKit, Firefox) is moved to its stored position with its tone before the first
 * paint (MD4-02, header-tone.ts).
 */
export function Footer() {
  const external = { target: "_blank", rel: "noopener noreferrer" } as const;
  const newTab = <span className="sr-only"> {HEADER_COPY.newTab}</span>;
  const indexLabelId = `${MENU_INDEX_ID}-label`;

  return (
    <footer data-theme="darker" className="site-footer">
      <div className="container-site site-footer__inner">
        <div className="site-footer__brand">
          <FooterMark className="site-footer__mark" title={CLUB.brandName} />
          <p className="site-footer__line">{typeset(FOOTER.line)}</p>
        </div>

        <div id={MENU_INDEX_ID} className="site-footer__index">
          <p id={indexLabelId} className="site-footer__label label-caps">
            {HEADER_COPY.menu}
          </p>
          <nav aria-labelledby={indexLabelId}>
            <ul className="site-footer__nav">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="site-footer__nav-link">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {/* Quiet index links, not a second pair of pills right after the S11 finale (ID-11). */}
          <ul className="site-footer__actions">
            <li>
              <a href="#kontakt" data-booking="" className="site-footer__action">
                <span>{typeset(CTA.trial)}</span>
                <ArrowIcon className="site-footer__action-arrow" />
              </a>
            </li>
            <li>
              <a href={telHref(PRIMARY_PHONE.e164)} className="site-footer__action">
                <span>{typeset(`${CTA.call} ${PRIMARY_PHONE.display}`)}</span>
              </a>
            </li>
          </ul>
        </div>

        <div className="site-footer__foot">
          <ul className="site-footer__links">
            <li>
              <a href={GSS.clubPage} className="site-footer__link" {...external}>
                <span>{typeset(FOOTER.gss)}</span>
                <ExternalIcon className="site-footer__arrow" />
                {newTab}
              </a>
            </li>
            <li>
              <a href={SOCIAL.instagram} className="site-footer__link" {...external}>
                <InstagramIcon />
                <span>{CONTACT.instagramLabel}</span>
                <ExternalIcon className="site-footer__arrow" />
                {newTab}
              </a>
            </li>
            {FLAGS.SHOW_FACEBOOK ? (
              <li>
                <a href={SOCIAL.facebook} className="site-footer__link" {...external}>
                  <FacebookIcon />
                  <span>{CONTACT.facebookLabel}</span>
                  <ExternalIcon className="site-footer__arrow" />
                  {newTab}
                </a>
              </li>
            ) : null}
          </ul>

          <div className="site-footer__base">
            <p>{typeset(FOOTER.copyright)}</p>
            <p>
              {typeset(FOOTER.creditPrefix)}{" "}
              {CREDIT_URL ? (
                <a href={CREDIT_URL} className="site-footer__credit" {...external}>
                  {CREDIT_NAME}
                  {newTab}
                </a>
              ) : (
                CREDIT_NAME
              )}
            </p>
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: HEADER_LAND_SCRIPT }} />
    </footer>
  );
}
