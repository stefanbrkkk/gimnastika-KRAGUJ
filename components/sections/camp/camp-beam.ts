/**
 * S8 „last beam routine“ (§4 Camp as revised by the design review v2: MD-07, RC-07, MI-04).
 * A one-shot on every device where motion is allowed — no pin, no scrub, no ScrollTrigger:
 *   1. the club silhouette takes off from the beam and flies one split leap along it,
 *      leaving three chronophotograph ghost frames (the shared --ghost tokens);
 *   2. she sticks the landing (compress and hold) and finds her balance (beam wobble);
 *      the beam gives a little under her;
 *   3. the beam lets go: the legs fold, the bar fades, and the line morphs (MorphSVG, one
 *      path) into the summer sea while she fades; the two echo swells ripple out from the
 *      middle behind it.
 * Loaded lazily by CampIsland when the horizon is ≤1 viewport away. The beam pre-state is
 * set only if the horizon is off-screen at arm time; if it is already on screen, the static
 * wave stays. Reduced motion / Save-Data / no JS: the static wave + echoes (the markup).
 * Only transform, opacity and the one path morph change; one timeline, played once.
 */
import { DUR, EASE, MQ, gsap, loadMorphSVG, queuePrimaryMotion, registerMotion } from "@/lib/motion";
import { BEAM_D, BEAM_X0, BEAM_X1, BEAM_Y, HORIZON_VIEWBOX, LEGS_FOOT_Y, WAVE_D } from "./horizon";

const SVG_NS = "http://www.w3.org/2000/svg";
/** The routine plays once the horizon is this far into the viewport. */
const PLAY_LINE = "0px 0px -25% 0px";
/** Leap box of the #leap symbol (components/brand/sprite-paths.generated.ts: 230 × 150). */
const LEAP_ASPECT = 230 / 150;

/* Timeline (seconds). */
const FLIGHT = 0.6;
const WOBBLE = DUR.wobble;
const LET_GO = FLIGHT + 0.42;
const MORPH = DUR.slow;
const ECHO_AT = LET_GO + 0.36;
const ECHO = DUR.reveal;
const TOTAL = ECHO_AT + ECHO + 0.08;

/** Ghost frames along the arc (path progress) — the chronophotograph trail. */
const GHOST_AT = [0.25, 0.5, 0.75] as const;

const onScreen = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

/** Point on the quadratic leap arc P0 → (apex control) → P2 at parameter t. */
const arcPoint = (x0: number, x1: number, y: number, lift: number, t: number) => {
  const cx = (x0 + x1) / 2;
  const cy = y - 2 * lift;
  const u = 1 - t;
  return { x: u * u * x0 + 2 * u * t * cx + t * t * x1, y: u * u * y + 2 * u * t * cy + t * t * y };
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

      // The leap uses the open stretch of the beam: its middle on phones, and left of the
      // postcard stack on desktop (the stack stands over the beam's right half there).
      const phone = hb.width < 640;
      const size = phone ? 20 : 26;
      let x0 = px(BEAM_X0) + (px(BEAM_X1) - px(BEAM_X0)) * (phone ? 0.2 : 0.12);
      let x1 = px(BEAM_X1) - (px(BEAM_X1) - px(BEAM_X0)) * (phone ? 0.2 : 0.12);
      const stage = layout.querySelector("[data-postcards]")?.getBoundingClientRect();
      if (stage && window.innerWidth >= 1024) x1 = Math.min(x1, stage.left - lb.left - size * 1.5);
      if (x1 - x0 < size * 4) {
        x0 = px(BEAM_X0) + size;
        x1 = x0 + size * 6;
      }
      // Apex: clear of the postcards' bottom edge (phones) and of the camp note (desktop).
      const lift = phone ? 22 : 28;

      // The flier and her ghost frames live in an overlay in plain px (a uniform scale, so
      // the silhouette is never stretched like the horizon).
      overlay = document.createElementNS(SVG_NS, "svg");
      overlay.setAttribute("class", "camp__routine");
      overlay.setAttribute("aria-hidden", "true");
      overlay.setAttribute("focusable", "false");
      overlay.setAttribute("viewBox", `0 0 ${lb.width} ${lb.height}`);
      const w = size * LEAP_ASPECT;
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
      ghosts.forEach((g) => overlay?.appendChild(g));
      overlay.appendChild(flier);
      layout.appendChild(overlay);

      const tl = gsap.timeline({
        onComplete: () => {
          overlay?.remove();
          overlay = null;
          // The line already IS the wave (the morph's end); the rest returns to the markup.
          gsap.set([bar, legs, beam, ...echoClips], { clearProps: "all" });
        },
      });

      // 1 · Flight: X steady, Y a parabola (the arc eased on „hang“: a hold at the apex),
      // torso pitch through the air; each ghost frame appears as she passes it.
      ghosts.forEach((g, i) => {
        const p = arcPoint(x0, x1, beamTop, lift, GHOST_AT[i] ?? 0.5);
        gsap.set(g, { x: p.x, y: p.y, opacity: 0 });
        tl.to(g, { opacity: 1, duration: DUR.fast, ease: "none" }, FLIGHT * (GHOST_AT[i] ?? 0.5));
      });
      gsap.set(flier, { x: x0, y: beamTop, rotation: -10, opacity: 0, transformOrigin: "50% 100%" });
      tl.to(flier, { opacity: 1, duration: DUR.tap, ease: "none" }, 0);
      tl.to(
        flier,
        {
          motionPath: { path: `M${x0},${beamTop} Q${(x0 + x1) / 2},${beamTop - 2 * lift} ${x1},${beamTop}` },
          duration: FLIGHT,
          ease: EASE.hang,
        },
        0,
      );
      tl.to(flier, { rotation: 4, duration: FLIGHT * 0.5, ease: "none" }, 0);
      tl.to(flier, { rotation: 0, duration: FLIGHT * 0.5, ease: "none" }, FLIGHT * 0.5);

      // 2 · Stuck landing (compress and hold), then the balance wobble; the beam gives a
      // little under her (3px, in user units of the stretched SVG).
      tl.fromTo(
        flier,
        { scaleX: 1.06, scaleY: 0.86 },
        { scaleX: 1, scaleY: 1, duration: DUR.land, ease: EASE.land, immediateRender: false },
        FLIGHT,
      );
      tl.fromTo(flier, { rotation: -6 }, { rotation: 0, duration: WOBBLE, ease: EASE.wobble, immediateRender: false }, FLIGHT + 0.04);
      tl.fromTo(beam, { y: 3 / sy }, { y: 0, duration: DUR.base, ease: EASE.land, immediateRender: false }, FLIGHT);

      // 3 · The beam lets go and becomes the sea; she fades; the swells ripple out.
      tl.to(legs, { scaleY: 0, svgOrigin: `${midX} ${LEGS_FOOT_Y}`, duration: DUR.fast, ease: EASE.takeoff }, LET_GO);
      tl.to(legs, { opacity: 0, duration: DUR.fast, ease: "none" }, LET_GO + 0.06);
      tl.to(bar, { opacity: 0, duration: DUR.fast, ease: "none" }, LET_GO);
      tl.to(line, { morphSVG: WAVE_D, duration: MORPH, ease: EASE.stick }, LET_GO);
      tl.to([flier, ...ghosts], { opacity: 0, duration: DUR.base, ease: "none" }, LET_GO + 0.12);
      tl.to(echoClips, { scaleX: 1, duration: ECHO, ease: EASE.stick, stagger: 0.08 }, ECHO_AT);

      void queuePrimaryMotion(TOTAL * 1000).then(() => {
        if (live) tl.play();
      });
      tl.pause();
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
