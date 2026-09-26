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
/**
 * Largest counter-rotation shown (deg). She sways whole, about the ankle of her support foot
 * (scene.ts), so her arms travel far: beyond 18° she leans with the beam instead, and her
 * forward arm stays clear of the judges' board at 320px.
 */
export const MAX_TILT = 18;

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
// Balance dynamics: an under-damped spring (she wobbles at the ankle, then holds),
// optionally with lagging followers (lags; the 404 scale pose has none).
// ---------------------------------------------------------------------------

export interface Balance {
  angle: number;
  velocity: number;
  /** Follower angles, each chasing the previous one (0 chases the figure). */
  lags: number[];
}

/**
 * ζ ≈ 0.35: a real catch on the beam — one clear lean, a counter-sway, a small
 * correction, still (design review C-17: the old ζ ≈ 0.47 and a −60 °/s push swayed
 * ~3° and read as a still image).
 */
export const SPRING = { stiffness: 100, damping: 7, lagTau: 0.07 } as const;
/**
 * Initial push (deg/s) for the one-shot "catch the balance" wobble on load:
 * ≈ 14° first lean, then ≈ 4° and ≈ 1° the other way; visibly still after ≈ 1.4 s.
 */
export const SETTLE_KICK = -250;
/** When the load catch is over (ms after the push): the judges post the score (4.04). */
export const SCORE_POST_MS = 900;

/** Largest lean (deg) the desktop pointer can ask for — less than the phone's MAX_TILT. */
export const POINTER_TILT = 12;

/**
 * Desktop (fine pointer) balance: the pointer's horizontal offset from the
 * scene's centre, as a share of the scene width, tilts her toward it
 * (±POINTER_TILT at ±40% of the width). Missing geometry → upright.
 */
export function pointerTarget(clientX: number, stageLeft: number, stageWidth: number): number {
  if (!(stageWidth > 0) || !Number.isFinite(clientX)) return 0;
  const t = ((clientX - (stageLeft + stageWidth / 2)) / stageWidth) * 30;
  return Math.max(-POINTER_TILT, Math.min(POINTER_TILT, t));
}

export const createBalance = (followers: number, velocity = 0): Balance => ({ angle: 0, velocity, lags: Array.from({ length: followers }, () => 0) });

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
