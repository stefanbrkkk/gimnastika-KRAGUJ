/**
 * The 404 gymnast's sway, kept free of the pose data so the lazy tilt chunk (BeamTiltMotion)
 * stays a few hundred bytes: scene.ts places the pose, this only rotates it.
 *
 * The ankle (pose units of POSES.scale): the centre of the support leg where it meets the foot
 * (the leg spans x 100–108 down to y 148; below it the instep widens toward the toe). Every
 * sway rotates the body about it; the foot stays on the beam.
 */
export const ANKLE = { x: 104, y: 148 } as const;

const r2 = (v: number) => Math.round(v * 100) / 100;
/** The body's sway (deg, clockwise positive) about the ankle, in the pose's own units. */
export const swayAt = (deg: number): string => `rotate(${r2(deg)} ${ANKLE.x} ${ANKLE.y})`;
