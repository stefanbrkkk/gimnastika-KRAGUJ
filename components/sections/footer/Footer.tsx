import { ExternalIcon, FacebookIcon, InstagramIcon } from "@/components/sections/header/icons";
import { HEADER_COPY } from "@/components/sections/header/header-copy";
import { FooterMark } from "@/components/sections/header/LeapTrail";
import { CONTACT, FOOTER } from "@/content/copy";
import { CLUB, CREDIT_NAME, CREDIT_URL, FLAGS, GSS, SOCIAL } from "@/content/site";

/**
 * Footer (§5 FOOTER), darkroom navy-950. The white logo is the last frame of
 * the page's chronophotograph: the leap takes off again past the logo in fading
 * ghost frames. On mobile the bottom padding clears the sticky bottom bar.
 */
export function Footer() {
  const external = { target: "_blank", rel: "noopener noreferrer" } as const;
  const newTab = <span className="sr-only"> {HEADER_COPY.newTab}</span>;

  return (
    <footer data-theme="darker" className="site-footer">
      <div className="container-site site-footer__inner">
        <div className="site-footer__brand">
          <FooterMark className="site-footer__mark" title={CLUB.brandName} />
          <p className="site-footer__line">{FOOTER.line}</p>
        </div>

        <ul className="site-footer__links">
          <li>
            <a href={GSS.clubPage} className="site-footer__link" {...external}>
              <span>{FOOTER.gss}</span>
              <ExternalIcon className="site-footer__arrow" />
              {newTab}
            </a>
          </li>
          <li>
            <a href={SOCIAL.instagram} className="site-footer__link" {...external}>
              <InstagramIcon />
              <span>{CONTACT.instagramLabel}</span>
              {newTab}
            </a>
          </li>
          {FLAGS.SHOW_FACEBOOK ? (
            <li>
              <a href={SOCIAL.facebook} className="site-footer__link" {...external}>
                <FacebookIcon />
                <span>{CONTACT.facebookLabel}</span>
                {newTab}
              </a>
            </li>
          ) : null}
        </ul>

        <div className="site-footer__base">
          <p>{FOOTER.copyright}</p>
          <p>
            {FOOTER.creditPrefix}{" "}
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
    </footer>
  );
}
