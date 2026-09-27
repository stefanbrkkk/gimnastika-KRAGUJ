import type { ApparatusIcon } from "@/content/programs";
import { PROGRAM_POSES, posePlacement, poseTransform } from "./pose-scene";

/**
 * Apparatus drawings for this site (viewBox 48, round strokes; design review QP-05).
 * Every apparatus stands on the same floor, y = 42, which the plate's mat line runs through.
 *   parter  — the competition floor in perspective: carpet edge, the thin boundary line inside
 *             it and the corner-to-corner diagonal of a tumbling pass (the page's floor spine)
 *   greda   — the beam on two splayed legs with foot plates
 *   razboj  — uneven bars: a low and a high rail (heavier strokes) crossing on slim uprights
 *   preskok — run-up dashes, the springboard wedge and the vault table
 *   aerobik — no apparatus: the high-kick pose standing on the mat line is the drawing
 * Each program's gymnast is its own pose of the figure family on its apparatus (plan §5.4,
 * ./pose-scene): star over the floor, cartwheel on the beam, handstand on the high rail,
 * handspring on the vault table, high kick on the mat — the end of her exercise (D-53,
 * ./program-exercises), which the card scrubs with the scroll and the sheet plays as it opens.
 *
 * Structure (styles/sections/programs.css; quiz/views.ts iconArt reads it, keep it stable):
 * - `.pi-latent`: a faint static print of the whole scene (QP-14) — the apparatus paths and the
 *   pose as one filled `.pi-solid` path (with its placement transform) — so a plate is never
 *   empty while its draw waits. Shown only while motion is on. Paths only: the quiz plates read
 *   it (never the exercise: its ghosts live in the pose figure below, not here).
 * - `.pi-part[data-part]`: the drawing, split into its pieces; each stroked path has
 *   pathLength=1 and draws with stroke-dashoffset.
 * - `.pi-pose > svg[data-figure="pose:<id>"]` (card and sheet only): the gymnast. The nested
 *   <svg> is the figure (qa/figures.mjs counts one per such svg, her ghosts included), with
 *   overflow visible, because the exercise's earlier frames reach outside the pose's box. It
 *   holds the exercise's static print (lib/exercise-scrub.ts contract): the ghost frames
 *   (`.ex-ghost`, data-frame, oldest first) and the final pose (`.ex-solid`). The frames between
 *   them come only from the lazy chunk (./program-exercises); on a card the whole scene scales
 *   with its plate (QP3-02).
 * Without motion (no JS, reduced motion, Save-Data) it is simply the finished scene: the
 * apparatus, every ghost frame and the pose.
 */

type Stroke = "base" | "thin" | "rail" | "post";
interface Segment {
  d: string;
  kind?: Stroke;
}
interface Part {
  part: string;
  paths: readonly Segment[];
}
interface IconSpec {
  parts: readonly Part[];
}

const SPECS: Record<ApparatusIcon, IconSpec> = {
  parter: {
    parts: [
      {
        part: "mat",
        paths: [{ d: "M1.5 42L13 22H46.5L35 42Z" }, { d: "M7 38.8L14.8 25.2H40.9L33.1 38.8Z", kind: "thin" }],
      },
      { part: "diag", paths: [{ d: "M7 38.8L40.9 25.2" }] },
    ],
  },
  greda: {
    parts: [
      {
        part: "beam",
        paths: [{ d: "M5 21.5H43A1.5 1.5 0 0 1 44.5 23V24A1.5 1.5 0 0 1 43 25.5H5A1.5 1.5 0 0 1 3.5 24V23A1.5 1.5 0 0 1 5 21.5Z" }],
      },
      { part: "legs", paths: [{ d: "M12 25.5L10.5 42M36 25.5L37.5 42M6 42H15M33 42H42" }] },
    ],
  },
  razboj: {
    parts: [
      {
        part: "low",
        paths: [
          { d: "M1.5 27.5H29.5", kind: "rail" },
          { d: "M5.5 27.5V42M22.5 27.5V42M2.5 42H8.5M19.5 42H25.5", kind: "post" },
        ],
      },
      {
        part: "high",
        paths: [
          { d: "M14.5 11.5H46.5", kind: "rail" },
          { d: "M27.5 11.5V42M43 11.5V42M25.5 42H30.5M40 42H46", kind: "post" },
        ],
      },
    ],
  },
  preskok: {
    parts: [
      { part: "run", paths: [{ d: "M1 42H3.5M6 42H8.5" }] },
      { part: "board", paths: [{ d: "M11 42L20.5 37.5V42Z" }] },
      {
        part: "table",
        paths: [
          { d: "M25.5 17C25.5 15.3 26.8 14 28.5 14H44C45.7 14 47 15.3 47 17S45.7 20.5 44 20.5H28.5C26.8 20.5 25.5 18.7 25.5 17Z" },
          { d: "M33 20.5L34.5 35.5M40 20.5L38.5 35.5M30 35.5H43L45 42H28Z" },
        ],
      },
    ],
  },
  aerobik: { parts: [] },
};

const kindClass = (kind: Stroke | undefined) => (kind && kind !== "base" ? `pi-${kind}` : undefined);

/** The static print of the program's exercise (./program-exercises exercisePrint): its ghost
 *  frames, oldest first. The frame index rides along as data-frame for the scrub. */
export interface ExercisePrint {
  readonly ghosts: readonly { readonly frame: number; readonly d: string }[];
}

interface ProgramIconProps {
  icon: ApparatusIcon;
  /** Accessible name (content/programs.ts iconLabel). */
  label: string;
  className?: string;
  /**
   * The scene: the program's pose on its apparatus, with its exercise's ghost frames (`exercise`).
   * "card": every plate (QP3-02); "sheet": the detail sheet's plate. Without it: the bare
   * apparatus with its latent print (the quiz reads that print, never a scene).
   */
  scene?: "card" | "sheet";
  exercise?: ExercisePrint;
}

/** The program's pose, placed on its apparatus: its own <svg data-figure="pose:<id>">, holding
 *  the exercise's ghost frames and the final pose (the scrub's .ex-ghost / .ex-solid). */
function PoseFigure({ icon, exercise }: { icon: ApparatusIcon; exercise?: ExercisePrint }) {
  const p = posePlacement(icon);
  const { d, viewBox: vb } = PROGRAM_POSES[p.id];
  return (
    <g className="pi-pose">
      <svg
        data-figure={`pose:${p.id}`}
        x={p.box.x}
        y={p.box.y}
        width={p.box.width}
        height={p.box.height}
        viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
        overflow="visible"
        aria-hidden="true"
        focusable="false"
      >
        {exercise?.ghosts.map((g) => (
          <path key={g.frame} className="ex-ghost" data-frame={g.frame} d={g.d} />
        ))}
        <path className="ex-solid" d={d} />
      </svg>
    </g>
  );
}

export function ProgramIcon({ icon, label, className, scene, exercise }: ProgramIconProps) {
  const spec = SPECS[icon];
  const pose = posePlacement(icon);
  return (
    <svg
      className={["pi", className].filter(Boolean).join(" ")}
      viewBox="0 0 48 48"
      role="img"
      aria-label={label}
      focusable="false"
      data-icon={icon}
    >
      <g className="pi-latent">
        {spec.parts.map((p) => p.paths.map((s) => <path key={`${p.part}${s.d}`} d={s.d} className={kindClass(s.kind)} />))}
        <path d={PROGRAM_POSES[pose.id].d} className="pi-solid" transform={poseTransform(pose)} data-pose={pose.id} />
      </g>
      {spec.parts.map((p) => (
        <g key={p.part} className="pi-part" data-part={p.part}>
          {p.paths.map((s) => (
            <path key={s.d} d={s.d} className={kindClass(s.kind)} pathLength={1} data-draw="" />
          ))}
        </g>
      ))}
      {scene ? <PoseFigure icon={icon} exercise={exercise} /> : null}
    </svg>
  );
}
