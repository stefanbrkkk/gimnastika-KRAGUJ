import { Leap } from "@/components/brand/Logo";
import { CTA, NAV, PRIMARY_PHONE } from "@/content/site";
import { telHref } from "@/lib/links";
import { HEADER_COPY } from "./header-copy";
import { LeapTrail } from "./LeapTrail";

/**
 * Body of the mobile menu sheet — a Server Component passed into the
 * MobileMenu island as children, so none of it ships as client JS.
 * aria-current on the links is set by HeaderBehavior (scroll-spy); the
 * silhouette "lands" on the current section's row.
 */
export function MenuSheetBody() {
  return (
    <>
      <nav aria-label={HEADER_COPY.navLabel} className="menu-sheet__nav">
        <ul className="menu-sheet__list">
          {NAV.map((item, i) => (
            <li key={item.href} className="menu-sheet__item" style={{ ["--i" as string]: i }}>
              <a href={item.href} className="menu-sheet__link" data-nav-link="">
                <span>{item.label}</span>
                <Leap className="menu-sheet__here" />
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="menu-sheet__actions menu-sheet__item" style={{ ["--i" as string]: NAV.length }}>
        <a href="#kontakt" data-booking="" className="btn btn-primary">
          {CTA.trial}
        </a>
        <a href={telHref(PRIMARY_PHONE.e164)} className="btn btn-secondary">
          {`${CTA.call} ${PRIMARY_PHONE.display}`}
        </a>
      </div>

      <LeapTrail className="menu-sheet__trail" />
    </>
  );
}
