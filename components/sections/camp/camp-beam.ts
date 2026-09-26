/**
 * S8 „last beam routine“ (§4 Camp as revised by the design review v2: MD-07, RC-07, MI-04;
 * reworked in round 2: RC2-07 + MD2-08; poses from plan-figure-system §5.8). A one-shot on
 * every device where motion is allowed — no pin, no scrub, no ScrollTrigger:
 *   1. take-off + flight: she jumps onto the beam as a faint star exposure (P1, the straddle
 *      jump: the take-off phase) — X at constant speed and only Y eased, a parabola in time, so
 *      she floats over the apex as a real leap does (MD3-04). One phase ghost of the star stays
 *      at the apex, fading in just after she has passed it, never ahead of her (RC3-03);
 *   2. the landing is a chronophotograph cut: the star gives way to the solid scale (P7, vaga)
 *      standing on the beam — a stuck landing (compress and hold) and the balance wobble, both
 *      about her standing foot; the beam gives a little under her;
 *   3. the beam lets go: she sinks through the beam line with gravity (clipped there, so her
 *      foot goes first) while she fades, the ghost fades, the bar fades and the legs fold —
 *      all within 240 ms (RC3-03);
 *   4. only then the line morphs (MorphSVG, one path) into the summer sea and the two echo
 *      swells ripple out from the middle. She is never on screen during the morph.
 * The figures are readable: the logo body at 34 px on phones, 40 on tablets, 48 from 1024
 * (MD2-08). Her lane and arc are measured at play time so the apex always stays clear of the
 * postcards' lower edges (rotated, measured exactly) and of the text column; where a lane is
 * too tight she is drawn smaller. Where no side lane fits at all (one placeholder postcard
 * over the whole beam: phones and tablets on the public build), the beam hangs lower, over
 * the sea, until a lane fits clear of the postcard — decided at arm time, off-screen, so the
 * visible beam never jumps — and rises back into the wave with the morph. Only if even that
 * fails, the beam simply lets go into the sea.
 * Each figure is its own <svg data-figure="pose:<id>"> (qa/figures.mjs); no #leap here.
 * Loaded lazily by CampIsland when the horizon is ≤1 viewport away. The beam pre-state is set
 * only if the horizon is off-screen at arm time; if it is already on screen, the static wave
 * stays. Reduced motion / Save-Data / no JS: the static wave + echoes (the markup).
 * Only transform, opacity and the one path morph change; one timeline (≤1.9s), played once.
 */
import { POSE_SCALE, POSE_STAR } from "@/components/brand/poses.generated";
import { DUR, EASE, MQ, gsap, loadMorphSVG, queuePrimaryMotion, registerMotion } from "@/lib/motion";
import { BEAM_D, BEAM_X0, BEAM_X1, BEAM_Y, HORIZON_VIEWBOX, LEGS_FOOT_Y, WAVE_D } from "./horizon";

const SVG_NS = "http://www.w3.org/2000/svg";
/** The routine plays once the horizon is this far into the viewport. */
const PLAY_LINE = "0px 0px -25% 0px";
/** Pose units per logo-body height: the #leap box is 150 units high (poses.generated.ts). */
const BODY_UNITS = 150;
/** Only the two poses this routine uses, so the lazy chunk carries two paths, not the whole family. */
const ROUTINE_POSES = { star: POSE_STAR, scale: POSE_SCALE } as const;
type RoutinePose = keyof typeof ROUTINE_POSES;
const STAR = POSE_STAR;
const SCALE = POSE_SCALE;
/** The scale's standing foot (its anchor on the beam), in pose units. */
const SCALE_FOOT = SCALE.contacts.foot;

/* Timeline (seconds). */
const APPEAR = 0.1;
const FLY_AT = 0.04;
const FLIGHT = 0.6;
const LAND_AT = FLY_AT + FLIGHT;
/** The chronophotograph cut at touchdown: the star fades out as the scale fades in. */
const CUT = 0.06;
const WOBBLE = DUR.wobble;
/** She holds the balance this long before the beam lets go. */
const LET_GO = LAND_AT + 0.36;
/** RC3-03: she sinks (power1.in) over this span; her fade starts 40 ms in and ends with it. */
const SINK = DUR.fast + 0.06;
const FADE_DELAY = 0.04;
const MORPH_AT = LET_GO + SINK;
const MORPH = DUR.reveal;
const ECHO_AT = MORPH_AT + 0.12;
const ECHO = 0.48;
const ECHO_STAGGER = 0.06;
const TOTAL = ECHO_AT + ECHO_STAGGER + ECHO;
/** She drops this far through the beam line as it lets go. */
const DROP = 18;

/** The one phase ghost: the star at the apex (share of the flight) — a different phase from the landing. */
const GHOST_AT = 0.5;
/** The ghost fades in this long after she passed its spot (RC3-03: always behind her). */
const GHOST_LAG = 0.03;

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

/**
 * Height of the leap (share of its lift), 0 → 1 → 0, at a share u of the flight. X runs at
 * constant speed, so u is both time and distance; Y alone is eased — the ballistic parabola
 * of the title marks (MD3-04). Used for the lane search, the flight and the ghost.
 */
const arcAt = (u: number): number => 4 * u * (1 - u);

const onScreen = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

/** Logo-body height (px): 34 on phones (portrait and landscape), 40 on tablets, 48 from 1024. */
const preferredSize = (): number => {
  const w = window.innerWidth;
  if (w < 640 || (w < 1024 && window.innerHeight <= 540)) return 34;
  return w < 1024 ? 40 : 48;
};

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

  /** Horizon geometry in layout px (the SVG stretches: user units → px per axis). */
  const measure = () => {
    const lb = layout.getBoundingClientRect();
    const hb = svg.getBoundingClientRect();
    const sx = hb.width / HORIZON_VIEWBOX.width;
    const sy = hb.height / HORIZON_VIEWBOX.height;
    const px = (x: number) => hb.left - lb.left + x * sx;
    return {
      lb,
      sy,
      beamTop: hb.top - lb.top + BEAM_Y * sy - 5, // the bar is 10px (non-scaling)
      bx0: Math.max(0, px(BEAM_X0)),
      bx1: Math.min(lb.width, px(BEAM_X1)),
      /** The lowest the beam may hang: its bar still inside the horizon box. */
      maxDrop: Math.max(0, hb.bottom - lb.top - (hb.top - lb.top + BEAM_Y * sy) - 10),
    };
  };

  const mm = gsap.matchMedia();
  mm.add(MQ.noReduce, (context) => {
    // Already on screen when the chunk arrived: never snap the visible wave to a beam.
    if (onScreen(svg)) return;

    let live = true;
    let overlay: SVGSVGElement | null = null;
    const midX = HORIZON_VIEWBOX.width / 2;

    // No side lane at the beam's own height (one postcard over the whole beam): the beam
    // hangs lower, over the sea, by the least drop (px) that gives the largest body a lane.
    let drop = 0;
    {
      const g = measure();
      const polys = obstacles(layout, g.lb);
      if (!findLane(polys, g.bx0, g.bx1, g.beamTop, preferredSize())) {
        search: for (let size = Math.min(preferredSize(), DROP_SIZE); size >= MIN_SIZE; size = Math.floor(size * 0.88)) {
          for (let d = DROP_STEP; d <= g.maxDrop; d += DROP_STEP) {
            if (laneAt(polys, g.bx0, g.bx1, g.beamTop + d, size)) {
              drop = d;
              break search;
            }
          }
        }
      }
    }
    /** The drop in user units: it stays true if the horizon's height changes before play. */
    const dy = drop / measure().sy;

    // Pre-state: the beam on its legs (lowered by `drop`); the echoes not yet out.
    gsap.set(line, { morphSVG: BEAM_D });
    gsap.set([bar, legs], { opacity: 1 });
    if (dy) gsap.set([beam, legs], { y: dy });
    gsap.set(echoClips, { scaleX: 0, svgOrigin: `${midX} 0` });

    const play = () => {
      if (!live) return;
      const { lb, sy, beamTop: top0, bx0, bx1 } = measure();
      const beamTop = top0 + dy * sy;
      const lane = findLane(obstacles(layout, lb), bx0, bx1, beamTop, dy ? Math.min(preferredSize(), DROP_SIZE) : preferredSize());

      const tl = gsap.timeline({
        paused: true,
        onComplete: () => {
          overlay?.remove();
          overlay = null;
          // The line already IS the wave (the morph's end); the rest returns to the markup.
          gsap.set([bar, legs, beam, ...echoClips], { clearProps: "all" });
        },
      });

      if (lane) {
        const { size, x0, x1, lift } = lane;
        const { k } = figures(size);
        // The figures live in an overlay in plain px (a uniform scale, so a pose is never
        // stretched like the horizon). The scale is clipped at the beam line, so when the beam
        // lets go she drops through it instead of hovering.
        overlay = document.createElementNS(SVG_NS, "svg");
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

        // 1 · Take-off + flight (MD3-04): the faint star leaves the beam at x0 — X at constant
        // speed, Y up and back down on the arc (its ease returns to 0, so the tween ends on the
        // beam). X is linear, so she passes the ghost's spot at FLIGHT × its share; the ghost
        // fades in just after that, on her exact path — never ahead of her (RC3-03).
        gsap.set(star, { x: x0, y: beamTop, opacity: 0 });
        tl.to(star, { opacity: 1, duration: APPEAR, ease: "none" }, 0);
        gsap.set(ghost, { x: x0 + GHOST_AT * (x1 - x0), y: beamTop - lift * arcAt(GHOST_AT), opacity: 0 });
        tl.to(ghost, { opacity: 1, duration: DUR.fast, ease: "none" }, FLY_AT + FLIGHT * GHOST_AT + GHOST_LAG);
        tl.to(star, { x: x1, duration: FLIGHT, ease: "none" }, FLY_AT);
        tl.to(star, { y: beamTop - lift, duration: FLIGHT, ease: arcAt }, FLY_AT);

        // 2 · Touchdown, a chronophotograph cut: the star gives way to the solid scale on her
        // standing foot. Stuck landing (compress and hold), then the balance wobble — both about
        // the foot; the beam gives a little.
        gsap.set(scale, { x: x1, y: beamTop, opacity: 0, transformOrigin: anchorOrigin(scale) });
        tl.to(star, { opacity: 0, duration: CUT, ease: "none" }, LAND_AT - CUT / 2);
        tl.to(scale, { opacity: 1, duration: CUT, ease: "none" }, LAND_AT - CUT / 2);
        tl.fromTo(
          scale,
          { scaleX: 1.06, scaleY: 0.86 },
          { scaleX: 1, scaleY: 1, duration: DUR.land, ease: EASE.land, immediateRender: false },
          LAND_AT,
        );
        tl.fromTo(scale, { rotation: -6 }, { rotation: 0, duration: WOBBLE, ease: EASE.wobble, immediateRender: false }, LAND_AT + 0.04);
        tl.fromTo(beam, { y: dy + 3 / sy }, { y: dy, duration: DUR.base, ease: EASE.land, immediateRender: false }, LAND_AT);

        // 3 · The beam lets go: she sinks through the line with gravity — the clip at the bar
        // top takes her foot first — and fades on the way, gone as the morph starts (RC3-03).
        tl.to(scale, { y: beamTop + DROP, duration: SINK, ease: "power1.in" }, LET_GO);
        tl.to(scale, { opacity: 0, duration: SINK - FADE_DELAY, ease: "none" }, LET_GO + FADE_DELAY);
        tl.to(ghost, { opacity: 0, duration: DUR.fast, ease: "none" }, LET_GO);
      }

      // 3 · …the bar fades and the legs fold, all before the morph starts.
      tl.to(bar, { opacity: 0, duration: DUR.fast, ease: "none" }, LET_GO);
      tl.to(legs, { scaleY: 0, svgOrigin: `${midX} ${LEGS_FOOT_Y + dy}`, duration: DUR.fast, ease: EASE.takeoff }, LET_GO);
      tl.to(legs, { opacity: 0, duration: DUR.fast * 0.7, ease: "none" }, LET_GO + DUR.fast * 0.3);

      // 4 · The line becomes the sea (a lowered beam rises back into it); the swells ripple out.
      tl.to(line, { morphSVG: WAVE_D, duration: MORPH, ease: EASE.stick }, MORPH_AT);
      if (dy) tl.to(beam, { y: 0, duration: MORPH, ease: EASE.stick }, MORPH_AT);
      tl.to(echoClips, { scaleX: 1, duration: ECHO, ease: EASE.stick, stagger: ECHO_STAGGER }, ECHO_AT);

      void queuePrimaryMotion(TOTAL * 1000).then(() => {
        if (live) tl.play();
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        context.add(play);
      },
      { rootMargin: PLAY_LINE },
    );
    io.observe(svg);

    return () => {
      live = false;
      io.disconnect();
      overlay?.remove();
      overlay = null;
    };
  });
  return () => mm.revert();
}
