import { STICKY_BAR } from "@/content/copy";
import { FLAGS, PRIMARY_PHONE } from "@/content/site";
import { smsHref, telHref, viberHref } from "@/lib/links";
import { MessageIcon, PhoneIcon, ScheduleIcon, ViberIcon } from "./icons";
import { HEADER_COPY } from "./header-copy";
import { StickyBarBehavior } from "./StickyBarBehavior";

/**
 * Mobile sticky bottom bar (§5): [Pozovite] [SMS | Viber] [Raspored].
 * 64px + safe-area, mobile only (<1024px). Server-rendered hidden
 * (data-visible="false"); StickyBarBehavior shows it once the hero CTAs have
 * scrolled away and hides it over the S11 contact block, while the keyboard is
 * open and while a form field has focus. Without JS it is always shown on
 * mobile (CSS), so a parent can still call in one tap.
 */
export function StickyBar() {
  const message = FLAGS.SHOW_VIBER
    ? { href: viberHref(PRIMARY_PHONE.e164), label: STICKY_BAR.viber, Icon: ViberIcon }
    : { href: smsHref(PRIMARY_PHONE.e164), label: STICKY_BAR.sms, Icon: MessageIcon };

  return (
    <nav aria-label={HEADER_COPY.stickyLabel} data-sticky-bar="" data-visible="false" data-theme="dark" className="sticky-bar">
      <ul className="sticky-bar__list">
        <li>
          <a href={telHref(PRIMARY_PHONE.e164)} className="sticky-bar__btn sticky-bar__btn--primary">
            <PhoneIcon />
            <span>
              {STICKY_BAR.call}
              <span className="sr-only"> {PRIMARY_PHONE.display}</span>
            </span>
          </a>
        </li>
        <li>
          <a href={message.href} className="sticky-bar__btn">
            <message.Icon />
            <span>
              {message.label}
              <span className="sr-only"> {PRIMARY_PHONE.display}</span>
            </span>
          </a>
        </li>
        <li>
          <a href="#raspored" className="sticky-bar__btn">
            <ScheduleIcon />
            <span>{STICKY_BAR.schedule}</span>
          </a>
        </li>
      </ul>
      <StickyBarBehavior />
    </nav>
  );
}
