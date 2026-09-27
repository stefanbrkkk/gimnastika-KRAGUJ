/**
 * S8 „last beam routine“ (§4 Camp; design review v2–v4: MD-07, RC-07, MI-04, RC2-07, MD2-08,
 * RC3-03, MD3-04; poses from plan-figure-system §5.8), scrubbed by the scroll (D-60, the
 * owner's D-52 rule for every exercise): the page's scroll position picks the moment of ONE
 * paused timeline (clock and lines in beam-scrub.ts). Scrolling plays the routine, scrolling back
 * rewinds it (the sea turns back into the beam, she rises out of it and flies back), and a
 * stopped scroll holds her mid-flight or mid-balance:
 *   1. take-off + flight: she jumps onto the beam as a faint star exposure (P1, the straddle
 *      jump) — X in step with the scroll and only Y eased, the ballistic parabola (MD3-04). One
 *      phase ghost of the star stays at the apex, fading in just after she passed it (RC3-03);
 *   2. the landing is a chronophotograph cut: the star gives way to the solid scale (P7, vaga)
 *      standing on the beam — a stuck landing (compress and recover), the beam gives a little,
 *      and she finds her balance about her standing foot (swayEase: one slow swing past
 *      upright, a small correction, still — the time-based elastic flickered under a scroll);
 *   3. the beam lets go: she sinks through the beam line (clipped there, foot first) while she
 *      fades, the ghost fades, the bar fades and the legs fold;
 *   4. only then the line morphs (MorphSVG, one path) into the summer sea and the two echo
 *      swells ripple out from the middle. She is never on screen during the morph.
 * The figures are readable: the logo body at 34 px on phones, 40 on tablets, 48 from 1024
 * (MD2-08). Her lane and arc are measured when the routine is built — off-screen, at arm time —
 * so the apex stays clear of the postcards' lower edges (rotated, measured exactly) and of the
 * text column; where a lane is too tight she is drawn smaller. Where no side lane fits at all
 * (one placeholder postcard over the whole beam: phones and tablets on the public build), the
 * beam hangs lower, over the sea, until a lane fits clear of the postcard, and rises back into
 * the wave with the morph. Only if even that fails, the beam simply lets go into the sea.
 * A new layout (resize, rotation; debounced) rebuilds the routine at the same moment; a
 * restacked postcard pile rebuilds it once the cards have landed and she is not on screen (with
 * the horizon in view, only if the beam can stay where it is), so she never jumps lanes.
 * Each figure is its own <svg data-figure="pose:<id>"> (qa/figures.mjs); no #leap here.
 * Loaded lazily by CampIsland when the horizon is ≤1 viewport away. The routine is built only
 * while the horizon is off-screen: one already on screen keeps its static wave until it has
 * left the view once (D-52), so nothing jumps under the reader's eyes. Reduced motion /
 * Save-Data / no JS: the static wave + echoes (the markup), which is also the routine's end.
 * Only transform, opacity and the one path morph change. No ScrollTrigger: one passive scroll
 * listener and one rAF, live only while the horizon is near.
 */
import { POSE_SCALE, POSE_STAR } from "@/components/brand/poses.generated";
import { EASE, MQ, gsap, loadMorphSVG, registerMotion } from "@/lib/motion";
import {
  APPEAR,
  CUT,
  ECHO,
  ECHO_AT,
  ECHO_STAGGER,
  FADE_DELAY,
  FLIGHT,
  FLY_AT,
  FOLD,
  GHOST_AT,
  GHOST_IN,
  GHOST_LAG,
  GIVE,
  GIVE_BACK,
  LAND_AT,
  LET_GO,
  MORPH,
  MORPH_AT,
  SINK,
  SQUASH,
  SWAY,
  SWAY_AT,
  SWAY_TILT,
  TOTAL,
  arcAt,
  routineProgress,
  swayEase,
} from "./beam-scrub";
import { BEAM_D, BEAM_X0, BEAM_X1, BEAM_Y, HORIZON_VIEWBOX, LEGS_FOOT_Y, WAVE_D } from "./horizon";

const SVG_NS = "http://www.w3.org/2000/svg";
/** Pose units per logo-body height: the #leap box is 150 units high (poses.generated.ts). */
const BODY_UNITS = 150;
/** Only the two poses this routine uses, so the lazy chunk carries two paths, not the whole family. */
const ROUTINE_POSES = { star: POSE_STAR, scale: POSE_SCALE } as const;
type RoutinePose = keyof typeof ROUTINE_POSES;
const STAR = POSE_STAR;
const SCALE = POSE_SCALE;
/** The scale's standing foot (its anchor on the beam), in pose units. */
const SCALE_FOOT = SCALE.contacts.foot;
/** She drops this far through the beam line as it lets go. */
const DROP = 18;
/** The beam's give under her landing (px). */
const GIVE_PX = 3;
/** The routine is live (scroll-driven) while the horizon is within this margin of the viewport. */
const NEAR = "50% 0px 50% 0px";
/** A new layout rebuilds the routine this long after the last resize (ms). */
const REBUILD_MS = 150;
/** A restacked pile has landed after this long (camp-postcards.ts: exit 180 ms + landing ≤700 ms). */
const RESTACK_MS = 950;

/* Lane search. */
/** Clear air between her silhouette and anything above (px) or beside her (px). */
const CLEAR = 6;
const CLEAR_X = 12;
/** Preferred apex height (× the body height), and the least that still reads as a leap. */
const LIFT = 0.75;
const MIN_LIFT = 0.5;
const MIN_SIZE = 24;
/** No side lane: the body size tried with the lowered beam first (the phone size), and the step (px). */
const DROP_SIZE = 34;
const DROP_STEP = 4;

type Pt = readonly [number, number];

/** Logo-body height (px): 34 on phones (portrait and landscape), 40 on tablets, 48 from 1024. */
const preferredSize = (): number => {
  const w = window.innerWidth;
  if (w < 640 || (w < 1024 && window.innerHeight <= 540)) return 34;
  return w < 1024 ? 40 : 48;
};

/** How far the phone dock covers the bottom of the viewport (px); 0 from 1024 up, where there is none. */
function dockCover(): number {
  const dock = document.querySelector<HTMLElement>("[data-sticky-bar]");
  if (!dock || window.matchMedia("(min-width: 1024px)").matches) return 0;
  const cs = getComputedStyle(dock);
  if (cs.display === "none") return 0;
  return Math.round(dock.offsetHeight + (parseFloat(cs.bottom) || 0));
}

/** The two figures' boxes at a body size (px): the star in the air, the scale on the beam. */
function figures(size: number) {
  const k = size / BODY_UNITS;
  return {
    k,
    starW: STAR.viewBox.width * k,
    starH: STAR.viewBox.height * k,
    scaleH: SCALE.floor * k,
    /** The scale's reach left and right of her standing foot. */
    scaleL: SCALE_FOOT[0] * k,
    scaleR: (SCALE.viewBox.width - SCALE_FOOT[0]) * k,
  };
}

/**
 * Everything the flier must pass under, as polygons in layout px: each postcard's frame with
 * its real (rotated) corners, and the text column's blocks.
 */
function obstacles(layout: HTMLElement, lb: DOMRect): Pt[][] {
  const polys: Pt[][] = [];
  for (const li of Array.from(layout.querySelectorAll<HTMLElement>("[data-postcard]"))) {
    const frame = li.querySelector<HTMLElement>(".frame") ?? li;
    const parent = li.offsetParent;
    if (!parent) continue;
    const pb = parent.getBoundingClientRect();
    const cs = getComputedStyle(li);
    const t = cs.transform;
    const m = new DOMMatrix(t && t !== "none" ? t : undefined);
    // The top card turns about its base once it has landed (camp-postcards.ts), the others
    // about their centre: map the corners about the card's real transform origin.
    const [ox = li.offsetWidth / 2, oy = li.offsetHeight / 2] = cs.transformOrigin.split(" ").map(parseFloat);
    const map = (x: number, y: number): Pt => {
      const p = m.transformPoint(new DOMPoint(x - ox, y - oy));
      return [pb.left - lb.left + li.offsetLeft + ox + p.x, pb.top - lb.top + li.offsetTop + oy + p.y];
    };
    const fx = frame === li ? 0 : frame.offsetLeft;
    const fy = frame === li ? 0 : frame.offsetTop;
    const fw = frame.offsetWidth;
    const fh = frame.offsetHeight;
    polys.push([map(fx, fy), map(fx + fw, fy), map(fx + fw, fy + fh), map(fx, fy + fh)]);
  }
  for (const el of Array.from(layout.querySelectorAll<HTMLElement>(".camp__text > *"))) {
    const r = el.getBoundingClientRect();
    if (el.hidden || r.height === 0) continue;
    const [l, t, rr, b] = [r.left - lb.left, r.top - lb.top, r.right - lb.left, r.bottom - lb.top];
    polys.push([[l, t], [rr, t], [rr, b], [l, b]]);
  }
  return polys;
}

/** The lowest point of any obstacle over [xa, xb] (−∞ when the span is open sky). */
function lowestOver(polys: readonly Pt[][], xa: number, xb: number): number {
  let y = -Infinity;
  for (const p of polys) {
    p.forEach((a, i) => {
      const b = p[(i + 1) % p.length] ?? a;
      const lo = Math.min(a[0], b[0]);
      const hi = Math.max(a[0], b[0]);
      const x0 = Math.max(lo, xa);
      const x1 = Math.min(hi, xb);
      if (x0 > x1) return;
      for (const x of [x0, x1]) {
        y = Math.max(y, hi === lo ? Math.max(a[1], b[1]) : a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]));
      }
    });
  }
  return y;
}

interface Lane {
  size: number;
  x0: number;
  x1: number;
  lift: number;
}

/**
 * The flight at one body size: the longest comfortable leap along the beam (up to 60% of it
 * or 9 body heights), as central as the obstacles allow, whose arc (`arcAt`, the real flight)
 * keeps the star CLEAR px under everything above it, and where the scale she lands in stands
 * clear at its end.
 */
function laneAt(polys: readonly Pt[][], bx0: number, bx1: number, beamTop: number, size: number): Lane | null {
  const f = figures(size);
  const mid = (bx0 + bx1) / 2;
  const want = size * LIFT;
  const longest = Math.max(4 * f.starW, Math.min(0.6 * (bx1 - bx0), 9 * size));
  for (let d = longest; d >= 3.5 * f.starW; d -= 16) {
    let best: (Lane & { score: number }) | null = null;
    for (let x0 = bx0 + f.starW / 2; x0 + d + f.scaleR <= bx1; x0 += 8) {
      const x1 = x0 + d;
      // The landing: the scale standing on the beam at x1.
      if (beamTop - CLEAR - f.scaleH < lowestOver(polys, x1 - f.scaleL - CLEAR_X, x1 + f.scaleR + CLEAR_X)) continue;
      let lift = want;
      for (let k = 0; k <= 24 && lift >= 0; k++) {
        const t = k / 24;
        const x = x0 + t * d;
        const room = beamTop - f.starH - CLEAR - lowestOver(polys, x - f.starW / 2 - CLEAR_X, x + f.starW / 2 + CLEAR_X);
        const arc = arcAt(t);
        lift = room < 0 ? -1 : arc > 0 ? Math.min(lift, room / arc) : lift;
      }
      if (lift < size * MIN_LIFT) continue;
      const score = lift - 0.02 * Math.abs(x0 + d / 2 - mid);
      if (!best || score > best.score) best = { size, x0, x1, lift, score };
    }
    if (best) return best;
  }
  return null;
}

/** The largest body size from `from` down to MIN_SIZE that has a lane (null: none). */
function findLane(polys: readonly Pt[][], bx0: number, bx1: number, beamTop: number, from: number): Lane | null {
  for (let size = from; size >= MIN_SIZE; size = Math.floor(size * 0.88)) {
    const lane = laneAt(polys, bx0, bx1, beamTop, size);
    if (lane) return lane;
  }
  return null;
}

/** One pose as its own <svg data-figure> in a <g> the timeline moves; `anchor` (pose units) sits on the g's origin. */
function poseFigure(id: RoutinePose, cls: string, k: number, anchor: Pt): SVGGElement {
  const { d, viewBox: vb } = ROUTINE_POSES[id];
  const g = document.createElementNS(SVG_NS, "g");
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("data-figure", `pose:${id}`);
  svg.setAttribute("class", cls);
  svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.width} ${vb.height}`);
  svg.setAttribute("x", String(-anchor[0] * k));
  svg.setAttribute("y", String(-anchor[1] * k));
  svg.setAttribute("width", String(vb.width * k));
  svg.setAttribute("height", String(vb.height * k));
  svg.setAttribute("overflow", "visible");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "currentColor");
  svg.appendChild(path);
  g.appendChild(svg);
  return g;
}

/** GSAP's SVG origin is relative to the bbox's top-left: this puts it on the g's own origin (the anchor). */
const anchorOrigin = (g: SVGGElement): string => {
  const bb = g.getBBox();
  return `${-bb.x}px ${-bb.y}px`;
};

/** One built routine: its paused timeline and what it was measured for. */
interface Routine {
  ctx: gsap.Context;
  tl: gsap.core.Timeline;
  overlay: SVGSVGElement | null;
  /** The layout it was measured for (a change rebuilds it). */
  key: string;
  /** The postcards' stack order it was measured for. */
  order: string;
  /** The phone dock's cover (px) when it was built. */
  cover: number;
  /** How far the beam hangs below its place in the horizon (px): the scroll follows the beam she stands on. */
  drop: number;
  /** The progress last shown (−1: none yet). */
  shown: number;
}

export async function armBeam(svg: SVGSVGElement): Promise<() => void> {
  registerMotion();
  await loadMorphSVG();
  const layout = svg.closest<HTMLElement>("[data-camp]");
  const beam = svg.querySelector<SVGGElement>("[data-horizon-beam]");
  const line = svg.querySelector<SVGPathElement>("[data-horizon-line]");
  const bar = svg.querySelector<SVGPathElement>("[data-horizon-bar]");
  const legs = svg.querySelector<SVGPathElement>("[data-horizon-legs]");
  const echoClips = Array.from(svg.querySelectorAll<SVGRectElement>("[data-horizon-echo-clip]"));
  if (!layout || !beam || !line || !bar || !legs) return () => {};
  const cards = Array.from(layout.querySelectorAll<HTMLElement>("[data-postcard]"));
  const midX = HORIZON_VIEWBOX.width / 2;

  /** Horizon geometry in layout px (the SVG stretches: user units → px per axis). */
  const measure = () => {
    const lb = layout.getBoundingClientRect();
    const hb = svg.getBoundingClientRect();
    const sx = hb.width / HORIZON_VIEWBOX.width;
    const sy = hb.height / HORIZON_VIEWBOX.height;
    const px = (x: number) => hb.left - lb.left + x * sx;
    return {
      lb,
      hb,
      sy,
      beamTop: hb.top - lb.top + BEAM_Y * sy - 5, // the bar is 10px (non-scaling)
      bx0: Math.max(0, px(BEAM_X0)),
      bx1: Math.min(lb.width, px(BEAM_X1)),
      /** The lowest the beam may hang: its bar still inside the horizon box. */
      maxDrop: Math.max(0, hb.bottom - lb.top - (hb.top - lb.top + BEAM_Y * sy) - 10),
    };
  };
  /** What the lane depends on: the layout's and the horizon's boxes, and the viewport width. */
  const layoutKey = (lb: DOMRect, hb: DOMRect): string =>
    [lb.width, lb.height, hb.width, hb.height, hb.top - lb.top, window.innerWidth].map(Math.round).join(" ");
  const stackOrder = (): string => cards.map((c) => c.dataset.slot ?? "").join(" ");

  /** The routine's plan for the current layout (measured, nothing drawn): her lane and the beam's drop. */
  const plan = () => {
    const g = measure();
    const { lb, beamTop: top0, bx0, bx1, maxDrop } = g;
    const polys = obstacles(layout, lb);
    // No side lane at the beam's own height (one postcard over the whole beam): the beam hangs
    // lower, over the sea, by the least drop (px) that gives the largest body a lane.
    let drop = 0;
    let lane = findLane(polys, bx0, bx1, top0, preferredSize());
    if (!lane) {
      search: for (let size = Math.min(preferredSize(), DROP_SIZE); size >= MIN_SIZE; size = Math.floor(size * 0.88)) {
        for (let d = DROP_STEP; d <= maxDrop; d += DROP_STEP) {
          const found = laneAt(polys, bx0, bx1, top0 + d, size);
          if (found) {
            drop = d;
            lane = found;
            break search;
          }
        }
      }
    }
    return { ...g, lane, drop, order: stackOrder() };
  };
  type Plan = ReturnType<typeof plan>;

  /**
   * Builds a planned routine: the pre-state (the beam on its legs, lowered by the drop; no
   * echoes yet) and one paused timeline on the beam-scrub clock. Nothing is shown until the
   * caller sets its progress, in the same frame.
   */
  const make = ({ lb, hb, sy, beamTop: top0, lane, drop, order }: Plan): Routine => {
    const beamTop = top0 + drop;
    /** The drop in user units. */
    const dy = drop / sy;
    const made: { tl?: gsap.core.Timeline; overlay?: SVGSVGElement } = {};

    const ctx = gsap.context(() => {
      gsap.set(line, { morphSVG: BEAM_D });
      gsap.set([bar, legs], { opacity: 1 });
      if (dy) gsap.set([beam, legs], { y: dy });
      gsap.set(echoClips, { scaleX: 0, svgOrigin: `${midX} 0` });

      // Every step is a `to` from the state before it (fromTo would snap back to its start
      // values whenever the scroll rewinds past it).
      const t = (made.tl = gsap.timeline({ paused: true, defaults: { lazy: false } }));

      if (lane) {
        const { size, x0, x1, lift } = lane;
        const { k } = figures(size);
        // The figures live in an overlay in plain px (a uniform scale, so a pose is never
        // stretched like the horizon). The scale is clipped at the beam line, so when the beam
        // lets go she drops through it instead of hovering.
        const overlay = (made.overlay = document.createElementNS(SVG_NS, "svg"));
        overlay.setAttribute("class", "camp__routine");
        overlay.setAttribute("aria-hidden", "true");
        overlay.setAttribute("focusable", "false");
        overlay.setAttribute("viewBox", `0 0 ${lb.width} ${lb.height}`);
        const clipId = "kamp-routine-clip";
        const clip = document.createElementNS(SVG_NS, "clipPath");
        clip.setAttribute("id", clipId);
        clip.setAttribute("clipPathUnits", "userSpaceOnUse");
        const rect = document.createElementNS(SVG_NS, "rect");
        rect.setAttribute("x", "-100");
        rect.setAttribute("y", "-100");
        rect.setAttribute("width", String(lb.width + 200));
        rect.setAttribute("height", String(beamTop + 100 + 1));
        clip.appendChild(rect);
        overlay.appendChild(clip);
        const starFoot: Pt = [STAR.viewBox.width / 2, STAR.viewBox.height];
        const ghost = poseFigure("star", "camp__routine-ghost", k, starFoot);
        const star = poseFigure("star", "camp__routine-star", k, starFoot);
        const scale = poseFigure("scale", "camp__routine-solid", k, SCALE_FOOT);
        const clipped = document.createElementNS(SVG_NS, "g");
        clipped.setAttribute("clip-path", `url(#${clipId})`);
        clipped.append(star, scale);
        overlay.append(ghost, clipped);
        layout.appendChild(overlay);

        // 1 · Take-off + flight (MD3-04): the faint star leaves the beam at x0 — X in step with
        // the scroll, Y up and back down on the arc (its ease returns to 0, so the tween ends on
        // the beam). The ghost fades in just after she passed its spot, on her exact path.
        gsap.set(star, { x: x0, y: beamTop, opacity: 0 });
        t.to(star, { opacity: 1, duration: APPEAR, ease: "none" }, 0);
        gsap.set(ghost, { x: x0 + GHOST_AT * (x1 - x0), y: beamTop - lift * arcAt(GHOST_AT), opacity: 0 });
        t.to(ghost, { opacity: 1, duration: GHOST_IN, ease: "none" }, FLY_AT + FLIGHT * GHOST_AT + GHOST_LAG);
        t.to(star, { x: x1, duration: FLIGHT, ease: "none" }, FLY_AT);
        t.to(star, { y: beamTop - lift, duration: FLIGHT, ease: arcAt }, FLY_AT);

        // 2 · Touchdown, a chronophotograph cut: the star gives way to the solid scale on her
        // standing foot, arriving compressed and tilted; she recovers (stuck landing) and finds
        // her balance about the foot while the beam gives a little and comes back.
        gsap.set(scale, { x: x1, y: beamTop, opacity: 0, transformOrigin: anchorOrigin(scale) });
        t.set(scale, { scaleX: 1.06, scaleY: 0.86, rotation: SWAY_TILT }, LAND_AT - CUT / 2);
        t.to(star, { opacity: 0, duration: CUT, ease: "none" }, LAND_AT - CUT / 2);
        t.to(scale, { opacity: 1, duration: CUT, ease: "none" }, LAND_AT - CUT / 2);
        t.to(scale, { scaleX: 1, scaleY: 1, duration: SQUASH, ease: EASE.land }, LAND_AT);
        t.to(scale, { rotation: 0, duration: SWAY, ease: swayEase }, SWAY_AT);
        t.to(beam, { y: dy + GIVE_PX / sy, duration: GIVE, ease: "power2.out" }, LAND_AT);
        t.to(beam, { y: dy, duration: GIVE_BACK, ease: EASE.land }, LAND_AT + GIVE);

        // 3 · The beam lets go: she sinks through the line with gravity — the clip at the bar
        // top takes her foot first — and fades on the way, gone as the morph starts (RC3-03).
        t.to(scale, { y: beamTop + DROP, duration: SINK, ease: "power1.in" }, LET_GO);
        t.to(scale, { opacity: 0, duration: SINK - FADE_DELAY, ease: "none" }, LET_GO + FADE_DELAY);
        t.to(ghost, { opacity: 0, duration: FOLD, ease: "none" }, LET_GO);
      }

      // 3 · …the bar fades and the legs fold, all before the morph starts.
      t.to(bar, { opacity: 0, duration: FOLD, ease: "none" }, LET_GO);
      t.to(legs, { scaleY: 0, svgOrigin: `${midX} ${LEGS_FOOT_Y + dy}`, duration: FOLD, ease: EASE.takeoff }, LET_GO);
      t.to(legs, { opacity: 0, duration: FOLD * 0.7, ease: "none" }, LET_GO + FOLD * 0.3);

      // 4 · The line becomes the sea (a lowered beam rises back into it); the swells ripple out.
      // Gentle eases, not the one-shot's stick: the scroll sets the tempo, so no stretch of it
      // may pass with nothing moving.
      t.to(line, { morphSVG: WAVE_D, duration: MORPH, ease: "sine.out" }, MORPH_AT);
      if (dy) t.to(beam, { y: 0, duration: MORPH, ease: "sine.out" }, MORPH_AT);
      t.to(echoClips, { scaleX: 1, duration: ECHO, ease: "sine.out", stagger: ECHO_STAGGER }, ECHO_AT);
    });

    return {
      ctx,
      tl: made.tl ?? gsap.timeline({ paused: true }),
      overlay: made.overlay ?? null,
      key: layoutKey(lb, hb),
      order,
      cover: dockCover(),
      drop,
      shown: -1,
    };
  };

  /** Puts the markup back: the static wave and echoes, no figures. */
  const dismantle = (r: Routine) => {
    r.ctx.revert();
    r.overlay?.remove();
  };

  const mm = gsap.matchMedia();
  mm.add(MQ.noReduce, () => {
    let routine: Routine | null = null;
    let near = false;
    /** One more update after the horizon left the near zone, so the routine rests at its end or its start. */
    let settle = false;
    let rebuild = false;
    let raf = 0;
    let timer = 0;
    /** When the pile's last restack has settled (a restack is measured only once it stands still). */
    let settledAt = 0;
    let settleTimer = 0;
    /** A restacked pile whose lane needs the beam to move: rebuilt once the horizon is off screen. */
    let deferred = "";

    const replace = (next: Plan): Routine => {
      if (routine) dismantle(routine);
      return (routine = make(next));
    };

    const update = () => {
      raf = 0;
      if (!near && !settle) return;
      settle = false;
      const vh = window.innerHeight;
      const hb = svg.getBoundingClientRect();
      const visible = hb.bottom > 0 && hb.top < vh;
      /** The static beam line in the viewport (the scroll follows the beam she stands on: + its drop). */
      const beamY = hb.top + BEAM_Y * (hb.height / HORIZON_VIEWBOX.height);
      let r = routine;
      if (!r) {
        // D-52: a horizon on screen keeps its static wave until it has left the view once.
        if (visible) return;
        r = replace(plan());
      } else if (layoutKey(layout.getBoundingClientRect(), hb) !== r.key) {
        if (rebuild || !visible) r = replace(plan());
        else {
          // A new layout on screen: rebuild once the resize has settled (at the same moment).
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            rebuild = true;
            schedule();
          }, REBUILD_MS);
        }
      } else if (stackOrder() !== r.order && performance.now() >= settledAt && (!visible || deferred !== stackOrder())) {
        // A restacked pile (camp-postcards.ts): her lane is measured again once she is not on
        // screen — and, with the horizon in view, only if the beam can stay where it is.
        const p = routineProgress(beamY + r.drop, vh, r.cover);
        if (!visible) r = replace(plan());
        else if (p <= 0 || p >= MORPH_AT / TOTAL) {
          const next = plan();
          if (next.drop === r.drop) r = replace(next);
          else deferred = next.order;
        }
      }
      rebuild = false;
      const p = routineProgress(beamY + r.drop, vh, r.cover);
      if (p !== r.shown) {
        r.shown = p;
        // On the routine's own clock (TOTAL, whatever the lane): a scroll position is always the same moment.
        r.tl.seek(p * TOTAL);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last) near = last.isIntersecting;
        settle = true;
        schedule();
      },
      { rootMargin: NEAR },
    );
    io.observe(svg);
    // The pile restacks (a flick, prev/next): wait until the cards have landed, then look again.
    const mo = new MutationObserver(() => {
      settledAt = performance.now() + RESTACK_MS;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(schedule, RESTACK_MS);
    });
    for (const card of cards) mo.observe(card, { attributes: true, attributeFilter: ["data-slot"] });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.clearTimeout(settleTimer);
      if (routine) dismantle(routine);
      routine = null;
      line.setAttribute("d", WAVE_D);
    };
  });
  return () => mm.revert();
}
