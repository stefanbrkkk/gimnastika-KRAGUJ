/**
 * Server-rendered pieces of the quiz result, passed to the island as React nodes (the island
 * places them and ships none of their code): the S3 program plate, the two-level CTA label and
 * the aerobic hint. Also used as-is by the static no-JS guide.
 */
import type { CSSProperties } from "react";
import type { QuizIconArt } from "./types";

interface PlateProps {
  color: string;
  ink: string;
  art: QuizIconArt;
  className?: string;
}

/**
 * The S3 program plate — program colour + its apparatus drawing in the plate ink — next to a
 * group name. Decorative: the name next to it carries the meaning.
 */
export function QuizPlate({ color, ink, art, className }: PlateProps) {
  return (
    <span
      className={className ? `quiz-plate ${className}` : "quiz-plate"}
      style={{ "--pc": color, "--pc-ink": ink } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" focusable="false">
        {art.paths.map(({ d, k }) => (
          <path key={d} d={d} data-k={k} />
        ))}
        {art.dots.map((c) => (
          <circle key={`${c.cx} ${c.cy}`} {...c} />
        ))}
      </svg>
    </span>
  );
}

/**
 * CTA label. With a second part it is set on two levels on phones (QP-15): the action, then
 * its object, quieter. Joined by one space, so the accessible name is the whole label.
 */
export function QuizCtaLabel({ main, sub = "" }: { main: string; sub?: string }) {
  return (
    <span className="quiz-cta__label">
      <span className="quiz-cta__main">{main}</span>
      {sub ? (
        <>
          {" "}
          <span className="quiz-cta__sub">{sub}</span>
        </>
      ) : null}
    </span>
  );
}

/** „Pitajte trenericu i za aerobnu gimnastiku.“ with the aerobic program's plate. */
export function QuizHint({ text, plate }: { text: string; plate: Omit<PlateProps, "className"> }) {
  return (
    <>
      <QuizPlate {...plate} className="quiz-plate--hint" />
      <span className="quiz-hint__text">{text}</span>
    </>
  );
}
