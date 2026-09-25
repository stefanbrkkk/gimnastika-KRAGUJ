/**
 * S8 „last beam routine“ (§4 Camp as revised by the design review v2: MD-07, RC-07, MI-04;
 * reworked in round 2: RC2-07 + MD2-08). A one-shot on every device where motion is allowed —
 * no pin, no scrub, no ScrollTrigger:
 *   1. take-off: the club silhouette appears standing on the bar, crouches and pushes off
 *      (scaleY .9 → 1 from the feet, EASE.takeoff);
 *   2. one split leap along the beam: X at constant speed and only Y eased — a parabola in
 *      time, so she floats over the apex as a real leap does (the title marks' and S10's
 *      flight model; MD3-04 — the whole path on „hang“ had stalled her there). She leaves
 *      three chronophotograph ghost frames (the shared --ghost tokens), each appearing just
 *      after she has passed its spot, never ahead of her (RC3-03); then a stuck landing
 *      (compress and hold) and a balance wobble; the beam gives a little under her;
 *   3. the beam lets go: she sinks through the beam line with gravity (clipped there, so her
 *      feet go first) while she fades, her ghosts fade, the bar fades and the legs fold —
 *      all within 240 ms (RC3-03);
 *   4. only then the line morphs (MorphSVG, one path) into the summer sea and the two echo
 *      swells ripple out from the middle. She is never on screen during the morph.
 * The flier is readable: 34px tall on phones, 40 on tablets, 48 from 1024 (MD2-08). Her lane
 * and arc are measured at play time so the apex always stays clear of the postcards' lower
 * edges (rotated, measured exactly) and of the text column; where a lane is too tight she is
 * drawn smaller, and if nothing fits, the beam simply lets go into the sea.
 * Loaded lazily by CampIsland when the horizon is ≤1 viewport away. The beam pre-state is set
 * only if the horizon is off-screen at arm time; if it is already on screen, the static wave
 * stays. Reduced motion / Save-Data / no JS: the static wave + echoes (the markup).
 * Only transform, opacity and the one path morph change; one timeline (≤1.9s), played once.
 */
import { DUR, EASE, MQ, gsap, loadMorphSVG, queuePrimaryMotion, registerMotion } from "@/lib/motion";
import { BEAM_D, BEAM_X0, BEAM_X1, BEAM_Y, HORIZON_VIEWBOX, LEGS_FOOT_Y, WAVE_D } from "./horizon";

const SVG_NS = "http://www.w3.org/2000/svg";
/** The routine plays once the horizon is this far into the viewport. */
const PLAY_LINE = "0px 0px -25% 0px";
/** Leap box of the #leap symbol (components/brand/sprite-paths.generated.ts: 230 × 150). */
const LEAP_ASPECT = 230 / 150;

/* Timeline (seconds). */
const APPEAR = 0.08;
const CROUCH_AT = 0.04;
const FLY_AT = CROUCH_AT + DUR.tap;
const FLIGHT = 0.6;
const LAND_AT = FLY_AT + FLIGHT;
const WOBBLE = DUR.wobble;
const LET_GO = LAND_AT + 0.26;
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

/** Ghost frames along the arc (share of the flight's length) — the chronophotograph trail. */
const GHOST_AT = [0.25, 0.5, 0.75] as const;
/** A ghost fades in this long after she passed its spot (RC3-03: always behind her). */
const GHOST_LAG = 0.03;

/* Lane search. */
/** Clear air between her silhouette and anything above (px) or beside her (px). */
const CLEAR = 6;
const CLEAR_X = 12;
/** Preferred apex height (× her height), and the least that still reads as a leap. */
const LIFT = 0.75;
const MIN_LIFT = 0.5;
const MIN_SIZE = 24;

type Pt = readonly [number, number];

/**
 * Height of the leap (share of its lift), 0 → 1 → 0, at a share u of the flight. X runs at
 * constant speed, so u is both time and distance; Y alone is eased — the ballistic parabola
 * of the title marks (MD3-04). Used for the lane search, the flight and the ghost frames.
 */
const arcAt = (u: number): number => 4 * u * (1 - u);

const onScreen = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

/** Height of the flier (px): 34 on phones (portrait and landscape), 40 on tablets, 48 from 1024. */
const preferredSize = (): number => {
  const w = window.innerWidth;
  if (w < 640 || (w < 1024 && window.innerHeight <= 540)) return 34;
  return w < 1024 ? 40 : 48;
};

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
 * The flight: the longest comfortable leap along the beam (up to 60% of it or 9 body
 * heights), as central as the obstacles allow, whose arc (`arcAt`, the real flight) keeps
 * her whole silhouette CLEAR px under everything above it. Smaller sizes are tried
 * before giving up.
 */
function findLane(polys: readonly Pt[][], bx0: number, bx1: number, beamTop: number): Lane | null {
  const mid = (bx0 + bx1) / 2;
  for (let size = preferredSize(); size >= MIN_SIZE; size = Math.floor(size * 0.88)) {
    const w = size * LEAP_ASPECT;
    const want = size * LIFT;
    const longest = Math.max(4 * w, Math.min(0.6 * (bx1 - bx0), 9 * size));
    for (let d = longest; d >= 3.5 * w; d -= 16) {
      let best: (Lane & { score: number }) | null = null;
      for (let x0 = bx0 + w / 2; x0 + d <= bx1 - w / 2; x0 += 8) {
        let lift = want;
        for (let k = 0; k <= 24 && lift >= 0; k++) {
          const t = k / 24;
          const x = x0 + t * d;
          const room = beamTop - size - CLEAR - lowestOver(polys, x - w / 2 - CLEAR_X, x + w / 2 + CLEAR_X);
          const arc = arcAt(t);
          lift = room < 0 ? -1 : arc > 0 ? Math.min(lift, room / arc) : lift;
        }
        if (lift < size * MIN_LIFT) continue;
        const score = lift - 0.02 * Math.abs(x0 + d / 2 - mid);
        if (!best || score > best.score) best = { size, x0, x1: x0 + d, lift, score };
      }
      if (best) return best;
    }
  }
  return null;
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

  const mm = gsap.matchMedia();
  mm.add(MQ.noReduce, (context) => {
    // Already on screen when the chunk arrived: never snap the visible wave to a beam.
    if (onScreen(svg)) return;

    let live = true;
    let overlay: SVGSVGElement | null = null;
    const midX = HORIZON_VIEWBOX.width / 2;

    // Pre-state: the beam on its legs; the echoes not yet out.
    gsap.set(line, { morphSVG: BEAM_D });
    gsap.set([bar, legs], { opacity: 1 });
    gsap.set(echoClips, { scaleX: 0, svgOrigin: `${midX} 0` });

    const play = () => {
      if (!live) return;
      // Horizon geometry in layout px (the SVG stretches: user units → px per axis).
      const lb = layout.getBoundingClientRect();
      const hb = svg.getBoundingClientRect();
      const sx = hb.width / HORIZON_VIEWBOX.width;
      const sy = hb.height / HORIZON_VIEWBOX.height;
      const px = (x: number) => hb.left - lb.left + x * sx;
      const beamTop = hb.top - lb.top + BEAM_Y * sy - 5; // the bar is 10px (non-scaling)
      const lane = findLane(obstacles(layout, lb), Math.max(0, px(BEAM_X0)), Math.min(lb.width, px(BEAM_X1)), beamTop);

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
        const w = size * LEAP_ASPECT;
        // The flier and her ghost frames live in an overlay in plain px (a uniform scale, so
        // the silhouette is never stretched like the horizon). She is clipped at the beam
        // line, so when the beam lets go she drops through it instead of hovering.
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
        const figure = (cls: string) => {
          const use = document.createElementNS(SVG_NS, "use");
          use.setAttribute("href", "#leap");
          use.setAttribute("width", String(w));
          use.setAttribute("height", String(size));
          use.setAttribute("x", String(-w / 2));
          use.setAttribute("y", String(-size));
          use.setAttribute("class", cls);
          const g = document.createElementNS(SVG_NS, "g");
          g.appendChild(use);
          return g;
        };
        const ghosts = GHOST_AT.map((_, i) => figure(`camp__routine-ghost camp__routine-ghost--${i + 1}`));
        const flier = figure("camp__routine-solid");
        const clipped = document.createElementNS(SVG_NS, "g");
        clipped.setAttribute("clip-path", `url(#${clipId})`);
        clipped.appendChild(flier);
        ghosts.forEach((g) => overlay?.appendChild(g));
        overlay.appendChild(clipped);
        layout.appendChild(overlay);

        // 1 · Take-off: she stands on the bar, crouched, and pushes off from her feet.
        gsap.set(flier, { x: x0, y: beamTop, rotation: -6, scaleY: 0.9, opacity: 0, transformOrigin: "50% 100%" });
        tl.to(flier, { opacity: 1, duration: APPEAR, ease: "none" }, 0);
        tl.to(flier, { scaleY: 1, duration: DUR.tap, ease: EASE.takeoff }, CROUCH_AT);

        // 2 · Flight (MD3-04): X at constant speed, Y up and back down on the arc (its ease
        // returns to 0, so the tween ends on the beam); torso pitch through the air. X is
        // linear, so she passes a ghost's spot at FLIGHT × its share; the ghost fades in just
        // after that, on her exact path — never ahead of her (RC3-03).
        ghosts.forEach((g, i) => {
          const t = GHOST_AT[i] ?? 0.5;
          gsap.set(g, { x: x0 + t * (x1 - x0), y: beamTop - lift * arcAt(t), opacity: 0 });
          tl.to(g, { opacity: 1, duration: DUR.fast, ease: "none" }, FLY_AT + FLIGHT * t + GHOST_LAG);
        });
        tl.to(flier, { x: x1, duration: FLIGHT, ease: "none" }, FLY_AT);
        tl.to(flier, { y: beamTop - lift, duration: FLIGHT, ease: arcAt }, FLY_AT);
        tl.to(flier, { rotation: 4, duration: FLIGHT * 0.5, ease: "none" }, FLY_AT);
        tl.to(flier, { rotation: 0, duration: FLIGHT * 0.5, ease: "none" }, FLY_AT + FLIGHT * 0.5);

        // Stuck landing (compress and hold), then the balance wobble; the beam gives a little.
        tl.fromTo(
          flier,
          { scaleX: 1.06, scaleY: 0.86 },
          { scaleX: 1, scaleY: 1, duration: DUR.land, ease: EASE.land, immediateRender: false },
          LAND_AT,
        );
        tl.fromTo(flier, { rotation: -6 }, { rotation: 0, duration: WOBBLE, ease: EASE.wobble, immediateRender: false }, LAND_AT + 0.04);
        tl.fromTo(beam, { y: 3 / sy }, { y: 0, duration: DUR.base, ease: EASE.land, immediateRender: false }, LAND_AT);

        // 3 · The beam lets go: she sinks through the line with gravity — the clip at the bar
        // top takes her feet first — and fades on the way, gone as the morph starts (RC3-03).
        tl.to(flier, { y: beamTop + DROP, duration: SINK, ease: "power1.in" }, LET_GO);
        tl.to(flier, { opacity: 0, duration: SINK - FADE_DELAY, ease: "none" }, LET_GO + FADE_DELAY);
        tl.to(ghosts, { opacity: 0, duration: DUR.fast, ease: "none" }, LET_GO);
      }

      // 3 · …the bar fades and the legs fold, all before the morph starts.
      tl.to(bar, { opacity: 0, duration: DUR.fast, ease: "none" }, LET_GO);
      tl.to(legs, { scaleY: 0, svgOrigin: `${midX} ${LEGS_FOOT_Y}`, duration: DUR.fast, ease: EASE.takeoff }, LET_GO);
      tl.to(legs, { opacity: 0, duration: DUR.fast * 0.7, ease: "none" }, LET_GO + DUR.fast * 0.3);

      // 4 · The line becomes the sea; the swells ripple out from the middle.
      tl.to(line, { morphSVG: WAVE_D, duration: MORPH, ease: EASE.stick }, MORPH_AT);
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
