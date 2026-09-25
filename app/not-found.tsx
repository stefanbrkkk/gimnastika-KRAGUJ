import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { Logo } from "@/components/brand/Logo";
import { BeamScene, ScorePlate } from "@/components/notfound/BeamScene";
import { BeamTiltLoader } from "@/components/notfound/BeamTiltLoader";
import { titlePhrases } from "@/components/notfound/title";
import { HERO, NOT_FOUND } from "@/content/copy";
import { CLUB, PRIMARY_PHONE } from "@/content/site";
import { telHref } from "@/lib/links";
import { typesetSr } from "@/lib/typeset";

/**
 * The h1, display only (the document title and content/copy.ts keep plain spaces):
 * four phrases with a toggled <br> before each of the last three (components/notfound/
 * title.ts), so its lines do not depend on which font has loaded. If the copy ever
 * stops matching the phrases, the plain typeset sentence („ova stranica“ kept whole).
 */
const PHRASES = titlePhrases(NOT_FOUND.title);
const TITLE = PHRASES
  ? PHRASES.map((phrase, i) => (
      <Fragment key={phrase}>
        {i > 0 ? (
          <>
            {" "}
            <br className={`nf__br nf__br--${i}`} />
          </>
        ) : null}
        {phrase}
      </Fragment>
    ))
  : typesetSr(NOT_FOUND.title).replace("ova stranica", "ova\u00a0stranica");

/**
 * Custom 404 „Ravnoteža na gredi“ (§4) → out/404.html. Renders inside the root
 * layout (lang, skip link → #sadrzaj, sprite) but none of the home sections.
 * The beam scene stands on a page-wide gym floor (a mat line over a darker floor
 * plane that runs to the bottom of the page); the judges' board posts 4.04.
 * Next adds <meta name="robots" content="noindex"> itself; the canonical is
 * dropped so a missing URL never claims to be the home page.
 */
export const metadata: Metadata = {
  title: `${NOT_FOUND.title.replace(/\.$/, "")} | ${CLUB.brandName}`,
  robots: { index: false, follow: true },
  alternates: { canonical: null },
};

export default function NotFound() {
  return (
    <main id="sadrzaj" tabIndex={-1} className="nf" data-theme="dark">
      <div className="container-site nf__inner">
        <Link className="nf__brand" href="/">
          <Logo className="nf__logo" />
        </Link>
        <div className="nf__body">
          <div className="nf__copy">
            <h1 className="nf__title">{TITLE}</h1>
            <div className="nf__actions">
              <Link className="btn btn-primary" href="/">
                {typesetSr(NOT_FOUND.cta)}
              </Link>
              <a className="btn btn-secondary" href={telHref(PRIMARY_PHONE.e164)}>
                {typesetSr(HERO.ctaSecondary)}
              </a>
            </div>
          </div>
          <div className="nf__stage-wrap" data-nf-stage="">
            <div className="nf__stage">
              <ScorePlate />
              <BeamScene />
            </div>
            {/* Under the floor, one row: the contact-sheet frame code (like the photos' frame
                labels) and, on iOS, the motion-sensor button right-aligned beside it. */}
            <div className="nf__foot">
              <p className="nf__frame frame-label" aria-hidden="true">
                KR-404
              </p>
              <BeamTiltLoader label={NOT_FOUND.enableTilt} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
