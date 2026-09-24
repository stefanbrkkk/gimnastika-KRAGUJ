import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { BeamScene } from "@/components/notfound/BeamScene";
import { BeamTiltLoader } from "@/components/notfound/BeamTiltLoader";
import { HERO, NOT_FOUND } from "@/content/copy";
import { CLUB, PRIMARY_PHONE } from "@/content/site";
import { telHref } from "@/lib/links";

/**
 * Custom 404 „Ravnoteža na gredi“ (§4) → out/404.html. Renders inside the root
 * layout (lang, skip link → #sadrzaj, sprite) but none of the home sections.
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
            <p className="nf__code label-caps tabular">
              <span aria-hidden="true">▸ </span>KR-404
            </p>
            <h1 className="nf__title">{NOT_FOUND.title}</h1>
            <div className="nf__actions">
              <Link className="btn btn-primary" href="/">
                {NOT_FOUND.cta}
              </Link>
              <a className="btn btn-secondary" href={telHref(PRIMARY_PHONE.e164)}>
                {HERO.ctaSecondary}
              </a>
            </div>
          </div>
          <div className="nf__stage-wrap" data-nf-stage="">
            <div className="nf__stage">
              <BeamScene />
            </div>
            <BeamTiltLoader label={NOT_FOUND.enableTilt} />
          </div>
        </div>
      </div>
    </main>
  );
}
