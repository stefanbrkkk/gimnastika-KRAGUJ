/**
 * S10 „Jedna zvezda, tri koraka“ — the cartwheel band's timeline (plan §5.9). A LAZY chunk
 * (imported only by LeapBandPlayer), so it may load gsap (the shared motion chunk). It imports
 * nothing from leap-band.ts: the pose paths stay out of this chunk; the markup carries what the
 * motion needs (data-origin: the salute's feet on the mat).
 *
 * Static poses cannot morph into each other, so there is no travelling flier: the movement is
 * told the way Tokyo's kinetic pictograms tell it. The three cartwheel phases develop left to
 * right as short fragments — each fades up to its ghost opacity while it slides a few units
 * along the travel (--ease-flight), 90 ms apart — and each lights the mat tick under its
 * support. The salute lands last: it drops onto its feet and sticks the landing (squash
 * 1.05 / .9 → 1 about the feet, EASE.land, compress and hold). Then the step numerals darken
 * 1 → 2 → 3 and the twelve month lamps light up like a scoreboard (LED steps).
 * transform / opacity only; one timeline; ≈1s.
 */
import { loadMotion } from "@/lib/load-motion";
import { DUR, queuePrimaryMotion } from "@/lib/motion-env";

/** Seconds between the phase fragments. */
const STAGGER = 0.09;
/** Band units each fragment slides along the travel (left → right). */
const TRAVEL = 14;
/** Band units the salute drops onto its feet before it sticks. */
const DROP = 8;
/** The phases develop from 0; the salute touches down as the third phase settles. */
const LAND = 2 * STAGGER + DUR.base;
/** The numerals darken, then the lamps post (12 × 25 ms steps). */
const LAMPS_AT = LAND + 0.1;
/** Length of the whole timeline (the lamps are the last to settle). */
const LEAP_MS = Math.round((LAMPS_AT + 11 * 0.025 + DUR.fast) * 1000);
/** The phases' ghost opacities if the tokens cannot be read (styles/ui.css, light theme). */
const GHOST_O = [0.2, 0.3, 0.42] as const;
/**
 * The band must stay in view this long before it takes its turn (GE3-02): a filter that
 * shortens the gallery sheet can drop the band into view in the middle of its own Flip, and a
 * layout jump is not an arrival. The band is decoration; the step texts are visible throughout.
 */
const DWELL_MS = 350;

/**
 * Watches the armed band (LeapBandPlayer). Once it has stayed well inside the viewport for
 * DWELL_MS, the sequence takes the page-wide primary-motion slot (≤250ms wait) and plays — it
 * does not wait for the section title's mark to land: the mark is an accent and may overlap,
 * while the band would sit empty (design review v2, MD2-07). A failsafe lands the final state if
 * anything stalls. Returns the cleanup.
 */
export function armLeap(root: HTMLElement): () => void {
  let live = true;
  let failsafe = 0;
  let dwell = 0;
  const finish = () => root.setAttribute("data-leap", "done");

  const bands = Array.from(root.querySelectorAll<SVGSVGElement>(".en-band"));
  const inView = new Set<Element>();
  const go = () => {
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
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) inView.add(e.target);
        else inView.delete(e.target);
      }
      // Arrival = in view for DWELL_MS; leaving earlier starts the count again.
      if (inView.size && !dwell) dwell = window.setTimeout(go, DWELL_MS);
      else if (!inView.size && dwell) {
        window.clearTimeout(dwell);
        dwell = 0;
      }
    },
    { rootMargin: "0px 0px -25% 0px", threshold: 0.5 },
  );
  bands.forEach((svg) => io.observe(svg));

  return () => {
    live = false;
    io.disconnect();
    window.clearTimeout(dwell);
    window.clearTimeout(failsafe);
  };
}

async function playLeap(root: HTMLElement, svg: SVGSVGElement | undefined): Promise<void> {
  const done = () => root.setAttribute("data-leap", "done");
  if (!svg) return done();
  const { gsap, EASE } = await loadMotion();
  if (root.getAttribute("data-leap") === "done") return; // the failsafe landed it meanwhile
  const frame = (id: string) => svg.querySelector<SVGGElement>(`.en-band__frame[data-frame="${id}"]`);
  const phases = ["cart1", "cart2", "cart3"].map(frame);
  const salute = frame("salute");
  const origin = salute?.dataset.origin;
  if (phases.some((p) => !p) || !salute || !origin) return done();
  const ghosts = phases as SVGGElement[];
  const tick = (step: number) => svg.querySelectorAll(`.en-band__tick[data-step="${step}"]`);
  // Step numerals 1 → 2 → 3: the list's, and on the narrow band the plate's own numbers.
  const nums = [1, 2, 3].map((n) => [
    ...Array.from(root.querySelectorAll(`.en-step[data-step="${n}"] .en-step__num`)),
    ...Array.from(svg.querySelectorAll(`.en-band__num[data-step="${n}"]`)),
  ]);
  const lamps = root.querySelectorAll(".en-month__lamp");
  // Each phase settles at its ghost token (--ghost-1/2/3-o, inherited from the section theme).
  const ghostOpacity = (i: number) =>
    parseFloat(getComputedStyle(ghosts[i]!).getPropertyValue(`--ghost-${i + 1}-o`)) || GHOST_O[i]!;
  const targets = ghosts.map((_, i) => ghostOpacity(i));
  const touched = [...ghosts, salute, ...tick(1), ...tick(2), ...tick(3), ...nums.flat(), ...Array.from(lamps)];

  root.setAttribute("data-leap", "play");
  await new Promise<void>((resolve) => {
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(touched, { clearProps: "opacity,transform" });
        done();
        resolve();
      },
    });
    // The phases: short fragments, left to right, each lighting the tick under its support.
    ghosts.forEach((g, i) => {
      const at = i * STAGGER;
      tl.fromTo(g, { opacity: 0, x: -TRAVEL }, { opacity: targets[i], x: 0, duration: DUR.base, ease: EASE.flight }, at);
      if (i < 2) tl.to(tick(i + 1), { opacity: 1, duration: DUR.fast, ease: "none" }, at);
    });
    // The salute drops onto its feet and sticks: compress about the feet, then hold.
    tl.fromTo(salute, { opacity: 0, y: -DROP }, { opacity: 1, y: 0, duration: DUR.tap, ease: EASE.takeoff }, LAND - DUR.tap)
      .fromTo(
        salute,
        { scaleX: 1.05, scaleY: 0.9, svgOrigin: origin },
        { scaleX: 1, scaleY: 1, duration: DUR.land, ease: EASE.land, immediateRender: false },
        LAND,
      )
      .to(tick(3), { opacity: 1, duration: DUR.fast, ease: "none" }, LAND);
    // The numerals darken 1 → 2 → 3 once the routine is stuck.
    nums.forEach((els, n) => tl.to(els, { opacity: 1, duration: DUR.fast, ease: "none" }, LAND + 0.04 + n * 0.06));
    tl
      // The score: twelve month lamps post one after another (LED steps).
      .to(lamps, { opacity: 1, duration: DUR.fast, ease: EASE.score, stagger: 0.025 }, LAMPS_AT)
      .to(lamps, { scale: 1, duration: DUR.fast, ease: EASE.stick, stagger: 0.025 }, LAMPS_AT);
  });
}
