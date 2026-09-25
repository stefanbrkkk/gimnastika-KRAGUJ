/**
 * S3 motion (§4 Programs + design review v2), loaded lazily by ProgramsBrowser when the section
 * is ≤1 viewport away and motion is allowed — never in the first-load JS.
 *
 * Every motion is a phase of the sport (styles/sections/programs.css holds the keyframes):
 *  - Draw (QP-14/MI-04): each apparatus is traced over its faint latent print when its plate is
 *    in view (0.6s stick, stagger .06s ≤ .24s), through queuePrimaryMotion (one primary motion
 *    per viewport). Plates are observed, not cards, so a desktop row draws as one batch and the
 *    off-screen cards of the phone row never draw unseen.
 *  - Perform (MD-06/MI-02): right after its draw every apparatus performs once — the beam
 *    wobbles and settles, the bars swing under a giant-swing orbit, the springboard compresses
 *    under a vault flight, a tumbling pass hops along the floor diagonal, the aerobic figure
 *    jumps and sticks. Phones: the card that snaps fully into view performs again (≥4s apart),
 *    so only one card per viewport moves. Hover devices: on pointer enter / keyboard focus.
 *  - Seam (MI-07): on desktop the floor-diagonal mat line of the section's cut draws from
 *    bottom-left to top-right (clip-path wipe, 0.9s flight) as the cut crosses 80% of the view.
 *  - Filter (MI-06): leaving cards take off (up, smaller, gone in 0.18s); staying cards glide
 *    (Flip 0.28s stick); arriving cards drop in and stick the landing (a 3% compression held
 *    on EASE.land, origin at their feet).
 *  - Stamp (QP-10): the quiz recommendation stamp presses on when its plate is in view.
 * Pre-states are CSS scoped under html.js-motion or set by JS right before a motion; a live
 * switch to reduced motion drops html.js-motion, which resolves all of them to the final state.
 * Only transform, opacity, clip-path and stroke-dashoffset animate; no rAF loop of its own.
 * gsap is reached only through loadMotion() (filter Flip): a static "@/lib/motion" import would
 * make this chunk share gsap's MotionPath helpers with the hero intro, which then downloads it.
 */
import { loadMotion } from "@/lib/load-motion";
import { DUR, EASE, MQ, OFFSET, STAGGER, motionAllowed, queuePrimaryMotion } from "@/lib/motion-env";

const CARD = "[data-program-card]";
const PLATE = ".pc-plate";
const DRAW_MS = DUR.reveal * 1000;
/** Longest perform (bars: 0.85s swing after a 0.12s pull) — programs.css. */
const PERFORM_MS = 1000;
/** Phones: a card performs again only after this long. */
const REARM_MS = 4000;
/** Draw / perform stagger: .06s per plate, ≤ .24s in total (QP-14). */
const staggerOf = (k: number) => Math.min(k * STAGGER.cards, 0.24);

export const warmFlip = (): Promise<void> => loadMotion().then((m) => m.loadFlip().then(() => undefined));

export function armPrograms(root: HTMLElement, strip: HTMLElement): () => void {
  const section = root.closest("section");
  const cards = Array.from(strip.querySelectorAll<HTMLElement>(CARD));
  const hoverable = window.matchMedia("(hover: hover)").matches;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  const lastPerform = new WeakMap<HTMLElement, number>();
  let disposed = false;

  const perform = (card: HTMLElement, delay = 0) => {
    if (disposed || !motionAllowed() || !card.hasAttribute("data-drawn") || card.hasAttribute("data-perform")) return;
    card.style.setProperty("--perform-delay", `${delay}s`);
    card.setAttribute("data-perform", "");
    lastPerform.set(card, performance.now() + delay * 1000);
    later(() => card.removeAttribute("data-perform"), PERFORM_MS + delay * 1000);
  };

  /* --- Draw on enter, then perform once ------------------------------------------------ */
  let pending: HTMLElement[] = [];
  let waiting = false;
  const drawIO = new IntersectionObserver(
    (entries) => {
      const hits = entries.filter((e) => e.isIntersecting);
      if (!hits.length) return;
      for (const e of hits) {
        drawIO.unobserve(e.target);
        const card = e.target.closest<HTMLElement>(CARD);
        if (card) pending.push(card);
      }
      if (waiting) return;
      waiting = true;
      const total = DRAW_MS + staggerOf(pending.length - 1) * 1000 + PERFORM_MS;
      void queuePrimaryMotion(total).then(() => {
        const batch = pending;
        pending = [];
        waiting = false;
        if (disposed) return;
        batch.forEach((card, k) => {
          card.style.setProperty("--draw-delay", `${staggerOf(k)}s`);
          card.setAttribute("data-drawn", "");
        });
        // The apparatus comes alive the moment its line is complete.
        later(() => batch.forEach((card, k) => perform(card, staggerOf(k))), DRAW_MS);
      });
    },
    { threshold: 0.6 },
  );

  /* --- Perform again when a drawn plate snaps fully into view (phones) ------------------- */
  const performIO = new IntersectionObserver(
    (entries) => {
      let k = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const card = e.target.closest<HTMLElement>(CARD);
        if (!card || !card.hasAttribute("data-drawn")) continue; // the draw chains its own perform
        const last = lastPerform.get(card);
        if (last !== undefined && (hoverable || performance.now() - last < REARM_MS)) continue;
        perform(card, staggerOf(k++));
      }
    },
    { threshold: 0.85 },
  );

  for (const card of cards) {
    const plate = card.querySelector(PLATE) ?? card;
    if (!card.hasAttribute("data-drawn")) drawIO.observe(plate);
    performIO.observe(plate);
  }

  /* --- Hover / keyboard focus (hover devices) ------------------------------------------- */
  const onPointerEnter = (e: PointerEvent) => {
    if (e.pointerType === "mouse") perform(e.currentTarget as HTMLElement);
  };
  const onFocusIn = (e: FocusEvent) => {
    const card = e.currentTarget as HTMLElement;
    if (e.relatedTarget instanceof Node && card.contains(e.relatedTarget)) return;
    perform(card);
  };
  if (hoverable) {
    for (const card of cards) {
      card.addEventListener("pointerenter", onPointerEnter);
      card.addEventListener("focusin", onFocusIn);
    }
  }

  /* --- Seam: the floor diagonal draws along the section's cut (desktop) ------------------ */
  let seamIO: IntersectionObserver | null = null;
  const line = section?.querySelector<SVGElement>(":scope > .edge-line") ?? null;
  if (section && line && window.matchMedia(MQ.desktopFine).matches && line.getBoundingClientRect().top > window.innerHeight * 0.8) {
    section.setAttribute("data-seam", "wait");
    seamIO = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        seamIO?.disconnect();
        void queuePrimaryMotion(DUR.slow * 1000).then(() => {
          if (!disposed) section.setAttribute("data-seam", "draw");
        });
      },
      // The cut crosses ~80% of the view (threshold 0: the section's clip-path trims the box).
      { rootMargin: "0px 0px -24% 0px", threshold: 0 },
    );
    seamIO.observe(line);
  }

  return () => {
    disposed = true;
    drawIO.disconnect();
    performIO.disconnect();
    seamIO?.disconnect();
    timers.forEach((t) => clearTimeout(t));
    for (const card of cards) {
      card.removeEventListener("pointerenter", onPointerEnter);
      card.removeEventListener("focusin", onFocusIn);
      card.removeAttribute("data-perform");
    }
    if (section?.getAttribute("data-seam") === "wait") section.removeAttribute("data-seam");
  };
}

/* --- Quiz recommendation stamp ------------------------------------------------------------ */
let stampIO: IntersectionObserver | null = null;
/** Presses the stamp on each recommended card when its plate is in view (0.35s rebound). */
export function stampIn(cards: readonly HTMLElement[]): void {
  stampIO?.disconnect();
  if (!motionAllowed() || typeof IntersectionObserver === "undefined") return;
  stampIO = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        stampIO?.unobserve(e.target);
        e.target.closest<HTMLElement>(CARD)?.setAttribute("data-stamp", "in");
      }
    },
    { threshold: 0.6 },
  );
  for (const card of cards) {
    const plate = card.querySelector(PLATE);
    if (!plate) continue;
    // Hidden only now, right before its motion (CSS: html.js-motion [data-stamp="wait"]).
    card.setAttribute("data-stamp", "wait");
    stampIO.observe(plate);
  }
}

/* --- Filter Flip ---------------------------------------------------------------------------- */
interface FlipFilterOptions {
  /** Every frame of the strip (cards + photo). */
  items: readonly HTMLElement[];
  /** Applies the final layout (visibility, count, scroll). */
  apply: () => void;
  /** Commits React state (pressed chip, status, rail) synchronously. */
  commit: () => void;
  done: () => void;
}

export async function flipFilter({ items, apply, commit, done }: FlipFilterOptions): Promise<void> {
  const { gsap, loadFlip } = await loadMotion();
  const Flip = await loadFlip();
  // getState() completes a Flip still running from a previous chip.
  const state = Flip.getState(items as HTMLElement[]);
  apply();
  commit();
  const drop = window.matchMedia("(min-width: 1024px)").matches ? OFFSET.desktop : OFFSET.mobile;
  Flip.from(state, {
    duration: DUR.base,
    ease: EASE.stick,
    scale: true,
    absoluteOnLeave: true,
    // Arrive: drop in from below the landing spot, then stick it — a 3% compression at the feet
    // that holds and releases without a bounce (EASE.land).
    onEnter: (els) => {
      const tl = gsap.timeline({ onComplete: () => gsap.set(els, { clearProps: "opacity,transform,transformOrigin" }) });
      els.forEach((el, k) => {
        const at = staggerOf(k);
        tl.fromTo(el, { opacity: 0, y: drop }, { opacity: 1, y: 0, duration: DUR.base, ease: EASE.stick }, at)
          .to(el, { scaleY: 0.97, transformOrigin: "50% 100%", duration: 0.08, ease: "power2.out" }, at + DUR.base * 0.45)
          .to(el, { scaleY: 1, duration: 0.2, ease: EASE.land }, ">");
      });
      return tl;
    },
    // Leave: take off — up and a little smaller, faded linearly so it is half gone while the
    // others glide past it.
    onLeave: (els) =>
      gsap
        .timeline()
        .to(els, { opacity: 0, duration: DUR.fast, ease: "none" }, 0)
        .to(els, { y: -8, scale: 0.97, duration: DUR.fast, ease: EASE.takeoff }, 0),
    onComplete: done,
  });
}
