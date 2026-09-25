/**
 * Motion environment — NO gsap import here, safe for any client island.
 *
 * Bundle rule (first-load JS ≤160KB gz, React+Next alone ≈130KB): never import
 * "gsap", "@gsap/react" or "@/lib/motion" statically from a component in the
 * initial bundle. Load motion code with next/dynamic(..., { ssr: false }) or
 * `await loadMotion()` (lib/load-motion.ts) after hydration.
 */
export const MQ = {
  /** Pin/scrub/desktop-only choreography. */
  desktopFine: "(min-width: 1024px) and (pointer: fine)",
  reduce: "(prefers-reduced-motion: reduce)",
  noReduce: "(prefers-reduced-motion: no-preference)",
} as const;

/** Seconds. tap 100 · fast 180 · base 280 · reveal 600 · slow 900. Hero intro ≤1.9s total. */
export const DUR = {
  tap: 0.1,
  fast: 0.18,
  base: 0.28,
  reveal: 0.6,
  slow: 0.9,
  /** Gymnastics vocabulary (design review v2): stick landing, vault spring, beam wobble, bars swing. */
  land: 0.26,
  spring: 0.42,
  wobble: 0.7,
  swing: 0.85,
} as const;
/** Stagger seconds; a sequence's total stagger must stay ≤ .36s (hero ghosts excepted). */
export const STAGGER = { words: 0.04, lines: 0.08, cards: 0.06, maxTotal: 0.36 } as const;
/** Reveal y-offset in px. Prefer clip-path reveals. */
export const OFFSET = { mobile: 16, desktop: 24 } as const;

/** Named GSAP eases (registered by registerMotion), identical to the CSS --ease-* tokens. */
export const EASE = {
  stick: "stick",
  takeoff: "takeoff",
  flight: "flight",
  rebound: "rebound",
  hang: "hang",
  /** Stuck landing: compress and hold (≤3% overshoot). Use for landings instead of rebound. */
  land: "land",
  /** Vault board / springboard. */
  spring: "back.out(2.2)",
  /** Beam balance: wobble and settle. */
  wobble: "elastic.out(1.1, 0.38)",
  /** Uneven-bars pendulum. */
  swing: "elastic.out(1, 0.55)",
  /** Score posting on a 7-row dot-matrix board. */
  score: "steps(7)",
} as const;

/**
 * True when decorative motion is allowed: html.js-motion is set by the inline
 * <head> script (no reduced motion, no Save-Data) and reduced motion is re-checked live.
 */
export function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  return document.documentElement.classList.contains("js-motion") && !window.matchMedia(MQ.reduce).matches;
}

/** Reduced motion OR Save-Data (decorative effects off). */
export function prefersLessMotion(): boolean {
  if (typeof window === "undefined") return true;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return window.matchMedia(MQ.reduce).matches || Boolean(conn?.saveData);
}

export const isDesktopFine = (): boolean => typeof window !== "undefined" && window.matchMedia(MQ.desktopFine).matches;

let heroGate: Promise<void> | null = null;

/**
 * Resolves once the hero intro is over (html[data-intro] = done | skipped), so no
 * section chunk competes with the hero's chunks or frames (§7 animation budget).
 * Resolves at once when there is no intro to wait for (motion off, no hero, the
 * hero off screen — e.g. a deep link) and at most 2.5 s after the first call.
 */
export function afterHeroIntro(): Promise<void> {
  if (heroGate) return heroGate;
  heroGate = new Promise<void>((resolve) => {
    const html = document.documentElement;
    const over = () => /^(done|skipped)$/.test(html.getAttribute("data-intro") ?? "");
    const hero = document.getElementById("top")?.getBoundingClientRect();
    if (over() || !motionAllowed() || !hero || hero.bottom <= 0 || hero.top >= window.innerHeight) {
      resolve();
      return;
    }
    const done = () => {
      mo.disconnect();
      window.clearTimeout(timer);
      resolve();
    };
    const mo = new MutationObserver(() => over() && done());
    const timer = window.setTimeout(done, 2500);
    mo.observe(html, { attributes: true, attributeFilter: ["data-intro"] });
  });
  return heroGate;
}

/**
 * Calls `onNear` once when `el` is within `margin` of the viewport
 * (default: ≤1 viewport away), never before the hero intro is over
 * (afterHeroIntro). Returns a cleanup function.
 */
export function whenNear(el: Element, onNear: () => void, margin = "100% 0px 100% 0px"): () => void {
  if (typeof IntersectionObserver === "undefined") {
    onNear();
    return () => {};
  }
  let live = true;
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        void afterHeroIntro().then(() => live && onNear());
      }
    },
    { rootMargin: margin },
  );
  io.observe(el);
  return () => {
    live = false;
    io.disconnect();
  };
}

/**
 * "ONE primary motion per viewport" across sections: sections run their primary
 * (content) motion through this queue, so a motion that starts while another
 * section's primary motion is still playing waits for it — at most `maxWaitMs`
 * (250 ms: content is never held back behind decoration; design review MD-02).
 * Section-title landings are accents and do not take a slot.
 *   await queuePrimaryMotion(900); // then start the timeline (≈900 ms long)
 */
let primaryBusyUntil = 0;
export function queuePrimaryMotion(durationMs: number, maxWaitMs = 250): Promise<void> {
  const now = typeof performance === "undefined" ? 0 : performance.now();
  const wait = Math.max(0, Math.min(primaryBusyUntil - now, maxWaitMs));
  primaryBusyUntil = now + wait + durationMs;
  return wait > 0 ? new Promise((resolve) => setTimeout(resolve, wait)) : Promise.resolve();
}
