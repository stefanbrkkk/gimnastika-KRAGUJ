/**
 * Hero constants shared by the server composition (Hero.tsx, pass.ts) and the
 * lazily loaded motion layer (HeroMotion.tsx). No gsap here. The floor pass's
 * timing and rig live in pass.ts.
 */

/** Share image only (geometry.ts): the OG still's ghost frames, as MotionPath progress. */
export const GHOST_P = [0.08, 0.15, 0.22, 0.29, 0.36, 0.45] as const;

/** Leotard-gradient stops, stepped: #cfe6ff → #c9b8ff → #8e78f0 (a third of the frames each). */
const GHOST_STEPS = ["var(--color-iceblue-200)", "var(--color-lav-200)", "var(--color-violet-500)"] as const;

/**
 * Colour of ghost frame i of n (oldest first): the wide plate's six frames
 * step two by two; the phones' five frames 2 · 1 · 2.
 */
export const ghostColor = (i: number, n: number): string => GHOST_STEPS[Math.min(2, Math.floor((3 * i) / Math.max(1, n - 1)))]!;

/** Opacity .10 → .28 across the frames (older frames fainter), whatever their number. */
export const ghostOpacity = (i: number, n: number): number => Math.round((0.1 + (0.18 * i) / Math.max(1, n - 1)) * 1000) / 1000;

/** Share image only (geometry.ts): MotionPath alignOrigin of the silhouette box. */
export const ALIGN_ORIGIN: [number, number] = [0.5, 0.6];

/** The silhouette box (= the #leap symbol viewBox size, logo units). */
export const LEAP_BOX = { width: 230, height: 150 } as const;

/** Where the #leap symbol sits inside the full logo (viewBox 0 0 490 213). */
export const LEAP_IN_LOGO = { x: 262, y: 48 } as const;
