/**
 * S3 motion (§4 Programs + design review v2), loaded lazily by ProgramsBrowser when the section
 * is ≤1 viewport away and motion is allowed — never in the first-load JS.
 *
 * Every motion is a phase of the sport (styles/sections/programs.css holds the keyframes):
 *  - Exercise (D-53, D-54, ./card-exercises): each card's gymnast performs her whole exercise
 *    with the scroll — the star jump, the beam cartwheel, the cast to handstand, the handspring
 *    vault, the high kick — and the key phases she passes stay behind as ghost frames. On the
 *    phone row a card also plays as it is swiped in. It replaces the cards' pose mount (the
 *    drop onto the apparatus) and the performs (the apparatus's own physics with the pose riding
 *    it): a time-based bounce under a gymnast the scroll holds mid-run would be incoherent, and
 *    an apparatus that dips without her would open a gap at her hands or feet.
 *  - Draw (QP-14/MI-04): each apparatus is traced over its faint latent print when its plate is
 *    in view (0.6s stick, stagger .06s ≤ .24s), through queuePrimaryMotion (one primary motion
 *    per viewport). Plates are observed, not cards, so a desktop row draws as one batch and the
 *    off-screen cards of the phone row never draw unseen. The gymnast is not part of the draw.
 *  - Seam (MI-07): on desktop the floor-diagonal mat line of the section's cut draws from
 *    bottom-left to top-right (clip-path wipe, 0.9s flight) as the cut crosses 80% of the view.
 *  - Filter (MI-06): leaving cards take off (up, smaller, gone in 0.18s); staying cards glide
 *    (Flip 0.28s stick); arriving cards drop in and stick the landing (a 3% compression held
 *    on EASE.land, origin at their feet). The final layout is the Flip's end state (QP3-01):
 *    leavers are out of flow from the first frame and the stayers' heights (so their plates)
 *    tween with the glide, so nothing changes size after the landing. Leavers lift relative to
 *    where Flip pins them (QP4-05). Phone/tablet row (QP4-01): the row is at its rest (clamped
 *    to the final row) from the first frame, snapping off until everything lands, while every
 *    frame is held where it stood on screen; each then glides at ≤0.8px/ms on a bounded ease
 *    (./flight), or — when that would cross more than a frame of the row — hops: takes off in
 *    place and lands at its rest. The flight starts on the next tick, so its first frame is the
 *    take-off. Cards that land in view draw only after the flight has landed.
 *  - Stamp (QP-10): the quiz recommendation stamp presses on when its plate is in view.
 * Pre-states are CSS scoped under html.js-motion or set by JS right before a motion; a live
 * switch to reduced motion drops html.js-motion, which resolves all of them to the final state
 * (the exercise scrub restores its static print itself). Only transform, opacity, clip-path and
 * stroke-dashoffset animate, plus the gymnast's path data; no rAF loop of its own (the scrub
 * engine runs one rAF per scroll frame).
 * gsap is reached only through loadMotion() (filter Flip): a static "@/lib/motion" import would
 * make this chunk share gsap's MotionPath helpers with the hero intro, which then downloads it.
 */
import { loadMotion } from "@/lib/load-motion";
import { DUR, EASE, MQ, OFFSET, STAGGER, motionAllowed, queuePrimaryMotion } from "@/lib/motion-env";
import { armCardExercises } from "./card-exercises";
import { glideEase, glideReach, glideTime, planRow, type Hop } from "./flight";

const CARD = "[data-program-card]";
const PLATE = ".pc-plate";
const DRAW_MS = DUR.reveal * 1000;
/** Draw stagger: .06s per plate, ≤ .24s in total (QP-14). */
const staggerOf = (k: number) => Math.min(k * STAGGER.cards, 0.24);

export const warmFlip = (): Promise<void> => loadMotion().then((m) => m.loadFlip().then(() => undefined));

/** When the filter flight in the air lands (performance.now() ms). A card that lands in view
 *  draws only after it: the row's flight is the one motion on it, and no draw starts (a heavy
 *  frame) in the middle of the glide. */
let flightUntil = 0;

export function armPrograms(root: HTMLElement, strip: HTMLElement): () => void {
  const section = root.closest("section");
  const cards = Array.from(strip.querySelectorAll<HTMLElement>(CARD));
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  let disposed = false;

  /* --- Exercises: scrubbed with the scroll (and the phone row's swipe) ------------------- */
  const unscrub = armCardExercises(strip);

  /* --- Draw on enter ---------------------------------------------------------------------- */
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
      const flying = flightUntil - performance.now();
      if (flying > 0) later(drawBatch, flying);
      else drawBatch();
    },
    { threshold: 0.6 },
  );
  function drawBatch() {
    void queuePrimaryMotion(staggerOf(pending.length - 1) * 1000 + DRAW_MS).then(() => {
      const batch = pending;
      pending = [];
      waiting = false;
      if (disposed) return;
      batch.forEach((card, k) => {
        card.style.setProperty("--draw-delay", `${staggerOf(k)}s`);
        card.setAttribute("data-drawn", "");
      });
    });
  }

  for (const card of cards) {
    if (!card.hasAttribute("data-drawn")) drawIO.observe(card.querySelector(PLATE) ?? card);
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
    unscrub();
    drawIO.disconnect();
    seamIO?.disconnect();
    timers.forEach((t) => clearTimeout(t));
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
  /** The strip: a scroll-snap row below 1024px (it rests where apply() says), a grid above. */
  strip: HTMLElement;
  /** Applies the final layout (visibility, count) and returns where the row rests (scrollLeft),
   *  measured on that final layout. */
  apply: () => number;
  /** Commits React state (pressed chip, status, rail) synchronously. */
  commit: () => void;
  done: () => void;
}

type Timeline = ReturnType<Awaited<ReturnType<typeof loadMotion>>["gsap"]["timeline"]>;

/** Stacking during the Flip (QP2-09): the leaving frames go absolute for their take-off and would
 *  paint over the frames that stay; stayers and arrivals are lifted above them until it ends.
 *  Leaving = filtered out (data-out) or dropped by the sheet's count rule (the photo, CSS
 *  display:none) — read before Flip puts its own inline display on them. */
const lift = (items: readonly HTMLElement[], on: boolean) => {
  const leaving = on ? items.map((el) => el.hasAttribute("data-out") || getComputedStyle(el).display === "none") : [];
  items.forEach((el, k) => (el.style.zIndex = on ? (leaving[k] ? "0" : "1") : ""));
};

/** Arrive: drop in from below the landing spot, then stick it — a 3% compression at the feet that
 *  holds and releases without a bounce (EASE.land). `now`: hidden from the first frame (arrivals);
 *  a hopper is still taking off then, so its landing starts hidden only when it starts. */
const arrive = (tl: Timeline, el: Element, at: number, drop: number, now = true) =>
  tl
    .fromTo(el, { opacity: 0, y: drop }, { opacity: 1, y: 0, duration: DUR.base, ease: EASE.stick, immediateRender: now }, at)
    .to(el, { scaleY: 0.97, transformOrigin: "50% 100%", duration: 0.08, ease: "power2.out" }, at + DUR.base * 0.45)
    .to(el, { scaleY: 1, duration: 0.2, ease: EASE.land }, ">");

/** A hopper fades out in HOP_OFF, moves to its landing spot at HOP_MOVE and lands from HOP_ON:
 *  it is fully gone for 60ms on each side of the move (3–4 frames), so not even a dropped frame
 *  shows it crossing the row. */
const HOP_OFF = 0.14;
const HOP_MOVE = 0.2;
const HOP_ON = 0.26;

/** Row arrivals start once a leaver's DUR.fast fade is nearly done (it is ≤ .15 by then). */
const ENTER_HOLD = 0.16;

/** The flight that has not taken off yet (`launch` starts it, once) and the hoppers in the air. */
let launch: (() => void) | null = null;
let hopping: Timeline | null = null;

export async function flipFilter({ items, strip, apply, commit, done }: FlipFilterOptions): Promise<void> {
  const { gsap, loadFlip } = await loadMotion();
  const Flip = await loadFlip();
  // A flight that has not taken off yet (two taps inside one frame) starts now and hoppers still
  // in the air land now, so that getState() completes them like any Flip still running.
  launch?.();
  hopping?.progress(1);
  lift(items, false);
  // The phone/tablet row scrolls; the ≥1024 sheet does not. On the row every position is read
  // from getBoundingClientRect (simple), so the row's scroll below is part of each frame's move.
  const row = getComputedStyle(strip).overflowX !== "visible";
  const state = Flip.getState(items as HTMLElement[], { simple: row });
  // No snap may move the row while the layout changes, or before the flight has landed.
  strip.style.scrollSnapType = "none";
  const rest = apply();
  // The row is at its rest from the first frame (QP4-01), while every frame is held — by Flip, or
  // below — where it stood on screen: the scroll is part of each frame's own flight, not a second
  // motion, so arrivals land and leavers take off in place. The rest is clamped to the final
  // row, so nothing snaps or moves after the landing.
  if (row) strip.scrollTo({ left: rest, behavior: "instant" });
  commit();
  lift(items, true);
  // Nothing is released (stacking, snap) before every flight has landed.
  let flying = 1;
  const land = () => {
    if (--flying) return;
    strip.style.removeProperty("scroll-snap-type");
    lift(items, false);
    done();
  };
  const drop = window.matchMedia("(min-width: 1024px)").matches ? OFFSET.desktop : OFFSET.mobile;
  // On the row an arrival can land on the spot a leaver is still fading from: it waits until the
  // leaver is nearly gone (its fade is DUR.fast, linear), so their text never prints over
  // each other. The ≥1024 sheet stacks leavers under the stayers instead.
  const enterAt = row ? ENTER_HOLD : 0;

  // The row's frames glide on screen at ≤ GLIDE_SPEED (./flight): one frame of the row over at
  // most (≤360px), in 0.28–0.6s. A frame that would cross more of the screen hops (QP4-01).
  let hops: Hop[] = [];
  let reach = 0;
  let hopEls: HTMLElement[] = [];
  /** Row stacking: a frame that rests mostly in view is drawn over the frames passing its spot
   *  (the chosen card over the photo's edge, a landing card over the photo gliding away). */
  const restZ = new Map<HTMLElement, string>();
  if (row) {
    const shown = items.filter((el) => !el.hasAttribute("data-out") && getComputedStyle(el).display !== "none");
    const kept = shown.filter((el) => state.getElementState(el)?.isVisible);
    const box = strip.getBoundingClientRect();
    const lo = Math.max(box.left, 0);
    const hi = Math.min(box.right, window.innerWidth);
    ({ hops, reach } = planRow(
      kept.map((el) => ({ from: state.getElementState(el).bounds, to: el.getBoundingClientRect() })),
      lo,
      hi,
      glideReach(DUR.reveal),
    ));
    hopEls = hops.map((h) => kept[h.index]!);
    for (const el of shown) {
      const r = el.getBoundingClientRect();
      restZ.set(el, Math.min(r.right, hi) - Math.max(r.left, lo) >= r.width / 2 ? "2" : "1");
    }
    restZ.forEach((z, el) => (el.style.zIndex = z));
  }

  // The end state is measured here, with the leavers already display:none (data-out): the final
  // layout, row heights included (QP3-01). absoluteOnLeave takes the leavers out of flow for
  // their take-off, and Flip pins every other frame at its old size meanwhile; scale:false
  // tweens that width/height to the final one inside the glide, so a card's plate — the flex
  // item that takes the row's spare height — grows or shrinks with the flight and the content is
  // never stretched. Nothing is left to snap when Flip clears it.
  // Every frame holds its old place (Flip fits it back) until the flight takes off (below).
  const flip = Flip.from(state, {
    ...(hopEls.length ? { targets: items.filter((el) => !hopEls.includes(el)) } : {}),
    simple: row,
    duration: row ? glideTime(reach, DUR.base, DUR.reveal) : DUR.base,
    ease: row ? glideEase : EASE.stick,
    scale: false,
    absoluteOnLeave: true,
    paused: true,
    onEnter: (els) => {
      const tl = gsap.timeline({ onComplete: () => gsap.set(els, { clearProps: "opacity,transform,transformOrigin" }) });
      els.forEach((el, k) => arrive(tl, el, enterAt + staggerOf(k), drop));
      return tl;
    },
    // Leave: take off — 8px up from where it stands and a little smaller, faded linearly so it is
    // half gone while the others glide past it. Relative (QP4-05): absoluteOnLeave pins the
    // leaver at the strip's top-left and puts it back in place with a translate (≈560px down in
    // a second desktop row), which an absolute y would replace.
    onLeave: (els) =>
      gsap
        .timeline()
        .to(els, { opacity: 0, duration: DUR.fast, ease: "none" }, 0)
        .to(els, { y: "-=8", scale: 0.97, duration: DUR.fast, ease: EASE.takeoff }, 0),
    onComplete: land,
  });

  // Hoppers: take off where they stood (as a leaver: under the frames that stay), gone while they
  // move, land where they rest (as an arrival). One whose take-off spot is off screen only lands;
  // one whose landing spot is off screen only takes off.
  let hop: Timeline | null = null;
  if (hopEls.length) {
    flying++;
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => {
        gsap.set(hopEls, { clearProps: "opacity,transform,transformOrigin" });
        if (hopping === tl) hopping = null;
        land();
      },
    });
    let k = 0;
    hops.forEach(({ dx, dy, off, on }, i) => {
      const el = hopEls[i]!;
      if (off) {
        gsap.set(el, { x: -dx, y: -dy, zIndex: 0 }); // where it stood: the first frame is the old layout
        tl.to(el, { opacity: 0, duration: HOP_OFF, ease: "none" }, 0)
          .to(el, { y: "-=8", scale: 0.97, duration: HOP_OFF, ease: EASE.takeoff }, 0)
          .set(el, { x: 0, y: on ? drop : 0, scale: 1, opacity: on ? 0 : 1, zIndex: restZ.get(el) }, HOP_MOVE);
        if (on) arrive(tl, el, HOP_ON, drop, false);
      } else if (on) {
        gsap.set(el, { opacity: 0 });
        arrive(tl, el, enterAt + staggerOf(k++), drop, false);
      }
    });
    hop = hopping = tl;
  }

  // Take-off on the next tick. A tween is stamped with the time of the last tick, so one created
  // at the end of the tap's work (≈50ms of layout) would show its first frame that far into the
  // flight — a jump. The ticker renders the root first, then this listener starts the flight at
  // that tick: the first frame is the take-off. Draws wait until it has landed.
  const go = () => {
    if (launch !== go) return;
    launch = null;
    flightUntil = performance.now() + Math.max(flip.duration(), hop?.duration() ?? 0) * 1000;
    flip.play();
    hop?.play();
  };
  launch = go;
  gsap.ticker.add(go, true);
}
