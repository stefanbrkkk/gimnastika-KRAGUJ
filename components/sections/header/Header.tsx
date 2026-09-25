import { Logo } from "@/components/brand/Logo";
import { CTA, NAV } from "@/content/site";
import { typesetSr } from "@/lib/typeset";
import { HEADER_COPY } from "./header-copy";
import { HeaderBehavior } from "./HeaderBehavior";
import { MenuSheetBody } from "./MenuSheetBody";
import { MobileMenu } from "./MobileMenu";

/**
 * Floating header (§5 HEADER). A solid inset bar — never glass/blur.
 * Server-rendered in its final state (visible, dark tone for the hero under it);
 * HeaderBehavior toggles data-hidden / data-theme after hydration.
 * ≥1024px: logo · links · CTA pill. <1024px: logo · (CTA from 640px) · menu sheet.
 */
export function Header() {
  return (
    <header data-site-header="" data-hidden="false" data-theme="dark" className="site-header">
      <div className="site-header__bar" data-header-bar="">
        <a href="#top" className="site-header__logo">
          <Logo className="site-header__logo-svg" />
        </a>

        <nav aria-label={HEADER_COPY.navLabel} className="site-header__nav">
          <ul className="site-header__list">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="site-header__link" data-nav-link="">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-header__actions">
          <a href="#kontakt" data-booking="" className="btn btn-primary site-header__cta">
            {typesetSr(CTA.trial)}
          </a>
          <MobileMenu logo={<Logo className="menu-sheet__logo" title={null} />}>
            <MenuSheetBody />
          </MobileMenu>
        </div>
      </div>
      <HeaderBehavior />
    </header>
  );
}
