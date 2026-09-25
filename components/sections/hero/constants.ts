/**
 * Hero constants shared by the server composition (Hero.tsx, pass.ts) and the
 * lazily loaded motion layer (HeroMotion.tsx). No gsap here. The floor pass's
 * timing and rig live in pass.ts.
 */

/** Share image only (geometry.ts): the OG still's ghost frames, as MotionPath progress. */
export const GHOST_P = [0.08, 0.15, 0.22, 0.29, 0.36, 0.45] as const;

/** Leotard-gradient stops, stepped: #cfe6ff → #c9b8ff → #8e78f0 (two frames each). */
export const GHOST_COLOR = [
  "var(--color-iceblue-200)",
  "var(--color-iceblue-200)",
  "var(--color-lav-200)",
  "var(--color-lav-200)",
  "var(--color-violet-500)",
  "var(--color-violet-500)",
] as const;

/** Opacity .10 → .28 across the six frames (older frames fainter). */
export const GHOST_OPACITY = [0.1, 0.136, 0.172, 0.208, 0.244, 0.28] as const;

/** Share image only (geometry.ts): MotionPath alignOrigin of the silhouette box. */
export const ALIGN_ORIGIN: [number, number] = [0.5, 0.6];

/** The silhouette box (= the #leap symbol viewBox size, logo units). */
export const LEAP_BOX = { width: 230, height: 150 } as const;

/** Where the #leap symbol sits inside the full logo (viewBox 0 0 490 213). */
export const LEAP_IN_LOGO = { x: 262, y: 48 } as const;
