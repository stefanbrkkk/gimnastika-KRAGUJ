/**
 * S6 motion (§4 Coaches; design review AC-11, MI-AC-2/3/4, MI-09, MD-14), loaded lazily by
 * CoachesMotion — never in the first-load JS.
 *  - Portrait „from a crouch“: the whole print (paper included) rises out of the card —
 *    clip-path inset(100% 0 0 0) → inset(0), y 12 → 0, the image 1.08 → 1 — .6 s ease stick.
 *  - KR-07 Marey plate (no portrait yet): the ghost exposures of the leap appear one after
 *    another across the navy plate and the solid frame drops onto the mat with a stuck
 *    landing (compress and hold, EASE.land).
 *  - „Licenca GSS“ stamp press: ≤120 ms after the print lands the stamp comes down fast
 *    (scale 1.35 → .94, rotate −8° → 0, EASE.takeoff), settles (.94 → 1, EASE.land), a one-off
 *    ink ring spreads from the rim and the print under it gives 1.5 px.
 *  - Brush annotation over photo 05, drawn at hand speed with DrawSVG: the loaded core first,
 *    the bristle strands lagging and flicking off the paper at the end (≤.9 s).
 *
 * Content is never held back behind decoration: a card starts when 20 % of it is in view,
 * through queuePrimaryMotion() (≤250 ms wait) — no wait for the section title's landing (an
 * accent). Safety net: a pre-hidden card ≥50 % in view for 300 ms without having started is
 * shown in its final state at once. The brush is decoration: once half of the print is in
 * view it is committed to play, after the card reveals still running (≤1.2 s).
 *
 * Hidden pre-states are set by JS only for elements still off-screen (deep links and restored
 * scroll keep the static final state). gsap.matchMedia reverts everything if reduced motion is
 * switched on. Only clip-path, transform, opacity and stroke-dashoffset animate; no rAF loop.
 */
import { DUR, EASE, MQ, gsap, loadDrawSVG, queuePrimaryMotion, registerMotion } from "@/lib/motion";

const REVEAL_THRESHOLD = 0.2;
const SAFETY_THRESHOLD = 0.5;
const SAFETY_MS = 300;
/** The stamp comes down this long after the print has landed (≤120 ms). */
const STAMP_GAP = 0.08;
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

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const inView = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

type State = "pending" | "playing" | "done";

interface Card {
  el: HTMLElement;
  state: State;
  /** Seconds, for the primary-motion queue. */
  duration: number;
  play: (onDone: () => void) => void;
  showStatic: () => void;
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
      if (inView(el)) return; // on screen at arm time: keep the static final state
      const frame = el.querySelector<HTMLElement>("[data-coach-portrait] .frame");
      const stamp = el.querySelector<HTMLElement>("[data-coach-stamp]");
      const layers = stamp ? Array.from(stamp.querySelectorAll<SVGSVGElement>(".licence-stamp__layer")) : [];
      const splash = stamp?.querySelector<SVGElement>("[data-stamp-splash]");
      if (!frame || !stamp || layers.length === 0 || !splash) return;

      const plate = el.querySelector<HTMLElement>("[data-coach-plate]");
      const ghosts = plate ? Array.from(plate.querySelectorAll<SVGElement>("[data-plate-ghost]")) : [];
      const solid = plate?.querySelector<SVGElement>("[data-plate-solid]") ?? null;
      const img = plate ? null : frame.querySelector<HTMLElement>("img");
      if (plate ? !solid || ghosts.length === 0 : !img) return;

      // Final opacities of the exposures (CSS: shared ghost steps), read before hiding them.
      const ghostTo = ghosts.map((g) => parseFloat(getComputedStyle(g).opacity) || 0.3);
      const solidTo = solid ? parseFloat(getComputedStyle(solid).opacity) || 1 : 1;
      const cleared = [frame, stamp, ...layers, splash, ...ghosts, ...(solid ? [solid] : []), ...(img ? [img] : [])];

      // --- Pre-states -------------------------------------------------------------------
      if (plate && solid) {
        gsap.set(ghosts, { opacity: 0, x: -3 });
        gsap.set(solid, { opacity: 0, y: -8, transformOrigin: "50% 100%" });
      } else if (img) {
        gsap.set(frame, { clipPath: `inset(${frame.offsetHeight}px -${CLIP_BLEED}px 0px -${CLIP_BLEED}px)`, y: 12 });
        gsap.set(img, { scale: 1.08, transformOrigin: "50% 100%" });
      }
      gsap.set(layers, { autoAlpha: 0, scale: 1.35, rotation: -8, y: -10, transformOrigin: "50% 50%" });

      /** When the print has landed (s). */
      const landed = plate ? 0.27 + 0.24 + DUR.land : DUR.reveal;
      const duration = landed + STAMP_GAP + PRESS + DUR.base;

      const card: Card = {
        el,
        state: "pending",
        duration,
        play: (onDone) => {
          // Two cards revealing together press their stamps one after the other, never as one thud.
          let press = landed + STAMP_GAP;
          const pressAt = performance.now() + press * 1000;
          if (Math.abs(pressAt - lastPress) < STAMP_STAGGER_MS) press += (lastPress + STAMP_STAGGER_MS - pressAt) / 1000;
          lastPress = performance.now() + press * 1000;
          const tl = gsap.timeline({
            onComplete: () => {
              gsap.set(cleared, { clearProps: "transform,opacity,visibility,clipPath" });
              onDone();
            },
          });
          if (plate && solid) {
            // Exposures of one leap: take-off, flight, descent… then the solid frame sticks the landing.
            tl.to(ghosts, { opacity: (i: number) => ghostTo[i] ?? 0.3, x: 0, duration: 0.18, ease: EASE.stick, stagger: 0.09 }, 0)
              .to(solid, { opacity: solidTo, duration: DUR.tap, ease: "none" }, 0.27)
              .to(solid, { y: 0, duration: 0.24, ease: "power2.in" }, 0.27)
              .fromTo(solid, { scaleY: 0.88, scaleX: 1.06 }, { scaleY: 1, scaleX: 1, duration: DUR.land, ease: EASE.land, immediateRender: false }, 0.51);
          } else if (img) {
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
    const byEl = new Map(cards.map((c) => [c.el as Element, c]));
    const start = (card: Card) => {
      void queuePrimaryMotion(card.duration * 1000).then(() => {
        if (!live || card.state !== "pending") return;
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
    cards.forEach((c) => {
      revealIo.observe(c.el);
      safetyIo.observe(c.el);
    });

    // --- Brush annotation (DrawSVG) ---------------------------------------------------------
    let brushIo: IntersectionObserver | undefined;
    const brush = root.querySelector<SVGSVGElement>("[data-brush]");
    const cardsBusy = () =>
      cards.some((c) => {
        if (c.state === "playing") return true;
        if (c.state !== "pending") return false;
        const r = c.el.getBoundingClientRect(); // desktop: a card beside the print, about to start
        return r.bottom > 0 && r.top < window.innerHeight * (1 + JOIN_BELOW);
      });
    if (brush && !inView(brush)) {
      loadDrawSVG()
        .then(() => {
          if (disposed || !live || inView(brush)) return; // scrolled in while loading → keep it static
          const cores = Array.from(brush.querySelectorAll<SVGPathElement>('[data-brush-path="core"]'));
          const strands = Array.from(brush.querySelectorAll<SVGPathElement>('[data-brush-path="strand"]'));
          const core = cores[1] ?? cores[0];
          const strand = strands[0];
          if (!core || !strand) return;
          // Share of each strand that follows the loop; the rest is the flick.
          const loop = Math.min(0.99, core.getTotalLength() / (strand.getTotalLength() || 1));
          context.add(() => {
            gsap.set(brush, { autoAlpha: 0 });
            gsap.set([...cores, ...strands], { drawSVG: "0%" });
          });
          const draw = () =>
            context.add(() => {
              const tl = gsap.timeline({
                onComplete: () => gsap.set([...cores, ...strands], { clearProps: "strokeDasharray,strokeDashoffset" }),
              });
              tl.set(brush, { autoAlpha: 1 }).to(cores, { drawSVG: "100%", duration: 0.72, ease: EASE.flight }, 0);
              strands.forEach((path, i) => {
                const at = 0.06 * (i + 1);
                const body = 0.7 - 0.04 * i;
                tl.to(path, { drawSVG: `${loop * 100}%`, duration: body, ease: EASE.flight }, at).to(
                  path,
                  { drawSVG: "100%", duration: 0.12, ease: EASE.takeoff }, // the hand leaves the paper
                  at + body,
                );
              });
            });
          const play = async () => {
            const until = performance.now() + BRUSH_WAIT_FOR_CARDS_MS;
            while (live && cardsBusy() && performance.now() < until) await sleep(100);
            if (!live) return;
            await queuePrimaryMotion(900);
            if (live) draw();
          };
          brushIo = new IntersectionObserver(
            (entries) => {
              if (!entries.some((e) => e.isIntersecting)) return;
              brushIo?.disconnect();
              void play();
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
      revealIo.disconnect();
      safetyIo.disconnect();
      timers.forEach((t) => clearTimeout(t));
      brushIo?.disconnect();
    };
  });

  return () => {
    disposed = true;
    mm.revert();
  };
}
