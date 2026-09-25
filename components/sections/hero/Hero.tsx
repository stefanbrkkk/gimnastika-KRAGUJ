import { Fragment } from "react";
import { HERO } from "@/content/copy";
import { PRIMARY_PHONE } from "@/content/site";
import { telHref } from "@/lib/links";
import { typesetSr } from "@/lib/typeset";
import { HeroArt } from "./HeroArt";
import { HeroMotionLoader } from "./HeroMotionLoader";
import { COMPACT, WIDE } from "./pass";

/**
 * Eyebrow typesetting (display only — content/copy.ts and the OG image keep the
 * plain string): each „ · “ separator is glued to the text before it with a
 * no-break space, so a separator never starts a line, and the eyebrow wraps
 * only between its segments (nowrap per segment, styles/sections/hero.css).
 * The first, long segment may still wrap between its words on phones, where
 * it cannot fit on one line.
 */
const EYEBROW_SEGMENTS = HERO.eyebrow
  .split(" · ")
  .map((segment, i, all) => typesetSr(i < all.length - 1 ? `${segment}\u00a0·` : segment));

/**
 * The H1 (display only): the one-letter preposition is glued to its word, so
 * the 144px headline never ends a line on „u“ („za decu / u Kragujevcu“).
 * The document title, meta and OG image keep the plain string.
 */
const TITLE = typesetSr(HERO.h1);

/**
 * Serbian typesetting of the subline (display only, no-break spaces, lib/typeset):
 * a dash never starts a line, a one-letter word („i“, „u“, „s“ …) never ends
 * one, and a number stays with both neighbours („od 3. godine“).
 */
const SUB = typesetSr(HERO.sub).replace(/(\S) (\d+\.?)\u00a0/g, "$1\u00a0$2\u00a0");

/**
 * S1 HERO — the signature moment (§4, §5 S1). Server-rendered FINAL composition:
 * complete and beautiful without JS. The decorative layer ([data-hero-decor]) is
 * hidden only under html.js-motion until the motion layer sets data-hero-ready
 * in the same frame it puts the intro's t=0 state; H1, sub, CTAs and trust strip
 * are never hidden (the H1 is the LCP element).
 */
export function Hero() {
  return (
    <section id="top" data-theme="dark" aria-labelledby="hero-title" className="hero">
      <div className="hero__inner container-site">
        <div className="hero__art" data-hero-decor="" aria-hidden="true">
          <HeroArt variant={COMPACT} name="compact" />
          <HeroArt variant={WIDE} name="wide" />
          {/* The mat line (the floor): viewport-left → container-right, 1.5px steel-300 @60%.
              The second path is the floor giving under the landing (drawn only during the intro). */}
          <svg className="hero-mat" viewBox="0 0 100 4" preserveAspectRatio="none" focusable="false">
            <path d="M0 2H100" pathLength={1} data-hero-mat="" />
            <path className="hero-mat__flex" d="M0 2H0" data-hero-flex="" />
          </svg>
        </div>

        <p className="hero__eyebrow label-caps">
          {EYEBROW_SEGMENTS.map((segment, i) => (
            <Fragment key={segment}>
              {i > 0 ? " " : null}
              <span className="hero__eyebrow-seg">{segment}</span>
            </Fragment>
          ))}
        </p>
        <h1 id="hero-title" className="hero__title text-display-xl">
          {TITLE}
        </h1>

        <div className="hero__aside">
          <p className="hero__sub">{SUB}</p>
          <div className="hero__ctas" data-hero-ctas="">
            <a href="#kontakt" data-booking="" className="btn btn-primary">
              {typesetSr(HERO.ctaPrimary)}
            </a>
            <a href={telHref(PRIMARY_PHONE.e164)} className="btn btn-secondary">
              {typesetSr(HERO.ctaSecondary)}
            </a>
          </div>
          <ul className="hero__trust">
            {HERO.trust.map((item) => (
              <li key={item}>
                <svg className="hero__tick ui-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M3 8.6 6.4 12 13 4.5" />
                </svg>
                {typesetSr(item)}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <HeroMotionLoader />
    </section>
  );
}
