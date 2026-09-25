/**
 * „Hronologija“ as a chronophotograph in motion (§5 S5; design review AC-01, MI-AC-1, MD-09).
 * The club's leaping gymnast rides the rail from year to year: a short crouch (take-off),
 * a hop down the rail at a constant running speed (flight: the progress line's head travels
 * with it, a small sideways arc and torso pitch), then a stuck landing on the year (compress
 * and hold, EASE.land). Every year it leaves keeps a ghost exposure, so when the reader
 * reaches 2026 the rail is a finished Marey plate — exactly the static no-JS state.
 * Loaded lazily by AboutMotion — never in the first-load JS.
 *
 * Trigger: IntersectionObserver — a year counts as reached when its node crosses 65 % of the
 * viewport (no scroll listener, no scrub, no rAF loop of its own; same on phones). A fast
 * scroll past several years is ONE longer flight; the ghosts of the years in between appear
 * as the flier passes them (the ease is inverted to find those moments). Years already
 * scrolled past at arm time show reached without animation. The legs are S5's primary motion
 * and go through queuePrimaryMotion(). Leg duration: distance / 1100 px·s⁻¹, clamped
 * .22–.65 s (.9 s for a multi-year flight). A ResizeObserver keeps the stops in sync.
 *
 * Only transform and opacity animate (flier, its body, the line's scaleY); ghost and year
 * states are attributes with CSS transitions. gsap.matchMedia reverts to the static plate
 * when reduced motion is switched on.
 */
import { DUR, EASE, MQ, gsap, queuePrimaryMotion, registerMotion } from "@/lib/motion";

/** Viewport fraction a node must cross (from below) to count as reached. */
const TRIGGER = 0.65;
/** Flight speed along the rail (px per second) and the leg duration bounds (s). */
const SPEED = 1100;
const LEG_MIN = 0.22;
const LEG_MAX = 0.65;
const BURST_MAX = 0.9;
/** Take-off crouch (s) and the drop onto the first year (px above it). */
const CROUCH = 0.08;
const DROP = 32;
/** Sideways hop off the rail (px) at ≥640 px / on phones. */
const ARC_WIDE = 10;
const ARC_NARROW = 7;

const noop = () => {};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Time fraction at which a monotonic ease reaches `progress` (bisection). */
function timeAt(ease: (p: number) => number, progress: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < progress) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function armTimeline(root: HTMLElement): () => void {
  registerMotion();
  const line = root.querySelector<HTMLElement>("[data-timeline-line]");
  const flier = root.querySelector<HTMLElement>("[data-timeline-flier]");
  const body = root.querySelector<HTMLElement>("[data-timeline-flier-body]");
  const items = Array.from(root.querySelectorAll<HTMLElement>("[data-timeline-item]"));
  const nodes = items.map((item) => item.querySelector<HTMLElement>("[data-timeline-node]"));
  if (!line || !flier || !body || items.length === 0 || nodes.some((n) => !n)) return noop;
  const nodeEls = nodes as HTMLElement[];
  const last = nodeEls.length - 1;
  const flightEase = gsap.parseEase(EASE.flight) as (p: number) => number;

  const mm = gsap.matchMedia();
  mm.add(MQ.noReduce, (context) => {
    let live = true;

    // --- Geometry: node centres along the rail, relative to the timeline box ----------
    let centres: number[] = [];
    let lineTop = 0;
    let lineH = 1;
    const measure = () => {
      const rootTop = root.getBoundingClientRect().top;
      centres = nodeEls.map((n) => {
        const r = n.getBoundingClientRect();
        return r.top + r.height / 2 - rootTop;
      });
      // offsetTop/offsetHeight ignore the line's own scaleY transform.
      lineTop = line.offsetTop;
      lineH = line.offsetHeight || 1;
    };
    measure();
    /** The flier's y (it is anchored on the first year's node); -1 = waiting above 2007. */
    const yOf = (i: number) => (i < 0 ? -DROP : (centres[i] ?? 0) - (centres[0] ?? 0));
    /** The line's scaleY with its head on year i. */
    const stopOf = (i: number) => (i < 0 ? 0 : clamp(((centres[i] ?? 0) - lineTop) / lineH, 0, 1));

    // --- State ---------------------------------------------------------------------------
    // Years already above the trigger line (deep link, restored scroll) count as reached.
    let reached = -1;
    const triggerY = window.innerHeight * TRIGGER;
    nodeEls.forEach((n, i) => {
      if (n.getBoundingClientRect().top < triggerY) reached = i;
    });
    let wanted = reached;
    let flying = false;
    let queued = false;

    /** Static placement for the current state (arm, resize, after each leg). */
    const snap = () => {
      gsap.set(flier, { x: 0, y: yOf(reached), autoAlpha: reached < 0 ? 0 : 1 });
      gsap.set(line, { scaleY: reached >= last ? 1 : stopOf(reached) });
    };
    items.forEach((item, i) => {
      item.toggleAttribute("data-left", i < reached);
      item.toggleAttribute("data-lit", i <= reached);
    });
    gsap.set(line, { transformOrigin: "50% 0%" });
    gsap.set(body, { transformOrigin: "50% 100%" });
    snap();
    root.setAttribute("data-armed", "");

    // --- One leg: take-off → flight → stuck landing ----------------------------------------
    const legDuration = (from: number, to: number) => {
      const hops = to - Math.max(from, 0);
      return clamp((yOf(to) - yOf(from)) / SPEED, LEG_MIN, hops > 1 ? BURST_MAX : LEG_MAX);
    };
    const leg = (to: number) => {
      const from = reached;
      const y0 = yOf(from);
      const y1 = yOf(to);
      const dist = Math.max(1, y1 - y0);
      const dur = legDuration(from, to);
      const t0 = from >= 0 ? CROUCH : 0;
      const tLand = t0 + dur;
      flying = true;

      const tl = gsap.timeline({
        onComplete: () => {
          flying = false;
          reached = to;
          measure();
          snap();
          if (to < last) kick();
        },
      });

      // The first year alone is a drop from above (gravity); any other flight travels at running speed.
      const drop = from < 0 && to === 0;
      const yEase = drop ? "power2.in" : EASE.flight;
      if (from >= 0) {
        // Take-off: compress, lean back; the ghost of the year it leaves stays on the plate.
        const leaving = items[from];
        tl.to(body, { scaleY: 0.9, scaleX: 1.05, rotation: -6, duration: CROUCH, ease: "power2.out" }, 0)
          .call(() => leaving?.setAttribute("data-left", ""), undefined, CROUCH)
          .to(body, { scaleY: 1, scaleX: 1, duration: DUR.fast, ease: "power2.out" }, CROUCH);
      } else {
        // Coming in from above the first year (a dismount onto the rail).
        tl.set(body, { rotation: -6 }, 0).to(flier, { autoAlpha: 1, duration: DUR.fast, ease: "none" }, 0);
      }
      if (!drop) {
        // Flight: a small hop off the rail and back, torso pitching forward.
        const arc = window.matchMedia("(min-width: 640px)").matches ? ARC_WIDE : ARC_NARROW;
        tl.to(flier, { x: -arc, duration: dur / 2, ease: "power1.out" }, t0)
          .to(flier, { x: 0, duration: dur / 2, ease: "power1.in" }, t0 + dur / 2)
          .to(body, { rotation: 4, duration: dur * 0.8, ease: "sine.inOut" }, t0)
          .to(body, { rotation: 0, duration: dur * 0.2, ease: "power1.out" }, t0 + dur * 0.8);
      } else {
        tl.to(body, { rotation: 0, duration: dur, ease: "power1.out" }, 0);
      }
      tl.to(flier, { y: y1, duration: dur, ease: yEase }, t0).to(line, { scaleY: stopOf(to), duration: dur, ease: yEase }, t0);
      // Years flown over in one go: lit, and their ghost left, as the flier passes them.
      const yEaseFn = drop ? (gsap.parseEase("power2.in") as (p: number) => number) : flightEase;
      for (let k = from + 1; k < to; k++) {
        const item = items[k];
        const at = t0 + dur * timeAt(yEaseFn, (yOf(k) - y0) / dist);
        tl.call(
          () => {
            item?.setAttribute("data-lit", "");
            item?.setAttribute("data-left", "");
          },
          undefined,
          at,
        );
      }

      // Stuck landing: compress and hold; the year lights as the feet touch.
      tl.call(() => items[to]?.setAttribute("data-lit", "land"), undefined, Math.max(0, tLand - 0.08)).fromTo(
        body,
        { scaleY: 0.86, scaleX: 1.08 },
        { scaleY: 1, scaleX: 1, duration: DUR.land, ease: EASE.land, immediateRender: false },
        tLand,
      );
      // 2026: the story goes on — the rail runs on past the last year and fades (about.css).
      if (to === last) tl.to(line, { scaleY: 1, duration: DUR.reveal, ease: EASE.stick }, tLand + DUR.land / 2);
    };

    /** Years the reader has already scrolled past: placed at once, no flight off-screen. */
    const jump = (to: number) => {
      for (let k = reached + 1; k <= to; k++) {
        items[k]?.toggleAttribute("data-left", k < to);
        items[k]?.setAttribute("data-lit", "");
      }
      items[reached]?.setAttribute("data-left", "");
      reached = to;
      snap();
    };

    const kick = () => {
      if (!live || flying || queued || wanted <= reached) return;
      if ((nodeEls[wanted]?.getBoundingClientRect().bottom ?? 0) < 0) {
        context.add(() => jump(wanted));
        return;
      }
      queued = true;
      const estimate = (from: number, to: number) => (from >= 0 ? CROUCH : 0) + legDuration(from, to) + DUR.land;
      void queuePrimaryMotion(estimate(reached, wanted) * 1000).then(() => {
        queued = false;
        if (!live || flying || wanted <= reached) return;
        if ((nodeEls[wanted]?.getBoundingClientRect().bottom ?? 0) < 0) context.add(() => jump(wanted));
        else context.add(() => leg(wanted));
      });
    };

    let io: IntersectionObserver | undefined;
    if (reached < last) {
      io = new IntersectionObserver(
        (entries) => {
          let max = wanted;
          for (const e of entries) {
            // Entered the upper 65 % of the viewport, or already scrolled past it.
            if (e.isIntersecting || e.boundingClientRect.bottom < 0) {
              max = Math.max(max, nodeEls.indexOf(e.target as HTMLElement));
            }
          }
          if (max <= wanted) return;
          wanted = max;
          if (wanted >= last) io?.disconnect();
          kick();
        },
        { rootMargin: `0px 0px -${Math.round((1 - TRIGGER) * 100)}% 0px` },
      );
      nodeEls.forEach((node) => io?.observe(node));
    }

    // Keep the stops in sync with the real layout (fonts, wrapping, width changes).
    const ro = new ResizeObserver(() => {
      if (!live) return;
      measure();
      if (!flying) context.add(snap);
    });
    ro.observe(root);

    return () => {
      live = false;
      io?.disconnect();
      ro.disconnect();
      root.removeAttribute("data-armed");
      items.forEach((item) => {
        item.removeAttribute("data-left");
        item.removeAttribute("data-lit");
      });
    };
  });

  return () => mm.revert();
}
