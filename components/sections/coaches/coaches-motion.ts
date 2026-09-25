/**
 * S6 motion (§4 Coaches), loaded lazily by CoachesMotion — never in the first-load JS.
 *  - Portrait reveal „from a crouch“: clip-path inset(100% 0 0 0) → inset(0) with the
 *    image scaling 1.08 → 1 (origin bottom), .6 s ease stick.
 *  - „Licenca GSS“ stamp: scale 1.25 → 1, rotate −8° → 0, ease rebound .35 s —
 *    only after the portraits have landed (sequenced, never overlapping).
 *  - Brush annotation over photo 05: DrawSVG (loaded here, lazily), .9 s ease flight.
 *
 * ONE primary motion per viewport:
 *  - the section's own sequences run one after another (a local chain: portraits and
 *    stamps, then the brush — on desktop the print sits beside the cards, so the brush
 *    waits for a card that is still to come on screen or just below it);
 *  - nothing starts while the „Trenerice“ title is still landing (its chrono mark,
 *    styles/ui.css: 0.2 s delay + 0.6 s);
 *  - every sequence also goes through queuePrimaryMotion(), so it waits for another
 *    section's primary motion (e.g. the S5 timeline line) still playing in view.
 * Pending cards on screen or just below it join the batch that starts, so a frame never
 * waits blank for its own turn (on desktop the two stacked cards reveal together).
 *
 * Hidden pre-states are set by JS only for elements still off-screen (deep links and
 * restored scroll keep the static final state). gsap.matchMedia reverts everything if
 * reduced motion is switched on (pending sequences are dropped). Only clip-path,
 * transform, opacity and stroke-dashoffset animate; no rAF loop of its own.
 */
import { DUR, EASE, MQ, STAGGER, gsap, loadDrawSVG, queuePrimaryMotion, registerMotion } from "@/lib/motion";

/** §4: the stamp lands in .35 s with ease rebound. */
const STAMP_DUR = 0.35;
/** Offset between the brush strands (dry-brush bristles). */
const STRAND_STAGGER = STAGGER.words;
/** The section title's chrono landing: styles/ui.css (.chrono-solid 0.2 s delay + 0.6 s). */
const HEADING_LANDING_MS = 800;
/** A pending card whose top is within this fraction of a viewport below the fold joins the batch. */
const JOIN_BELOW = 0.35;
/** Longest the brush waits for a card still to come before drawing anyway. */
const BRUSH_WAIT_FOR_CARDS_MS = 1200;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const inView = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

interface CardParts {
  box: HTMLElement;
  media: Element;
  stamp: HTMLElement;
}

export function armCoaches(root: HTMLElement): () => void {
  registerMotion();
  let disposed = false;
  const mm = gsap.matchMedia();

  mm.add(MQ.noReduce, (context) => {
    let live = true;

    // --- The section title's landing (HeadingLandings sets data-landed) ----------
    const mark = root.querySelector<SVGElement>(".chrono-mark[data-land]");
    let headingEnd = 0;
    let markObserver: MutationObserver | undefined;
    if (mark && !mark.hasAttribute("data-landed")) {
      markObserver = new MutationObserver(() => {
        if (!mark.hasAttribute("data-landed")) return;
        headingEnd = performance.now() + HEADING_LANDING_MS;
        markObserver?.disconnect();
      });
      markObserver.observe(mark, { attributes: true, attributeFilter: ["data-landed"] });
    }
    const headingWait = (): number => {
      // On screen but not landed yet: it lands now (same scroll that brought the cards in).
      if (mark && !mark.hasAttribute("data-landed") && inView(mark)) return HEADING_LANDING_MS;
      return Math.max(0, headingEnd - performance.now());
    };

    // --- Local chain: one sequence at a time --------------------------------------
    let chain: Promise<void> = Promise.resolve();
    const enqueue = (seconds: number, play: () => void) => {
      const run = async () => {
        const wait = headingWait();
        if (wait > 0) await sleep(wait);
        if (!live) return;
        await queuePrimaryMotion(seconds * 1000);
        if (!live) return;
        context.add(play);
        await sleep(seconds * 1000);
      };
      chain = chain.then(run, run);
    };

    // --- Portraits + stamps -------------------------------------------------
    const parts = new Map<Element, CardParts>();
    root.querySelectorAll<HTMLElement>("[data-coach]").forEach((card) => {
      if (inView(card)) return;
      const box = card.querySelector<HTMLElement>("[data-coach-portrait] .photo");
      const media = box?.querySelector("img, svg");
      const stamp = card.querySelector<HTMLElement>("[data-coach-stamp]");
      if (!box || !media || !stamp) return;
      gsap.set(box, { clipPath: "inset(100% 0% 0% 0%)" });
      gsap.set(media, { scale: 1.08, transformOrigin: "50% 100%" });
      gsap.set(stamp, { autoAlpha: 0, scale: 1.25, rotation: -8, transformOrigin: "50% 50%" });
      parts.set(card, { box, media, stamp });
    });

    const playCards = (batch: CardParts[]) => {
      const n = batch.length;
      const boxes = batch.map((p) => p.box);
      const media = batch.map((p) => p.media);
      const stamps = batch.map((p) => p.stamp);
      const portraitsEnd = DUR.reveal + STAGGER.cards * (n - 1);
      const total = portraitsEnd + STAMP_DUR + STAGGER.cards * (n - 1);
      enqueue(total, () => {
        gsap
          .timeline({
            onComplete: () => {
              gsap.set(boxes, { clearProps: "clipPath" });
              gsap.set([...media, ...stamps], { clearProps: "transform,opacity,visibility" });
            },
          })
          .to(boxes, { clipPath: "inset(0% 0% 0% 0%)", duration: DUR.reveal, ease: EASE.stick, stagger: STAGGER.cards }, 0)
          .to(media, { scale: 1, duration: DUR.reveal, ease: EASE.stick, stagger: STAGGER.cards }, 0)
          .to(stamps, { autoAlpha: 1, scale: 1, rotation: 0, duration: STAMP_DUR, ease: EASE.rebound, stagger: STAGGER.cards }, portraitsEnd);
      });
    };

    /** The brush, when it is waiting for the cards (desktop: print beside the cards). */
    let brushAfterCards: (() => void) | undefined;
    let brushTimer: ReturnType<typeof setTimeout> | undefined;
    const releaseBrush = () => {
      const start = brushAfterCards;
      brushAfterCards = undefined;
      if (brushTimer) clearTimeout(brushTimer);
      start?.();
    };

    let cardsIo: IntersectionObserver | undefined;
    if (parts.size > 0) {
      cardsIo = new IntersectionObserver(
        (entries) => {
          const hit = new Set<Element>();
          for (const e of entries) if (e.isIntersecting && parts.has(e.target)) hit.add(e.target);
          if (hit.size === 0) return;
          // Pending cards on screen or just below it (desktop: the second card of the
          // stack) start with this batch — the pair reveals as one, no frame waits blank.
          const reach = window.innerHeight * (1 + JOIN_BELOW);
          parts.forEach((_, card) => {
            const r = card.getBoundingClientRect();
            if (r.bottom > 0 && r.top < reach) hit.add(card);
          });
          const batch: CardParts[] = [];
          parts.forEach((p, card) => {
            if (!hit.has(card)) return;
            batch.push(p);
            cardsIo?.unobserve(card);
          });
          hit.forEach((card) => parts.delete(card));
          playCards(batch);
          if (parts.size === 0) {
            cardsIo?.disconnect();
            releaseBrush();
          }
        },
        { threshold: 0.35 },
      );
      parts.forEach((_, card) => cardsIo?.observe(card));
    }

    // --- Brush annotation (DrawSVG) ------------------------------------------
    let brushIo: IntersectionObserver | undefined;
    const brush = root.querySelector<SVGSVGElement>("[data-brush]");
    if (brush && !inView(brush)) {
      loadDrawSVG()
        .then(() => {
          if (disposed || !live || inView(brush)) return; // scrolled in while loading → keep it static
          const paths = Array.from(brush.querySelectorAll<SVGPathElement>("[data-brush-path]"));
          context.add(() => {
            gsap.set(brush, { autoAlpha: 0 });
            gsap.set(paths, { drawSVG: "0%" });
          });
          const total = DUR.slow + STRAND_STAGGER * (paths.length - 1);
          const startBrush = () =>
            enqueue(total, () => {
              gsap
                .timeline({ onComplete: () => gsap.set(paths, { clearProps: "strokeDasharray,strokeDashoffset" }) })
                .set(brush, { autoAlpha: 1 })
                .to(paths, { drawSVG: "100%", duration: DUR.slow, ease: EASE.flight, stagger: STRAND_STAGGER });
            });
          brushIo = new IntersectionObserver(
            (entries) => {
              if (!entries.some((e) => e.isIntersecting)) return;
              brushIo?.disconnect();
              // A card still to come on screen or below (desktop: beside the print) goes first.
              const cardsFirst = [...parts.keys()].some((card) => card.getBoundingClientRect().bottom > 0);
              if (!cardsFirst) {
                startBrush();
                return;
              }
              brushAfterCards = startBrush;
              brushTimer = setTimeout(releaseBrush, BRUSH_WAIT_FOR_CARDS_MS);
            },
            { threshold: 0.5 },
          );
          brushIo.observe(brush);
        })
        .catch(() => {
          /* decorative — the static stroke stays */
        });
    }

    return () => {
      live = false;
      markObserver?.disconnect();
      cardsIo?.disconnect();
      brushIo?.disconnect();
      if (brushTimer) clearTimeout(brushTimer);
    };
  });

  return () => {
    disposed = true;
    mm.revert();
  };
}
