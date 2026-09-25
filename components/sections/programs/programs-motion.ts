/**
 * S3 motion (§4 Programs + design review v2), loaded lazily by ProgramsBrowser when the section
 * is ≤1 viewport away and motion is allowed — never in the first-load JS.
 *
 * Every motion is a phase of the sport (styles/sections/programs.css holds the keyframes):
 *  - Draw (QP-14/MI-04): each apparatus is traced over its faint latent print when its plate is
 *    in view (0.6s stick, stagger .06s ≤ .24s), through queuePrimaryMotion (one primary motion
 *    per viewport). Plates are observed, not cards, so a desktop row draws as one batch and the
 *    off-screen cards of the phone row never draw unseen.
 *  - Perform (MD-06/MI-02, QP2-11): right after its draw every apparatus performs once with its
 *    own physics only — the beam flexes down and balances out, the rails flex under a swing, the
 *    springboard compresses and the table takes the hands, the floor gives, the aerobic
 *    silhouette crouches, jumps and sticks. No trails on the cards (at 84–132px a body-less arc
 *    reads as a scratch); they live in the detail sheet, beside the posed silhouette.
 *    Phones: the card that snaps fully into view performs again (≥4s apart), so only one card
 *    per viewport moves. Hover devices: on pointer enter / keyboard focus.
 *  - Mount (QP2-05, QP3-02): every plate is a scene (the posed silhouette scales with it), so
 *    the first draw plays the detail sheet's mount instead of a perform — the drawing traces
 *    itself, then the silhouette hops onto her pose and sticks it. Once per card.
 *  - Seam (MI-07): on desktop the floor-diagonal mat line of the section's cut draws from
 *    bottom-left to top-right (clip-path wipe, 0.9s flight) as the cut crosses 80% of the view.
 *  - Filter (MI-06): leaving cards take off (up, smaller, gone in 0.18s); staying cards glide
 *    (Flip 0.28s stick); arriving cards drop in and stick the landing (a 3% compression held
 *    on EASE.land, origin at their feet). The final layout is the Flip's end state (QP3-01):
 *    leavers are out of flow from the first frame and the stayers' heights (so their plates)
 *    tween with the glide, so nothing changes size after the landing.
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
/** Longest perform (bars: the low rail's 0.97s flex, 80ms after the high one) — programs.css. */
const PERFORM_MS = 1100;
/** Card mount after the draw starts: hop from +450ms (0.5s), stick from +950ms (0.35s). */
const MOUNT_MS = 1300;
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

  /** The plate is a scene: the posed silhouette is part of its drawing (every card, QP3-02). */
  const isScene = (card: HTMLElement) => !!card.querySelector(".pc-icon .pi-fig-x");

  const perform = (card: HTMLElement, delay = 0) => {
    if (disposed || !motionAllowed() || !card.hasAttribute("data-drawn") || card.matches("[data-perform], [data-mount]")) return;
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
      const total = staggerOf(pending.length - 1) * 1000 + Math.max(DRAW_MS + PERFORM_MS, MOUNT_MS);
      void queuePrimaryMotion(total).then(() => {
        const batch = pending;
        pending = [];
        waiting = false;
        if (disposed) return;
        const scenes = batch.map(isScene);
        batch.forEach((card, k) => {
          card.style.setProperty("--draw-delay", `${staggerOf(k)}s`);
          // A scene plate mounts: the silhouette hops on as the line completes (CSS, data-mount).
          if (scenes[k]) {
            card.setAttribute("data-mount", "");
            lastPerform.set(card, performance.now());
          }
          card.setAttribute("data-drawn", "");
        });
        // The apparatus comes alive the moment its line is complete (plain plates).
        later(
          () =>
            batch.forEach((card, k) => {
              if (!scenes[k]) perform(card, staggerOf(k));
            }),
          DRAW_MS,
        );
        // The mount ends on the final pose: dropping the attribute changes nothing on screen.
        later(() => batch.forEach((card) => card.removeAttribute("data-mount")), MOUNT_MS + staggerOf(batch.length - 1) * 1000);
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
      card.removeAttribute("data-mount");
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

/** Stacking during the Flip (QP2-09): the leaving frames go absolute for their take-off and would
 *  paint over the frames that stay; stayers and arrivals are lifted above them until it ends.
 *  Leaving = filtered out (data-out) or dropped by the sheet's count rule (the photo, CSS
 *  display:none) — read before Flip puts its own inline display on them. */
const lift = (items: readonly HTMLElement[], on: boolean) => {
  const leaving = on ? items.map((el) => el.hasAttribute("data-out") || getComputedStyle(el).display === "none") : [];
  items.forEach((el, k) => (el.style.zIndex = on ? (leaving[k] ? "0" : "1") : ""));
};

export async function flipFilter({ items, apply, commit, done }: FlipFilterOptions): Promise<void> {
  const { gsap, loadFlip } = await loadMotion();
  const Flip = await loadFlip();
  lift(items, false);
  // getState() completes a Flip still running from a previous chip.
  const state = Flip.getState(items as HTMLElement[]);
  apply();
  commit();
  lift(items, true);
  const drop = window.matchMedia("(min-width: 1024px)").matches ? OFFSET.desktop : OFFSET.mobile;
  // The end state is measured here, with the leavers already display:none (data-out): the final
  // layout, row heights included (QP3-01). absoluteOnLeave takes the leavers out of flow for
  // their take-off, and Flip pins every other frame at its old size meanwhile; scale:false
  // tweens that width/height to the final one inside the glide (same DUR.base, EASE.stick), so
  // a card's plate — the flex item that takes the row's spare height — grows or shrinks with the
  // flight and the content is never stretched. Nothing is left to snap when Flip clears it.
  Flip.from(state, {
    duration: DUR.base,
    ease: EASE.stick,
    scale: false,
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
    onComplete: () => {
      lift(items, false);
      done();
    },
  });
}
