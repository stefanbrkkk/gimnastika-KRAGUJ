/**
 * Final CTA „doskok“ (§4): when the CTA enters, the silhouette hops a short arc
 * through the three chronophotograph frames, leaving each ghost behind as it passes,
 * and lands on the button's top edge; the button squashes scaleY .94 / scaleX 1.03 → 1
 * (ease rebound, .35 s). Loaded lazily by ContactDoskok — never in the first-load JS.
 *
 * Rules kept: transform + opacity only; one tween sequence, no rAF loop of its own;
 * pre-animation hidden state is applied by JS only while the CTA is still off-screen;
 * cleanup reverts every inline style (gsap.context).
 */
import { DUR, EASE, gsap, motionAllowed, registerMotion } from "@/lib/motion";

const SQUASH = { scaleX: 1.03, scaleY: 0.94 } as const;
const SQUASH_DUR = 0.35;
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
  const ghosts = Array.from(root.querySelectorAll<SVGSVGElement>("[data-doskok-ghost]"));
  if (!leap || !body || ghosts.length === 0) return noop;

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
    const ease = gsap.parseEase(EASE.flight);

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set([leap, body, ...ghosts], { clearProps: "transform,opacity,visibility" });
      },
    });
    tl.set(leap, { x: start.x, y: start.y, rotation: -9, autoAlpha: 1, transformOrigin: "50% 100%" }, 0)
      .to(
        leap,
        {
          motionPath: { path: [...via, { x: 0, y: 0 }], curviness: 1.2 },
          rotation: 0,
          duration: DUR.reveal,
          ease: EASE.flight,
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

  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      if (!motionAllowed()) {
        ctx.revert(); // reduced motion switched on meanwhile → back to the static composition
        return;
      }
      ctx.add(play);
    },
    { threshold: 0.5, rootMargin: "0px 0px -8% 0px" },
  );
  io.observe(body);

  return () => {
    io.disconnect();
    ctx.revert();
  };
}
