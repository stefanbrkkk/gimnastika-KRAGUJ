/**
 * The last beam routine's clock and scroll lines (DECISIONS D-60). Pure: no DOM, no GSAP, so
 * tests/camp-beam.test.ts can pin the choreography. camp-beam.ts builds one paused timeline on
 * this clock and the scroll picks its time: scrolling plays the routine, scrolling back rewinds
 * it, a stopped scroll holds her mid-move.
 */

/*
 * The routine's clock. The units are the old one-shot's seconds, rebalanced for the scroll (the
 * reader sets the tempo now): the flight about a third, landing and balance a quarter, the
 * beam letting go an eighth, the sea and its echoes the last third.
 */
/** The star exposure fades in on the beam at the take-off… */
export const APPEAR = 0.08;
/** …and leaves it just after. */
export const FLY_AT = 0.02;
export const FLIGHT = 0.62;
export const LAND_AT = FLY_AT + FLIGHT;
/** The chronophotograph cut at touchdown: the star gives way to the solid scale. */
export const CUT = 0.05;
/** Stuck landing: the scale compresses on contact and recovers. */
export const SQUASH = 0.22;
/** The beam gives under her landing (down, then back). */
export const GIVE = 0.04;
export const GIVE_BACK = 0.28;
/** She finds her balance (swayEase) about her standing foot… */
export const SWAY_AT = LAND_AT + 0.02;
export const SWAY = 0.5;
/** …and the beam lets go the moment she stands still. */
export const LET_GO = SWAY_AT + SWAY;
/** She sinks through the beam line (power1.in) and fades from FADE_DELAY in, gone as the morph starts. */
export const SINK = 0.24;
export const FADE_DELAY = 0.04;
/** The bar fades and the legs fold within this, before the morph. */
export const FOLD = 0.18;
export const MORPH_AT = LET_GO + SINK;
/** The morph (sine.out) is ~60% formed when the echoes start, so no swell ever crosses a flat line. */
export const MORPH = 0.5;
export const ECHO_AT = MORPH_AT + 0.2;
export const ECHO = 0.4;
export const ECHO_STAGGER = 0.06;
export const TOTAL = ECHO_AT + ECHO_STAGGER + ECHO;

/** The one phase ghost: the star at the apex (share of the flight); it fades in just after she passed it. */
export const GHOST_AT = 0.5;
export const GHOST_LAG = 0.03;
export const GHOST_IN = 0.18;

/**
 * Height of the leap (share of its lift), 0 → 1 → 0, at a share u of the flight. X runs at
 * constant speed, so u is both time and distance; Y alone is eased — the ballistic parabola
 * of the title marks (MD3-04). Used for the lane search, the flight and the ghost.
 */
export const arcAt = (u: number): number => 4 * u * (1 - u);

/** The landing tilt (degrees) she recovers from. */
export const SWAY_TILT = -6;
/** Swings of the balance sway: past upright once, a small correction, still. */
export const SWAY_CYCLES = 1.25;

/**
 * The balance sway as a GSAP ease for the tilt SWAY_TILT → 0 (it replaces the one-shot's
 * elastic.out(1.1, 0.38), whose fast ringing turns into a flicker under a scroll). The tilt is
 * SWAY_TILT × (1 − t)² × cos(2π · 1.25 · t): upright at t = .2, 36% of the tilt the other way at
 * .4, upright at .6, 4% back at .8, and still at 1 — every swing slower and smaller than the
 * last, and no motion left when the beam lets go.
 */
export const swayEase = (t: number): number => 1 - (1 - t) ** 2 * Math.cos(2 * Math.PI * SWAY_CYCLES * t);

/**
 * The beam line's place in the viewport (share of its height from the top) when the routine is
 * over: the sea and its echoes are done with the postcards wholly in view (at 1440×900 the stack
 * top is then ~60 px down; at 0.45 it touched the top edge).
 */
export const END_LINE = 0.5;
/** It starts once the beam stands this far (px) above the bottom edge, or above the phone dock. */
export const START_AIR = 24;
/** The least scroll (px) the routine is ever given: a short viewport (phone landscape) ends it higher up… */
export const MIN_SPAN_PX = 200;
/** …but never above this line (share of the viewport height). */
const TOP_LINE = 0.2;

/**
 * The two lines (shares of the viewport height from its top) the beam line crosses at the
 * routine's first and last moment: from just above the bottom edge (and the phone dock, `cover`
 * px) up to END_LINE. That is 426 px of scroll at 1440×900 and 330 px at 390×844; a phone in
 * landscape (844×390) ends higher up, at 25%, to keep MIN_SPAN_PX.
 */
export function routineLines(vh: number, cover: number): { from: number; to: number } {
  if (vh <= 0) return { from: 1, to: END_LINE };
  const from = (vh - cover - START_AIR) / vh;
  return { from, to: Math.max(TOP_LINE, Math.min(END_LINE, from - MIN_SPAN_PX / vh)) };
}

/**
 * The routine's progress 0…1 with the beam line `beamY` px from the viewport top: linear and
 * clamped, the same map as lib/exercise-scrub.ts scrubProgress (D-52). Not imported from there:
 * the bundler would carry that whole module (the flipbook engine) into this chunk.
 */
export function routineProgress(beamY: number, vh: number, cover: number): number {
  const { from, to } = routineLines(vh, cover);
  const span = (from - to) * vh;
  if (span <= 0) return 1;
  const p = (from * vh - beamY) / span;
  return p < 0 ? 0 : p > 1 ? 1 : p;
}
