import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { BeamScene } from "@/components/notfound/BeamScene";
import { BeamTiltLoader } from "@/components/notfound/BeamTiltLoader";
import { HERO, NOT_FOUND } from "@/content/copy";
import { CLUB, PRIMARY_PHONE } from "@/content/site";
import { telHref } from "@/lib/links";
import { typesetSr } from "@/lib/typeset";

/**
 * The h1, display only (the document title and content/copy.ts keep plain
 * spaces): „ova stranica“ stays on one line, so the rag never cuts the
 * demonstrative from its noun („Ups — / ova stranica / je izgubila / ravnotežu.“).
 */
const TITLE = typesetSr(NOT_FOUND.title).replace("ova stranica", "ova\u00a0stranica");

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
              <BeamScene />
            </div>
            <BeamTiltLoader label={NOT_FOUND.enableTilt} />
          </div>
        </div>
      </div>
    </main>
  );
}
