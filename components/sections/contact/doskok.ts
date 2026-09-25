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
 * ONE primary motion per viewport (§4): the doskok is S11's landing, so it waits
 * for the section title's own chronophotograph landing to finish (HeadingLandings,
 * styles/ui.css) and then goes through the page-wide queuePrimaryMotion().
 * A live switch to reduced motion reverts to the static composition at once.
 */
import { DUR, EASE, MQ, gsap, motionAllowed, queuePrimaryMotion, registerMotion } from "@/lib/motion";

const SQUASH = { scaleX: 1.03, scaleY: 0.94 } as const;
const SQUASH_DUR = 0.35;
/** The doskok's length: the hop, then the squash. */
const DOSKOK_MS = (DUR.reveal + SQUASH_DUR) * 1000;
/** A section title's landing (styles/ui.css .chrono-solid: 0.2 s delay + 0.6 s). */
const HEADING_LAND_MS = 800;
const noop = () => {};

/**
 * How long to wait so the S11 title's landing is over before the doskok starts.
 * Records when the mark lands (HeadingLandings sets data-landed); a mark that is
 * on screen but not landed yet is about to land, so it gets its whole landing.
 */
function trackHeadingLanding(mark: Element | null): { wait: () => number; stop: () => void } {
  if (!mark || !mark.hasAttribute("data-land") || mark.hasAttribute("data-landed")) return { wait: () => 0, stop: noop };
  let landedAt: number | null = null;
  const mo = new MutationObserver(() => {
    if (!mark.hasAttribute("data-landed")) return;
    landedAt = performance.now();
    mo.disconnect();
  });
  mo.observe(mark, { attributes: true, attributeFilter: ["data-landed"] });
  return {
    wait: () => {
      if (landedAt !== null) return Math.max(0, landedAt + HEADING_LAND_MS - performance.now());
      const r = mark.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight ? HEADING_LAND_MS : 0;
    },
    stop: () => mo.disconnect(),
  };
}

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

  const heading = trackHeadingLanding(root.closest("section")?.querySelector(".section-heading .chrono-mark") ?? null);
  let stopped = false;
  let timer = 0;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(timer);
    io.disconnect();
    heading.stop();
    reduce.removeEventListener("change", onReduce);
    ctx.revert(); // back to the static composition (kills a running hop too)
  };

  const start = () => {
    if (stopped) return;
    if (!motionAllowed()) return stop();
    void queuePrimaryMotion(DOSKOK_MS).then(() => {
      if (stopped) return;
      if (!motionAllowed()) return stop();
      heading.stop();
      ctx.add(play);
    });
  };

  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      if (!motionAllowed()) return stop(); // reduced motion switched on meanwhile
      timer = window.setTimeout(start, heading.wait());
    },
    { threshold: 0.5, rootMargin: "0px 0px -8% 0px" },
  );
  io.observe(body);

  const reduce = window.matchMedia(MQ.reduce);
  const onReduce = () => {
    if (reduce.matches) stop();
  };
  reduce.addEventListener("change", onReduce);

  return stop;
}
