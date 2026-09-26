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
 *     2. phones only (<1024, and only where the whole frame fits between the header and the
 *        dock line — not in phone landscape): photo 01's shutter opens from a slit (scroll = the
 *        camera);
 *     3. the medal ceremony: the podium outline draws, the blocks rise out of the panel, the
 *        medals drop onto their steps bronze → silver → gold and stick the landing, then the
 *        white brush underline sweeps under „Medalje“.
 *   A step starts when its element crosses the −18% line and the running step has finished,
 *   through queuePrimaryMotion (≤250 ms). The ceremony waits for more (RC3-01): the whole
 *   „Medalje“ title must stand clear above the phone dock (plus 36 px of air), or from 1024 up
 *   12% above the fold — the podium band sits right above that title, so the ceremony and its
 *   closing brush always play where they are seen. The shutter waits too (RC4-01): 85% of the
 *   photo must stand above that same dock line — on portrait screens the whole frame clear of
 *   the dock — so the slit is in plain view when it starts to widen. Nothing ever pops
 *   (design review v2, RC2-01/MD2-06):
 *     · an off-screen step never blocks a visible one — a running step whose element has left
 *       the viewport completes invisibly the moment another step is waiting, and a step whose
 *       element is off-screen when its turn comes is finished without animating;
 *     · a visible step that has been ≥50% in view for more than 600 ms by its turn plays a
 *       compressed version instead (the scan and the shutter at 2.5× speed, the ceremony as a
 *       ≤700 ms short form) — never a jump cut from ghost to final state.
 *
 * Hidden pre-states (title lines, photo slit, podium parts, brush) are set by JS only for
 * elements still off-screen at arm time. Safety net (MD-02): a pre-hidden element that has
 * been ≥50% in view for 300 ms without its trigger joins the sequence now (the ceremony: its
 * title wholly above its own line for 300 ms; the shutter: the reader has stopped scrolling
 * for 300 ms with the slit in clear view, between the shown header and the dock). Under
 * gsap.matchMedia(MQ.noReduce): a live switch to reduced motion reverts every inline state
 * and the split at once. Only transform, opacity, clip-path and
 * stroke-dashoffset/-dasharray change.
 */
import type { SplitText as SplitTextInstance } from "gsap/SplitText";
import { DUR, EASE, MQ, STAGGER, gsap, loadDrawSVG, loadSplitText, queuePrimaryMotion, registerMotion } from "@/lib/motion";

/** The title's lines rise once it is this far into the viewport. */
const TITLE_LINE = "0px 0px -15% 0px";
/** Primary steps start once their element is this far into the viewport. */
const STEP_LINE = "0px 0px -18% 0px";
/**
 * RC3-01: the medal ceremony starts only once the „Medalje“ title stands wholly above this line:
 * phones and tablets (the dock is shown below 1024) — the dock's height plus this much air;
 * from 1024 up — 12% above the fold. The podium band sits directly above the title.
 * RC4-01: the phone shutter uses the same dock line.
 */
const DOCK_AIR = 36;
const CEREMONY_LINE_WIDE = "0px 0px -12% 0px";
/** The dock's cover (60 px capsule + 8 px gap) if it cannot be measured. */
const DOCK_COVER_FALLBACK = 68;
/** RC2-01: ≥50% in view for longer than this by its turn → the step plays compressed. */
const MAX_SEQUENCE_WAIT_MS = 600;
/** The compressed scan and shutter run this much faster (the shutter ≈ 240 ms). */
const FAST = 2.5;
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

/* --- Photo 01 shutter (phones) ---------------------------------------------------------------
   Symmetric insets in the browser's own two-value serialization (RC4-01), so every frame is
   „inset(x% 0%)“ with top = bottom: the slit widens from the middle. */
const SHUTTER_SLIT = "inset(48% 0%)";
const SHUTTER_OPEN = "inset(0% 0%)";
/**
 * RC4-01 (v2): the shutter fires only once this share of the photo stands above the dock line
 * (the dock's cover + DOCK_AIR; the shown header's height kept clear at the top). The whole
 * frame then stands clear of the dock (its last 15% sits in the 36 px of air): the slit is in
 * plain view and both edges open where they are seen, instead of a blind rising out of the
 * dock. Where that much of the frame cannot fit between the shown header and the dock line
 * (phone landscape: 390 px tall, 74 px header, 104 px dock line, a 270 px photo), a reader can
 * never see the shutter whole, so the photo is simply shown there, as from 1024 up.
 */
const SHUTTER_NEED = 0.85;
/** The slit's share of the photo's height (inset 48% top and bottom). */
const SLIT_SHARE = 0.04;

/* --- Medal ceremony ------------------------------------------------------------------------ */
const CEREMONY_ORDER = ["bronze", "silver", "gold"] as const;
/** Medals follow the outline; 140 ms apart; each falls 240 ms, then sticks the landing. */
const MEDALS_AT = DUR.reveal * 0.95;
const MEDAL_GAP = 0.14;
const MEDAL_FALL = 0.24;
const MEDAL_DROP = -28;
/* The compressed ceremony (MD2-06, ≤700 ms): blocks rise together with the outline, the medals
   drop a short way 40 ms apart and stick the landing, the brush draws in 300 ms. */
const SHORT_RISE = 0.24;
const SHORT_MEDALS_AT = 0.16;
const SHORT_MEDAL_GAP = 0.04;
const SHORT_MEDAL_FALL = 0.18;
const SHORT_MEDAL_DROP = -16;
const SHORT_BRUSH = 0.3;

interface Gate {
  el: Element;
  /** IntersectionObserver rootMargin. */
  line: string;
  thresholds: number[];
  reached: (entry: IntersectionObserverEntry) => boolean;
}

interface Step {
  /** The element whose on-/off-screen state decides finish-unseen and release. */
  el: Element;
  /**
   * RC3-01/RC4-01: when set, the step becomes ready (and counts as „seen“) only while the gate
   * is `reached` inside the root shrunk by `line` — instead of `el` crossing STEP_LINE.
   */
  gate?: Gate;
  /**
   * The MD-02 net for a gated step: by default the gate itself held for 300 ms; „parked“ (the
   * shutter) = the reader stopped scrolling for 300 ms with the slit in clear view.
   */
  net?: "parked";
  /** JS pre-hid something (the safety net applies). */
  hidden: boolean;
  /** Seconds the sequence stays blocked once the step starts (normal · compressed). */
  block: number;
  fastBlock: number;
  /** The step's timeline; `fast` = the compressed version (RC2-01/MD2-06). */
  build: (fast: boolean) => gsap.core.Animation;
  /** The static final state — only ever applied while the element is off-screen. */
  finish: () => void;
  state: "idle" | "ready" | "running" | "done";
  /** performance.now() since the element is ≥50% in view (0 = not now). */
  seenAt: number;
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

/** How far the phone dock covers the bottom of the viewport (null: no dock here), at arm time. */
function dockCover(): number | null {
  const dock = document.querySelector<HTMLElement>("[data-sticky-bar]");
  if (!dock || window.matchMedia("(min-width: 1024px)").matches) return null;
  const cs = getComputedStyle(dock);
  if (cs.display === "none") return null;
  return Math.round(dock.offsetHeight + (parseFloat(cs.bottom) || 0)) || DOCK_COVER_FALLBACK;
}

/** IntersectionObserver rootMargin for the ceremony gate (RC3-01), read once at arm time. */
function ceremonyLine(): string {
  const cover = dockCover();
  return cover === null ? CEREMONY_LINE_WIDE : `0px 0px -${cover + DOCK_AIR}px 0px`;
}

const siteHeader = (): HTMLElement | null => document.querySelector<HTMLElement>("[data-site-header]");

/**
 * RC4-01: the shutter's gate — SHUTTER_NEED of the photo inside the viewport minus the header's
 * height at the top and the dock line at the bottom. It observes the unclipped figure, not the
 * photo box: Chromium's IntersectionObserver honours the target's own clip-path, so the slit box
 * would only ever report its 4% slit. The figure's thresholds are where the photo's share can
 * first reach SHUTTER_NEED entering from below (its top in view) or from above (its foot and the
 * caption in view); the photo's own share is then measured from the entry.
 * null: the frame cannot stand that far clear between header and dock line — no shutter.
 */
function shutterGate(fig: HTMLElement, box: HTMLElement): Omit<Gate, "el"> | null {
  const top = siteHeader()?.offsetHeight ?? 0;
  const bottom = (dockCover() ?? 0) + DOCK_AIR;
  const f = fig.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  if (b.height <= 0 || f.height <= 0) return null;
  if ((window.innerHeight - top - bottom) / b.height - 0.02 < SHUTTER_NEED) return null;
  const share = SHUTTER_NEED * b.height;
  const at = (px: number) => Math.min(1, Math.round((px / f.height) * 1000) / 1000);
  const thresholds = [...new Set([0, at(b.top - f.top + share), at(f.bottom - b.bottom + share)])].sort((x, y) => x - y);
  const reached = (entry: IntersectionObserverEntry): boolean => {
    if (!entry.isIntersecting) return false;
    const fNow = fig.getBoundingClientRect();
    const bNow = box.getBoundingClientRect();
    const e = entry.boundingClientRect;
    const photoTop = e.top + (bNow.top - fNow.top);
    const photoBottom = e.bottom - (fNow.bottom - bNow.bottom);
    const rootTop = entry.rootBounds?.top ?? top;
    const rootBottom = entry.rootBounds?.bottom ?? window.innerHeight - bottom;
    const inside = Math.min(photoBottom, rootBottom) - Math.max(photoTop, rootTop);
    return bNow.height > 0 && inside / bNow.height >= SHUTTER_NEED - 0.01;
  };
  return { line: `-${top}px 0px -${bottom}px 0px`, thresholds, reached };
}

/** The band of the viewport a reader sees between the shown header and the shown dock. */
function clearBand(): { top: number; bottom: number } {
  const header = siteHeader();
  const top = header && header.dataset.hidden !== "true" ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
  const dock = document.querySelector<HTMLElement>("[data-sticky-bar]");
  const dockStyle = dock ? getComputedStyle(dock) : null;
  const dockShown = dock && dockStyle && dockStyle.display !== "none" && dockStyle.visibility !== "hidden";
  const bottom = dockShown ? Math.min(window.innerHeight, dock.getBoundingClientRect().top) : window.innerHeight;
  return { top, bottom };
}

/** The whole slit (photo centre) is in view right now: below the shown header, above the dock. */
function slitClear(box: HTMLElement): boolean {
  const r = box.getBoundingClientRect();
  if (r.height <= 0) return false;
  const slit = r.top + r.height / 2;
  const clear = (r.height * SLIT_SHARE) / 2;
  const { top, bottom } = clearBand();
  return slit >= top + clear && slit <= bottom - clear;
}

/** At least this much of the (still closed) frame is in the clear band: it reads as an empty box. */
const EMPTY_FRAME_PX = 48;

/** A reader parked on part of the frame sees an empty paper box: never leave it waiting. */
function frameShown(box: HTMLElement): boolean {
  const r = box.getBoundingClientRect();
  const { top, bottom } = clearBand();
  return Math.min(r.bottom, bottom) - Math.max(r.top, top) >= EMPTY_FRAME_PX;
}

/** The whole element is inside the (margin-shrunk) root. */
const wholly = (entry: IntersectionObserverEntry): boolean => entry.isIntersecting && entry.intersectionRatio >= 0.99;

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
  const medalsTitle = root.querySelector<HTMLElement>(".medals__title");

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
      const block = (n - 1) * SCAN_STAGGER + SCAN;
      steps.push({
        el: scoreboard,
        hidden: false,
        block,
        fastBlock: block / FAST,
        state: "idle",
        seenAt: 0,
        build: (fast) => {
          const tl = gsap.timeline({ onComplete: () => void gsap.set(scores, { clearProps: "clipPath,opacity" }) });
          scores.forEach((score, i) => {
            const at = i * SCAN_STAGGER;
            for (let k = 0; k <= ROWS; k++) tl.set(score, { clipPath: litRows(k) }, at + (k * SCAN) / ROWS);
          });
          // The score holds: one blink of the whole board (a single flash, far below 3/s).
          tl.to(scores, { opacity: 0.55, duration: BLINK_DIM, ease: "none" }, blinkAt);
          tl.to(scores, { opacity: 1, duration: BLINK_BACK, ease: "none" }, blinkAt + BLINK_DIM);
          return fast ? tl.timeScale(FAST) : tl;
        },
        finish: () => void gsap.set(scores, { clearProps: "clipPath,opacity" }),
      });
    }

    // 2 — phones: photo 01 opens like a shutter, then its KR-01 frame label appears.
    const shutterBox = photo?.querySelector<HTMLElement>(".photo") ?? null;
    const frameLabel = photo?.querySelector<HTMLElement>(".frame-label") ?? null;
    const phone = window.matchMedia("(max-width: 1023.98px)").matches;
    const shutter = photo && shutterBox && phone && !inView(photo) ? shutterGate(photo, shutterBox) : null;
    if (photo && shutterBox && shutter) {
      const targets = [shutterBox, frameLabel].filter((t): t is HTMLElement => t !== null);
      // RC4-01: the two-value form at both ends. The browser serializes a symmetric inset to
      // „inset(48% 0%)“, and GSAP pairs the numbers of the start and end strings in order — a
      // four-value end would leave the bottom inset without a partner and snap it to 0 on the
      // first frame (half the photo at once instead of a slit widening from the middle).
      gsap.set(shutterBox, { clipPath: SHUTTER_SLIT });
      if (frameLabel) gsap.set(frameLabel, { opacity: 0 });
      steps.push({
        el: photo,
        // RC4-01: the start waits for 85% of the photo to stand above the dock line (the whole
        // frame clear of the dock on portrait screens), read on the unclipped figure.
        gate: { el: photo, ...shutter },
        net: "parked",
        hidden: true,
        block: DUR.reveal,
        fastBlock: DUR.reveal / FAST,
        state: "idle",
        seenAt: 0,
        build: (fast) => {
          const tl = gsap.timeline({ onComplete: () => void gsap.set(targets, { clearProps: "clipPath,opacity" }) });
          tl.fromTo(shutterBox, { clipPath: SHUTTER_SLIT }, { clipPath: SHUTTER_OPEN, duration: DUR.reveal, ease: EASE.stick }, 0);
          if (frameLabel) tl.to(frameLabel, { opacity: 1, duration: DUR.fast, ease: "none" }, DUR.reveal * 0.6);
          return fast ? tl.timeScale(FAST) : tl;
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
      const shortGoldTouch = SHORT_MEDALS_AT + (ceremony.length - 1) * SHORT_MEDAL_GAP + SHORT_MEDAL_FALL;
      /** MD2-06: the short form — the same ceremony, every part still moving, ≤700 ms. */
      const buildShort = () => {
        const tl = gsap.timeline({ onComplete: () => void gsap.set(parts, { clearProps: "all" }) });
        tl.to(podiumLine, { drawSVG: "0% 100%", duration: SHORT_RISE, ease: EASE.stick }, 0);
        tl.to(blocks, { scaleY: 1, duration: SHORT_RISE, ease: EASE.stick }, 0);
        ceremony.forEach((medal, i) => {
          const at = SHORT_MEDALS_AT + i * SHORT_MEDAL_GAP;
          tl.fromTo(medal, { y: SHORT_MEDAL_DROP }, { y: 0, duration: SHORT_MEDAL_FALL, ease: "power2.in", immediateRender: false }, at);
          tl.to(medal, { opacity: 1, duration: DUR.tap * 0.6, ease: "none" }, at);
          tl.fromTo(
            medal,
            { scaleX: 1.08, scaleY: 0.88 },
            { scaleX: 1, scaleY: 1, duration: DUR.land, ease: EASE.land, immediateRender: false },
            at + SHORT_MEDAL_FALL,
          );
        });
        if (strokes.length) {
          tl.to(strokes, { drawSVG: "0% 100%", duration: SHORT_BRUSH, ease: EASE.stick }, shortGoldTouch - 0.02);
        }
        return tl;
      };
      steps.push({
        el: band,
        // RC3-01: the band stays the on-/off-screen element; the start waits for the title.
        ...(medalsTitle ? { gate: { el: medalsTitle, line: ceremonyLine(), thresholds: [0, 1], reached: wholly } } : {}),
        hidden: true,
        block: goldTouch + DUR.land,
        fastBlock: shortGoldTouch + DUR.land,
        state: "idle",
        seenAt: 0,
        build: (fast) => {
          if (fast) return buildShort();
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
    /** The running step: its timeline once built, and the timer that frees the sequence. */
    interface Run {
      step: Step;
      tl?: gsap.core.Animation;
      timer?: ReturnType<typeof setTimeout>;
      over: boolean;
    }
    let current: Run | null = null;
    /** A released step's own busy time must not hold up the next step in the shared queue. */
    let afterRelease = false;

    const settle = (step: Step) => {
      step.state = "done";
      current = null;
      pump();
    };

    /** The running step's element has left the viewport: complete it where nobody sees it. */
    const release = () => {
      const run = current;
      if (!run) return;
      run.over = true;
      if (run.timer) {
        clearTimeout(run.timer);
        timers.delete(run.timer);
      }
      // kill(), not progress(1): finish() clears the animated props to the final CSS state, and
      // jumping the timeline to its end would first render every unstarted tween (GSAP unit
      // conversion → a forced layout each; a 70 ms task at 4× CPU in qa/trace).
      run.tl?.kill();
      run.step.finish();
      afterRelease = true;
      settle(run.step);
    };

    function pump(): void {
      if (!live) return;
      const waiting = steps.find((s) => s.state === "ready");
      if (current) {
        // An off-screen step never blocks a visible one (RC2-01).
        if (waiting && !inView(current.step.el)) release();
        return;
      }
      if (!waiting) return;
      const step = waiting;
      if (!inView(step.el)) {
        // Scrolled past (or back above) before its turn: final state, off-screen — no pop.
        step.state = "done";
        step.finish();
        pump();
        return;
      }
      // Seen for a while already (a fast flick or jump): the compressed version, never a snap.
      const fast = step.seenAt > 0 && performance.now() - step.seenAt > MAX_SEQUENCE_WAIT_MS;
      const block = (fast ? step.fastBlock : step.block) * 1000;
      const run: Run = { step, over: false };
      current = run;
      step.state = "running";
      const maxWait = fast || afterRelease ? 0 : undefined;
      afterRelease = false;
      void queuePrimaryMotion(block, maxWait).then(() => {
        if (!live || run.over) return;
        context.add(() => {
          run.tl = step.build(fast);
        });
        run.timer = later(() => {
          run.over = true;
          settle(step);
        }, block);
      });
    }

    const makeReady = (step: Step) => {
      if (step.state !== "idle") return;
      step.state = "ready";
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
    // How long each step has been ≥50% in view (a gated step: its gate, below), and whether a
    // running step has left the viewport (then it must not hold up the next one).
    const seenIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const step = steps.find((s) => s.el === entry.target);
          if (!step) continue;
          if (step.state === "done") {
            seenIo.unobserve(entry.target);
            continue;
          }
          if (!step.gate) {
            if (shareInView(entry) >= 0.5) step.seenAt ||= performance.now();
            else step.seenAt = 0;
          }
          if (!entry.isIntersecting && current?.step === step) pump();
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    for (const step of steps) {
      seenIo.observe(step.el);
      const waiting = () => step.state === "idle";
      const go = () => makeReady(step);
      if (step.gate) {
        // RC3-01/RC4-01: ready (and „seen“) only while the gate's share stands inside its line.
        const gate = step.gate;
        const gateIo = new IntersectionObserver(
          (entries) => {
            const entry = entries[entries.length - 1];
            if (!entry) return;
            if (step.state === "done") {
              gateIo.disconnect();
              return;
            }
            if (gate.reached(entry)) {
              step.seenAt ||= performance.now();
              makeReady(step);
            } else step.seenAt = 0;
          },
          { rootMargin: gate.line, threshold: gate.thresholds },
        );
        gateIo.observe(gate.el);
        observers.push(gateIo);
        if (step.hidden) {
          if (step.net === "parked" && shutterBox) parked(gate.el, shutterBox, waiting, go);
          else guard(gate.el, waiting, go, gate);
        }
      } else {
        stepIo.observe(step.el);
        if (step.hidden) guard(step.el, waiting, go);
      }
    }
    observers.push(stepIo, seenIo);

    /**
     * MD-02 safety net: ≥50% in view for 300 ms while still waiting for its trigger. With a
     * `gate` (the ceremony, RC3-01): the gate's share inside its line for 300 ms.
     */
    function guard(el: Element, waiting: () => boolean, go: () => void, gate?: Gate) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const io = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (!entry) return;
          if (!waiting()) {
            io.disconnect();
            return;
          }
          if (gate ? gate.reached(entry) : shareInView(entry) >= 0.5) {
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
        gate ? { rootMargin: gate.line, threshold: gate.thresholds } : { threshold: [0, 0.25, 0.5, 0.75, 1] },
      );
      io.observe(el);
      observers.push(io);
    }

    /**
     * MD-02 net for the shutter (RC4-01): a reader who stops scrolling short of the gate (the
     * frame's foot still behind the dock) gets the opening once the page has been still for
     * 300 ms with the whole slit in view, or with ≥48 px of the still-closed frame in view (an
     * empty box must never wait; the visible part then sees the aperture wipe open). A passive scroll listener lives only while the figure is on screen and waiting.
     */
    function parked(fig: Element, box: HTMLElement, waiting: () => boolean, go: () => void) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let movedAt = 0;
      let listening = false;
      const onScroll = () => {
        movedAt = performance.now();
        timer ??= later(check, SAFETY_MS + 10);
      };
      const stop = () => {
        if (timer) {
          clearTimeout(timer);
          timers.delete(timer);
          timer = undefined;
        }
        if (listening) window.removeEventListener("scroll", onScroll);
        listening = false;
      };
      const check = () => {
        timer = undefined;
        if (!waiting()) {
          stop();
          io.disconnect();
          return;
        }
        const still = performance.now() - movedAt;
        if (still < SAFETY_MS) timer = later(check, SAFETY_MS - still + 10);
        else if (slitClear(box) || frameShown(box)) {
          // With the slit behind the dock the visible part of the frame sees the aperture's edge
          // wipe open — a reveal, never an empty box left waiting (RC4-01 round 4).
          stop();
          io.disconnect();
          go();
        }
        // Still, but not enough of the frame in clear view: the next scroll re-arms the check.
      };
      const io = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (!entry) return;
          if (!waiting()) {
            stop();
            io.disconnect();
            return;
          }
          if (!entry.isIntersecting) {
            stop();
            return;
          }
          if (!listening) window.addEventListener("scroll", onScroll, { passive: true });
          listening = true;
          onScroll();
        },
        { threshold: [0] },
      );
      io.observe(fig);
      observers.push(io, { disconnect: stop });
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
