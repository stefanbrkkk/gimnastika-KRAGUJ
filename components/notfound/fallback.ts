/**
 * Copy of the Serbian error screen (app/global-error.tsx). The boundary is a
 * client reference in the root tree, so this module ships on every page: it
 * must stay tiny and dependency-free — no content/* module graph in the 404's or
 * the home page's first load.
 */

/** Mechanical UI strings, not in the master prompt (DECISIONS.md „UI strings that are not in the master prompt“). */
export const ERROR_COPY = {
  title: "Stranica se nije učitala.",
  lead: "Došlo je do greške. Osvežite stranicu — ako se greška ponovi, pozovite nas.",
  reload: "Osvežite stranicu",
} as const;

/**
 * Facts mirrored from content/*.ts for the reason above; tests/seo.test.ts
 * asserts they are identical to CLUB.brandName, HERO.ctaSecondary and
 * telHref(PRIMARY_PHONE.e164), so they can never drift.
 */
export const FALLBACK_FACTS = {
  brandName: "Gimnastički klub Kraguj",
  call: "Pozovite 060 028 7631",
  tel: "tel:+381600287631",
} as const;
