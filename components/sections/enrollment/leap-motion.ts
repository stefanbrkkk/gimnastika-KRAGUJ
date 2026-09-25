/**
 * S10 „Jedan skok, tri kadra“ — the leap timeline. A LAZY chunk (imported only
 * by LeapBandPlayer), so it may load gsap (the shared motion chunk).
 *
 * The solid silhouette takes off from frame 1, flies the dotted parabola on the
 * „hang“ ease (it floats at the apex), pitching from takeoff through a level
 * split to the landing, and exposes its own trajectory as it goes. It drops the
 * ghost frames as it passes (takeoff at once, apex at half time), then sticks
 * the landing on step 3: the solid frame compresses and holds on the front foot
 * (--ease-land). Each step numeral and mat tick lights with its frame. After
 * touchdown the twelve month lamps light up like a scoreboard (LED steps).
 * transform / opacity only (the trajectory is exposed by a clip rect's scaleX);
 * one timeline; ≈1.46s.
 */
import { loadMotion } from "@/lib/load-motion";
import { queuePrimaryMotion } from "@/lib/motion-env";
import { buildBand, FRAME_OPACITY, frameTransform, NARROW, pitchAt, pointAt, WIDE } from "./leap-band";

const FLIGHT = 0.9;
/** Length of the whole timeline: flight + landing + the twelve month lamps. */
const LEAP_MS = 1460;

/**
 * Watches the armed band (LeapBandPlayer). As soon as it is well inside the
 * viewport, the leap takes the page-wide primary-motion slot (≤250ms wait) and
 * plays — it no longer waits for the section title's mark to land: the mark is an
 * accent and may overlap, while the band would sit empty (design review v2, MD2-07).
 * A failsafe lands the final state if anything stalls. Returns the cleanup.
 */
export function armLeap(root: HTMLElement): () => void {
  let live = true;
  let failsafe = 0;
  const finish = () => root.setAttribute("data-leap", "done");

  const bands = Array.from(root.querySelectorAll<SVGSVGElement>(".en-band"));
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      failsafe = window.setTimeout(finish, LEAP_MS + 3000); // never stuck hidden
      void queuePrimaryMotion(LEAP_MS)
        .then(() => {
          // Unmounted, or the failsafe already landed the final state: never hide it again.
          if (!live || root.getAttribute("data-leap") === "done") return;
          return playLeap(
            root,
            bands.find((svg) => svg.getBoundingClientRect().width > 0),
          );
        })
        .catch(finish);
    },
    { rootMargin: "0px 0px -25% 0px", threshold: 0.5 },
  );
  bands.forEach((svg) => io.observe(svg));

  return () => {
    live = false;
    io.disconnect();
    window.clearTimeout(failsafe);
  };
}

async function playLeap(root: HTMLElement, svg: SVGSVGElement | undefined): Promise<void> {
  const done = () => root.setAttribute("data-leap", "done");
  if (!svg) return done();
  const { gsap, DUR, EASE } = await loadMotion();
  if (root.getAttribute("data-leap") === "done") return; // the failsafe landed it meanwhile
  const band = buildBand(svg.dataset.variant === "narrow" ? NARROW : WIDE);
  const $ = <T extends Element>(sel: string) => svg.querySelector<T>(sel);
  const flier = $<SVGGElement>(".en-band__flier");
  const reveal = $<SVGRectElement>(".en-band__reveal");
  const path = $<SVGPathElement>(".en-band__path");
  const land = $<SVGGElement>(".en-band__land");
  if (!flier || !reveal || !path || !land) return done();
  const frame = (kind: string) => svg.querySelectorAll(`.en-band__frame[data-frame="${kind}"]`);
  const tick = (kind: string) => svg.querySelectorAll(`.en-band__tick[data-frame="${kind}"]`);
  // The step numeral and (narrow band) the frame number that belong to a frame.
  const nums = (kind: string) => [
    ...Array.from(root.querySelectorAll(`.en-step[data-frame="${kind}"] .en-step__num`)),
    ...Array.from(svg.querySelectorAll(`.en-band__num[data-frame="${kind}"]`)),
  ];
  const lamps = root.querySelectorAll(".en-month__lamp");

  const { s } = band.spec;
  const rx = band.p0.x - 6;
  const span = band.p2.x - band.p0.x + 12;
  const proxy = { t: 0 };
  const place = () => {
    const p = pointAt(band, proxy.t);
    flier.setAttribute("transform", frameTransform(p, pitchAt(proxy.t), s));
    const k = Math.min(1, Math.max(0.001, (p.x - rx) / span));
    reveal.setAttribute("transform", `translate(${rx} 0) scale(${k} 1) translate(${-rx} 0)`);
  };

  root.setAttribute("data-leap", "play");
  place();
  const touched = [flier, path, ...frame("takeoff"), ...frame("apex"), ...frame("landing"), ...tick("takeoff"), ...tick("apex"), ...tick("landing"), ...nums("takeoff"), ...nums("apex"), ...nums("landing"), ...Array.from(lamps)];

  await new Promise<void>((resolve) => {
    const light = (kind: string, at: number) =>
      tl
        .to(nums(kind), { opacity: 1, duration: DUR.fast, ease: "none" }, at)
        .to(tick(kind), { opacity: 1, duration: DUR.fast, ease: "none" }, at);
    const tl = gsap.timeline({
      onComplete: () => {
        reveal.removeAttribute("transform");
        gsap.set(touched, { clearProps: "opacity,transform" });
        gsap.set(land, { clearProps: "transform" });
        done();
        resolve();
      },
    });
    tl.set([flier, path], { opacity: 1 }, 0)
      .to(proxy, { t: 1, duration: FLIGHT, ease: EASE.hang, onUpdate: place }, 0)
      // Takeoff: the ghost stays behind as the flier leaves it.
      .to(frame("takeoff"), { opacity: FRAME_OPACITY.takeoff, duration: DUR.fast, ease: "none" }, 0)
      // Apex: dropped as the flier hangs over it.
      .to(frame("apex"), { opacity: FRAME_OPACITY.apex, duration: DUR.fast, ease: "none" }, FLIGHT / 2)
      // Touchdown: the solid frame replaces the flier and sticks — compress, then hold.
      .set(flier, { opacity: 0 }, FLIGHT)
      .set(frame("landing"), { opacity: 1 }, FLIGHT)
      .fromTo(
        land,
        { scaleX: 1.03, scaleY: 0.94, svgOrigin: `${band.landing.x} ${band.landing.y}` },
        { scaleX: 1, scaleY: 1, duration: DUR.land, ease: EASE.land },
        FLIGHT,
      )
      // The score: twelve month lamps post one after another (LED steps).
      .to(lamps, { opacity: 1, duration: DUR.fast, ease: EASE.score, stagger: 0.025 }, FLIGHT + 0.1)
      .to(lamps, { scale: 1, duration: DUR.fast, ease: EASE.stick, stagger: 0.025 }, FLIGHT + 0.1);
    light("takeoff", 0);
    light("apex", FLIGHT / 2);
    light("landing", FLIGHT);
  });
}
