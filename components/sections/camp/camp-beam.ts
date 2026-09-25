/**
 * S8 beam → sea wave (§4 Camp): one path, MorphSVG, scrubbed by ScrollTrigger.
 * Desktop with a fine pointer only, and never under reduced motion; everywhere else
 * the static wave from the server markup stays. Loaded lazily by CampIsland when
 * the horizon is ≤1 viewport away. mm.revert() restores the static wave.
 *
 * In-view guard: creating the scrub renders the shape for the current scroll position
 * (and a from() renders the beam first). If the horizon is already on screen (a late
 * chunk, a restored scroll), that would snap the visible wave to a half-beam with no
 * scroll input, so the scrub is only created once the horizon is off screen.
 */
import { MQ, gsap, loadMorphSVG, loadScrollTrigger, registerMotion } from "@/lib/motion";
import { BEAM_D } from "./horizon";

const onScreen = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

export async function armBeam(svg: SVGSVGElement): Promise<() => void> {
  registerMotion();
  await Promise.all([loadScrollTrigger(), loadMorphSVG()]);
  const line = svg.querySelector<SVGPathElement>("[data-horizon-line]");
  const legs = svg.querySelector<SVGPathElement>("[data-horizon-legs]");
  if (!line) return () => {};

  const mm = gsap.matchMedia();
  mm.add(`${MQ.desktopFine} and ${MQ.noReduce}`, (context) => {
    const create = () =>
      context.add(() => {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: svg, start: "top 92%", end: "top 42%", scrub: 0.5 },
        });
        // from(): the path starts as the beam and lands on its own (wave) shape.
        tl.from(line, { morphSVG: { shape: BEAM_D }, ease: "none", duration: 1 }, 0);
        if (legs) tl.fromTo(legs, { opacity: 1 }, { opacity: 0, ease: "none", duration: 0.32 }, 0);
      });

    if (!onScreen(svg)) {
      create();
      return;
    }
    // On screen: keep the static wave until the horizon has left the viewport.
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      create();
    });
    io.observe(svg);
    return () => io.disconnect();
  });
  return () => mm.revert();
}
