/**
 * The quiz's darkroom strip: a Marey-style chronophotograph of the club silhouette.
 * Each answer is one frame of the leap — takeoff (01), flight (02), landing on the
 * result (03). One <use href="#leap"> moves between the frames (CSS transform only)
 * and leaves ghost frames behind. Reduced motion / Save-Data / no-JS: the static
 * final composition (landed figure + both ghosts). Purely decorative (aria-hidden).
 */
import { Fragment } from "react";

export type QuizStep = 0 | 1 | 2;

const VB_W = 720;
const MAT_Y = 178;
/** Frame centers along the mat, in viewBox units: 01 takeoff · 02 flight · 03 landing. */
const FRAME_X = [130, 360, 590] as const;
/**
 * Aspect of the #leap symbol (LEAP_VIEWBOX 230×150 in components/brand/sprite-paths.generated.ts).
 * Not imported: that module also carries the full path strings, which must stay out of the island bundle.
 */
const LEAP_ASPECT = 150 / 230;
const FIG_W = 156;
const FIG_H = Math.round(FIG_W * LEAP_ASPECT);
/**
 * Pivot of the landed figure (frame 03), at 70% of its height. Each figure is a <g> placed at the
 * pivot; poses 1–2 are CSS transforms of that <g> around its own origin (SVG default origin 0 0),
 * so rotation/scale never depend on transform-box support for <use>.
 */
const PIVOT_X = FRAME_X[2];
const PIVOT_Y = MAT_Y - Math.round(FIG_H * 0.3);
const USE_X = -FIG_W / 2;
const USE_Y = -Math.round(FIG_H * 0.7);
const GRID_X = Array.from({ length: 17 }, (_, i) => 40 + i * 40);

type FrameState = "current" | "done" | "todo" | "skip";

interface QuizBandProps {
  step: QuizStep;
  /** Whether step 2 was part of this run (age ≥ 8). */
  asked?: boolean;
  /** Edge print: the answers so far, one part per answer („9 god.“, „Tek počinje“). */
  caption?: readonly string[];
  /** Final composition regardless of step (no-JS guide). */
  still?: boolean;
}

function frameStates(step: QuizStep, asked: boolean, still: boolean): readonly FrameState[] {
  if (still) return ["done", "done", "current"];
  if (step === 0) return ["current", "todo", "todo"];
  if (step === 1) return ["done", "current", "todo"];
  return ["done", asked ? "done" : "skip", "current"];
}

const NO_CAPTION: readonly string[] = [];

export function QuizBand({ step, asked = false, caption = NO_CAPTION, still = false }: QuizBandProps) {
  const states = frameStates(step, asked, still);
  return (
    <div
      className="quiz-band"
      aria-hidden="true"
      data-step={still ? 2 : step}
      data-asked={still || asked ? "" : undefined}
      data-still={still ? "" : undefined}
    >
      <p className="quiz-band__edge">
        {/* Each answer stays whole; a narrow strip wraps only after the „ · “ separator. */}
        <span className="quiz-band__caption">
          {caption.map((part, i) => (
            <Fragment key={part}>
              {i > 0 ? "\u00a0· " : null}
              <span className="quiz-band__part">{part}</span>
            </Fragment>
          ))}
        </span>
        <span className="quiz-band__code">KR-Q</span>
      </p>
      <svg className="quiz-band__svg" viewBox={`0 0 ${VB_W} 200`} focusable="false">
        <g className="quiz-band__grid">
          {GRID_X.map((x) => (
            <line key={x} x1={x} x2={x} y1={10} y2={MAT_Y} />
          ))}
        </g>
        <line className="quiz-band__mat" x1={16} x2={VB_W - 16} y1={MAT_Y} y2={MAT_Y} />
        {FRAME_X.map((x) => (
          <line key={x} className="quiz-band__tick" x1={x} x2={x} y1={MAT_Y} y2={MAT_Y + 9} />
        ))}
        <g transform={`translate(${PIVOT_X} ${PIVOT_Y})`}>
          {(["ghost1", "ghost2", "fig"] as const).map((k) => (
            <g key={k} className={`quiz-leap quiz-leap--${k}`}>
              <use href="#leap" x={USE_X} y={USE_Y} width={FIG_W} height={FIG_H} />
            </g>
          ))}
        </g>
      </svg>
      <ol className="quiz-band__frames">
        {FRAME_X.map((x, i) => (
          <li key={x} data-state={states[i]} style={{ left: `${((x / VB_W) * 100).toFixed(2)}%` }}>
            {`0${i + 1}`}
          </li>
        ))}
      </ol>
    </div>
  );
}
