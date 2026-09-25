/**
 * S9 filter motion — a LAZY chunk (imported by GalleryBrowser on the first chip
 * tap, prefetched when the sheet is near), so gsap may be imported here.
 *
 * The strips re-flow under Flip (≤280ms, stick): prints glide and scale (a
 * transform, never width/height). Leavers dismount — a small drop (takeoff ease)
 * while they fade (linear), so a leaving print is already half gone while the
 * others glide past it. Newcomers are hung on the line: a pendulum swing from a
 * peg above the print (±3°, alternating, uneven-bars swing ease), a short drop
 * onto the line and a quick fade in (stagger .06, ≤5 prints).
 */
import { DUR, EASE, gsap, loadFlip, registerMotion, STAGGER } from "@/lib/motion";

export interface FlipHandle {
  progress: (value: number) => unknown;
  kill: () => unknown;
}

interface FilterFlip {
  items: HTMLElement[];
  shows: (el: HTMLElement) => boolean;
  /** Switches the grid's view (data-filter) — the strips re-flow from here. */
  setView: () => void;
  /** False once a newer filter has started while Flip was loading. */
  isCurrent: () => boolean;
  /** The previous filter's Flip, landed first (its leavers get `hidden`). */
  previous: FlipHandle | null;
}

/** Everything gsap wrote inline (Flip's absolute/size/transform, the individual-transform
 *  resets), but never the print's own --ar (its share of the strip). */
function reset(els: HTMLElement[]): void {
  if (!els.length) return; // an empty target list would warn
  const ars = els.map((el) => el.style.getPropertyValue("--ar"));
  gsap.set(els, { clearProps: "all" });
  els.forEach((el, i) => ars[i] && el.style.setProperty("--ar", ars[i]));
}

/**
 * Resolves as soon as the Flip has started, with its handle wrapped in an object: a gsap
 * timeline is a thenable, so returning it bare would make the promise wait for its end.
 */
export async function flipFilter({ items, shows, setView, isCurrent, previous }: FilterFlip): Promise<{ flip: FlipHandle } | null> {
  registerMotion();
  const Flip = await loadFlip();
  if (!isCurrent()) return null;
  previous?.progress(1);
  const before = items.filter((el) => !el.hidden);
  const state = Flip.getState(before);
  // Leaving prints fade out where they stood. They are marked with data-leaving (display:none
  // in CSS, which Flip's inline display can override) instead of `hidden`: Tailwind's
  // [hidden]{display:none!important} would cut them on the first frame. `hidden` follows on complete.
  const leaving = before.filter((el) => !shows(el));
  const staying = before.filter(shows);
  for (const el of leaving) el.setAttribute("data-leaving", "");
  setView();
  for (const el of items) if (shows(el)) el.hidden = false;
  const done = () => {
    for (const el of leaving) {
      el.hidden = true;
      el.removeAttribute("data-leaving");
    }
    reset(leaving);
    reset(staying);
  };
  const drop = window.matchMedia("(min-width: 640px)").matches ? 10 : 8;
  const flip = Flip.from(state, {
    targets: [...items.filter(shows), ...leaving],
    duration: DUR.base,
    ease: EASE.stick,
    scale: true,
    absoluteOnLeave: true,
    // Not returned to Flip: the swing outlasts the glide, and Flip must not re-apply its start
    // state when its own (shorter) timeline completes.
    // The print swings (its child: the strip's rule on the item stays level); the item fades.
    onEnter: (els) => {
      const list = els as HTMLElement[];
      const prints = list.map((el) => el.firstElementChild).filter((el): el is HTMLElement => el instanceof HTMLElement);
      gsap
        .timeline({
          onComplete: () => {
            reset(list);
            gsap.set(prints, { clearProps: "transform,transformOrigin,translate,rotate,scale" });
          },
        })
        .fromTo(
          prints,
          { rotation: (i: number) => (i % 2 ? 3 : -3), transformOrigin: "50% -8px" },
          { rotation: 0, duration: 0.6, ease: EASE.swing, stagger: STAGGER.cards },
          0,
        )
        .fromTo(prints, { y: -drop }, { y: 0, duration: 0.4, ease: EASE.stick, stagger: STAGGER.cards }, 0)
        .fromTo(list, { opacity: 0 }, { opacity: 1, duration: 0.16, ease: "none", stagger: STAGGER.cards }, 0);
    },
    onLeave: (els) =>
      gsap
        .timeline()
        .to(els, { opacity: 0, duration: DUR.fast, ease: "none" }, 0)
        .to(els, { y: drop, duration: DUR.fast, ease: EASE.takeoff }, 0),
    onComplete: done,
    onInterrupt: done,
  });
  return { flip };
}
