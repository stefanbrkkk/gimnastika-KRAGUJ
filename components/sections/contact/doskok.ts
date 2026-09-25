/**
 * Final CTA „doskok“ — „Poslednji skok“ (§4 Final CTA; design review v2: C-02, C-13,
 * MD-11, M-01, MI-10; round 2: CV2-01, CV2-06, CV2-07). The page's closing dismount:
 *
 *   take-off  the flier appears exactly ON the S11 title mark's solid frame (same ink size
 *             and centre) and crossfades with it (the frame dims to .3), crouches, springs;
 *   hop       a short rise that never reaches the title line above, then straight down past
 *             the mark until the figure is clear of the title's glyphs (measured at play
 *             time: Range rects of the title text) — small, and turned at most 40°;
 *   salto     only then the back salto: tucked (the figure compressed .9/.82) and still
 *             small through the inverted part, over the empty gap under the title; it opens
 *             out at full size through the three static ghost frames (tilts −330/−344/−354),
 *             each flashing brighter as it is passed — a fresh exposure on the plate;
 *   landing   a STUCK landing on the button's top edge: the figure compresses and holds
 *             (--ease-land), the button squashes with it (.94/1.03 → 1, rebound .35 s,
 *             D-S11-4), chalk puffs leave the feet; the afterimages fade back to the
 *             trail's resting opacity and the title's take-off frame settles at the
 *             ghost-3 step, so the mark rests as a clean four-frame trail.
 *
 * On phones the trust list sits under the privacy line (contact.css), so the flight falls
 * through empty navy; the route is measured against the title and trust-list text at play
 * time and never crosses a glyph box at any width.
 *
 * The flier IS the landed frame ([data-doskok-leap]), moved by transform from the mark to
 * its own layout box, so the final state is exactly the static composition (no-JS and
 * reduced motion), and every point is measured at play time (any layout, any width).
 *
 * Rules kept: transform + opacity only; one timeline, ≤1 rAF loop (GSAP's ticker, which
 * sleeps when idle), no scroll-linked scrub, no pin; the only hidden pre-state is the
 * landed figure (it is still on the title's mark), applied by JS while the CTA is
 * off-screen — the trail stays, so the slab never rests empty; cleanup reverts every
 * inline style (gsap.context).
 * ONE primary motion per viewport: the flight goes through queuePrimaryMotion(); the title
 * mark is static (land={false}), so this is S11's one landing.
 * Trigger: the button ≥85% in view for 120 ms (MD-11), so it plays once the hand stops,
 * not mid-scroll; it re-arms if the button leaves before the dwell ends.
 * Loaded lazily by ContactDoskok — never in the first-load JS.
 */
import { DUR, EASE, MQ, gsap, motionAllowed, queuePrimaryMotion, registerMotion } from "@/lib/motion";
import { buildFlight, flightTiming, keyed, progressAt, timeAt, type Pt } from "./doskok-path";

const noop = () => {};

/** Crossfade on the mark (flier in, the mark's solid frame down to .3) before the crouch (s). */
const CROSSFADE = DUR.tap;
/** Crouch before the take-off (s). */
const CROUCH = 0.09;
/** Button squash on touchdown (§4: scaleY .94 / scaleX 1.03 → 1, rebound .35 s). */
const BUTTON_SQUASH = { scaleX: 1.03, scaleY: 0.94 } as const;
const BUTTON_SQUASH_DUR = 0.35;
/** The figure's own stuck landing: compress, then hold (MD-11). */
const FIGURE_SQUASH = { scaleX: 1.05, scaleY: 0.86 } as const;
/** The tuck through the inverted part of the salto (CV2-07). */
const TUCK = { scaleX: 0.9, scaleY: 0.82 } as const;
/** Ghost frames flash brighter as they are passed, then decay to their resting opacity. */
const GHOST_PEAK = 1.8;
/** Tilt of each static ghost (contact.css --gr): the salto's last degrees, as negative (backward) turns. */
const GHOST_TURN = [-330, -344, -354] as const;
/** Turn and scale limits while the figure is still beside the title (CV2-01). */
const NEAR_TITLE_TURN = -40;
const TUCK_TURN = -200;
/** Clearance kept from any glyph box (px). */
const CLEAR = 8;
const MAX_RISE = 24;
const DWELL_MS = 120;
const VISIBLE_RATIO = 0.85;

/** Chalk: puffs where the split touches down — front foot (out and up) and under the hips. */
const CHALK = [
  { at: 0.95, dx: 15, dy: -9 },
  { at: 0.88, dx: -5, dy: -15 },
  { at: 0.55, dx: -13, dy: -8 },
] as const;

interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

const center = (r: DOMRect): Pt => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/** Glyph boxes of an element's text (one per line fragment; inline <svg> marks excluded). */
function textBoxes(el: Element | null | undefined): Box[] {
  if (!el) return [];
  const out: Box[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim()) continue;
    range.selectNodeContents(n);
    for (const r of Array.from(range.getClientRects())) if (r.width > 1) out.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  }
  range.detach();
  return out;
}

/** Half extents of a w×h box turned by `deg`. */
function halfExtents(w: number, h: number, deg: number): { hw: number; hh: number } {
  const a = (Math.abs(deg) * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  return { hw: (w * c + h * s) / 2, hh: (w * s + h * c) / 2 };
}

export function armDoskok(root: HTMLElement): () => void {
  registerMotion();
  const flier = root.querySelector<SVGSVGElement>("[data-doskok-leap]");
  const figure = flier?.querySelector<SVGUseElement>("use") ?? null;
  const body = root.querySelector<HTMLElement>("[data-doskok-body]");
  const ghosts = Array.from(root.querySelectorAll<SVGSVGElement>("[data-doskok-ghost]"));
  const section = root.closest("section");
  const mark = section?.querySelector<SVGUseElement>(".section-heading__mark .chrono-solid") ?? null;
  const title = section?.querySelector<HTMLElement>(".section-heading__title") ?? null;
  const trust = section?.querySelector<HTMLElement>(".cta-panel__trust") ?? null;
  if (!flier || !figure || !body || ghosts.length !== GHOST_TURN.length) return noop;

  // Already on screen (deep link to #kontakt, restored scroll): keep the static final state — no flash.
  const box = body.getBoundingClientRect();
  if (box.bottom > 0 && box.top < window.innerHeight) return noop;

  const rest = ghosts.map((g) => Number(getComputedStyle(g).opacity) || 0.3);

  const ctx = gsap.context(() => {
    gsap.set(flier, { autoAlpha: 0 });
  });

  const play = () => {
    const land = flier.getBoundingClientRect();
    const L = center(land);
    const k = land.width / 230; // flier px per viewBox unit
    const rel = (p: Pt): Pt => ({ x: p.x - L.x, y: p.y - L.y });
    const G = ghosts.map((g) => rel(center(g.getBoundingClientRect())));
    const g1 = G[0]!;

    // The silhouette's ink box inside the flier's 230×150 frame (viewBox units → px at scale 1).
    let ink = { x: 3, y: 3, width: 224, height: 144.5 };
    try {
      const b = figure.getBBox();
      if (b.width > 0) ink = { x: b.x, y: b.y, width: b.width, height: b.height };
    } catch {
      /* not rendered: keep the sprite's measured box */
    }
    const inkW = ink.width * k;
    // Ink centre relative to the frame centre (the transform origin), at scale 1.
    const inkOff = { x: (ink.x + ink.width / 2 - 115) * k, y: (ink.y + ink.height / 2 - 75) * k };

    // Take-off: the flier starts exactly on the mark's solid frame — same ink size, same centre
    // (CV2-06). Without a visible mark: a point one trail-length above the first ghost.
    const markRect = mark?.getBoundingClientRect();
    const hasMark = Boolean(markRect && markRect.width > 0);
    const s0 = hasMark ? Math.min(1.2, Math.max(0.2, markRect!.width / inkW)) : 0.6;
    const P0 = hasMark
      ? rel({ x: markRect!.left + markRect!.width / 2 - inkOff.x * s0, y: markRect!.top + markRect!.height / 2 - inkOff.y * s0 })
      : { x: g1.x + land.width * 0.4, y: g1.y - land.width * 1.6 };

    // Obstacles: the title's and the trust list's glyph boxes (viewport px).
    const glyphs = [...textBoxes(title), ...textBoxes(trust)];
    const frameAt = (p: Pt, scale: number, turn: number): Box => {
      const { hw, hh } = halfExtents(230 * k * scale, 150 * k * scale, turn);
      const x = p.x + L.x;
      const y = p.y + L.y;
      return { l: x - hw, t: y - hh, r: x + hw, b: y + hh };
    };
    const overlapsX = (a: Box, g: Box) => a.l < g.r + CLEAR && a.r > g.l - CLEAR;

    // Hop (CV2-01): the rise stops short of any glyph above the mark and of the viewport top.
    const drift = -Math.min(8, land.width * 0.08); // a back salto travels backwards (left)
    const sHop = s0 + 0.05;
    const startBox = frameAt(P0, s0, 0);
    const riseLane = { ...startBox, l: startBox.l + drift, r: startBox.r };
    let rise = MAX_RISE;
    for (const g of glyphs) if (g.b <= startBox.t + 2 && overlapsX(riseLane, g)) rise = Math.min(rise, startBox.t - g.b - CLEAR / 2);
    rise = Math.min(rise, startBox.t - CLEAR); // never out of the viewport's top
    if (!hasMark || (title && title.getBoundingClientRect().top < 0)) rise = hasMark ? 0 : 32;
    rise = Math.max(0, rise);

    // Drop point: straight under the mark, low enough that the figure — turned the
    // NEAR_TITLE_TURN and at hop scale — clears every glyph box it could reach.
    const dropX = P0.x + drift;
    // The lane spans the hop and the way back to the first ghost frame, so the figure is
    // below every glyph it would otherwise pass under on its way back (e.g. „trening“).
    const nearBox = frameAt({ x: dropX, y: P0.y }, sHop, NEAR_TITLE_TURN);
    const g1Box = frameAt(g1, 1, GHOST_TURN[0]);
    const lane = { ...nearBox, l: Math.min(nearBox.l, startBox.l, g1Box.l), r: Math.max(nearBox.r, startBox.r) };
    let floor = startBox.b; // at least below the mark itself
    for (const g of glyphs) if (overlapsX(lane, g) && g.t < lane.b + land.height) floor = Math.max(floor, g.b);
    const { hh: hhNear } = halfExtents(230 * k * sHop, 150 * k * sHop, NEAR_TITLE_TURN);
    const D: Pt = { x: dropX, y: Math.max(floor + CLEAR + hhNear - L.y, P0.y + land.height * 0.3 * s0) };

    const path = buildFlight(P0, rise, D, [...G, { x: 0, y: 0 }]);
    const drop = -P0.y; // P0 is above the landing (y < 0)
    const wide = window.innerWidth >= 1024;
    const total = Math.min(wide ? 1.0 : 0.9, Math.max(0.75, 0.04 * Math.sqrt(drop + 2 * rise)));
    const timing = flightTiming(path, 1, drop, rise, total);
    const [, aApex = 0, aDrop = 0, ...aRest] = path.anchors;
    const tApex = timeAt(timing, aApex);
    const tDrop = timeAt(timing, aDrop);
    const tGhost = G.map((_, i) => timeAt(timing, aRest[i] ?? 0));
    const tLand = timing.rise + timing.fall;
    const tG1 = tGhost[0]!;
    // The salto: tucked and small through the inverted part, opening out at full size (CV2-07).
    const tTuck = tDrop + (tG1 - tDrop) * 0.45;
    const sTuck = Math.min(Math.max(s0 + 0.1, 0.5), 0.75);

    const turnKeys: [number, number][] = [
      [0, 0],
      [tApex, -8],
      [tDrop, NEAR_TITLE_TURN],
      [tTuck, TUCK_TURN],
      ...tGhost.map((t, i): [number, number] => [t, GHOST_TURN[i]!]),
      [tLand, -360],
    ];
    const scaleKeys: [number, number][] = [
      [0, s0],
      [tDrop, sHop],
      [tTuck, sTuck],
      [tG1, 1],
    ];
    // Figure (its <use>): the crouch before the take-off (negative time), the spring out of
    // it, and the tuck while inverted.
    const spring = Math.min(0.1, tDrop * 0.8);
    const tuckIn = tDrop + (tTuck - tDrop) * 0.5;
    const tuckOut = tTuck + (tG1 - tTuck) * 0.4;
    const sxKeys: [number, number][] = [
      [-CROUCH, 1],
      [0, 1.04],
      [spring, 1],
      [tDrop, 1],
      [tuckIn, TUCK.scaleX],
      [tuckOut, TUCK.scaleX],
      [tG1, 1],
    ];
    const syKeys: [number, number][] = [
      [-CROUCH, 1],
      [0, 0.9],
      [spring, 1],
      [tDrop, 1],
      [tuckIn, TUCK.scaleY],
      [tuckOut, TUCK.scaleY],
      [tG1, 1],
    ];

    const setX = gsap.quickSetter(flier, "x", "px");
    const setY = gsap.quickSetter(flier, "y", "px");
    const setR = gsap.quickSetter(flier, "rotation", "deg");
    // Two setters: a quickSetter on the "scale" alias never reached the transform (CV2-06:
    // the flier took off at full size, 2–2.5× the mark's frame).
    const setSX = gsap.quickSetter(flier, "scaleX");
    const setSY = gsap.quickSetter(flier, "scaleY");
    const setFX = gsap.quickSetter(figure, "scaleX");
    const setFY = gsap.quickSetter(figure, "scaleY");
    const place = (t: number) => {
      const p = path.at(progressAt(timing, t));
      setX(p.x);
      setY(p.y);
      setR(keyed(turnKeys, t));
      const sc = keyed(scaleKeys, t);
      setSX(sc);
      setSY(sc);
      setFX(keyed(sxKeys, t));
      setFY(keyed(syKeys, t));
    };

    // Chalk puffs (created now, removed when the flight ends or is stopped).
    const bodyBox = body.getBoundingClientRect();
    puffs = CHALK.map(({ at }) => {
      const el = document.createElement("span");
      el.setAttribute("aria-hidden", "true");
      el.style.cssText =
        "position:absolute;bottom:100%;width:16px;height:16px;margin:0 0 -6px -8px;border-radius:50%;" +
        "background:radial-gradient(closest-side,rgb(246 248 252/.95),rgb(246 248 252/.45) 55%,rgb(246 248 252/0));" +
        "pointer-events:none;opacity:0";
      el.style.left = `${land.left - bodyBox.left + land.width * at}px`;
      body.append(el);
      return el;
    });

    const clock = { t: -CROUCH };
    const tl = gsap.timeline({
      onComplete: () => {
        removePuffs();
        gsap.set([flier, body, ...ghosts], { clearProps: "all" });
        gsap.set(figure, { clearProps: "all" }); // transform + the origin GSAP set on the <use>
        // The take-off frame stays on the title at the ghost-3 step: the figure has left it.
      },
    });

    // 1 · Take-off: the flier appears ON the mark's solid frame (same size and centre) while
    //     the frame dims — a crossfade, no jump — then crouches and springs.
    gsap.set(flier, { transformOrigin: "50% 50%", willChange: "transform" });
    gsap.set(figure, { transformOrigin: "50% 50%" });
    place(-CROUCH);
    tl.to(flier, { autoAlpha: 1, duration: CROSSFADE, ease: "none" }, 0);
    if (mark) tl.to(mark, { opacity: 0.3, duration: CROSSFADE, ease: "none" }, 0);

    // 2 · Crouch + flight: one pass of the clock (hop, salto, opening out).
    tl.to(clock, { t: tLand, duration: CROUCH + tLand, ease: "none", onUpdate: () => place(clock.t) }, CROSSFADE);
    const lift = CROSSFADE + CROUCH;

    // Ghost frames flash as they are passed — brighter, like a fresh exposure.
    ghosts.forEach((g, i) => {
      tl.to(g, { opacity: Math.min(1, rest[i]! * GHOST_PEAK), duration: DUR.tap, ease: "none" }, lift + tGhost[i]! - DUR.tap / 2);
    });

    // 3 · Stuck landing: figure and button compress together; chalk leaves the feet.
    const touch = lift + tLand;
    tl.set(figure, { transformOrigin: "50% 100%" }, touch)
      .fromTo(figure, { ...FIGURE_SQUASH }, { scaleX: 1, scaleY: 1, duration: DUR.land, ease: EASE.land, immediateRender: false }, touch)
      .fromTo(body, { ...BUTTON_SQUASH, transformOrigin: "50% 100%" }, { scaleX: 1, scaleY: 1, duration: BUTTON_SQUASH_DUR, ease: EASE.rebound, immediateRender: false }, touch);
    puffs.forEach((el, i) => {
      tl.fromTo(
        el,
        { opacity: 0.9, scale: 0.35, x: 0, y: 0 },
        { opacity: 0, scale: 1.8, x: CHALK[i]!.dx, y: CHALK[i]!.dy, duration: 0.46, ease: EASE.stick, immediateRender: false },
        touch,
      );
    });

    // 4 · Afterimage: the trail decays to its resting opacity (the static composition), and the
    //     title's take-off frame settles at the ghost-3 step — a clean four-frame trail (CV2-06).
    ghosts.forEach((g, i) => {
      tl.to(g, { opacity: rest[i]!, duration: DUR.slow, ease: "none" }, touch + 0.05);
    });
    if (mark) {
      const settle = Number.parseFloat(getComputedStyle(mark).getPropertyValue("--ghost-3-o")) || 0.42;
      tl.to(mark, { opacity: settle, duration: DUR.slow, ease: "none" }, touch + 0.05);
    }
  };

  const durationMs = () => 1000 * (CROSSFADE + CROUCH + 1.0 + BUTTON_SQUASH_DUR);

  let puffs: HTMLElement[] = [];
  const removePuffs = () => {
    puffs.forEach((el) => el.remove());
    puffs = [];
  };

  let stopped = false;
  let dwell = 0;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(dwell);
    io.disconnect();
    reduce.removeEventListener("change", onReduce);
    ctx.revert(); // back to the static composition (kills a running flight too)
    removePuffs();
  };

  const start = () => {
    if (stopped) return;
    if (!motionAllowed()) return stop();
    void queuePrimaryMotion(durationMs()).then(() => {
      if (stopped) return;
      if (!motionAllowed()) return stop();
      ctx.add(play);
    });
  };

  // Play once the button is ≥85% in view for 120 ms: the hand has stopped, and the
  // mark above it is in view on every tested viewport, so the whole flight is seen.
  const io = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1];
      window.clearTimeout(dwell);
      if (!entry?.isIntersecting || entry.intersectionRatio < VISIBLE_RATIO - 0.01) return;
      dwell = window.setTimeout(() => {
        const r = body.getBoundingClientRect();
        const seen = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
        if (seen < r.height * (VISIBLE_RATIO - 0.01)) return; // left again: wait for the next crossing
        io.disconnect();
        start();
      }, DWELL_MS);
    },
    { threshold: [0, VISIBLE_RATIO, 1] },
  );
  io.observe(body);

  const reduce = window.matchMedia(MQ.reduce);
  const onReduce = () => {
    if (reduce.matches) stop();
  };
  reduce.addEventListener("change", onReduce);

  return stop;
}
