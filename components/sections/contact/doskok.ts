/**
 * Final CTA „doskok“ — „Poslednji skok“ (§4 Final CTA; design review v2: C-02, C-13,
 * MD-11, M-01, MI-10). The page's closing dismount:
 *
 *   take-off  the silhouette on the S11 title's mark crouches (compress) and springs;
 *             the mark's solid frame stays behind at .3 — the take-off frame;
 *   flight    a short rise to the apex, then a back salto (the figure faces right and
 *             travels back-and-down, so it rotates backwards) that opens out through the
 *             three static ghost frames — each one flashes brighter as it is passed, a
 *             fresh exposure on the plate;
 *   landing   a STUCK landing on the button's top edge: the figure compresses and holds
 *             (--ease-land), the button squashes with it (.94/1.03 → 1, rebound .35 s,
 *             D-S11-4), two chalk puffs leave the feet; then the afterimages fade back to
 *             the trail's resting opacity.
 *
 * The flier IS the landed frame ([data-doskok-leap]), moved by transform from the mark to
 * its own layout box, so the final state is exactly the static composition (no-JS and
 * reduced motion), and every point is measured at play time (any layout, any width).
 *
 * Rules kept: transform + opacity only; one timeline, ≤1 rAF loop (GSAP's ticker, which
 * sleeps when idle), no scroll-linked scrub, no pin; the only hidden pre-state is the
 * landed figure (it is still on the title's mark), applied by JS while the CTA is
 * off-screen — the trail stays, so the slab never rests empty (e.g. after the header
 * „Kontakt“ jump, which leaves the button at the fold); cleanup reverts every inline
 * style (gsap.context).
 * ONE primary motion per viewport: the flight goes through queuePrimaryMotion(); the title
 * mark is static (land={false}), so this is S11's one landing.
 * Trigger: the button ≥85% in view for 120 ms (MD-11), so it plays once the hand stops,
 * not mid-scroll; it re-arms if the button leaves before the dwell ends.
 * Loaded lazily by ContactDoskok — never in the first-load JS.
 */
import { DUR, EASE, MQ, gsap, motionAllowed, queuePrimaryMotion, registerMotion } from "@/lib/motion";
import { buildPath, flightTiming, keyed, progressAt, timeAt, type Pt } from "./doskok-path";

const noop = () => {};

/** Crouch before the take-off (s). */
const CROUCH = 0.09;
/** Button squash on touchdown (§4: scaleY .94 / scaleX 1.03 → 1, rebound .35 s). */
const BUTTON_SQUASH = { scaleX: 1.03, scaleY: 0.94 } as const;
const BUTTON_SQUASH_DUR = 0.35;
/** The figure's own stuck landing: compress, then hold (MD-11). */
const FIGURE_SQUASH = { scaleX: 1.05, scaleY: 0.86 } as const;
/** Ghost frames flash brighter as they are passed, then decay to their resting opacity. */
const GHOST_PEAK = 1.8;
/** Tilt of each static ghost (contact.css --gr): the salto's last degrees, as negative (backward) turns. */
const GHOST_TURN = [-330, -344, -354] as const;
const DWELL_MS = 120;
const VISIBLE_RATIO = 0.85;
/** The silhouette's ink box inside its 230×150 frame (sprite bbox 224×144.5). */
const INK_W = 224 / 230;

/** Chalk: puffs where the split touches down — front foot (out and up) and under the hips. */
const CHALK = [
  { at: 0.95, dx: 15, dy: -9 },
  { at: 0.88, dx: -5, dy: -15 },
  { at: 0.55, dx: -13, dy: -8 },
] as const;

const center = (r: DOMRect): Pt => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

export function armDoskok(root: HTMLElement): () => void {
  registerMotion();
  const flier = root.querySelector<SVGSVGElement>("[data-doskok-leap]");
  const figure = flier?.querySelector<SVGUseElement>("use") ?? null;
  const body = root.querySelector<HTMLElement>("[data-doskok-body]");
  const ghosts = Array.from(root.querySelectorAll<SVGSVGElement>("[data-doskok-ghost]"));
  const section = root.closest("section");
  const mark = section?.querySelector<SVGUseElement>(".section-heading__mark .chrono-solid") ?? null;
  if (!flier || !figure || !body || ghosts.length !== GHOST_TURN.length) return noop;

  // Already on screen (deep link to #kontakt, restored scroll): keep the static final state — no flash.
  const box = body.getBoundingClientRect();
  if (box.bottom > 0 && box.top < window.innerHeight) return noop;

  const rest = ghosts.map((g) => Number(getComputedStyle(g).opacity) || 0.3);

  const ctx = gsap.context(() => {
    gsap.set(flier, { autoAlpha: 0 });
  });

  const play = () => {
    const land = flier.getBoundingClientRect();
    const L = center(land);
    const rel = (p: Pt): Pt => ({ x: p.x - L.x, y: p.y - L.y });
    const G = ghosts.map((g) => rel(center(g.getBoundingClientRect())));

    // Take-off point and size: the title mark's solid frame (or, if the title is missing,
    // a point one trail-length above the first ghost).
    const markRect = mark?.getBoundingClientRect();
    const hasMark = Boolean(markRect && markRect.width > 0);
    const g1 = G[0]!;
    const P0 = hasMark ? rel(center(markRect!)) : { x: g1.x + land.width * 0.4, y: g1.y - land.width * 1.6 };
    const startScale = hasMark ? Math.min(1.2, Math.max(0.3, markRect!.width / INK_W / land.width)) : 0.6;

    // Apex: a real rise off the mark (the take-off), a third of the way toward the trail —
    // and always a little back (left), the way a back salto travels.
    const drop = -P0.y; // P0 is above the landing (y < 0)
    const riseH = Math.min(90, Math.max(32, drop * 0.14));
    const back = Math.min(-land.width * 0.18, (g1.x - P0.x) * 0.36);
    const apex: Pt = { x: P0.x + back, y: P0.y - riseH };
    const path = buildPath([P0, apex, ...G, { x: 0, y: 0 }]);
    const wide = window.innerWidth >= 1024;
    const total = Math.min(wide ? 1.0 : 0.9, Math.max(0.75, 0.04 * Math.sqrt(drop + 2 * riseH)));
    const timing = flightTiming(path, 1, drop, riseH, total);
    const tGhost = G.map((_, i) => timeAt(timing, path.anchors[i + 2] ?? 0));
    const tLand = timing.rise + timing.fall;

    // Rotation (a back salto opening out through the ghosts' tilts) and scale, keyed by time.
    const turnKeys: [number, number][] = [[0, 0], ...tGhost.map((t, i): [number, number] => [t, GHOST_TURN[i]!]), [tLand, -360]];
    const scaleKeys: [number, number][] = [
      [0, startScale],
      [tGhost[0]! * 0.7, startScale + (1 - startScale) * 0.85],
      [tGhost[0]!, 1],
    ];

    const setX = gsap.quickSetter(flier, "x", "px");
    const setY = gsap.quickSetter(flier, "y", "px");
    const setR = gsap.quickSetter(flier, "rotation", "deg");
    const setS = gsap.quickSetter(flier, "scale");
    const place = (t: number) => {
      const p = path.at(progressAt(timing, t));
      setX(p.x);
      setY(p.y);
      setR(keyed(turnKeys, t));
      setS(keyed(scaleKeys, t));
    };

    // Chalk puffs (created now, removed when the flight ends or is stopped).
    const bodyBox = body.getBoundingClientRect();
    puffs = CHALK.map(({ at }) => {
      const el = document.createElement("span");
      el.setAttribute("aria-hidden", "true");
      el.style.cssText =
        "position:absolute;bottom:100%;width:16px;height:16px;margin:0 0 -6px -8px;border-radius:50%;" +
        "background:radial-gradient(closest-side,rgb(246 248 252/.95),rgb(246 248 252/.45) 55%,rgb(246 248 252/0));" +
        "pointer-events:none;opacity:0";
      el.style.left = `${land.left - bodyBox.left + land.width * at}px`;
      body.append(el);
      return el;
    });

    const flight = { t: 0 };
    const tl = gsap.timeline({
      onComplete: () => {
        removePuffs();
        gsap.set([flier, body, ...ghosts], { clearProps: "all" });
        gsap.set(figure, { clearProps: "transform" });
        // The take-off frame stays at .3 on the title: the figure has left it.
      },
    });

    // 1 · Take-off: the flier appears ON the mark's solid frame and crouches; the frame dims.
    gsap.set(flier, { transformOrigin: "50% 50%", willChange: "transform" });
    place(0);
    tl.to(flier, { autoAlpha: 1, duration: DUR.tap, ease: "none" }, 0)
      .fromTo(figure, { scaleX: 1, scaleY: 1, transformOrigin: "50% 100%" }, { scaleX: 1.04, scaleY: 0.9, duration: CROUCH, ease: EASE.takeoff }, 0)
      .to(figure, { scaleX: 1, scaleY: 1, duration: DUR.spring, ease: EASE.spring }, CROUCH);
    if (mark) tl.to(mark, { opacity: 0.3, duration: DUR.fast, ease: "none" }, 0);

    // 2 · Flight: one ballistic pass along the path (rise, salto, opening out).
    tl.to(flight, { t: tLand, duration: tLand, ease: "none", onUpdate: () => place(flight.t) }, CROUCH);

    // Ghost frames flash as they are passed — brighter, like a fresh exposure.
    ghosts.forEach((g, i) => {
      tl.to(g, { opacity: Math.min(1, rest[i]! * GHOST_PEAK), duration: DUR.tap, ease: "none" }, CROUCH + tGhost[i]! - DUR.tap / 2);
    });

    // 3 · Stuck landing: figure and button compress together; chalk leaves the feet.
    const touch = CROUCH + tLand;
    tl.fromTo(figure, { ...FIGURE_SQUASH, transformOrigin: "50% 100%" }, { scaleX: 1, scaleY: 1, duration: DUR.land, ease: EASE.land, immediateRender: false }, touch)
      .fromTo(body, { ...BUTTON_SQUASH, transformOrigin: "50% 100%" }, { scaleX: 1, scaleY: 1, duration: BUTTON_SQUASH_DUR, ease: EASE.rebound, immediateRender: false }, touch);
    puffs.forEach((el, i) => {
      tl.fromTo(
        el,
        { opacity: 0.9, scale: 0.35, x: 0, y: 0 },
        { opacity: 0, scale: 1.8, x: CHALK[i]!.dx, y: CHALK[i]!.dy, duration: 0.46, ease: EASE.stick, immediateRender: false },
        touch,
      );
    });

    // 4 · Afterimage: the trail decays to its resting opacity (the static composition).
    ghosts.forEach((g, i) => {
      tl.to(g, { opacity: rest[i]!, duration: DUR.slow, ease: "none" }, touch + 0.05);
    });
  };

  const durationMs = () => 1000 * (CROUCH + 1.0 + BUTTON_SQUASH_DUR);

  let puffs: HTMLElement[] = [];
  const removePuffs = () => {
    puffs.forEach((el) => el.remove());
    puffs = [];
  };

  let stopped = false;
  let dwell = 0;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(dwell);
    io.disconnect();
    reduce.removeEventListener("change", onReduce);
    ctx.revert(); // back to the static composition (kills a running flight too)
    removePuffs();
  };

  const start = () => {
    if (stopped) return;
    if (!motionAllowed()) return stop();
    void queuePrimaryMotion(durationMs()).then(() => {
      if (stopped) return;
      if (!motionAllowed()) return stop();
      ctx.add(play);
    });
  };

  // Play once the button is ≥85% in view for 120 ms: the hand has stopped, and the
  // mark above it is in view on every tested viewport, so the whole flight is seen.
  const io = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1];
      window.clearTimeout(dwell);
      if (!entry?.isIntersecting || entry.intersectionRatio < VISIBLE_RATIO - 0.01) return;
      dwell = window.setTimeout(() => {
        const r = body.getBoundingClientRect();
        const seen = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
        if (seen < r.height * (VISIBLE_RATIO - 0.01)) return; // left again: wait for the next crossing
        io.disconnect();
        start();
      }, DWELL_MS);
    },
    { threshold: [0, VISIBLE_RATIO, 1] },
  );
  io.observe(body);

  const reduce = window.matchMedia(MQ.reduce);
  const onReduce = () => {
    if (reduce.matches) stop();
  };
  reduce.addEventListener("change", onReduce);

  return stop;
}
