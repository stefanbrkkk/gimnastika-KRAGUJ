/**
 * 404 „Ravnoteža na gredi“ — pure math for the tilt island (no DOM, no React).
 *
 * The gymnast keeps her balance against REAL gravity: when the phone rolls, the
 * beam (fixed to the screen) tilts with it and she counter-rotates on screen.
 * Gravity in device coordinates from DeviceOrientation (Z-X'-Y'' Tait–Bryan):
 *   down = (cos β · sin γ, −sin β, −cos β · cos γ)
 * Its projection on the screen plane gives the angle of "true down", measured
 * from screen-down toward screen-right; alpha does not matter.
 */

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** Below this share of g on the screen plane the phone lies ~flat: no meaningful "down". */
export const FLAT_THRESHOLD = 0.35;
/** Largest counter-rotation shown (deg). */
export const MAX_TILT = 24;

export const normalizeDeg = (deg: number): number => {
  const d = (((deg + 180) % 360) + 360) % 360 - 180;
  return d === -180 ? 180 : d;
};

/**
 * Angle (deg) of true "down" on the screen, counter-clockwise from screen-down
 * toward screen-right, for the current screen orientation (0 / 90 / 180 / 270,
 * as screen.orientation.angle or window.orientation). null when unknown or flat.
 */
export function gravityAngle(beta: number | null | undefined, gamma: number | null | undefined, screenAngle = 0): number | null {
  if (beta == null || gamma == null || !Number.isFinite(beta) || !Number.isFinite(gamma)) return null;
  const b = beta * D2R;
  const g = gamma * D2R;
  const x = Math.cos(b) * Math.sin(g); // toward the device's right edge
  const y = Math.sin(b); // toward the device's bottom edge
  if (Math.hypot(x, y) < FLAT_THRESHOLD) return null;
  return normalizeDeg(Math.atan2(x, y) * R2D + screenAngle);
}

/** On-screen rotation (SVG rotate(), clockwise positive) that keeps the figure upright in the world. */
export function balanceTarget(down: number | null): number {
  if (down == null) return 0;
  return Math.max(-MAX_TILT, Math.min(MAX_TILT, -down));
}

// ---------------------------------------------------------------------------
// Balance dynamics: an under-damped spring (she wobbles, then holds) and three
// lagging ghost frames (the chronophotograph trail of the wobble).
// ---------------------------------------------------------------------------

export interface Balance {
  angle: number;
  velocity: number;
  /** Ghost angles, each chasing the previous one (0 chases the figure). */
  lags: number[];
}

export const SPRING = { stiffness: 90, damping: 9, lagTau: 0.07 } as const;
/** Initial push (deg/s) for the one-shot "catch the balance" wobble on load. */
export const SETTLE_KICK = -60;

export const createBalance = (ghosts: number, velocity = 0): Balance => ({ angle: 0, velocity, lags: Array.from({ length: ghosts }, () => 0) });

/** Advances the balance by dt seconds (semi-implicit Euler; dt is clamped to 1/30 s). */
export function stepBalance(s: Balance, target: number, dt: number): Balance {
  const h = Math.min(Math.max(dt, 0), 1 / 30);
  const accel = SPRING.stiffness * (target - s.angle) - SPRING.damping * s.velocity;
  const velocity = s.velocity + accel * h;
  const angle = s.angle + velocity * h;
  const k = 1 - Math.exp(-h / SPRING.lagTau);
  const lags: number[] = [];
  s.lags.forEach((lag, i) => {
    const lead = i === 0 ? angle : lags[i - 1]!;
    lags.push(lag + (lead - lag) * k);
  });
  return { angle, velocity, lags };
}

export function isSettled(s: Balance, target: number, eps = 0.05): boolean {
  return Math.abs(s.angle - target) < eps && Math.abs(s.velocity) < eps && s.lags.every((l) => Math.abs(l - s.angle) < eps);
}
