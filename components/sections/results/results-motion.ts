/**
 * S7 motion (§4 Results) — loaded lazily by ResultsMotion, never in the first-load JS.
 *
 * Four steps, SEQUENCED and never overlapping (one primary motion per viewport):
 *   1. SplitText line mask on the section title only;
 *   2. the LAST digit of each Doto numeral flips once (split-flap rotateX) — no count-up;
 *   3. the podium line draws (DrawSVG) and the medal marks settle;
 *   4. the white brush stroke over photo 01 draws (DrawSVG).
 * Each step waits for its own element to enter the viewport, then for any running
 * step to finish; simultaneously visible steps play in the order above.
 *
 * Rules kept: only transform, opacity and stroke-dashoffset/-dasharray; hidden
 * pre-animation states are applied by JS only to elements that are still off-screen
 * (anything already visible when this arms keeps its static final state);
 * cleanup reverts every inline style and the split.
 */
import type { SplitText as SplitTextInstance } from "gsap/SplitText";
import { DUR, EASE, STAGGER, gsap, loadDrawSVG, loadSplitText, registerMotion } from "@/lib/motion";

interface Step {
  el: Element;
  prep: () => void;
  play: () => gsap.core.Animation;
  state: "idle" | "ready" | "playing" | "done";
}

const inView = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

export async function armResults(root: HTMLElement): Promise<() => void> {
  registerMotion();
  const [SplitText] = await Promise.all([loadSplitText(), loadDrawSVG()]);

  const title = root.querySelector<HTMLElement>(".section-heading__title");
  const scoreboard = root.querySelector<HTMLElement>("[data-scoreboard]");
  const flaps = Array.from(root.querySelectorAll<HTMLElement>("[data-flip]"));
  const podium = root.querySelector<SVGSVGElement>("[data-podium]");
  const podiumLine = root.querySelector<SVGPathElement>("[data-podium-line]");
  const marks = Array.from(root.querySelectorAll<SVGCircleElement>("[data-podium-mark]"));
  const brush = root.querySelector<SVGSVGElement>("[data-brush]");
  const strokes = Array.from(root.querySelectorAll<SVGPathElement>("[data-brush-stroke]"));

  const ctx = gsap.context(() => {});
  const steps: Step[] = [];

  // 1 — title line mask. SplitText.revert() rewrites innerHTML, so the heading's
  // chronophotograph mark (observed by HeadingLandings) is put back as the same node.
  let split: SplitTextInstance | null = null;
  const mark = title?.querySelector(".chrono-mark") ?? null;
  const unsplit = () => {
    if (!split || !title) return;
    split.revert();
    split = null;
    const fresh = title.querySelector(".chrono-mark");
    if (mark && fresh && fresh !== mark) fresh.replaceWith(mark);
  };
  if (title) {
    steps.push({
      el: title,
      state: "idle",
      prep: () => {
        split = SplitText.create(title, { type: "lines", mask: "lines", autoSplit: false });
        gsap.set(split.lines, { yPercent: 105 });
      },
      play: () =>
        gsap.to(split?.lines ?? [], {
          yPercent: 0,
          duration: DUR.reveal,
          ease: EASE.stick,
          stagger: STAGGER.lines,
          // Let the heading's own landing mark finish before the DOM is restored.
          onComplete: () => void gsap.delayedCall(0.35, unsplit),
        }),
    });
  }

  // 2 — the last digit of every numeral flips once.
  if (scoreboard && flaps.length) {
    steps.push({
      el: scoreboard,
      state: "idle",
      prep: () => gsap.set(flaps, { rotationX: -90, opacity: 0, transformPerspective: 360, transformOrigin: "50% 50%" }),
      play: () =>
        gsap
          .timeline({ onComplete: () => void gsap.set(flaps, { clearProps: "transform,opacity" }) })
          .to(flaps, { opacity: 1, duration: 0.01, stagger: STAGGER.cards }, 0)
          .to(flaps, { rotationX: 0, duration: 0.5, ease: EASE.rebound, stagger: STAGGER.cards }, 0),
    });
  }

  // 3 — the podium line draws, then the medal marks settle on their steps.
  if (podium && podiumLine) {
    steps.push({
      el: podium,
      state: "idle",
      prep: () => {
        gsap.set(podiumLine, { drawSVG: "0% 0%" });
        gsap.set(marks, { scale: 0, transformOrigin: "50% 50%" });
      },
      play: () =>
        gsap
          .timeline({ onComplete: () => void gsap.set([podiumLine, ...marks], { clearProps: "all" }) })
          .to(podiumLine, { drawSVG: "0% 100%", duration: DUR.slow, ease: EASE.flight })
          .to(marks, { scale: 1, duration: 0.35, ease: EASE.rebound, stagger: STAGGER.cards }, "-=0.12"),
    });
  }

  // 4 — the brush stroke over photo 01.
  if (brush && strokes.length) {
    steps.push({
      el: brush,
      state: "idle",
      prep: () => gsap.set(strokes, { drawSVG: "0% 0%" }),
      play: () =>
        gsap.to(strokes, {
          drawSVG: "0% 100%",
          duration: DUR.slow,
          ease: EASE.flight,
          stagger: 0.05,
          onComplete: () => void gsap.set(strokes, { clearProps: "all" }),
        }),
    });
  }

  let running: gsap.core.Timeline | null = null;
  const pump = () => {
    if (running) return;
    const step = steps.find((s) => s.state === "ready");
    if (!step) return;
    step.state = "playing";
    ctx.add(() => {
      running = gsap.timeline({
        onComplete: () => {
          step.state = "done";
          running = null;
          pump();
        },
      });
      running.add(step.play());
    });
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const step = steps.find((s) => s.el === entry.target);
        if (step && step.state === "idle") step.state = "ready";
        io.unobserve(entry.target);
      }
      pump();
    },
    { rootMargin: "0px 0px -18% 0px" },
  );

  for (const step of steps) {
    // Already on screen (deep link, restored scroll): keep the static final state — no flash.
    if (inView(step.el)) {
      step.state = "done";
      continue;
    }
    ctx.add(step.prep);
    io.observe(step.el);
  }

  return () => {
    io.disconnect();
    running?.kill();
    running = null;
    ctx.revert();
    unsplit();
  };
}
