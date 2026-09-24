/**
 * S8 beam → sea wave (§4 Camp): one path, MorphSVG, scrubbed by ScrollTrigger.
 * Desktop with a fine pointer only, and never under reduced motion; everywhere else
 * the static wave from the server markup stays. Loaded lazily by CampIsland when
 * the horizon is ≤1 viewport away. mm.revert() restores the static wave.
 */
import { MQ, gsap, loadMorphSVG, loadScrollTrigger, registerMotion } from "@/lib/motion";
import { BEAM_D } from "./horizon";

export async function armBeam(svg: SVGSVGElement): Promise<() => void> {
  registerMotion();
  await Promise.all([loadScrollTrigger(), loadMorphSVG()]);
  const line = svg.querySelector<SVGPathElement>("[data-horizon-line]");
  const legs = svg.querySelector<SVGPathElement>("[data-horizon-legs]");
  if (!line) return () => {};

  const mm = gsap.matchMedia();
  mm.add(`${MQ.desktopFine} and ${MQ.noReduce}`, () => {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: svg, start: "top 92%", end: "top 42%", scrub: 0.5 },
    });
    // from(): the path starts as the beam and lands on its own (wave) shape.
    tl.from(line, { morphSVG: { shape: BEAM_D }, ease: "none", duration: 1 }, 0);
    if (legs) tl.fromTo(legs, { opacity: 1 }, { opacity: 0, ease: "none", duration: 0.32 }, 0);
  });
  return () => mm.revert();
}
