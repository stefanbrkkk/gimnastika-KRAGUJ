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
 */
import { DUR, EASE, MQ, gsap, registerMotion } from "@/lib/motion";

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
  mm.add(MQ.noReduce, () => {
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
    const advance = (to: number) => {
      if (to <= reached) return;
      for (let i = reached + 1; i <= to; i++) items[i]?.setAttribute("data-reached", "");
      reached = to;
      gsap.to(line, { scaleY: target(), duration: DUR.reveal, ease: EASE.stick, overwrite: true });
      if (reached >= nodeEls.length - 1) io?.disconnect();
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
      measure();
      if (gsap.isTweening(line)) {
        gsap.to(line, { scaleY: target(), duration: DUR.base, ease: EASE.stick, overwrite: true });
      } else {
        gsap.set(line, { scaleY: target() });
      }
    });
    ro.observe(root);

    return () => {
      io?.disconnect();
      ro.disconnect();
      root.removeAttribute("data-armed");
      items.forEach((item) => item.removeAttribute("data-reached"));
    };
  });

  return () => mm.revert();
}
