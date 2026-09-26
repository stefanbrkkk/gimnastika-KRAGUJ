/**
 * The quiz's darkroom strip: a Marey chronophotograph of one tumbling pass. Each answer is
 * one hop of the club silhouette — take-off (01), contact (02), stuck landing (03) — and the
 * print develops frame by frame behind it. The picture (`art`, QuizBandArt) is server-rendered
 * once; this wrapper only states where the pass is (data attributes) and prints the edge
 * caption and frame numbers, so the island carries no geometry. Purely decorative (aria-hidden).
 * Reduced motion / Save-Data: the same states without transitions. No-JS guide: `still`.
 */
import { Fragment, type ReactNode } from "react";
import type { QuizBandVariant, QuizResultView } from "./types";

export type QuizStep = 0 | 1 | 2;

/** Frame-number positions along the strip (FRAME_X / VB_W in geometry.ts: 130, 360, 590 of 720). */
export const FRAME_LEFT = ["18.06%", "50.00%", "81.94%"] as const;

type FrameState = "current" | "done" | "todo" | "skip";

interface QuizBandProps {
  step: QuizStep;
  /** Whether step 2 was part of this run (age ≥ 8). */
  asked?: boolean;
  /** The result's landing (step 2 only). */
  band?: QuizResultView["band"] | null;
  /** Direction of the last move: a forward answer leaps, going back rewinds. */
  dir?: "fwd" | "back";
  /** Edge print: the answers so far, one part per answer („9 god.“, „Tek počinje“). */
  caption?: readonly string[];
  /** Final composition regardless of step (no-JS guide). */
  still?: boolean;
  art: ReactNode;
}

function frameStates(step: QuizStep, asked: boolean, still: boolean): readonly FrameState[] {
  if (still || (step === 2 && asked)) return ["done", "done", "current"];
  if (step === 0) return ["current", "todo", "todo"];
  if (step === 1) return ["done", "current", "todo"];
  return ["done", "skip", "current"];
}

const NO_CAPTION: readonly string[] = [];

export function QuizBand({ step, asked = false, band = null, dir, caption = NO_CAPTION, still = false, art }: QuizBandProps) {
  const states = frameStates(step, asked, still);
  const variant: QuizBandVariant = step === 2 && band ? band.variant : "flat";
  return (
    <div
      className="quiz-band"
      data-theme="dark"
      aria-hidden="true"
      data-step={still ? 2 : step}
      data-v={variant}
      data-app={step === 2 && band ? band.apparatus : undefined}
      data-dir={dir}
      data-still={still ? "" : undefined}
    >
      {/* data-parts: a narrow strip drops the decorative „KR-Q“ once the caption has two answers. */}
      <p className="quiz-band__edge" data-parts={caption.length}>
        {/* Each answer stays whole and the „·“ travels with the answer after it, so a narrow
            strip could only wrap before the dot, never leave it dangling at a line end. */}
        <span className="quiz-band__caption">
          {caption.map((part, i) => (
            <Fragment key={part}>
              {i > 0 ? " " : null}
              <span className="quiz-band__part">{i > 0 ? `· ${part}` : part}</span>
            </Fragment>
          ))}
        </span>
        <span className="quiz-band__code">KR-Q</span>
      </p>
      {art}
      <ol className="quiz-band__frames">
        {FRAME_LEFT.map((left, i) => (
          <li key={left} data-state={states[i]} style={{ left }}>
            {`0${i + 1}`}
          </li>
        ))}
      </ol>
    </div>
  );
}
