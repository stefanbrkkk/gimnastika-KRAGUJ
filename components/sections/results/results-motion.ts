/**
 * S7 motion (§4 Results) — loaded lazily by ResultsMotion, never in the first-load JS.
 *
 * One sequence, never overlapping (§4 „Sequence these, never overlap“; ONE primary motion
 * per viewport):
 *   1. the title's SplitText line mask plays WITH the heading's own chrono landing (same
 *      element, same observer line as HeadingLandings): one composite landing;
 *   2. the LAST digit of each Doto numeral flips once: the static digit folds away and
 *      back (split-flap rotateX). It is never hidden in advance and no other number ever
 *      shows (D-S7-2); no count-up;
 *   3. the podium line draws (DrawSVG) and the medal marks settle on their steps;
 *   4. the white brush stroke over photo 01 draws (only rendered over the real photo).
 * Steps 2–4 each wait for their element to cross the viewport line, then for the heading
 * landing, the running step and any other section's primary motion (queuePrimaryMotion).
 *
 * Hidden pre-states (title lines, podium, brush) are set by JS only for elements that are
 * still off-screen; anything visible when this arms keeps its static final state. Under
 * gsap.matchMedia(MQ.noReduce): a live switch to reduced motion reverts every inline state
 * and the split at once. Only transform, opacity and stroke-dashoffset/-dasharray animate.
 */
import type { SplitText as SplitTextInstance } from "gsap/SplitText";
import { DUR, EASE, MQ, STAGGER, gsap, loadDrawSVG, loadSplitText, queuePrimaryMotion, registerMotion } from "@/lib/motion";

/** The heading's chrono landing: styles/ui.css (.chrono-solid 0.2 s delay + 0.6 s). */
const HEADING_LANDING_MS = 800;
/** HeadingLandings' observer line, so the title mask and the chrono landing start together. */
const HEADING_LINE = "0px 0px -15% 0px";
/** Steps 2–4 start once their element is this far into the viewport. */
const STEP_LINE = "0px 0px -18% 0px";
/** The SplitText DOM is restored once the chrono mark has landed inside the masked line. */
const UNSPLIT_MS = Math.max(0, HEADING_LANDING_MS - DUR.reveal * 1000) + 150;
/** Medal marks settle like the §4 badge/squash (--dur-slow-squash, 350 ms, ease rebound). */
const SETTLE = 0.35;
/** Dry-brush bristles, same offset as the S6 brush. */
const STRAND_STAGGER = STAGGER.words;

interface Step {
  el: Element;
  /** Builds the step's animation right before it plays. */
  build: () => gsap.core.Animation;
  state: "idle" | "ready" | "done";
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const inView = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

export async function armResults(root: HTMLElement): Promise<() => void> {
  registerMotion();
  const [SplitText] = await Promise.all([loadSplitText(), loadDrawSVG()]);

  const title = root.querySelector<HTMLElement>(".section-heading__title");
  const mark = title?.querySelector<SVGElement>(".chrono-mark") ?? null;
  const scoreboard = root.querySelector<HTMLElement>("[data-scoreboard]");
  const flaps = Array.from(root.querySelectorAll<HTMLElement>("[data-flip]"));
  const podium = root.querySelector<SVGSVGElement>("[data-podium]");
  const podiumLine = root.querySelector<SVGPathElement>("[data-podium-line]");
  const marks = Array.from(root.querySelectorAll<SVGCircleElement>("[data-podium-mark]"));
  const brush = root.querySelector<SVGSVGElement>("[data-brush]");
  const strokes = Array.from(root.querySelectorAll<SVGPathElement>("[data-brush-stroke]"));

  const mm = gsap.matchMedia();
  mm.add(MQ.noReduce, (context) => {
    let live = true;
    const observers: { disconnect(): void }[] = [];

    // --- Heading landing (HeadingLandings sets data-landed on the chrono mark) -----------
    let headingEnd = 0;
    if (mark && !mark.hasAttribute("data-landed")) {
      const mo = new MutationObserver(() => {
        if (!mark.hasAttribute("data-landed")) return;
        headingEnd = Math.max(headingEnd, performance.now() + HEADING_LANDING_MS);
        mo.disconnect();
      });
      mo.observe(mark, { attributes: true, attributeFilter: ["data-landed"] });
      observers.push(mo);
    }
    const headingWait = (): number => {
      // On screen but not landed yet: it lands now (the same scroll brought the step in).
      if (mark && !mark.hasAttribute("data-landed") && inView(mark)) return HEADING_LANDING_MS;
      return Math.max(0, headingEnd - performance.now());
    };

    // --- 1 · Title line mask, together with the chrono landing -------------------------
    // SplitText.revert() rewrites innerHTML, so the chrono mark (observed by HeadingLandings)
    // is put back as the same node afterwards.
    let split: SplitTextInstance | null = null;
    let unsplitTimer: ReturnType<typeof setTimeout> | undefined;
    const restoreMark = () => {
      const fresh = title?.querySelector(".chrono-mark");
      if (mark && fresh && fresh !== mark) fresh.replaceWith(mark);
    };
    const unsplit = () => {
      if (split?.isSplit) split.revert();
      split = null;
      restoreMark();
    };
    if (title && !inView(title)) {
      split = SplitText.create(title, { type: "lines", mask: "lines", autoSplit: false });
      gsap.set(split.lines, { yPercent: 105 });
      const titleIo = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting) || !split) return;
          titleIo.disconnect();
          headingEnd = Math.max(headingEnd, performance.now() + HEADING_LANDING_MS);
          const lines = split.lines;
          context.add(() => {
            gsap.to(lines, {
              yPercent: 0,
              duration: DUR.reveal,
              ease: EASE.stick,
              stagger: STAGGER.lines,
              onComplete: () => {
                unsplitTimer = setTimeout(unsplit, UNSPLIT_MS);
              },
            });
          });
        },
        { rootMargin: HEADING_LINE },
      );
      // The h2 itself: the masked line clips the chrono mark, and a fully clipped element
      // never intersects. HeadingLandings lands the mark as soon as the rising line shows it.
      titleIo.observe(title);
      observers.push(titleIo);
    }

    // --- 2–4 · Sequenced steps ----------------------------------------------------------
    const steps: Step[] = [];

    // 2 — the last digit of every numeral folds away and back once. Nothing is hidden in
    // advance: until its turn, the scoreboard shows the static, correct numerals.
    if (scoreboard && flaps.length && !inView(scoreboard)) {
      steps.push({
        el: scoreboard,
        state: "idle",
        build: () => {
          const tl = gsap.timeline({ onComplete: () => void gsap.set(flaps, { clearProps: "transform" }) });
          tl.set(flaps, { transformPerspective: 360, transformOrigin: "50% 50%" }, 0);
          flaps.forEach((flap, i) => {
            const at = i * STAGGER.cards;
            tl.to(flap, { rotationX: 90, duration: DUR.tap, ease: EASE.takeoff }, at)
              .set(flap, { rotationX: -90 }, at + DUR.tap)
              .to(flap, { rotationX: 0, duration: DUR.base, ease: EASE.rebound }, at + DUR.tap);
          });
          return tl;
        },
      });
    }

    // 3 — the podium line draws, then the medal marks settle on their steps.
    if (podium && podiumLine && !inView(podium)) {
      gsap.set(podiumLine, { drawSVG: "0% 0%" });
      gsap.set(marks, { scale: 0, transformOrigin: "50% 50%" });
      steps.push({
        el: podium,
        state: "idle",
        build: () =>
          gsap
            .timeline({ onComplete: () => void gsap.set([podiumLine, ...marks], { clearProps: "all" }) })
            .to(podiumLine, { drawSVG: "0% 100%", duration: DUR.slow, ease: EASE.flight })
            .to(marks, { scale: 1, duration: SETTLE, ease: EASE.rebound, stagger: STAGGER.cards }, "-=0.12"),
      });
    }

    // 4 — the brush stroke over photo 01.
    if (brush && strokes.length && !inView(brush)) {
      gsap.set(strokes, { drawSVG: "0% 0%" });
      steps.push({
        el: brush,
        state: "idle",
        build: () =>
          gsap.to(strokes, {
            drawSVG: "0% 100%",
            duration: DUR.slow,
            ease: EASE.flight,
            stagger: STRAND_STAGGER,
            onComplete: () => void gsap.set(strokes, { clearProps: "all" }),
          }),
      });
    }

    let busy = false;
    const pump = async (): Promise<void> => {
      if (busy || !live) return;
      const step = steps.find((s) => s.state === "ready");
      if (!step) return;
      busy = true;
      step.state = "done";
      const wait = headingWait();
      if (wait > 0) await sleep(wait);
      if (!live) return;
      let tl: gsap.core.Timeline | undefined;
      context.add(() => {
        tl = gsap.timeline({
          paused: true,
          onComplete: () => {
            busy = false;
            void pump();
          },
        });
        tl.add(step.build());
      });
      if (!tl) return;
      await queuePrimaryMotion(tl.totalDuration() * 1000);
      if (live) tl.play();
    };

    const stepIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const step = steps.find((s) => s.el === entry.target);
          if (step && step.state === "idle") step.state = "ready";
          stepIo.unobserve(entry.target);
        }
        void pump();
      },
      { rootMargin: STEP_LINE },
    );
    steps.forEach((s) => s.state === "idle" && stepIo.observe(s.el));
    observers.push(stepIo);

    return () => {
      live = false;
      observers.forEach((o) => o.disconnect());
      clearTimeout(unsplitTimer);
      // The context has already reverted the tweens (and the split, which it owns).
      unsplit();
    };
  });

  return () => mm.revert();
}
