import type { PoseId } from "@/components/brand/poses.generated";

/**
 * A scroll-scrubbed exercise (a flipbook): the frames of ONE continuous movement that ends exactly
 * in an approved pose. Generated per exercise into ./<id>.generated.ts by scripts/exercises.mjs
 * from assets-source/exercises/<id>.json (authored by tools/figure-rig/exercises.py).
 *
 * Coordinates: every frame is in the final pose's own viewBox units (POSES[pose].viewBox), so the
 * frames can be drawn in that pose's nested <svg overflow="visible"> without changing its
 * placement. Earlier frames may lie outside the box (a run-up, a start further along the beam).
 */
export interface ExerciseData {
  /** The approved pose the movement ends in; the last frame is exactly POSES[pose].d. */
  readonly pose: PoseId;
  /** Path data per frame (one filled path of closed subpaths each), in movement order. */
  readonly frames: readonly string[];
  /** Frame indexes of the key phases, ascending; the last key is the last frame. */
  readonly keys: readonly number[];
  /** Frame indexes left behind as faint afterimages (chronophotograph ghosts), oldest first. */
  readonly ghosts: readonly number[];
  /**
   * Per key, where that key pose's own viewBox origin lies in the exercise's coordinates (only
   * where the keys are approved poses a scene spreads apart, e.g. the enrollment band): key k's
   * frame is POSES[keyPose].d translated by keyOrigins[k].
   */
  readonly keyOrigins?: readonly (readonly [number, number])[];
  /** [minX, minY, maxX, maxY] over all frames. */
  readonly bounds: readonly [number, number, number, number];
}
