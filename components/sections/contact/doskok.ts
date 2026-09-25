/**
 * Final CTA „doskok“ (§4): when the CTA enters, the silhouette hops a short arc
 * through the three chronophotograph frames, leaving each ghost behind as it passes,
 * and lands on the button's top edge; the button squashes scaleY .94 / scaleX 1.03 → 1
 * (ease rebound, .35 s). Loaded lazily by ContactDoskok — never in the first-load JS.
 *
 * Rules kept: transform + opacity only; one tween sequence, no rAF loop of its own;
 * pre-animation hidden state is applied by JS only while the CTA is still off-screen;
 * cleanup reverts every inline style (gsap.context).
 *
 * ONE primary motion per viewport (§4): the doskok is S11's ONE landing. The S11
 * title mark is static (SectionHeading land={false}, D-S11-9 rev), so the hop starts
 * as soon as half of the hop band or of the button is in view, through the page-wide
 * queuePrimaryMotion() — no title landing to wait for, no empty band at rest.
 * The flier fades in at the takeoff frame and flies on „hang“ (hold at the apex,
 * then a fast drop into the squash), like the hero's leap.
 * A live switch to reduced motion reverts to the static composition at once.
 */
import { DUR, EASE, MQ, gsap, motionAllowed, queuePrimaryMotion, registerMotion } from "@/lib/motion";

const SQUASH = { scaleX: 1.03, scaleY: 0.94 } as const;
const SQUASH_DUR = 0.35;
/** The doskok's length: the hop, then the squash. */
const DOSKOK_MS = (DUR.reveal + SQUASH_DUR) * 1000;
const noop = () => {};

/** Time (0–1) at which an eased tween reaches `progress` — for dropping ghosts as the leap passes them. */
function timeAt(ease: (t: number) => number, progress: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < progress) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function armDoskok(root: HTMLElement): () => void {
  registerMotion();
  const leap = root.querySelector<SVGSVGElement>("[data-doskok-leap]");
  const body = root.querySelector<HTMLElement>("[data-doskok-body]");
  const arc = root.querySelector<HTMLElement>("[data-doskok-arc]");
  const ghosts = Array.from(root.querySelectorAll<SVGSVGElement>("[data-doskok-ghost]"));
  if (!leap || !body || !arc || ghosts.length === 0) return noop;

  // Already on screen (deep link to #kontakt, restored scroll): keep the static final state — no flash.
  const box = root.getBoundingClientRect();
  if (box.bottom > 0 && box.top < window.innerHeight) return noop;

  const ctx = gsap.context(() => {
    gsap.set(ghosts, { opacity: 0 });
    gsap.set(leap, { autoAlpha: 0 });
  });

  const play = () => {
    // Landed position = the silhouette's own layout box (no transform applied yet).
    const land = leap.getBoundingClientRect();
    const points = ghosts.map((g) => {
      const r = g.getBoundingClientRect();
      return { x: r.left - land.left, y: r.bottom - land.bottom };
    });
    const [start, ...via] = points;
    if (!start) return;
    const ease = gsap.parseEase(EASE.hang);

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set([leap, body, ...ghosts], { clearProps: "transform,opacity,visibility" });
      },
    });
    // Takeoff: the flier fades in on the first ghost frame (DUR.tap) while the hop starts.
    tl.set(leap, { x: start.x, y: start.y, rotation: -9, autoAlpha: 0, transformOrigin: "50% 100%" }, 0)
      .to(leap, { autoAlpha: 1, duration: DUR.tap, ease: "none" }, 0)
      .to(
        leap,
        {
          motionPath: { path: [...via, { x: 0, y: 0 }], curviness: 1.2 },
          rotation: 0,
          duration: DUR.reveal,
          ease: EASE.hang,
        },
        0,
      )
      .fromTo(
        body,
        { ...SQUASH, transformOrigin: "50% 100%" },
        { scaleX: 1, scaleY: 1, duration: SQUASH_DUR, ease: EASE.rebound, immediateRender: false },
        DUR.reveal,
      );
    ghosts.forEach((g, i) => {
      const target = Number(g.dataset.doskokGhost) || 0.25;
      tl.to(g, { opacity: target, duration: DUR.fast, ease: "none" }, DUR.reveal * timeAt(ease, i / ghosts.length));
    });
  };

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    io.disconnect();
    reduce.removeEventListener("change", onReduce);
    ctx.revert(); // back to the static composition (kills a running hop too)
  };

  const start = () => {
    if (stopped) return;
    if (!motionAllowed()) return stop();
    void queuePrimaryMotion(DOSKOK_MS).then(() => {
      if (stopped) return;
      if (!motionAllowed()) return stop();
      ctx.add(play);
    });
  };

  // Play once half of the hop band OR half of the button is in view. Keyed on the band
  // too, so the pre-state never rests as an empty band above a visible button — e.g.
  // after the header „Kontakt“ jump on a 1280–1440 laptop, where the display title
  // leaves the button at the fold. (Scrolling up from below, the button comes first.)
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.49)) return;
      io.disconnect();
      if (!motionAllowed()) return stop(); // reduced motion switched on meanwhile
      start();
    },
    { threshold: 0.5 },
  );
  io.observe(arc);
  io.observe(body);

  const reduce = window.matchMedia(MQ.reduce);
  const onReduce = () => {
    if (reduce.matches) stop();
  };
  reduce.addEventListener("change", onReduce);

  return stop;
}
