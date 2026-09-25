/**
 * S6 motion (§4 Coaches; design review AC-11, MI-AC-2/3/4, MI-09, MD-14), loaded lazily by
 * CoachesMotion — never in the first-load JS.
 *  - Portrait „from a crouch“: the whole print (paper included) rises out of the card —
 *    clip-path inset(100% 0 0 0) → inset(0), y 12 → 0, the image 1.08 → 1 — .6 s ease stick.
 *  - KR-07 Marey plate (no portrait yet): always the finished static plate, like the
 *    timeline's (AC2-03) — the card's only motion is the stamp press, armed by the stamp's
 *    OWN visibility (AC3-01): it comes down once the whole stamp is in view, clear of the
 *    mobile dock (its height + 24 px) or above the lowest 12 % of the viewport from 1024 px
 *    up (and below the fixed header when scrolled back into view from above), after the
 *    „Trenerice“ title mark has finished landing (≤800 ms). A stamp left at least half in
 *    view for 900 ms (the reader stopped short of it) is pressed then.
 *  - „Licenca GSS“ stamp press: ≤120 ms after the print lands the stamp comes down fast
 *    (scale 1.35 → .94, rotate −8° → 0, EASE.takeoff), settles (.94 → 1, EASE.land), a one-off
 *    ink ring spreads from the rim and the print under it gives 1.5 px.
 *  - Brush annotation over photo 05, drawn at hand speed with DrawSVG (MI-AC-4): the loaded
 *    core 0 → 100 % in .72 s, the four bristles +.04–.12 s behind it, each lifting off the
 *    paper along its own flick (≤.92 s in all).
 *
 * Content is never held back behind decoration: a portrait card starts when 20 % of it is in
 * view, through queuePrimaryMotion() (≤250 ms wait) — no wait for the section title's landing
 * (an accent). Safety net: a pre-hidden portrait card ≥50 % in view for 300 ms without having
 * started is shown in its final state at once. The brush is decoration: it is committed to
 * play when the reader pauses on the print (half in view, no scroll for 300 ms; or 1.4 s in
 * view), after the card reveals still running (≤1.2 s).
 * It takes a primary-motion slot for its draw, and — being decoration — it waits for a
 * primary motion already running (another section's, e.g. the S7 score scan) instead of
 * overlapping it; content arriving while it draws queues behind it (≤250 ms, RC2-08).
 *
 * Hidden pre-states are set by JS only for elements still off-screen (deep links and restored
 * scroll keep the static final state). gsap.matchMedia reverts everything if reduced motion is
 * switched on. Only clip-path, transform, opacity and stroke-dashoffset animate; no rAF loop.
 */
import { DUR, EASE, MQ, gsap, loadDrawSVG, queuePrimaryMotion, registerMotion } from "@/lib/motion";

const REVEAL_THRESHOLD = 0.2;
const SAFETY_THRESHOLD = 0.5;
const SAFETY_MS = 300;
/** The stamp comes down this long after the print has landed (≤120 ms)… */
const STAMP_GAP = 0.08;
/** …or, on the static KR-07 plate, this long after the whole stamp is in view (AC3-01). */
const PLATE_STAMP_GAP = 0.05;
/** The plate stamp's press line from 1024 px up: above the lowest 12 % of the viewport. */
const STAMP_BOTTOM_WIDE = "-12%";
/** Below 1024 px: clear of the sticky dock by this much (px)… */
const DOCK_CLEAR = 24;
/** …or this whole margin when the dock cannot be measured. */
const DOCK_MARGIN_FALLBACK = 112;
/** A plate stamp at least half in view (above the dock) this long is pressed anyway (ms). */
const STAMP_LINGER_MS = 900;
/** Longest the plate stamp waits for the section title's landing to finish (ms). */
const TITLE_WAIT_MS = 800;
/** Stamp downstroke / ink ring. */
const PRESS = 0.14;
/** Minimum gap between two cards' stamp presses (ms). */
const STAMP_STAGGER_MS = 140;
/** The print's clip reaches past its box at the end, so its hairline and shadow are never cut. */
const CLIP_BLEED = 40;
/** Longest the brush waits for card reveals still running (or about to start beside it). */
const BRUSH_WAIT_FOR_CARDS_MS = 1200;
/** A pending card whose top is within this fraction of a viewport below the fold counts as „about to start“. */
const JOIN_BELOW = 0.35;
/** The hand starts when the reader pauses on the print: half in view and no scroll for this long… */
const BRUSH_DWELL_MS = 300;
/** …or once it has been in view this long, however they scroll. */
const BRUSH_VIEW_MAX_MS = 1400;
/** Brush draw (s): the core, the bristles' lag behind it, and its primary-motion slot. */
const CORE_DRAW = 0.72;
const BRISTLE_LAG = [0.04, 0.06, 0.09, 0.12] as const;
const BRUSH_MS = 920;
/** Decoration yields: the longest the brush waits for a primary motion already running… */
const BRUSH_YIELD_MS = 1600;
/** …and the pause it leaves after one. */
const BRUSH_BREATH_MS = 220;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const inView = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

/** Share of the element's height inside the viewport. */
const shownShare = (el: Element): number => {
  const r = el.getBoundingClientRect();
  return r.height ? Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)) / r.height : 0;
};

type State = "pending" | "queued" | "playing" | "done";

interface Card {
  el: HTMLElement;
  /** What arms the card: the card itself (portrait), or its stamp (the KR-07 plate). */
  anchor: HTMLElement;
  plate: boolean;
  state: State;
  /** Seconds, for the primary-motion queue. */
  duration: number;
  play: (onDone: () => void) => void;
  showStatic: () => void;
}

/** Height the sticky dock covers at the bottom of the viewport (px); 0 from 1024 up. */
function dockCover(): number {
  const dock = document.querySelector<HTMLElement>("[data-sticky-bar]");
  if (!dock) return DOCK_MARGIN_FALLBACK - DOCK_CLEAR;
  const cs = getComputedStyle(dock);
  if (cs.display === "none") return 0;
  return Math.round(dock.offsetHeight + (parseFloat(cs.bottom) || 0));
}

/** Height the fixed site header covers at the top of the viewport (px): a stamp scrolled back
 *  into view from above presses below it, not behind it. */
function headerCover(): number {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  if (!header) return 0;
  const cs = getComputedStyle(header);
  if (cs.position !== "fixed" && cs.position !== "sticky") return 0;
  return Math.round(header.offsetHeight + (parseFloat(cs.top) || 0));
}

/** Resolves when the section title's mark has finished its landing (or at once, or ≤ maxMs). */
function titleLanded(root: HTMLElement, maxMs: number): Promise<void> {
  const mark = root.querySelector(".chrono-mark");
  const running = mark?.getAnimations?.({ subtree: true }).filter((a) => a.playState === "running") ?? [];
  if (running.length === 0) return Promise.resolve();
  return Promise.race([Promise.all(running.map((a) => a.finished.catch(() => undefined))).then(() => undefined), sleep(maxMs)]);
}

export function armCoaches(root: HTMLElement): () => void {
  registerMotion();
  let disposed = false;
  const mm = gsap.matchMedia();

  mm.add(MQ.noReduce, (context) => {
    let live = true;
    const cards: Card[] = [];
    let lastPress = -Infinity;

    root.querySelectorAll<HTMLElement>("[data-coach]").forEach((el) => {
      const frame = el.querySelector<HTMLElement>("[data-coach-portrait] .frame");
      const stamp = el.querySelector<HTMLElement>("[data-coach-stamp]");
      const layers = stamp ? Array.from(stamp.querySelectorAll<SVGSVGElement>(".licence-stamp__layer")) : [];
      const splash = stamp?.querySelector<SVGElement>("[data-stamp-splash]");
      if (!frame || !stamp || layers.length === 0 || !splash) return;

      // The KR-07 plate is always the finished static plate: that card's motion is the stamp alone.
      const plate = el.querySelector<HTMLElement>("[data-coach-plate]");
      const img = plate ? null : frame.querySelector<HTMLElement>("img");
      if (!plate && !img) return;
      // On screen at arm time (the card, or on the plate card its stamp): keep the static final state.
      if (inView(plate ? stamp : el)) return;
      const cleared = [frame, stamp, ...layers, splash, ...(img ? [img] : [])];

      // --- Pre-states -------------------------------------------------------------------
      if (img) {
        gsap.set(frame, { clipPath: `inset(${frame.offsetHeight}px -${CLIP_BLEED}px 0px -${CLIP_BLEED}px)`, y: 12 });
        gsap.set(img, { scale: 1.08, transformOrigin: "50% 100%" });
      }
      gsap.set(layers, { autoAlpha: 0, scale: 1.35, rotation: -8, y: -10, transformOrigin: "50% 50%" });

      /** When the stamp comes down (s from the card's start). */
      const pressAtStart = img ? DUR.reveal + STAMP_GAP : PLATE_STAMP_GAP;
      const duration = pressAtStart + PRESS + Math.max(DUR.base, DUR.land);

      const card: Card = {
        el,
        anchor: plate ? stamp : el,
        plate: Boolean(plate),
        state: "pending",
        duration,
        play: (onDone) => {
          // Two cards revealing together press their stamps one after the other, never as one thud.
          let press = pressAtStart;
          const pressAt = performance.now() + press * 1000;
          if (Math.abs(pressAt - lastPress) < STAMP_STAGGER_MS) press += (lastPress + STAMP_STAGGER_MS - pressAt) / 1000;
          lastPress = performance.now() + press * 1000;
          const tl = gsap.timeline({
            onComplete: () => {
              gsap.set(cleared, { clearProps: "transform,opacity,visibility,clipPath" });
              onDone();
            },
          });
          if (img) {
            tl.to(frame, { clipPath: `inset(-${CLIP_BLEED}px -${CLIP_BLEED}px -${CLIP_BLEED}px -${CLIP_BLEED}px)`, y: 0, duration: DUR.reveal, ease: EASE.stick }, 0)
              .to(img, { scale: 1, duration: DUR.reveal, ease: EASE.stick }, 0);
          }
          // The judge's stamp: fast down, press, hold.
          tl.to(layers, { autoAlpha: 1, duration: 0.08, ease: "none" }, press)
            .to(layers, { scale: 0.94, y: 0, rotation: 0, duration: PRESS, ease: EASE.takeoff }, press)
            .to(layers, { scale: 1, duration: DUR.land, ease: EASE.land }, press + PRESS)
            .fromTo(
              splash,
              { opacity: 0.4, scale: 1, transformOrigin: "50% 50%" },
              { opacity: 0, scale: 1.16, duration: DUR.base, ease: EASE.stick, immediateRender: false },
              press + PRESS,
            )
            .to(frame, { y: 1.5, duration: 0.06, ease: "power2.out", yoyo: true, repeat: 1 }, press + PRESS);
        },
        showStatic: () => {
          gsap.set(cleared, { clearProps: "transform,opacity,visibility,clipPath" });
        },
      };
      cards.push(card);
    });

    // --- Card triggers + safety net -------------------------------------------------------
    const byEl = new Map(cards.map((c) => [c.anchor as Element, c]));
    const start = (card: Card) => {
      if (card.state !== "pending") return;
      card.state = "queued";
      // The plate's stamp follows the „Trenerice“ mark's landing instead of overlapping it.
      void (card.plate ? titleLanded(root, TITLE_WAIT_MS) : Promise.resolve())
        .then(() => queuePrimaryMotion(card.duration * 1000))
        .then(() => {
          if (!live || card.state !== "queued") return;
          card.state = "playing";
          context.add(() =>
            card.play(() => {
              card.state = "done";
            }),
          );
        });
    };
    const revealIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const card = byEl.get(e.target);
          if (!e.isIntersecting || !card) continue;
          revealIo.unobserve(e.target);
          start(card);
        }
      },
      { threshold: REVEAL_THRESHOLD },
    );
    const timers = new Map<Card, ReturnType<typeof setTimeout>>();
    const safetyIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const card = byEl.get(e.target);
          if (!card) continue;
          const t = timers.get(card);
          if (t) clearTimeout(t);
          timers.delete(card);
          if (!e.isIntersecting || card.state !== "pending") continue;
          timers.set(
            card,
            setTimeout(() => {
              if (!live || card.state !== "pending") return;
              card.state = "done"; // never leave a frame hidden in view
              card.showStatic();
            }, SAFETY_MS),
          );
        }
      },
      { threshold: SAFETY_THRESHOLD },
    );
    // The KR-07 plate card (AC3-01): its stamp presses once the whole stamp is in view, clear of
    // the dock on phones and tablets; one left half in view for STAMP_LINGER_MS presses then.
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    const cover = wide ? 0 : dockCover();
    const top = `-${headerCover()}px`;
    const pressIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const card = byEl.get(e.target);
          if (!card || e.intersectionRatio < 0.98) continue;
          pressIo.unobserve(e.target);
          start(card);
        }
      },
      { threshold: [0.98, 1], rootMargin: `${top} 0px ${wide ? STAMP_BOTTOM_WIDE : `-${cover ? cover + DOCK_CLEAR : DOCK_MARGIN_FALLBACK}px`} 0px` },
    );
    const lingerIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const card = byEl.get(e.target);
          if (!card) continue;
          const t = timers.get(card);
          if (t) clearTimeout(t);
          timers.delete(card);
          if (e.intersectionRatio < 0.5 || card.state !== "pending") continue;
          timers.set(
            card,
            setTimeout(() => live && start(card), STAMP_LINGER_MS),
          );
        }
      },
      { threshold: [0, 0.5], rootMargin: `${top} 0px -${cover}px 0px` },
    );
    cards.forEach((c) => {
      if (c.plate) {
        pressIo.observe(c.anchor);
        lingerIo.observe(c.anchor);
      } else {
        revealIo.observe(c.el);
        safetyIo.observe(c.el);
      }
    });

    // --- Brush annotation (DrawSVG) ---------------------------------------------------------
    let brushIo: IntersectionObserver | undefined;
    const brush = root.querySelector<SVGSVGElement>("[data-brush]");
    const cardsBusy = () =>
      cards.some((c) => {
        if (c.state === "playing" || c.state === "queued") return true;
        if (c.state !== "pending") return false;
        const r = c.anchor.getBoundingClientRect(); // desktop: a card beside the print, about to start
        return r.bottom > 0 && r.top < window.innerHeight * (1 + JOIN_BELOW);
      });
    let dwell: ReturnType<typeof setTimeout> | undefined;
    let unwatchBrush: (() => void) | undefined;
    if (brush && !inView(brush)) {
      loadDrawSVG()
        .then(() => {
          if (disposed || !live || inView(brush)) return; // scrolled in while loading → keep it static
          const paths = Array.from(brush.querySelectorAll<SVGPathElement>("[data-brush-path]"));
          const shadow = paths.filter((p) => p.dataset.brushPath === "shadow");
          const core = paths.filter((p) => p.dataset.brushPath === "core");
          const bristles = paths.filter((p) => p.dataset.brushPath === "strand");
          if (core.length === 0) return;
          const showStatic = () => gsap.set([brush, ...paths], { clearProps: "opacity,visibility,strokeDasharray,strokeDashoffset" });
          context.add(() => {
            gsap.set(brush, { autoAlpha: 0 });
            gsap.set(paths, { drawSVG: "0%" });
          });
          const draw = () =>
            context.add(() => {
              const tl = gsap.timeline({ onComplete: showStatic });
              // The loaded core (and its navy under-stroke over the pale wall) at hand speed…
              tl.set(brush, { autoAlpha: 1 }).to([...core, ...shadow], { drawSVG: "100%", duration: CORE_DRAW, ease: EASE.flight }, 0);
              // …each bristle a little behind it along the loop, then off the paper along its flick.
              bristles.forEach((path, i) => {
                const at = BRISTLE_LAG[Math.min(i, BRISTLE_LAG.length - 1)] ?? 0.12;
                const loop = Math.min(0.995, parseFloat(path.dataset.loop ?? "") || 0.95);
                const body = CORE_DRAW - 0.02 - at / 2;
                tl.to(path, { drawSVG: `${loop * 100}%`, duration: body, ease: EASE.flight }, at).to(
                  path,
                  { drawSVG: "100%", duration: 0.04 + (1 - loop) * 1.6, ease: EASE.takeoff }, // the hand leaves the paper
                  at + body,
                );
              });
            });
          const play = async () => {
            const until = performance.now() + BRUSH_WAIT_FOR_CARDS_MS;
            while (live && cardsBusy() && performance.now() < until) await sleep(100);
            if (!live) return;
            // Decoration yields to a primary motion already running (plus a breath for its settle,
            // e.g. the S7 board's blink), then holds the slot for its draw.
            const asked = performance.now();
            await queuePrimaryMotion(BRUSH_MS + BRUSH_BREATH_MS, BRUSH_YIELD_MS);
            if (performance.now() - asked > 30) await sleep(BRUSH_BREATH_MS);
            if (!live) return;
            if (shownShare(brush) >= 0.15) draw();
            else context.add(showStatic); // the reader has moved on: no draw off-screen
          };
          // Committed once the reader pauses on the print: half in view and no scrolling for
          // BRUSH_DWELL_MS (a reader flicking on into S7 lets the score scan go first), or in
          // view for BRUSH_VIEW_MAX_MS however they scroll.
          let ratio = 0;
          let seenAt = 0;
          const arm = () => {
            if (dwell) clearTimeout(dwell);
            dwell = undefined;
            if (ratio < 0.15) return;
            const now = performance.now();
            const pause = ratio >= 0.5 ? BRUSH_DWELL_MS : BRUSH_DWELL_MS * 4;
            const wait = Math.max(0, Math.min(pause, seenAt + BRUSH_VIEW_MAX_MS - now));
            dwell = setTimeout(() => {
              stopWatch();
              void play();
            }, wait);
          };
          const onScroll = () => arm();
          const stopWatch = () => {
            brushIo?.disconnect();
            window.removeEventListener("scroll", onScroll);
          };
          unwatchBrush = stopWatch;
          brushIo = new IntersectionObserver(
            (entries) => {
              ratio = entries[entries.length - 1]?.intersectionRatio ?? 0;
              if (ratio >= 0.15 && !seenAt) seenAt = performance.now();
              if (ratio < 0.15) seenAt = 0;
              arm();
            },
            { threshold: [0, 0.15, 0.5] },
          );
          window.addEventListener("scroll", onScroll, { passive: true });
          brushIo.observe(brush);
        })
        .catch(() => {
          /* decorative — the static stroke stays */
        });
    }

    return () => {
      live = false;
      revealIo.disconnect();
      safetyIo.disconnect();
      pressIo.disconnect();
      lingerIo.disconnect();
      timers.forEach((t) => clearTimeout(t));
      if (dwell) clearTimeout(dwell);
      unwatchBrush?.();
      brushIo?.disconnect();
    };
  });

  return () => {
    disposed = true;
    mm.revert();
  };
}
