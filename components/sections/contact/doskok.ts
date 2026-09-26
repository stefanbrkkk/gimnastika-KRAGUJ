/**
 * Final CTA „doskok“ — „Poslednji skok“ (§4 Final CTA; design review v2: C-02, C-13,
 * MD-11, M-01, MI-10; round 2: CV2-01, CV2-06, CV2-07; round 3: CV3-02; round 4: MD4-01).
 * The page's closing dismount:
 *
 *   take-off  the flier appears exactly ON the S11 title mark's solid frame (same ink size
 *             and centre) and crossfades with it (the frame dims to .3), crouches, springs;
 *   hop       a short rise that never reaches the title line above, then straight down past
 *             the mark until the figure is clear of the title's glyphs (measured at play
 *             time: Range rects of the title text) — small, and only drifting (≤12°) while
 *             it is beside the title's last line;
 *   salto     the back turn starts as soon as the turned figure is 8 px under that line
 *             box and runs on evenly (≤1,050°/s) through the tuck: tucked (the figure
 *             compressed .9/.82) and still small (≤.75) through the inverted part, over the
 *             empty gap under the title; timed by its turn, not its path length (≥260 ms
 *             from the drop point, taken from the hop and the drop — doskok-path
 *             saltoClock), it opens out at full size through the three static ghost frames
 *             (tilts −330/−344/−354), each flashing brighter as it is passed — a fresh
 *             exposure on the plate; from 640, where the salto passes over the leotard
 *             sash, she wears a navy keyline while her box overlaps its band (MD4-01);
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
import { buildFlight, convexOverlap, flightTiming, keyed, saltoClock, spansWhere, timeAt, turnedBox, withinPolygon, type Pt } from "./doskok-path";

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
/** The hop's turn at the apex, and the slow drift while the figure is beside the title (CV2-01). */
const HOP_TURN = -8;
const DRIFT_TURN = -12;
/** Once clear of the title: at most this turn by the drop point, then an even spin (CV3-02). */
const DROP_TURN = -60;
/** Head down: the tuck's smallest point (CV2-07); the head-down part ends 45° past upside down. */
const TUCK_TURN = -200;
const HEAD_DOWN_END = -225;
/** The tuck (drop point → ghost 1) lasts at least this long (s)… */
const TUCK_MIN = 0.26;
/** …and never spins faster than this (°/s): a salto, not a spin-blur. */
const MAX_SPIN = 1050;
/** Clearance kept from any glyph box (px). */
const CLEAR = 8;
const MAX_RISE = 24;
const DWELL_MS = 120;
const VISIBLE_RATIO = 0.85;
/** The flier's keyline while she is over the sash's band (screen px at the tuck's scale, MD4-01):
 *  painted under the fill, so 1px shows — a clean edge even on 1× screens. */
const KEYLINE_PX = 2;
/** Grid of the silhouette's ink samples for the band test (px at scale 1). */
const INK_STEP = 3;

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

/**
 * The leotard sash's band (≥640, contact.css .cta-panel__slab::after) as a polygon relative to
 * `origin` (viewport px): the pseudo's box at the slab's top-right, cut by its polygon() clip.
 * Empty where there is no sash (phones: a 10px mat clipped by inset()).
 */
function sashBand(slab: HTMLElement | null, origin: Pt): Pt[] {
  if (!slab) return [];
  const cs = getComputedStyle(slab, "::after");
  const m = /^polygon\((.*)\)$/.exec(cs.clipPath.trim());
  const w = Number.parseFloat(cs.width);
  const h = Number.parseFloat(cs.height);
  if (!m || !(w > 0) || !(h > 0)) return [];
  const r = slab.getBoundingClientRect();
  const left = r.left + slab.clientLeft + slab.clientWidth - w; // inset: 0 0 auto auto
  const top = r.top + slab.clientTop;
  const len = (v: string, of: number) => (v.endsWith("%") ? (Number.parseFloat(v) / 100) * of : Number.parseFloat(v));
  const pts: Pt[] = [];
  for (const pair of m[1]!.split(",")) {
    const v = pair.trim().split(/\s+/);
    if (v.length !== 2) continue; // a fill rule
    const x = len(v[0]!, w);
    const y = len(v[1]!, h);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    pts.push({ x: left + x - origin.x, y: top + y - origin.y });
  }
  return pts.length >= 3 ? pts : [];
}

/**
 * Ink sample points of the flier's silhouette (#leap), on a grid of about `step` px: offsets
 * from the flier frame's centre in px at scale 1 (the frame is LEAP_W × LEAP_H = 230 × 150
 * units, `k` px each). Null when the path cannot be probed (then the ink box stands in).
 */
function inkPoints(figure: SVGUseElement, k: number, ink: { x: number; y: number; width: number; height: number }, step: number): Pt[] | null {
  const href = figure.getAttribute("href") ?? figure.getAttribute("xlink:href") ?? "";
  const symbol = href.startsWith("#") ? document.getElementById(href.slice(1)) : null;
  const path = symbol?.querySelector("path");
  const vb = symbol instanceof SVGSymbolElement ? symbol.viewBox.baseVal : null;
  if (!path || !vb || !(vb.width > 0) || !(vb.height > 0) || typeof path.isPointInFill !== "function") return null;
  // The symbol's viewBox inside the <use>'s 230 × 150 box (preserveAspectRatio xMidYMid meet).
  const s = Math.min(230 / vb.width, 150 / vb.height);
  const ox = (230 - vb.width * s) / 2 - vb.x * s;
  const oy = (150 - vb.height * s) / 2 - vb.y * s;
  const d = step / k;
  const out: Pt[] = [];
  try {
    for (let fy = ink.y + d / 2; fy < ink.y + ink.height; fy += d) {
      for (let fx = ink.x + d / 2; fx < ink.x + ink.width; fx += d) {
        if (path.isPointInFill({ x: (fx - ox) / s, y: (fy - oy) / s })) out.push({ x: (fx - 115) * k, y: (fy - 75) * k });
      }
    }
  } catch {
    return null;
  }
  return out.length > 0 ? out : null;
}

/** Half extents of a w×h box turned by `deg`. */
function halfExtents(w: number, h: number, deg: number): { hw: number; hh: number } {
  const a = (Math.abs(deg) * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  return { hw: (w * c + h * s) / 2, hh: (w * s + h * c) / 2 };
}

/** The largest half extents of a w×h box turned by anything from 0 to `maxDeg`. */
function maxExtents(w: number, h: number, maxDeg: number): { hw: number; hh: number } {
  let hw = 0;
  let hh = 0;
  for (let d = 0; d <= maxDeg; d += 1) {
    const e = halfExtents(w, h, d);
    hw = Math.max(hw, e.hw);
    hh = Math.max(hh, e.hh);
  }
  return { hw, hh };
}

/**
 * Bottom of the element's last line box (viewport px): the glyph boxes are the font's
 * content area, taller than the display step's .92 line box, so each is re-centred on it.
 */
function lineBoxBottom(el: Element | null | undefined, boxes: Box[]): number {
  if (!el || boxes.length === 0) return Number.NEGATIVE_INFINITY;
  const lh = Number.parseFloat(getComputedStyle(el).lineHeight);
  return Math.max(...boxes.map((b) => (Number.isFinite(lh) ? (b.t + b.b) / 2 + lh / 2 : b.b)));
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
  const slab = root.closest<HTMLElement>(".cta-panel__slab") ?? section?.querySelector<HTMLElement>(".cta-panel__slab") ?? null;
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
    const inkH = ink.height * k;
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

    // Drop point: straight under the mark, low enough that the figure — turned anything up
    // to the DROP_TURN and at hop scale — clears every glyph box it could reach.
    const dropX = P0.x + drift;
    // The lane spans the hop and the way back to the first ghost frame, so the figure is
    // below every glyph it would otherwise pass under on its way back (e.g. „trening“).
    const near = maxExtents(230 * k * sHop, 150 * k * sHop, -DROP_TURN);
    const nearBox = { l: dropX + L.x - near.hw, t: P0.y + L.y - near.hh, r: dropX + L.x + near.hw, b: P0.y + L.y + near.hh };
    const g1Box = frameAt(g1, 1, GHOST_TURN[0]);
    const lane = { ...nearBox, l: Math.min(nearBox.l, startBox.l, g1Box.l), r: Math.max(nearBox.r, startBox.r) };
    let floor = startBox.b; // at least below the mark itself
    for (const g of glyphs) if (overlapsX(lane, g) && g.t < lane.b + land.height) floor = Math.max(floor, g.b);
    const D: Pt = { x: dropX, y: Math.max(floor + CLEAR + near.hh - L.y, P0.y + land.height * 0.3 * s0) };

    const path = buildFlight(P0, rise, D, [...G, { x: 0, y: 0 }]);
    const drop = -P0.y; // P0 is above the landing (y < 0)
    const wide = window.innerWidth >= 1024;
    const total = Math.min(wide ? 1.0 : 0.9, Math.max(0.75, 0.04 * Math.sqrt(drop + 2 * rise)));
    const timing = flightTiming(path, 1, drop, rise, total);
    const [, , aDrop = 0, aG1 = 0, ...aRest] = path.anchors;
    // The salto: tucked and small through the inverted part, opening out at full size (CV2-07).
    const sTuck = Math.min(Math.max(s0 + 0.1, 0.5), 0.75);

    // CV3-02 · The turn is timed by angle. It stays a slow drift (HOP_TURN → DRIFT_TURN)
    // while the figure is beside the title; from the moment its turned box is CLEAR px under
    // the title's last line box (and off every glyph box) it turns on, at most DROP_TURN by
    // the drop point, then evenly through the tuck to ghost 1. The tuck gets at least
    // TUCK_MIN (the clock takes that time from the hop and the drop), and more if the turn
    // would still spin faster than MAX_SPIN (the clear point moves with the clock, so it is
    // re-measured on each pass).
    const lineBottom = lineBoxBottom(title, textBoxes(title));
    const clearOf = (b: Box) =>
      b.t >= lineBottom + CLEAR && glyphs.every((g) => b.r < g.l - CLEAR / 2 || b.l > g.r + CLEAR / 2 || b.b < g.t - CLEAR / 2 || b.t > g.b + CLEAR / 2);
    let clock = saltoClock(timing, aDrop, aG1, TUCK_MIN);
    let tClear = clock.drop;
    let turnC = -DRIFT_TURN;
    let turnD = turnC;
    for (let pass = 0; pass < 4; pass++) {
      const { apex: tA, drop: tD, g1: tG } = clock;
      const pre = (t: number) => -keyed([[0, 0], [tA, HOP_TURN], [tD, DRIFT_TURN]], t);
      // The turn (magnitude) from tc on: even spin to ghost 1, capped at DROP_TURN by the drop point.
      const plan = (tc: number) => {
        const mc = pre(tc);
        const spin = (-GHOST_TURN[0] - mc) / (tG - tc);
        return { mc, md: Math.min(-DROP_TURN, mc + spin * (tD - tc)) };
      };
      const step = 1 / 240;
      tClear = tD;
      for (let tc = tA; tc < tD; tc += step) {
        const { mc, md } = plan(tc);
        let ok = true;
        for (let t = tc; t <= tD + 1e-6 && ok; t += step) {
          const turn = t <= tc ? mc : mc + ((md - mc) * (t - tc)) / (tD - tc);
          const sc = s0 + ((sHop - s0) * t) / tD;
          ok = clearOf(frameAt(path.at(clock.progress(t)), sc, -turn));
        }
        if (ok) {
          tClear = tc;
          break;
        }
      }
      ({ mc: turnC, md: turnD } = plan(tClear));
      const tuckSpin = (-GHOST_TURN[0] - turnD) / (tG - tD);
      if (tuckSpin <= MAX_SPIN || pass === 3) break;
      clock = saltoClock(timing, aDrop, aG1, (-GHOST_TURN[0] - turnD) / MAX_SPIN + 0.005);
    }

    const { apex: tApex, drop: tDrop, g1: tG1, land: tLand } = clock;
    const tGhost = [tG1, ...aRest.slice(0, GHOST_TURN.length - 1).map((a) => clock.map(timeAt(timing, a)))];
    // When the even tuck spin reaches a turn (after the drop point).
    const tAt = (turn: number) => tDrop + ((-turn - turnD) / (-GHOST_TURN[0] - turnD)) * (tG1 - tDrop);
    // Head down at TUCK_TURN: the tuck's smallest point; the figure opens out only once it is
    // past head-down (HEAD_DOWN_END), so it is never larger than .75 while inverted.
    const tTuck = tAt(TUCK_TURN);
    const tHeadUp = tAt(HEAD_DOWN_END);
    const sHeadUp = Math.min(0.75, sTuck + ((1 - sTuck) * (tHeadUp - tTuck)) / (tG1 - tTuck));

    const turnKeys: [number, number][] = [
      [0, 0],
      [tApex, HOP_TURN],
      [tClear, -turnC],
      [tDrop, -turnD],
      ...tGhost.map((t, i): [number, number] => [t, GHOST_TURN[i]!]),
      [tLand, -360],
    ];
    const scaleKeys: [number, number][] = [
      [0, s0],
      [tDrop, sHop],
      [tTuck, sTuck],
      [tHeadUp, sHeadUp],
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
      const p = path.at(clock.progress(t));
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

    const tick = { t: -CROUCH };
    const tl = gsap.timeline({
      onComplete: () => {
        removePuffs();
        gsap.set([flier, body, ...ghosts], { clearProps: "all" });
        gsap.set(figure, { clearProps: "all" }); // transform + the origin GSAP set on the <use>
        // The take-off frame stays on the title at the ghost-3 step: the figure has left it.
      },
    });

    // MD4-01 · From 640 the salto's inverted part passes over the leotard sash, where white on
    // the band's lavender end is only ~1.4:1. While her (turned, scaled) ink box overlaps the
    // band she wears a navy-950 keyline (contact.css --doskok-keyline, in the leap symbol's
    // units = the flier's 230-unit frame), which cuts her silhouette out of the stripe. It is
    // off everywhere else: on the navy-800 title band at take-off it would show as a darker
    // rim, and over the ghost trail as a dark cut line (round 4 verification). Sized to
    // KEYLINE_PX at the tuck's scale; 0 at touchdown, so the landed frame is exactly the static
    // composition. (Routing the head-down part below the band was measured: only 28–96 px of
    // path lie between the band and ghost 1, so a ≤1,050°/s turn there brakes the fall to a
    // ~250 ms hover — the timing stays CV3-02's.)
    const band = sashBand(slab, L);
    const keyline = band.length > 0 ? KEYLINE_PX / (k * ((sHop + sTuck) / 2)) : 0;
    // Her ink, not her box: the split's bounding box reaches far past the limbs, so a box test
    // keeps the keyline on while she is already over the ghost trail. Each sample point is
    // moved as the figure is (tuck scale about the ink centre, then the flier's scale and turn
    // about the frame centre, then the path), and counts within half a grid step plus the
    // keyline of the band; the turned ink box is a quick reject (and the fallback).
    const points = keyline > 0 ? inkPoints(figure, k, ink, INK_STEP) : null;
    const reach = INK_STEP / 2 + KEYLINE_PX;
    const overBand = (t: number) => {
      const p = path.at(clock.progress(t));
      const turn = keyed(turnKeys, t);
      const sc = keyed(scaleKeys, t);
      const fx = keyed(sxKeys, t);
      const fy = keyed(syKeys, t);
      const cos = Math.cos((turn * Math.PI) / 180);
      const sin = Math.sin((turn * Math.PI) / 180);
      const move = (q: Pt): Pt => {
        const x = (inkOff.x + (q.x - inkOff.x) * fx) * sc;
        const y = (inkOff.y + (q.y - inkOff.y) * fy) * sc;
        return { x: p.x + x * cos - y * sin, y: p.y + x * sin + y * cos };
      };
      const box = turnedBox(move(inkOff), inkW * sc * fx + 2 * reach, inkH * sc * fy + 2 * reach, turn);
      if (!convexOverlap(box, band)) return false;
      return points ? points.some((q) => withinPolygon(move(q), band, reach)) : true;
    };
    const KEY_STEP = 1 / 240;
    const keySpans = keyline > 0 ? spansWhere(overBand, -CROUCH, tLand, KEY_STEP) : [];

    // 1 · Take-off: the flier appears ON the mark's solid frame (same size and centre) while
    //     the frame dims — a crossfade, no jump — then crouches and springs.
    gsap.set(flier, { transformOrigin: "50% 50%", willChange: "transform" });
    if (keyline > 0) gsap.set(flier, { "--doskok-keyline": 0 });
    gsap.set(figure, { transformOrigin: "50% 50%" });
    place(-CROUCH);
    tl.to(flier, { autoAlpha: 1, duration: CROSSFADE, ease: "none" }, 0);
    if (mark) tl.to(mark, { opacity: 0.3, duration: CROSSFADE, ease: "none" }, 0);

    // 2 · Crouch + flight: one pass of the salto clock (hop, salto, opening out).
    tl.to(tick, { t: tLand, duration: CROUCH + tLand, ease: "none", onUpdate: () => place(tick.t) }, CROSSFADE);
    const lift = CROSSFADE + CROUCH;
    // The keyline on one sample before her box reaches the band, off as it has left it.
    for (const [a, b] of keySpans) {
      tl.set(flier, { "--doskok-keyline": keyline.toFixed(2) }, lift + a - KEY_STEP);
      tl.set(flier, { "--doskok-keyline": 0 }, lift + b);
    }

    // Ghost frames flash as they are passed — brighter, like a fresh exposure.
    ghosts.forEach((g, i) => {
      tl.to(g, { opacity: Math.min(1, rest[i]! * GHOST_PEAK), duration: DUR.tap, ease: "none" }, lift + tGhost[i]! - DUR.tap / 2);
    });

    // 3 · Stuck landing: figure and button compress together; chalk leaves the feet.
    const touch = lift + tLand;
    if (keyline > 0) tl.set(flier, { "--doskok-keyline": 0 }, touch);
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
