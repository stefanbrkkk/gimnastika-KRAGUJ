/**
 * S5 club print (photo 03) — a multi-exposure landing (design review MI-AC-5). The print
 * arrives along the floor diagonal (from the upper left) with two paper ghost frames
 * trailing it; the ghosts collapse into the print like merging exposures and the print
 * sticks the landing (EASE.land: compress and hold). Loaded lazily by AboutMotion.
 *
 * Rules: transform + opacity only (the frame's shadow stays static); the pre-state is set by
 * JS only when the print is still off-screen at arm time; the reveal is content, so it goes
 * through queuePrimaryMotion() (≤250 ms wait) and a safety net shows it statically if it is
 * ≥50 % in view for 300 ms without having started. gsap.matchMedia reverts everything when
 * reduced motion is switched on.
 */
import { DUR, EASE, MQ, STAGGER, gsap, queuePrimaryMotion, registerMotion } from "@/lib/motion";

/** Offsets on the floor diagonal (px, desktop): ghost 1, ghost 2, print. Halved on phones. */
const GHOST_FAR = 36;
const GHOST_NEAR = 18;
const PRINT_FROM = 12;
/** Starting opacity of the two paper ghosts (outlined in --ghost-1 / --ghost-2, about.css). */
const GHOST_FAR_O = 0.35;
const GHOST_NEAR_O = 0.55;
const SAFETY_MS = 300;
const noop = () => {};

const inView = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
};

export function armPrint(print: HTMLElement): () => void {
  registerMotion();
  const frame = print.querySelector<HTMLElement>(".frame");
  const ghosts = Array.from(print.querySelectorAll<HTMLElement>("[data-print-ghost]"));
  if (!frame || ghosts.length < 2) return noop;

  const mm = gsap.matchMedia();
  mm.add(MQ.noReduce, (context) => {
    if (inView(print)) return; // already on screen (deep link, restored scroll): keep it static
    let state: "pending" | "playing" | "done" = "pending";
    const k = window.matchMedia("(min-width: 640px)").matches ? 1 : 0.5;

    gsap.set(frame, { x: -PRINT_FROM * k, y: -PRINT_FROM * k, autoAlpha: 0 });

    const reveal = () => {
      if (state !== "pending") return;
      state = "playing";
      context.add(() => {
        gsap
          .timeline({
            onComplete: () => {
              state = "done";
              gsap.set(frame, { clearProps: "transform,opacity,visibility" });
              gsap.set(ghosts, { clearProps: "transform,opacity,visibility" });
            },
          })
          // The trailing exposures catch up with the print and merge into it: they travel on the
          // flight ease and fade late, so they are still visible as they close in.
          .fromTo(
            ghosts,
            { x: (i: number) => -(i === 0 ? GHOST_FAR : GHOST_NEAR) * k, y: (i: number) => -(i === 0 ? GHOST_FAR : GHOST_NEAR) * k },
            { x: 0, y: 0, duration: DUR.reveal, ease: EASE.flight, stagger: STAGGER.cards },
            0,
          )
          .fromTo(
            ghosts,
            { autoAlpha: (i: number) => (i === 0 ? GHOST_FAR_O : GHOST_NEAR_O) },
            { autoAlpha: 0, duration: DUR.reveal, ease: "power2.in", stagger: STAGGER.cards },
            0,
          )
          .to(frame, { x: 0, y: 0, autoAlpha: 1, duration: DUR.reveal, ease: EASE.land }, 0);
      });
    };
    const showStatic = () => {
      if (state !== "pending") return;
      state = "done";
      gsap.set(frame, { clearProps: "transform,opacity,visibility" });
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void queuePrimaryMotion((DUR.reveal + STAGGER.cards) * 1000).then(reveal);
      },
      { threshold: 0.3 },
    );
    io.observe(print);

    // Safety net: never leave the print hidden in view.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const safety = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (timer) clearTimeout(timer);
        timer = visible ? setTimeout(showStatic, SAFETY_MS) : undefined;
      },
      { threshold: 0.5 },
    );
    safety.observe(print);

    return () => {
      io.disconnect();
      safety.disconnect();
      if (timer) clearTimeout(timer);
    };
  });

  return () => mm.revert();
}
