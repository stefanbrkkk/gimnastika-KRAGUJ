import type { CSSProperties } from "react";
import type { ApparatusIcon } from "@/content/programs";
import { LEAP_ICON_BOX, LEAP_ICON_D } from "./leap-icon";

/**
 * Apparatus drawings for this site (viewBox 48, round strokes; design review QP-05).
 * Every apparatus stands on the same floor, y = 42, which the plate's mat line runs through.
 *   parter  — the competition floor in perspective: carpet edge, the thin boundary line inside
 *             it and the corner-to-corner diagonal of a tumbling pass (the page's floor spine)
 *   greda   — the beam on two splayed legs with foot plates
 *   razboj  — uneven bars: a low and a high rail (heavier strokes) crossing on slim uprights
 *   preskok — run-up dashes, the springboard wedge and the vault table
 *   aerobik — the club's own leap silhouette (QP2-06): aerobic gymnastics has no apparatus, the
 *             body is the drawing. The front toe stands on the floor; in the scene a mirrored
 *             partner joins her (pairs and groups are part of the sport).
 *
 * Structure (styles/sections/programs.css; quiz/views.ts iconArt reads it, keep it stable):
 * - `.pi-latent`: a faint static print of the whole drawing (QP-14), so a plate is never empty
 *   while its draw waits. Shown only while motion is on. Paths only (the quiz plates read it):
 *   the aerobic silhouette is a filled `.pi-solid` path there.
 * - `.pi-part[data-part]`: the drawing, split into the pieces that "perform" (MD-06): each stroked
 *   path has pathLength=1 and draws with stroke-dashoffset; a part moves as one (beam flex, rails
 *   flex, springboard compression, floor give, the jump). The silhouette part (`[data-leap]`) is
 *   the sprite's exact #leap and is revealed with a clip-path instead of a stroke draw.
 * - `.pi-fx`: the gymnast's path (giant-swing orbit, vault flight, tumbling hops), only in the
 *   detail sheet, where it leads to the posed silhouette (QP2-11); invisible at rest.
 * - `.pi-fig-x > .pi-fig-y > .pi-fig`: the club's leap silhouette posed over the apparatus (for
 *   aerobik: the partner) — the scene. Sheet and card (`scene="card"`): always; on a card the
 *   whole scene scales with its plate (QP3-02).
 * Without motion (no JS, reduced motion, Save-Data) it is simply the finished drawing.
 */

type Stroke = "base" | "thin" | "rail" | "post";
interface Segment {
  d: string;
  kind?: Stroke;
}
interface Part {
  part: string;
  paths?: readonly Segment[];
  /** The club silhouette itself is the drawing (aerobik). */
  leap?: boolean;
}
interface Figure {
  /** Top-left of the silhouette in icon units. */
  x: number;
  y: number;
  /** Mirrored (faces left). */
  flip?: boolean;
  /** Full size (the aerobic partner matches the drawing); otherwise the posed 35-unit size. */
  full?: boolean;
}
interface IconSpec {
  parts: readonly Part[];
  fx?: readonly string[];
  figure: Figure;
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
    // Three hops of a tumbling pass along the diagonal.
    fx: ["M9.7 37.7Q14.5 17.8 19.2 33.9", "M19.2 33.9Q24 14 28.7 30.1", "M28.7 30.1Q33.5 10.2 38.2 26.3"],
    figure: { x: 11, y: -4.5 },
  },
  greda: {
    parts: [
      {
        part: "beam",
        paths: [{ d: "M5 21.5H43A1.5 1.5 0 0 1 44.5 23V24A1.5 1.5 0 0 1 43 25.5H5A1.5 1.5 0 0 1 3.5 24V23A1.5 1.5 0 0 1 5 21.5Z" }],
      },
      { part: "legs", paths: [{ d: "M12 25.5L10.5 42M36 25.5L37.5 42M6 42H15M33 42H42" }] },
    ],
    figure: { x: 6.5, y: -3.5 },
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
    // Giant swing: one lap around the high rail, from the handstand.
    fx: ["M35 3A8.5 8.5 0 1 1 35 20A8.5 8.5 0 1 1 35 3"],
    figure: { x: 46.5, y: -3 },
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
    // Pre-flight from the board to the table, repulsion, post-flight past the table.
    fx: ["M20 37Q23 18.5 29 14.5Q40.5 1.5 51 21"],
    figure: { x: 48.5, y: 1 },
  },
  aerobik: {
    parts: [{ part: "fig", leap: true }],
    // The partner: mirrored, facing her on the same floor, 62% of a body to the right — their
    // raised hands meet and the front legs cross on the mat (QP2-06).
    figure: { x: 30, y: LEAP_ICON_BOX.y, flip: true, full: true },
  },
};

/** Posed silhouette in icon units: 96px wide on the sheet's 132px drawing (QP-21). The #leap
 *  symbol box is 230×150 (LEAP_VIEWBOX); not imported, so the lazy sheet chunk never pulls the
 *  generated path strings. Aerobik's partner has the drawing's own size (LEAP_ICON_BOX). */
const FIG_W = 35;
const FIG_H = 22.83;

const kindClass = (kind: Stroke | undefined) => (kind && kind !== "base" ? `pi-${kind}` : undefined);

interface ProgramIconProps {
  icon: ApparatusIcon;
  /** Accessible name (content/programs.ts iconLabel). */
  label: string;
  className?: string;
  /**
   * The apparatus scene: the club silhouette posed over the apparatus (aerobik: her partner).
   * "card": the silhouette only (on every plate, QP3-02); "sheet": the silhouette and the
   * gymnast's path (.pi-fx). Without it: the bare drawing (quiz plates).
   */
  scene?: "card" | "sheet";
}

function PosedFigure({ figure }: { figure: Figure }) {
  const w = figure.full ? LEAP_ICON_BOX.width : FIG_W;
  const h = figure.full ? LEAP_ICON_BOX.height : FIG_H;
  const use = <use className="pi-fig" href="#leap" x={figure.x} y={figure.y} width={w} height={h} />;
  return (
    <g className="pi-fig-x" style={figure.flip ? ({ "--fig-dir": -1 } as CSSProperties) : undefined}>
      <g className="pi-fig-y">
        {/* The mirror is an attribute transform on its own group: the CSS stick (scale) on
            .pi-fig and the hop on the outer groups never replace it. */}
        {figure.flip ? <g transform={`matrix(-1 0 0 1 ${2 * figure.x + w} 0)`}>{use}</g> : use}
      </g>
    </g>
  );
}

export function ProgramIcon({ icon, label, className, scene }: ProgramIconProps) {
  const spec = SPECS[icon];
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
        {spec.parts.map((p) =>
          p.leap ? (
            <path key={p.part} d={LEAP_ICON_D} className="pi-solid" />
          ) : (
            (p.paths ?? []).map((s) => <path key={`${p.part}${s.d}`} d={s.d} className={kindClass(s.kind)} />)
          ),
        )}
      </g>
      {spec.parts.map((p) => (
        <g key={p.part} className="pi-part" data-part={p.part} {...(p.leap ? { "data-leap": "" } : {})}>
          {p.leap ? <use className="pi-solid" href="#leap" {...LEAP_ICON_BOX} /> : null}
          {(p.paths ?? []).map((s) => (
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
      {scene ? <PosedFigure figure={spec.figure} /> : null}
    </svg>
  );
}
