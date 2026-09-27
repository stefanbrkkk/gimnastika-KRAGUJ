/**
 * Each program's exercise (DECISIONS D-53): the full flipbook of the movement that ends in the
 * program's pose on its apparatus (components/brand/exercises, authored in tools/figure-rig):
 *   parter  — starJump: stand on the carpet, plié, rise into the star at its apex
 *   greda   — beamCartwheel: cart1's stance at the beam's far end, reach, wheel into the cartwheel
 *   razboj  — barCast: front support on the high rail, pike, cast into the handstand
 *   preskok — vaultHandspring: run-up, hurdle, board, pre-flight, hands on the table, handspring
 *   aerobik — aerobicKick: stand, tendu, straight-leg kick into the high kick
 * Every frame is in the final pose's own units, so it draws in the pose's nested <svg> without
 * moving it (ProgramIcon), and the last frame is the pose.
 *
 * Bundle rule: the frames reach the client ONLY through a dynamic import() of this module — its
 * own lazy chunk, fetched by programs-motion when the card scrub arms and by the detail sheet
 * when it plays the exercise. The server (ProgramCard) imports it for the static print: the
 * ghost frames and the final pose, which is all the HTML carries. Client code never imports it
 * statically (tests/programs.test.ts walks the import graph). Keep it data only: whatever it
 * imports ships in that chunk (the headroom and placement checks live in pose-scene and the tests).
 */
import type { ExerciseData } from "@/components/brand/exercises/types";
import { EXERCISE_AEROBIC_KICK } from "@/components/brand/exercises/aerobicKick.generated";
import { EXERCISE_BAR_CAST } from "@/components/brand/exercises/barCast.generated";
import { EXERCISE_BEAM_CARTWHEEL } from "@/components/brand/exercises/beamCartwheel.generated";
import { EXERCISE_STAR_JUMP } from "@/components/brand/exercises/starJump.generated";
import { EXERCISE_VAULT_HANDSPRING } from "@/components/brand/exercises/vaultHandspring.generated";
import type { ApparatusIcon } from "@/content/programs";
import type { ExercisePrint } from "./ProgramIcon";

export const PROGRAM_EXERCISES: Readonly<Record<ApparatusIcon, ExerciseData>> = {
  parter: EXERCISE_STAR_JUMP,
  greda: EXERCISE_BEAM_CARTWHEEL,
  razboj: EXERCISE_BAR_CAST,
  preskok: EXERCISE_VAULT_HANDSPRING,
  aerobik: EXERCISE_AEROBIC_KICK,
};

/** The static print of a program's exercise: its ghost frames, oldest first (the final pose is
 *  the pose itself). The finished exercise, as the page shows it without motion. */
export const exercisePrint = (icon: ApparatusIcon): ExercisePrint => {
  const { frames, ghosts } = PROGRAM_EXERCISES[icon];
  return { ghosts: ghosts.map((frame) => ({ frame, d: frames[frame]! })) };
};
