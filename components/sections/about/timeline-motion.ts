/**
 * „Hronologija“ line (§5 S5): a GSAP vertical line (scaleY, transform-origin top)
 * that advances frame by frame — like a chronophotograph — to each year's node as
 * the node crosses 65 % of the viewport. A ResizeObserver keeps the stops in sync
 * with the list's real layout (fonts, wrapping, viewport width).
 * Loaded lazily by TimelineMotion — never in the first-load JS.
 *
 * Rules kept: transform only (scaleY) + a CSS transform pop on the node dots;
 * no scroll listener and no rAF loop of its own (IntersectionObserver-driven);
 * years the reader has already passed are shown reached without animation;
 * gsap.matchMedia reverts to the static full line if reduced motion is switched on.
 *
 * The line is S5's primary motion: a new leg goes through queuePrimaryMotion(), so it
 * waits for another section's primary motion still playing (and S6's portraits wait for
 * it). A leg that starts while the line is already travelling just retargets it. The
 * node dots are marked reached when their leg starts, so dot and line stay in step.
 */
import { DUR, EASE, MQ, gsap, queuePrimaryMotion, registerMotion } from "@/lib/motion";

/** Viewport fraction a node must cross (from below) to count as reached. */
const TRIGGER = 0.65;
const noop = () => {};
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function armTimeline(root: HTMLElement): () => void {
  registerMotion();
  const line = root.querySelector<HTMLElement>("[data-timeline-line]");
  const items = Array.from(root.querySelectorAll<HTMLElement>("[data-timeline-item]"));
  const nodes = items.map((item) => item.querySelector<HTMLElement>("[data-timeline-node]"));
  if (!line || items.length === 0 || nodes.some((n) => !n)) return noop;
  const nodeEls = nodes as HTMLElement[];

  const mm = gsap.matchMedia();
  mm.add(MQ.noReduce, (context) => {
    let live = true;
    /** scaleY stop for each node: its centre along the line (the last node = full line). */
    let stops: number[] = [];
    const measure = () => {
      const rootTop = root.getBoundingClientRect().top;
      // offsetTop/offsetHeight ignore the line's own scaleY transform.
      const top = line.offsetTop;
      const height = line.offsetHeight || 1;
      stops = nodeEls.map((node, i) => {
        if (i === nodeEls.length - 1) return 1;
        const r = node.getBoundingClientRect();
        return clamp01((r.top + r.height / 2 - rootTop - top) / height);
      });
    };
    measure();

    // Years already above the trigger line (deep link, restored scroll) count as reached.
    let reached = -1;
    const triggerY = window.innerHeight * TRIGGER;
    nodeEls.forEach((node, i) => {
      if (node.getBoundingClientRect().top < triggerY) reached = i;
    });
    const target = () => (reached < 0 ? 0 : (stops[reached] ?? 1));

    gsap.set(line, { scaleY: target(), transformOrigin: "50% 0%" });
    items.forEach((item, i) => item.toggleAttribute("data-reached", i <= reached));
    root.setAttribute("data-armed", "");

    let io: IntersectionObserver | undefined;
    /** Furthest node the reader has passed; `reached` follows it when the leg starts. */
    let wanted = reached;
    let queued = false;
    const move = () => {
      if (!live || wanted <= reached) return;
      for (let i = reached + 1; i <= wanted; i++) items[i]?.setAttribute("data-reached", "");
      reached = wanted;
      context.add(() => gsap.to(line, { scaleY: target(), duration: DUR.reveal, ease: EASE.stick, overwrite: true }));
    };
    const advance = (to: number) => {
      if (to <= wanted) return;
      wanted = to;
      if (wanted >= nodeEls.length - 1) io?.disconnect();
      if (gsap.isTweening(line)) {
        move(); // already travelling: the same motion goes on to the new stop
        return;
      }
      if (queued) return;
      queued = true;
      void queuePrimaryMotion(DUR.reveal * 1000).then(() => {
        queued = false;
        move();
      });
    };

    if (reached < nodeEls.length - 1) {
      io = new IntersectionObserver(
        (entries) => {
          let max = reached;
          for (const e of entries) {
            // Entered the upper 65 % of the viewport, or already scrolled past it.
            if (e.isIntersecting || e.boundingClientRect.bottom < 0) {
              max = Math.max(max, nodeEls.indexOf(e.target as HTMLElement));
            }
          }
          advance(max);
        },
        { rootMargin: `0px 0px -${Math.round((1 - TRIGGER) * 100)}% 0px` },
      );
      nodeEls.forEach((node) => io?.observe(node));
    }

    // Keep the stops in sync with the real layout (fonts, wrapping, width changes).
    const ro = new ResizeObserver(() => {
      if (!live) return;
      measure();
      context.add(() => {
        if (gsap.isTweening(line)) {
          gsap.to(line, { scaleY: target(), duration: DUR.base, ease: EASE.stick, overwrite: true });
        } else {
          gsap.set(line, { scaleY: target() });
        }
      });
    });
    ro.observe(root);

    return () => {
      live = false;
      io?.disconnect();
      ro.disconnect();
      root.removeAttribute("data-armed");
      items.forEach((item) => item.removeAttribute("data-reached"));
    };
  });

  return () => mm.revert();
}
