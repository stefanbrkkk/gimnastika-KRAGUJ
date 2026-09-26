import type { CSSProperties } from "react";
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
 * handspring on the vault table, high kick on the mat.
 *
 * Structure (styles/sections/programs.css; quiz/views.ts iconArt reads it, keep it stable):
 * - `.pi-latent`: a faint static print of the whole scene (QP-14) — the apparatus paths and the
 *   pose as one filled `.pi-solid` path (with its placement transform) — so a plate is never
 *   empty while its draw waits. Shown only while motion is on. Paths only: the quiz plates read it.
 * - `.pi-part[data-part]`: the drawing, split into the pieces that "perform" (MD-06): each stroked
 *   path has pathLength=1 and draws with stroke-dashoffset; a part moves as one (beam flex, rails
 *   flex, springboard compression, floor give).
 * - `.pi-fx`: the gymnast's path into her pose (the swing up to the handstand, the vault's
 *   pre-flight, the tumbling hops), only in the detail sheet (QP2-11); invisible at rest.
 * - `.pi-pose > .pi-ride > .pi-stick > svg[data-figure="pose:<id>"]`: the pose (sheet and card:
 *   always). The mount drops `.pi-pose` in, a perform moves `.pi-ride` with the apparatus it
 *   holds, the landing squash scales `.pi-stick` about the contact (--at). The nested <svg> is
 *   the figure (qa/figures.mjs counts one per such svg); on a card the whole scene scales with
 *   its plate (QP3-02).
 * Without motion (no JS, reduced motion, Save-Data) it is simply the finished scene.
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
  fx?: readonly string[];
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
    // Three hops of a tumbling pass along the diagonal, into the star jump over the floor.
    fx: ["M9.7 37.7Q14.5 17.8 19.2 33.9", "M19.2 33.9Q24 14 28.7 30.1", "M28.7 30.1Q33.5 10.2 38.2 26.3"],
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
    // The swing up into the handstand: her hips' half-circle about the high rail.
    fx: ["M35.5 27.5A16 16 0 0 0 35.5 -4.5"],
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
    // Pre-flight from the springboard onto the table, where her hands take it.
    fx: ["M20 37Q24 18 33.5 13.5"],
  },
  aerobik: { parts: [] },
};

const kindClass = (kind: Stroke | undefined) => (kind && kind !== "base" ? `pi-${kind}` : undefined);

interface ProgramIconProps {
  icon: ApparatusIcon;
  /** Accessible name (content/programs.ts iconLabel). */
  label: string;
  className?: string;
  /**
   * The scene: the program's pose on its apparatus. "card": the pose (every plate, QP3-02);
   * "sheet": the pose and the gymnast's path into it (.pi-fx). Without it: the bare apparatus
   * with its latent print (the quiz reads that print, never a scene).
   */
  scene?: "card" | "sheet";
}

type Vars = CSSProperties & Record<`--${string}`, string>;

/** The program's pose, placed on its apparatus: its own <svg data-figure="pose:<id>">. */
function PoseFigure({ icon }: { icon: ApparatusIcon }) {
  const p = posePlacement(icon);
  const { d, viewBox: vb } = PROGRAM_POSES[p.id];
  const [ax, ay] = p.at;
  return (
    <g className="pi-pose" style={{ "--at": `${ax}px ${ay}px` } as Vars}>
      <g className="pi-ride">
        <g className="pi-stick">
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
            <path d={d} />
          </svg>
        </g>
      </g>
    </g>
  );
}

export function ProgramIcon({ icon, label, className, scene }: ProgramIconProps) {
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
      {scene === "sheet" && spec.fx ? (
        <g className="pi-fx">
          {spec.fx.map((d, k) => (
            <path key={d} d={d} pathLength={1} style={{ "--k": k } as CSSProperties} />
          ))}
        </g>
      ) : null}
      {scene ? <PoseFigure icon={icon} /> : null}
    </svg>
  );
}
