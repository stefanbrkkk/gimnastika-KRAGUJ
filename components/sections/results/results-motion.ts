/**
 * S7 motion (§4 Results, design review v2) — loaded lazily by ResultsMotion, never in the
 * first-load JS.
 *
 *   · Title: the SplitText line mask rises as the title enters (content first, no queue).
 *     The chronophotograph mark then lands like every other title (HeadingLandings, an
 *     accent); the split is reverted only when no landing is running.
 *   · Primary steps, one at a time (§4 „Sequence these, never overlap“):
 *     1. the scores POST on the judges' LED board: each numeral re-lights dot row by dot row,
 *        top → bottom (the Doto cell is 7 rows), then the board gives one „hold“ blink.
 *        Nothing is hidden in advance; a partly lit numeral is only ever the top rows of the
 *        correct digits (SOURCE RULE, never another number, no count-up);
 *     2. phones only (<1024): photo 01's shutter opens from a slit (scroll = the camera);
 *     3. the medal ceremony: the podium outline draws, the blocks rise out of the panel, the
 *        medals drop onto their steps bronze → silver → gold and stick the landing, then the
 *        white brush underline sweeps under „Medalje“.
 *   A step starts when its element crosses the −18% line and the running step has finished,
 *   through queuePrimaryMotion (≤250 ms). A step that would wait more than 600 ms in the
 *   sequence shows its static final state instead (RC-10).
 *
 * Hidden pre-states (title lines, photo slit, podium parts, brush) are set by JS only for
 * elements still off-screen at arm time. Safety net (MD-02): a pre-hidden element that has
 * been ≥50% in view for 300 ms without its trigger plays now (or, if it cannot start in time,
 * shows statically). Under gsap.matchMedia(MQ.noReduce): a live switch to reduced motion
 * reverts every inline state and the split at once. Only transform, opacity, clip-path and
 * stroke-dashoffset/-dasharray change.
 */
import type { SplitText as SplitTextInstance } from "gsap/SplitText";
import { DUR, EASE, MQ, STAGGER, gsap, loadDrawSVG, loadSplitText, queuePrimaryMotion, registerMotion } from "@/lib/motion";

/** The title's lines rise once it is this far into the viewport. */
const TITLE_LINE = "0px 0px -15% 0px";
/** Primary steps start once their element is this far into the viewport. */
const STEP_LINE = "0px 0px -18% 0px";
/** RC-10: longer than this in the sequence → static final state instead of a lingering ghost. */
const MAX_SEQUENCE_WAIT_MS = 600;
/** MD-02 safety net: ≥50% in view for this long without playing → play now / show. */
const SAFETY_MS = 300;
/** The chrono mark's hop in styles/ui.css (520 ms flight + 260 ms stick) plus a margin. */
const LANDING_MS = 850;

/* --- Score posting (Doto geometry) --------------------------------------------------------
   Doto digits sit on a 5 × 7 dot grid, row pitch 0.1em. In .stat__num (inline-block,
   line-height .9) the 1.2em content area is centred, so the baseline is at 0.8em and the dot
   rows are centred at 0.15em … 0.75em from the box top. k lit rows = clip below the midline
   between row k and row k + 1. Side and top insets are negative so the LED bloom is kept. */
const ROWS = 7;
const BLOOM = "-0.4em";
const litRows = (k: number): string => {
  if (k >= ROWS) return `inset(${BLOOM} ${BLOOM} ${BLOOM} ${BLOOM})`;
  const bottom = k <= 0 ? 1.3 : 0.9 - (0.2 + 0.1 * (k - 1));
  return `inset(${BLOOM} ${BLOOM} ${bottom.toFixed(2)}em ${BLOOM})`;
};
/** One numeral's scan (one step per dot row), the stagger across the board, the hold blink. */
const SCAN = 0.35;
const SCAN_STAGGER = 0.08;
const BLINK_DIM = 0.07;
const BLINK_BACK = 0.09;

/* --- Medal ceremony ------------------------------------------------------------------------ */
const CEREMONY_ORDER = ["bronze", "silver", "gold"] as const;
/** Medals follow the outline; 140 ms apart; each falls 240 ms, then sticks the landing. */
const MEDALS_AT = DUR.reveal * 0.95;
const MEDAL_GAP = 0.14;
const MEDAL_FALL = 0.24;
const MEDAL_DROP = -28;

interface Step {
  el: Element;
  /** JS pre-hid something (the safety net applies). */
  hidden: boolean;
  /** Seconds the sequence stays blocked once the step starts. */
  block: number;
  build: () => gsap.core.Animation;
  /** The static final state (skip, safety net). */
  finish: () => void;
  state: "idle" | "ready" | "running" | "done";
  readyAt: number;
}

const inView = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

/** Visible share of an element, relative to itself or (when taller) to the viewport. */
const shareInView = (entry: IntersectionObserverEntry): number => {
  const h = Math.min(entry.boundingClientRect.height, window.innerHeight);
  return h > 0 ? entry.intersectionRect.height / h : 0;
};

const qsa = <T extends Element>(root: ParentNode, sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));

export async function armResults(root: HTMLElement): Promise<() => void> {
  registerMotion();
  const [SplitText] = await Promise.all([loadSplitText(), loadDrawSVG()]);

  const title = root.querySelector<HTMLElement>(".section-heading__title");
  const mark = title?.querySelector<SVGElement>(".chrono-mark") ?? null;
  const scoreboard = root.querySelector<HTMLElement>("[data-scoreboard]");
  const scores = qsa<HTMLElement>(root, "[data-score]");
  const photo = root.querySelector<HTMLElement>("[data-results-photo]");
  const band = root.querySelector<HTMLElement>("[data-medals-band]");
  const podiumLine = root.querySelector<SVGPathElement>("[data-podium-line]");
  const blocks = qsa<SVGRectElement>(root, "[data-podium-block]");
  const medals = qsa<SVGGElement>(root, "[data-podium-medal]");
  const strokes = qsa<SVGPathElement>(root, "[data-medal-brush] [data-brush-stroke]");

  const mm = gsap.matchMedia();
  mm.add(MQ.noReduce, (context) => {
    let live = true;
    const observers: { disconnect(): void }[] = [];
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (live) fn();
      }, ms);
      timers.add(t);
      return t;
    };

    // --- Title: line mask ---------------------------------------------------------------
    // SplitText.revert() rewrites innerHTML, so the chrono mark (observed by HeadingLandings)
    // is put back as the same node — never while its landing is playing (a moved node would
    // cancel the hop). A masked mark never intersects, so it can only land once its line rose.
    let split: SplitTextInstance | null = null;
    let landedAt = mark?.hasAttribute("data-landed") ? 0 : -1;
    if (mark && landedAt < 0) {
      const mo = new MutationObserver(() => {
        if (landedAt < 0 && mark.hasAttribute("data-landed")) {
          landedAt = performance.now();
          mo.disconnect();
        }
      });
      mo.observe(mark, { attributes: true, attributeFilter: ["data-landed"] });
      observers.push(mo);
    }
    const unsplit = () => {
      if (split?.isSplit) split.revert();
      split = null;
      const fresh = title?.querySelector(".chrono-mark");
      if (mark && fresh && fresh !== mark) fresh.replaceWith(mark);
    };
    const unsplitWhenStill = () => {
      const busyFor = landedAt < 0 ? 0 : landedAt + LANDING_MS - performance.now();
      if (busyFor > 0) later(unsplitWhenStill, busyFor + 20);
      else unsplit();
    };

    if (title && !inView(title)) {
      split = SplitText.create(title, { type: "lines", mask: "lines", autoSplit: false });
      gsap.set(split.lines, { yPercent: 105 });
      let risen = false;
      const rise = () => {
        if (risen || !split) return;
        risen = true;
        const lines = split.lines;
        context.add(() =>
          gsap.to(lines, {
            yPercent: 0,
            duration: DUR.reveal,
            ease: EASE.stick,
            stagger: STAGGER.lines,
            onComplete: unsplitWhenStill,
          }),
        );
      };
      const titleIo = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          titleIo.disconnect();
          rise();
        },
        { rootMargin: TITLE_LINE },
      );
      titleIo.observe(title);
      observers.push(titleIo);
      guard(title, () => !risen, rise);
    }

    // --- Primary steps ------------------------------------------------------------------
    const steps: Step[] = [];

    // 1 — the scores post. Never pre-hidden: until its turn the board shows the static,
    // correct numerals; at its turn each window refreshes and re-lights row by row.
    if (scoreboard && scores.length && !inView(scoreboard)) {
      const n = scores.length;
      const blinkAt = (n - 1) * SCAN_STAGGER + SCAN + 0.07;
      steps.push({
        el: scoreboard,
        hidden: false,
        block: (n - 1) * SCAN_STAGGER + SCAN,
        state: "idle",
        readyAt: 0,
        build: () => {
          const tl = gsap.timeline({ onComplete: () => void gsap.set(scores, { clearProps: "clipPath,opacity" }) });
          scores.forEach((score, i) => {
            const at = i * SCAN_STAGGER;
            for (let k = 0; k <= ROWS; k++) tl.set(score, { clipPath: litRows(k) }, at + (k * SCAN) / ROWS);
          });
          // The score holds: one blink of the whole board (a single flash, far below 3/s).
          tl.to(scores, { opacity: 0.55, duration: BLINK_DIM, ease: "none" }, blinkAt);
          tl.to(scores, { opacity: 1, duration: BLINK_BACK, ease: "none" }, blinkAt + BLINK_DIM);
          return tl;
        },
        finish: () => void gsap.set(scores, { clearProps: "clipPath,opacity" }),
      });
    }

    // 2 — phones: photo 01 opens like a shutter, then its KR-01 frame label appears.
    const shutterBox = photo?.querySelector<HTMLElement>(".photo") ?? null;
    const frameLabel = photo?.querySelector<HTMLElement>(".frame-label") ?? null;
    if (photo && shutterBox && !inView(photo) && window.matchMedia("(max-width: 1023.98px)").matches) {
      const targets = [shutterBox, frameLabel].filter((t): t is HTMLElement => t !== null);
      gsap.set(shutterBox, { clipPath: "inset(48% 0% 48% 0%)" });
      if (frameLabel) gsap.set(frameLabel, { opacity: 0 });
      steps.push({
        el: photo,
        hidden: true,
        block: DUR.reveal,
        state: "idle",
        readyAt: 0,
        build: () => {
          const tl = gsap.timeline({ onComplete: () => void gsap.set(targets, { clearProps: "clipPath,opacity" }) });
          tl.to(shutterBox, { clipPath: "inset(0% 0% 0% 0%)", duration: DUR.reveal, ease: EASE.stick }, 0);
          if (frameLabel) tl.to(frameLabel, { opacity: 1, duration: DUR.fast, ease: "none" }, DUR.reveal * 0.6);
          return tl;
        },
        finish: () => void gsap.set(targets, { clearProps: "clipPath,opacity" }),
      });
    }

    // 3 — the medal ceremony, closed by the brush underline under „Medalje“.
    if (band && podiumLine && !inView(band)) {
      const byKind = (kind: string) => medals.find((m) => m.dataset.podiumMedal === kind);
      const ceremony = CEREMONY_ORDER.map(byKind).filter((m): m is SVGGElement => m !== undefined);
      const parts: Element[] = [podiumLine, ...blocks, ...medals, ...strokes];
      gsap.set(podiumLine, { drawSVG: "0% 0%" });
      gsap.set(blocks, { scaleY: 0, transformOrigin: "50% 100%" });
      gsap.set(medals, { opacity: 0, y: MEDAL_DROP, transformOrigin: "50% 100%" });
      if (strokes.length) gsap.set(strokes, { drawSVG: "0% 0%" });
      const goldTouch = MEDALS_AT + (ceremony.length - 1) * MEDAL_GAP + MEDAL_FALL;
      steps.push({
        el: band,
        hidden: true,
        block: goldTouch + DUR.land,
        state: "idle",
        readyAt: 0,
        build: () => {
          const tl = gsap.timeline({ onComplete: () => void gsap.set(parts, { clearProps: "all" }) });
          // The outline draws; at 60% the solid blocks rise out of the panel (2nd · 1st · 3rd).
          tl.to(podiumLine, { drawSVG: "0% 100%", duration: DUR.reveal, ease: EASE.stick }, 0);
          tl.to(blocks, { scaleY: 1, duration: DUR.reveal, ease: EASE.stick, stagger: STAGGER.cards }, DUR.reveal * 0.6);
          // Medals in ceremony order: they fall with gravity, then stick the landing.
          ceremony.forEach((medal, i) => {
            const at = MEDALS_AT + i * MEDAL_GAP;
            tl.to(medal, { opacity: 1, duration: DUR.tap, ease: "none" }, at);
            tl.to(medal, { y: 0, duration: MEDAL_FALL, ease: "power2.in" }, at);
            tl.fromTo(
              medal,
              { scaleX: 1.12, scaleY: 0.82 },
              { scaleX: 1, scaleY: 1, duration: DUR.land, ease: EASE.land, immediateRender: false },
              at + MEDAL_FALL,
            );
          });
          // The coach's brush marks the wins, 150 ms after gold touches down.
          if (strokes.length) {
            tl.to(strokes, { drawSVG: "0% 100%", duration: DUR.reveal, ease: EASE.stick, stagger: STAGGER.words }, goldTouch + 0.15);
          }
          return tl;
        },
        finish: () => void gsap.set(parts, { clearProps: "all" }),
      });
    }

    // --- Sequencer ------------------------------------------------------------------------
    let running = false;
    const pump = (): void => {
      if (running || !live) return;
      const step = steps.find((s) => s.state === "ready");
      if (!step) return;
      if (performance.now() - step.readyAt > MAX_SEQUENCE_WAIT_MS) {
        // Waited too long behind another step: show it, never a lingering ghost.
        step.state = "done";
        step.finish();
        pump();
        return;
      }
      running = true;
      step.state = "running";
      const block = step.block * 1000;
      void queuePrimaryMotion(block).then(() => {
        if (!live) return;
        context.add(() => step.build());
        later(() => {
          step.state = "done";
          running = false;
          pump();
        }, block);
      });
    };
    const makeReady = (step: Step) => {
      if (step.state !== "idle") return;
      step.state = "ready";
      step.readyAt = performance.now();
      pump();
    };

    const stepIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const step = steps.find((s) => s.el === entry.target);
          stepIo.unobserve(entry.target);
          if (step) makeReady(step);
        }
      },
      { rootMargin: STEP_LINE },
    );
    for (const step of steps) {
      stepIo.observe(step.el);
      if (step.hidden) guard(step.el, () => step.state === "idle", () => makeReady(step));
    }
    observers.push(stepIo);

    /** MD-02 safety net: ≥50% in view for 300 ms while still waiting for its trigger. */
    function guard(el: Element, waiting: () => boolean, go: () => void) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const io = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (!entry) return;
          if (!waiting()) {
            io.disconnect();
            return;
          }
          if (shareInView(entry) >= 0.5) {
            timer ??= later(() => {
              io.disconnect();
              if (waiting()) go();
            }, SAFETY_MS);
          } else if (timer) {
            clearTimeout(timer);
            timers.delete(timer);
            timer = undefined;
          }
        },
        { threshold: [0, 0.25, 0.5, 0.75, 1] },
      );
      io.observe(el);
      observers.push(io);
    }

    return () => {
      live = false;
      observers.forEach((o) => o.disconnect());
      timers.forEach((t) => clearTimeout(t));
      // The context has already reverted the tweens and the pre-states (and the split).
      unsplit();
    };
  });

  return () => mm.revert();
}
