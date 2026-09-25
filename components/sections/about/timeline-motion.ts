/**
 * „Hronologija“ as a chronophotograph in motion (§5 S5; design review AC-01, MI-AC-1, MD-09,
 * AC2-04, AC2-09). The club's leaping gymnast rides the rail from year to year: a short crouch,
 * a leap — it rises off the year first (take-off), then drops onto the next one riding the
 * progress line's head (flight), with a small sideways arc and torso pitch — and a stuck
 * landing on the year (compress and hold, EASE.land). Every year it leaves keeps a ghost
 * exposure, so when the reader reaches 2026 the rail is a finished Marey plate — exactly the
 * static no-JS state. Loaded lazily by AboutMotion — never in the first-load JS.
 *
 * Content before decoration (AC2-04): a year lights on its OWN crossing of the trigger line,
 * never more than 250 ms after it, whether or not the flier has got there; a flier landing in
 * time lights it with the landing. Only the ghost exposure (data-left) follows the flier.
 * A year's frame cut in the rail (its node backing) exists only once the flier has stood on it
 * (data-left) or stands on it now (data-here): a year not reached yet — even one already lit —
 * lets the thin unlit rail run through, never an empty cut (AC3-05).
 *
 * Trigger: IntersectionObserver — a year counts as reached when its node crosses 65 % of the
 * viewport (no scroll listener, no scrub, no rAF loop of its own; same on phones). A new year
 * reached mid-flight retargets the flight instead of queueing another leg: it carries on at
 * its current speed to the furthest year wanted (min(remaining + .09 s per extra year, .9 s)),
 * and a flier touching down with a further year already wanted goes straight on — no landing
 * squash, no hold. Years already scrolled past at arm time show reached without animation.
 * A flight from rest is S5's primary motion and goes through queuePrimaryMotion(). Leg
 * duration: distance / 1100 px·s⁻¹, clamped .22–.65 s (.9 s for a multi-year flight).
 * A ResizeObserver keeps the stops in sync.
 *
 * Only transform and opacity animate (flier, its body, the line's scaleY); ghost and year
 * states are attributes with CSS transitions. gsap.matchMedia reverts to the static plate
 * when reduced motion is switched on.
 */
import { CustomEase, DUR, EASE, MQ, gsap, queuePrimaryMotion, registerMotion } from "@/lib/motion";

/** Viewport fraction a node must cross (from below) to count as reached. */
const TRIGGER = 0.65;
/** Flight speed along the rail (px per second) and the leg duration bounds (s). */
const SPEED = 1100;
const LEG_MIN = 0.22;
const LEG_MAX = 0.65;
const BURST_MAX = 0.9;
/** Retargeting mid-flight: extra time per further year (s). */
const PER_YEAR = 0.09;
/** Take-off crouch (s) and the drop onto the first year (px above it). */
const CROUCH = 0.08;
const DROP = 32;
/** Take-off rise off the year (px) at ≥640 px / on phones, and its share of the leg. */
const RISE_WIDE = 8;
const RISE_NARROW = 6;
const RISE_SHARE = 0.22;
/** Body pitch (deg): leaning back at take-off, forward at the apex. */
const PITCH_TAKEOFF = -8;
const PITCH_APEX = 4;
/** Sideways hop off the rail (px) at ≥640 px / on phones. */
const ARC_WIDE = 10;
const ARC_NARROW = 7;
/** A year lights at most this long after its own crossing (content is never held behind decoration). */
const LIT_CAP_MS = 250;
/** The retarget ease's id (re-created per retarget: its start slope continues the flier's speed). */
const RETARGET_EASE = "timeline-retarget";

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
  const fallEase = gsap.parseEase("power2.in") as (p: number) => number;
  const dropEase = gsap.parseEase("power2.in") as (p: number) => number;

  const mm = gsap.matchMedia();
  mm.add(MQ.noReduce, (context) => {
    let live = true;
    const wide = () => window.matchMedia("(min-width: 640px)").matches;

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
    /** The line's scaleY with its head at flier height y. */
    const stopAt = (y: number) => clamp(((centres[0] ?? 0) + y - lineTop) / lineH, 0, 1);
    const stopOf = (i: number) => (i < 0 ? 0 : stopAt(yOf(i)));

    // --- Year states -----------------------------------------------------------------------
    const litTimers = new Map<number, ReturnType<typeof setTimeout>>();
    /** Lights year k (once); `landing` also plays the year's small settle with the flier. */
    const light = (k: number, landing = false) => {
      const item = items[k];
      if (!item) return;
      const t = litTimers.get(k);
      if (t) clearTimeout(t);
      litTimers.delete(k);
      if (!item.hasAttribute("data-lit")) item.setAttribute("data-lit", landing ? "land" : "");
    };
    /** The year was crossed (or scrolled past): lit within LIT_CAP_MS, flier or not. */
    const crossed = (k: number) => {
      const item = items[k];
      if (!item || item.hasAttribute("data-lit") || litTimers.has(k)) return;
      if ((nodeEls[k]?.getBoundingClientRect().bottom ?? 0) < 0) light(k);
      else litTimers.set(k, setTimeout(() => live && light(k), LIT_CAP_MS));
    };
    const leave = (k: number) => items[k]?.setAttribute("data-left", "");
    /** The year the flier stands on (its frame cut shows under the flier). */
    const stand = (k: number) => items.forEach((item, i) => item.toggleAttribute("data-here", i === k));

    // --- State ---------------------------------------------------------------------------
    // Years already above the trigger line (deep link, restored scroll) count as reached.
    let reached = -1;
    const triggerY = window.innerHeight * TRIGGER;
    nodeEls.forEach((n, i) => {
      if (n.getBoundingClientRect().top < triggerY) reached = i;
    });
    /** Furthest year crossed; the year the current flight is headed for. */
    let wanted = reached;
    let target = reached;
    let phase: "idle" | "queued" | "flying" | "landing" = "idle";
    let flight: gsap.core.Timeline | null = null;
    let landingTween: gsap.core.Tween | null = null;

    /** Static placement for the current state (arm, resize, after each landing). */
    const snap = (withLine = true) => {
      gsap.set(flier, { x: 0, y: yOf(reached), autoAlpha: reached < 0 ? 0 : 1 });
      stand(reached);
      gsap.set(body, { rotation: 0, scaleX: 1, scaleY: 1 });
      if (withLine) gsap.set(line, { scaleY: reached >= last ? 1 : stopOf(reached) });
    };
    items.forEach((item, i) => {
      item.toggleAttribute("data-left", i < reached);
      item.toggleAttribute("data-lit", i <= reached);
    });
    gsap.set(line, { transformOrigin: "50% 0%" });
    gsap.set(body, { transformOrigin: "50% 100%" });
    snap();
    root.setAttribute("data-armed", "");

    const legDuration = (from: number, to: number) => {
      const hops = to - Math.max(from, 0);
      return clamp((yOf(to) - yOf(from)) / SPEED, LEG_MIN, hops > 1 ? BURST_MAX : LEG_MAX);
    };

    /** Ghosts and years passed on the way: exposed/lit as the flier's y crosses them. */
    const passEvents = (tl: gsap.core.Timeline, from: number, to: number, yA: number, t0: number, dur: number, ease: (p: number) => number) => {
      const span = Math.max(1, yOf(to) - yA);
      for (let k = from + 1; k < to; k++) {
        const p = (yOf(k) - yA) / span;
        if (p <= 0) {
          leave(k);
          light(k);
          continue;
        }
        tl.call(
          () => {
            leave(k);
            light(k);
          },
          undefined,
          t0 + dur * timeAt(ease, p),
        );
      }
    };

    /** Stuck landing — or, with a further year already wanted, straight on. */
    const touchdown = () => {
      flight = null;
      reached = target;
      if (!live) return;
      stand(reached); // the frame cut appears under the flier's feet, never ahead of it
      if (wanted > reached && (nodeEls[wanted]?.getBoundingClientRect().bottom ?? 0) >= 0) {
        context.add(() => fly(wanted, false));
        return;
      }
      phase = "landing";
      context.add(() => {
        if (reached === last) gsap.to(line, { scaleY: 1, duration: DUR.reveal, ease: EASE.stick, delay: DUR.land / 2 });
        landingTween = gsap.fromTo(
          body,
          { scaleY: 0.86, scaleX: 1.08, rotation: 0 },
          {
            scaleY: 1,
            scaleX: 1,
            duration: DUR.land,
            ease: EASE.land,
            onComplete: () => {
              landingTween = null;
              phase = "idle";
              measure();
              snap(reached < last); // at 2026 the line is still running on past the year
              kick();
            },
          },
        );
      });
    };

    /**
     * One leg from the year the flier stands on: take-off (a crouch when starting from rest),
     * a rise off the year, then the drop onto `to` riding the progress head.
     */
    const fly = (to: number, fromRest: boolean) => {
      const from = reached;
      const y0 = yOf(from);
      const y1 = yOf(to);
      const dur = legDuration(from, to);
      const drop = from < 0; // coming in from above the first year (a dismount onto the rail)
      const t0 = fromRest && !drop ? CROUCH : 0;
      target = to;
      phase = "flying";
      landingTween?.kill();
      landingTween = null;

      const tl = gsap.timeline({ onComplete: touchdown });
      flight = tl;
      if (drop) {
        tl.set(body, { rotation: -6 }, 0)
          .to(flier, { autoAlpha: 1, duration: DUR.fast, ease: "none" }, 0)
          .to(body, { rotation: 0, duration: dur, ease: "power1.out" }, 0)
          .to(flier, { y: y1, duration: dur, ease: "power2.in" }, 0)
          .to(line, { scaleY: stopOf(to), duration: dur, ease: "power2.in" }, 0);
        passEvents(tl, from, to, y0, 0, dur, dropEase);
      } else {
        // Take-off: compress and lean back (from rest), or spring straight off a touch-down.
        if (fromRest) tl.to(body, { scaleY: 0.9, scaleX: 1.05, rotation: PITCH_TAKEOFF, duration: CROUCH, ease: "power2.out" }, 0);
        else tl.to(body, { rotation: PITCH_TAKEOFF, duration: 0.06, ease: "power2.out" }, 0);
        tl.call(() => leave(from), undefined, t0).to(body, { scaleY: 1, scaleX: 1, duration: DUR.fast, ease: "power2.out" }, t0);
        // Flight: rise off the year, then the fall onto the next, riding the progress head.
        const rise = wide() ? RISE_WIDE : RISE_NARROW;
        const tUp = dur * RISE_SHARE;
        const yApex = y0 - rise;
        tl.to(flier, { y: yApex, duration: tUp, ease: "power2.out" }, t0)
          .to(flier, { y: y1, duration: dur - tUp, ease: "power2.in" }, t0 + tUp)
          .to(line, { scaleY: stopOf(to), duration: dur - tUp, ease: "power2.in" }, t0 + tUp)
          .to(body, { rotation: PITCH_APEX, duration: tUp, ease: "sine.inOut" }, t0 + 0.02)
          .to(body, { rotation: 0, duration: (dur - tUp) * 0.5, ease: "sine.inOut" }, t0 + dur - (dur - tUp) * 0.5);
        const arc = wide() ? ARC_WIDE : ARC_NARROW;
        tl.to(flier, { x: -arc, duration: dur * 0.45, ease: "power1.out" }, t0).to(flier, { x: 0, duration: dur * 0.55, ease: "power1.in" }, t0 + dur * 0.45);
        passEvents(tl, from, to, yApex, t0 + tUp, dur - tUp, fallEase);
      }
      // The year lights as the feet touch (unless its own crossing already lit it).
      tl.call(() => light(to, true), undefined, Math.max(0, t0 + dur - 0.08));
    };

    /** A further year wanted mid-flight: carry on to it at the current speed instead of queueing. */
    const retarget = () => {
      const tl = flight;
      if (!tl) return;
      const n = wanted - target;
      const to = wanted;
      const remaining = Math.max(0, tl.duration() - tl.time());
      let T = Math.min(remaining + PER_YEAR * n, BURST_MAX);
      // The flier's speed now (px/s), sampled from the running flight without firing its events.
      const t = tl.time();
      const yNow = gsap.getProperty(flier, "y") as number;
      tl.time(Math.min(tl.duration(), t + 1 / 120), true);
      const yNext = gsap.getProperty(flier, "y") as number;
      tl.time(t, true);
      tl.kill();
      if (!items[reached]?.hasAttribute("data-left") && reached >= 0) leave(reached);
      const v = Math.max(0, (yNext - yNow) * 120);
      const D = Math.max(1, yOf(to) - yNow);
      // Start at the current speed (≤1.2 × the mean), end a little faster: no hitch, no float.
      let k = (v * T) / D;
      if (k > 1.2) {
        T = Math.max(0.12, (1.2 * D) / v);
        k = 1.2;
      }
      const ease = CustomEase.create(RETARGET_EASE, `M0,0 C${(1 / 3).toFixed(3)},${(k / 3).toFixed(3)} 0.667,0.4 1,1`) as (p: number) => number;
      const fromIdx = reached; // years already passed are settled at once by passEvents
      target = to;
      const next = gsap.timeline({ onComplete: touchdown });
      flight = next;
      next
        .to(flier, { y: yOf(to), duration: T, ease: RETARGET_EASE }, 0)
        .to(line, { scaleY: stopOf(to), duration: T, ease: RETARGET_EASE }, 0)
        .to(flier, { x: 0, autoAlpha: 1, duration: T, ease: "sine.out" }, 0)
        .to(body, { scaleX: 1, scaleY: 1, rotation: PITCH_APEX, duration: T * 0.5, ease: "sine.out" }, 0)
        .to(body, { rotation: 0, duration: T * 0.5, ease: "sine.inOut" }, T * 0.5);
      passEvents(next, fromIdx, to, yNow, 0, T, ease);
      next.call(() => light(to, true), undefined, Math.max(0, T - 0.08));
    };

    /** Years the reader has already scrolled past: placed at once, no flight off-screen. */
    const jump = (to: number) => {
      for (let k = reached + 1; k <= to; k++) {
        items[k]?.toggleAttribute("data-left", k < to);
        light(k);
      }
      if (reached >= 0) leave(reached);
      reached = to;
      target = to;
      snap();
    };

    const offAbove = (i: number) => (nodeEls[i]?.getBoundingClientRect().bottom ?? 0) < 0;
    const estimate = (from: number, to: number) => (from >= 0 ? CROUCH : 0) + legDuration(from, to) + DUR.land;

    function kick() {
      if (!live) return;
      if (phase === "flying") {
        if (wanted > target) context.add(retarget);
        return;
      }
      if (phase === "landing") {
        // Touched down and a further year is already wanted: skip the hold, spring on.
        if (wanted <= reached) return;
        context.add(() => {
          if (!offAbove(wanted)) {
            fly(wanted, false);
            return;
          }
          landingTween?.kill();
          landingTween = null;
          phase = "idle";
          jump(wanted);
        });
        return;
      }
      if (phase === "queued" || wanted <= reached) return;
      if (offAbove(wanted)) {
        context.add(() => jump(wanted));
        return;
      }
      phase = "queued";
      void queuePrimaryMotion(estimate(reached, wanted) * 1000).then(() => {
        if (!live || phase !== "queued") return;
        phase = "idle";
        if (wanted <= reached) return;
        if (offAbove(wanted)) context.add(() => jump(wanted));
        else context.add(() => fly(wanted, true));
      });
    }

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
          // Every year up to here lights on its own crossing (≤250 ms), flier or not.
          for (let k = 0; k <= wanted; k++) crossed(k);
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
      if (phase === "idle" || phase === "queued") context.add(() => snap());
    });
    ro.observe(root);

    return () => {
      live = false;
      io?.disconnect();
      ro.disconnect();
      litTimers.forEach((t) => clearTimeout(t));
      root.removeAttribute("data-armed");
      items.forEach((item) => {
        item.removeAttribute("data-left");
        item.removeAttribute("data-lit");
        item.removeAttribute("data-here");
      });
    };
  });

  return () => mm.revert();
}
