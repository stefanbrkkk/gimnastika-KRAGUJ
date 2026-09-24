"use client";

/**
 * S2 quiz island. Step 1: age chips 3…18. Step 2 (only if age ≥ 8): experience.
 * Result: recommended group(s) with schedule chips + booking CTA, announced via
 * aria-live (polite). All rules/content arrive precomputed as props (views.ts);
 * this file ships no content modules and no gsap — CSS transitions only.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { prefersLessMotion } from "@/lib/motion-env";
import { QuizBand, type QuizStep } from "./QuizBand";
import { QuizActions, QuizGroups } from "./QuizGroups";
import type { QuizResultView, QuizViewModel } from "./types";

const ARROWS: Record<string, "x" | "y"> = { ArrowLeft: "x", ArrowRight: "x", ArrowUp: "y", ArrowDown: "y" };

/** Roving focus inside a chip group: arrows (grid-aware), Home/End. Enter/Space activate natively. */
function onChipKeys(e: KeyboardEvent<HTMLDivElement>) {
  const chips = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
  const i = chips.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  const cols = getComputedStyle(e.currentTarget).gridTemplateColumns.split(" ").length || 1;
  const axis = ARROWS[e.key];
  const dir = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
  const next =
    e.key === "Home" ? 0 : e.key === "End" ? chips.length - 1 : axis ? i + dir * (axis === "y" ? cols : 1) : -1;
  if (next < 0 || next >= chips.length) return;
  e.preventDefault();
  chips.forEach((c, j) => (c.tabIndex = j === next ? 0 : -1));
  chips[next]?.focus();
}

function ChipGroup({
  labelledBy,
  className,
  selected,
  children,
}: {
  labelledBy: string;
  className: string;
  selected: number;
  children: (tabIndexFor: (i: number) => 0 | -1) => ReactNode;
}) {
  const home = Math.max(selected, 0);
  return (
    <div role="group" aria-labelledby={labelledBy} className={className} onKeyDown={onChipKeys}>
      {children((i) => (i === home ? 0 : -1))}
    </div>
  );
}

function Result({ view, copy }: { view: QuizResultView; copy: QuizViewModel["copy"] }) {
  return (
    <div className="quiz-result">
      <div className="quiz-result__main">
        <QuizGroups view={view} focusFirst />
      </div>
      <QuizActions
        booking={view.booking}
        cta={copy.resultCta}
        finalNote={copy.finalNote}
        aerobicHint={copy.aerobicHint}
        aerobicColor={copy.aerobicColor}
      />
    </div>
  );
}

export function QuizApp({ vm }: { vm: QuizViewModel }) {
  const { ages, table, views, copy } = vm;
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [moved, setMoved] = useState(false);
  const [step, setStep] = useState<QuizStep>(0);
  const [age, setAge] = useState<number | null>(null);
  const [exp, setExp] = useState<number | null>(null);

  const entry = age === null ? undefined : table[age - (ages[0] ?? 0)];
  const asked = Array.isArray(entry);
  const kind = typeof entry === "string" ? entry : entry && exp !== null ? entry[exp] : undefined;
  const view = step === 2 && kind ? views[kind] : null;

  // Reduced motion or Save-Data → static band (CSS keys off data-lite). DOM attribute, not state:
  // SSR and hydration render the same markup.
  useEffect(() => {
    rootRef.current?.toggleAttribute("data-lite", prefersLessMotion());
  }, []);

  // After a user-driven step change, move focus to the new question / result heading.
  useEffect(() => {
    if (!moved) return;
    rootRef.current?.querySelector<HTMLElement>("[data-quiz-focus]")?.focus();
  }, [step, moved]);

  const go = (next: QuizStep) => {
    setMoved(true);
    setStep(next);
  };
  const chooseAge = (a: number) => {
    setAge(a);
    go(Array.isArray(table[a - (ages[0] ?? 0)]) ? 1 : 2);
  };
  const chooseExp = (i: number) => {
    setExp(i);
    go(2);
  };
  const back = () => go(step === 2 && asked ? 1 : 0);
  const restart = () => {
    setAge(null);
    setExp(null);
    go(0);
  };

  const caption =
    age === null || step === 0
      ? ""
      : [`${age} ${copy.ageUnit}`, step === 2 && asked && exp !== null ? copy.experience[exp] : null]
          .filter(Boolean)
          .join(" · ");
  const q1 = `${uid}-q1`;
  const q2 = `${uid}-q2`;

  return (
    <div ref={rootRef} className="quiz-card quiz-app" data-step={step} data-entered={moved ? "" : undefined}>
      <QuizBand step={step} asked={asked} caption={caption} />
      <div className="quiz-body">
        {step === 0 ? (
          <div className="quiz-step" key="s1">
            <h3 id={q1} className="quiz-q text-h3" tabIndex={-1} data-quiz-focus="">
              {copy.step1}
            </h3>
            <ChipGroup labelledBy={q1} className="quiz-ages" selected={age === null ? -1 : ages.indexOf(age)}>
              {(tab) =>
                ages.map((a, i) => (
                  <button
                    key={a}
                    type="button"
                    className="quiz-chip quiz-chip--age tabular"
                    aria-pressed={a === age}
                    tabIndex={tab(i)}
                    onClick={() => chooseAge(a)}
                  >
                    {a}
                  </button>
                ))
              }
            </ChipGroup>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="quiz-step" key="s2">
            <h3 id={q2} className="quiz-q text-h3" tabIndex={-1} data-quiz-focus="">
              {copy.step2}
            </h3>
            <ChipGroup labelledBy={q2} className="quiz-exps" selected={exp ?? -1}>
              {(tab) =>
                copy.experience.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    className="quiz-chip quiz-chip--exp"
                    aria-pressed={i === exp}
                    tabIndex={tab(i)}
                    onClick={() => chooseExp(i)}
                  >
                    <span>{label}</span>
                    <svg className="quiz-chip__arrow" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                      <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" />
                    </svg>
                  </button>
                ))
              }
            </ChipGroup>
          </div>
        ) : null}

        {/* Persistent live region: the whole result is announced when it appears. */}
        <div className="quiz-live" aria-live="polite">
          {view ? <Result view={view} copy={copy} /> : null}
        </div>

        {step > 0 ? (
          <div className="quiz-controls">
            <button type="button" className="quiz-ctrl" onClick={back}>
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path d="M16 10H5m4.5-4.5L5 10l4.5 4.5" />
              </svg>
              {copy.back}
            </button>
            {step === 2 ? (
              <button type="button" className="quiz-ctrl" onClick={restart}>
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path d="M4.5 9.5a6 6 0 1 1 1.8 4.6M4.5 15.5v-4h4" />
                </svg>
                {copy.restart}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
