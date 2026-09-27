/**
 * Scroll-scrubbed exercises (DECISIONS D-52): a gymnast's whole exercise is a flipbook of
 * silhouette frames (components/brand/exercises/*.generated.ts), and the page's scroll position
 * picks the frame. Scrolling plays the exercise, scrolling back rewinds it, and a stopped scroll
 * holds her mid-move. The key phases she passes stay behind as ghost frames, like the title marks'.
 *
 * No GSAP and no ScrollTrigger: a single passive scroll listener (capture, so horizontal strips
 * count too) schedules one rAF, which reads the scenes' rects first and then sets at most one `d`
 * attribute and a few data attributes per scene; scenes more than a viewport away are skipped.
 * Loaded lazily by the sections' motion islands, never on first load.
 *
 * Markup contract (server-rendered, complete without JS): an <svg> that holds
 *   - `.ex-ghost` paths, one per ghost frame (data-frame = its frame index), and
 *   - one `.ex-solid` path whose `d` is the last frame (the approved pose).
 * The static state is the finished exercise: every ghost shown and the final pose. While a scene
 * is scrubbed its svg carries data-scrub, and CSS (styles/ui.css) shows a ghost only when the
 * engine marks it data-shown.
 */

/** The frame data a scene needs (structural: components/brand/exercises/types.ts satisfies it). */
export interface ExerciseFrames {
  readonly frames: readonly string[];
  readonly ghosts: readonly number[];
}

export interface ScrubScene {
  /** The element whose position drives the exercise (a card plate, the band, a portrait frame). */
  trigger: Element;
  /** The svg holding the scene's .ex-ghost / .ex-solid paths. */
  figure: SVGSVGElement;
  data: ExerciseFrames;
  /**
   * The viewport lines (fractions of the viewport height from its top) the trigger's centre
   * crosses at the first and the last frame. Defaults: from the bottom edge to 40% from the top,
   * so the exercise ends while the scene is comfortably in view.
   */
  from?: number;
  to?: number;
  /** An extra 0…1 limit on the progress (e.g. how far a carousel card has slid in). */
  gate?: () => number;
  /** A translation (in the figure's own units) for a frame, e.g. to spread key phases apart. */
  offset?: (frame: number) => readonly [number, number];
  /** Called whenever the scrubbed frame changes (never while the scene is held static). */
  onFrame?: (frame: number) => void;
}

export const SCRUB_FROM = 1;
export const SCRUB_TO = 0.4;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Progress 0…1 of a scene whose trigger's centre is at `centerY` (px from the viewport top) in a
 * viewport `vh` tall: 0 at the `from` line, 1 at the `to` line.
 */
export function scrubProgress(centerY: number, vh: number, from = SCRUB_FROM, to = SCRUB_TO): number {
  const span = (from - to) * vh;
  if (span <= 0) return 1;
  return clamp01((from * vh - centerY) / span);
}

/** The frame shown at progress `p` of an `n`-frame exercise. */
export const frameAt = (p: number, n: number): number => Math.round(clamp01(p) * (n - 1));

/**
 * A scene that spreads an exercise's key phases apart (the enrollment band puts each on its step):
 * `shifts[k]` moves key frame `keys[k]`; a frame between two keys moves by the linear blend of
 * theirs by frame index, and frames outside the keys keep the nearest key's shift.
 */
export function keyedOffset(
  keys: readonly number[],
  shifts: readonly (readonly [number, number])[],
): (frame: number) => readonly [number, number] {
  return (frame) => {
    if (!keys.length) return [0, 0];
    if (frame <= keys[0]!) return shifts[0]!;
    for (let k = 1; k < keys.length; k++) {
      if (frame <= keys[k]!) {
        const t = (frame - keys[k - 1]!) / (keys[k]! - keys[k - 1]!);
        const [a, b] = [shifts[k - 1]!, shifts[k]!];
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      }
    }
    return shifts[shifts.length - 1]!;
  };
}

interface Live {
  scene: ScrubScene;
  solid: SVGPathElement;
  ghosts: SVGPathElement[];
  ghostFrames: number[];
  frame: number;
  /** Visible when the engine armed: it stays in its static final state until it has left the viewport. */
  held: boolean;
}

/** On screen: inside the viewport on both axes (a card waiting off to the right of a row is not). */
const onScreen = (r: DOMRect): boolean =>
  r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;

/** Scenes further than this many viewport heights from the viewport are left alone until they near it. */
const NEAR = 1;

/**
 * Arms the scenes and returns the cleanup, which restores every scene's static final state.
 * A scene already on screen when it arms keeps its finished pose until it has left the viewport
 * once, so nothing jumps under the reader's eyes; every other scene is set to its scroll position
 * at once, so none shows its finished pose for a frame when it arrives.
 */
export function scrubExercises(scenes: readonly ScrubScene[]): () => void {
  const lives: Live[] = [];
  for (const scene of scenes) {
    const solid = scene.figure.querySelector<SVGPathElement>(".ex-solid");
    if (!solid || scene.data.frames.length < 2) continue;
    const ghosts = Array.from(scene.figure.querySelectorAll<SVGPathElement>(".ex-ghost"));
    lives.push({
      scene,
      solid,
      ghosts,
      ghostFrames: ghosts.map((g, i) => Number(g.dataset.frame ?? scene.data.ghosts[i] ?? 0)),
      frame: scene.data.frames.length - 1,
      held: onScreen(scene.trigger.getBoundingClientRect()),
    });
  }
  if (!lives.length) return () => {};

  const show = (live: Live, frame: number) => {
    if (frame === live.frame) return;
    live.frame = frame;
    live.solid.setAttribute("d", live.scene.data.frames[frame]!);
    const off = live.scene.offset?.(frame);
    if (off) live.solid.setAttribute("transform", `translate(${off[0]} ${off[1]})`);
    live.ghosts.forEach((g, i) => g.toggleAttribute("data-shown", frame >= live.ghostFrames[i]!));
    live.scene.onFrame?.(frame);
  };

  // Every rect is read before any frame is written, so a scroll frame lays the page out once.
  const update = () => {
    const vh = window.innerHeight;
    const next: [Live, number][] = [];
    for (const live of lives) {
      const r = live.scene.trigger.getBoundingClientRect();
      // Not rendered (display: none, e.g. the band variant of the other layout): nothing to move.
      if (!r.width && !r.height) continue;
      if (live.held) {
        if (onScreen(r)) continue;
        live.held = false;
        live.frame = -1;
        live.scene.figure.setAttribute("data-scrub", "");
      }
      if (live.frame >= 0 && (r.bottom < -NEAR * vh || r.top > (1 + NEAR) * vh)) continue;
      let p = scrubProgress(r.top + r.height / 2, vh, live.scene.from, live.scene.to);
      if (live.scene.gate) p = Math.min(p, clamp01(live.scene.gate()));
      next.push([live, frameAt(p, live.scene.data.frames.length)]);
    }
    for (const [live, frame] of next) show(live, frame);
  };

  let raf = 0;
  const schedule = () => {
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
  };

  for (const live of lives) {
    if (live.held) continue;
    live.frame = -1;
    live.scene.figure.setAttribute("data-scrub", "");
  }
  update();

  const opts = { capture: true, passive: true } as const;
  document.addEventListener("scroll", schedule, opts);
  window.addEventListener("resize", schedule, { passive: true });

  return () => {
    document.removeEventListener("scroll", schedule, opts);
    window.removeEventListener("resize", schedule);
    if (raf) cancelAnimationFrame(raf);
    for (const live of lives) {
      const { frames } = live.scene.data;
      live.solid.setAttribute("d", frames[frames.length - 1]!);
      live.solid.removeAttribute("transform");
      for (const g of live.ghosts) g.removeAttribute("data-shown");
      live.scene.figure.removeAttribute("data-scrub");
    }
  };
}

/**
 * Plays an exercise once in time instead of scroll (the program sheet opening, a quiz landing):
 * the frames at an even rate over `ms`, ending on the final pose. Returns a cancel function that
 * jumps to the end.
 */
export function playExercise(figure: SVGSVGElement, data: ExerciseFrames, ms: number, onDone?: () => void): () => void {
  const solid = figure.querySelector<SVGPathElement>(".ex-solid");
  const ghosts = Array.from(figure.querySelectorAll<SVGPathElement>(".ex-ghost"));
  const n = data.frames.length;
  if (!solid || n < 2) {
    onDone?.();
    return () => {};
  }
  const ghostFrames = ghosts.map((g, i) => Number(g.dataset.frame ?? data.ghosts[i] ?? 0));
  figure.setAttribute("data-scrub", "");
  let shown = -1;
  let raf = 0;
  const t0 = performance.now();
  const set = (frame: number) => {
    if (frame === shown) return;
    shown = frame;
    solid.setAttribute("d", data.frames[frame]!);
    ghosts.forEach((g, i) => g.toggleAttribute("data-shown", frame >= ghostFrames[i]!));
  };
  const finish = () => {
    set(n - 1);
    for (const g of ghosts) g.removeAttribute("data-shown");
    figure.removeAttribute("data-scrub");
    onDone?.();
  };
  const tick = (now: number) => {
    const p = clamp01((now - t0) / ms);
    set(frameAt(p, n));
    if (p < 1) raf = requestAnimationFrame(tick);
    else {
      raf = 0;
      finish();
    }
  };
  set(0);
  raf = requestAnimationFrame(tick);
  return () => {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
    finish();
  };
}
