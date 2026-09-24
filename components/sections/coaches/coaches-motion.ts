/**
 * S6 motion (§4 Coaches), loaded lazily by CoachesMotion — never in the first-load JS.
 *  - Portrait reveal „from a crouch“: clip-path inset(100% 0 0 0) → inset(0) with the
 *    image scaling 1.08 → 1 (origin bottom), .6 s ease stick.
 *  - „Licenca GSS“ stamp: scale 1.25 → 1, rotate −8° → 0, ease rebound .35 s —
 *    only after the portraits have landed (sequenced, never overlapping).
 *  - Brush annotation over photo 05: DrawSVG (loaded here, lazily), .9 s ease flight.
 * One sequence at a time: whatever enters later waits for the running one to end,
 * so there is only one primary motion per viewport.
 *
 * Hidden pre-states are set by JS only for elements still off-screen (deep links and
 * restored scroll keep the static final state). gsap.matchMedia reverts everything if
 * reduced motion is switched on. Only clip-path, transform, opacity and
 * stroke-dashoffset animate; no rAF loop of its own.
 */
import { DUR, EASE, MQ, STAGGER, gsap, loadDrawSVG, registerMotion } from "@/lib/motion";

const STAMP_DUR = 0.35;
/** Offset between the brush strands (dry-brush bristles). */
const STRAND_STAGGER = 0.04;

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
    /** Serialises sequences: returns the delay before a sequence of `duration` may start. */
    let busyUntil = 0;
    const slot = (duration: number): number => {
      const now = performance.now() / 1000;
      const start = Math.max(now, busyUntil);
      busyUntil = start + duration;
      return start - now;
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
      gsap
        .timeline({
          delay: slot(total),
          onComplete: () => {
            gsap.set(boxes, { clearProps: "clipPath" });
            gsap.set([...media, ...stamps], { clearProps: "transform,opacity,visibility" });
          },
        })
        .to(boxes, { clipPath: "inset(0% 0% 0% 0%)", duration: DUR.reveal, ease: EASE.stick, stagger: STAGGER.cards }, 0)
        .to(media, { scale: 1, duration: DUR.reveal, ease: EASE.stick, stagger: STAGGER.cards }, 0)
        .to(stamps, { autoAlpha: 1, scale: 1, rotation: 0, duration: STAMP_DUR, ease: EASE.rebound, stagger: STAGGER.cards }, portraitsEnd);
    };

    let cardsIo: IntersectionObserver | undefined;
    if (parts.size > 0) {
      cardsIo = new IntersectionObserver(
        (entries) => {
          const batch: CardParts[] = [];
          for (const e of entries) {
            const p = e.isIntersecting ? parts.get(e.target) : undefined;
            if (!p) continue;
            cardsIo?.unobserve(e.target);
            parts.delete(e.target);
            batch.push(p);
          }
          if (batch.length > 0) context.add(() => playCards(batch));
          if (parts.size === 0) cardsIo?.disconnect();
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
          if (disposed || inView(brush)) return; // scrolled in while loading → keep it static
          const paths = Array.from(brush.querySelectorAll<SVGPathElement>("[data-brush-path]"));
          context.add(() => {
            gsap.set(brush, { autoAlpha: 0 });
            gsap.set(paths, { drawSVG: "0%" });
          });
          brushIo = new IntersectionObserver(
            (entries) => {
              if (!entries.some((e) => e.isIntersecting)) return;
              brushIo?.disconnect();
              const total = DUR.slow + STRAND_STAGGER * (paths.length - 1);
              context.add(() => {
                gsap
                  .timeline({
                    delay: slot(total),
                    onComplete: () => gsap.set(paths, { clearProps: "strokeDasharray,strokeDashoffset" }),
                  })
                  .set(brush, { autoAlpha: 1 })
                  .to(paths, { drawSVG: "100%", duration: DUR.slow, ease: EASE.flight, stagger: STRAND_STAGGER });
              });
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
      cardsIo?.disconnect();
      brushIo?.disconnect();
    };
  });

  return () => {
    disposed = true;
    mm.revert();
  };
}
