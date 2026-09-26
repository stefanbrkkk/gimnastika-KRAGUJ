/**
 * The desktop scrub (loaded with ScrollTrigger after the intro, on (min-width:
 * 1024px) and (pointer:fine) only — never part of the initial animation chunk).
 * See pinHero().
 */
import { EASE, gsap } from "@/lib/motion";
import type { loadScrollTrigger } from "@/lib/motion";
import { LEAP_BOX } from "./constants";
import type { Pt } from "./pass";
import {
  STEEP,
  exposureAt,
  exposureRamp,
  gutterLeg,
  laneLeg,
  laneTicks,
  legTicks,
  measure,
  nextLeg,
  roundRoute,
  routeClear,
  routePath,
  spineRoute,
  type Pt as RoutePt,
  type SpineNext,
  type SpineRect,
} from "./spine";

type ScrollTriggerStatic = Awaited<ReturnType<typeof loadScrollTrigger>>;
type Matrix = [number, number, number, number, number, number];

const SVG_NS = "http://www.w3.org/2000/svg";
const q = <T extends Element>(root: ParentNode, sel: string) => root.querySelector<T>(sel);
const qa = <T extends Element>(root: ParentNode, sel: string) => Array.from(root.querySelectorAll<T>(sel));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const smooth = (s: number) => s * s * (3 - 2 * s);
const grow = (r: SpineRect, d: number): SpineRect => ({ left: r.left - d, top: r.top - d, right: r.right + d, bottom: r.bottom + d });
const overlaps = (a: SpineRect, b: SpineRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Client rects of the text inside `root` and of its painted boxes, relative to `origin`, inflated by `pad`. */
function textBoxes(root: Element, origin: DOMRect, pad: number, skip?: Element | null): SpineRect[] {
  const boxes: SpineRect[] = [];
  const add = (r: DOMRect) => {
    if (r.width > 0 && r.height > 0) {
      boxes.push({ left: r.left - origin.left - pad, top: r.top - origin.top - pad, right: r.right - origin.left + pad, bottom: r.bottom - origin.top + pad });
    }
  };
  const range = document.createRange();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim() || (skip && skip.contains(n))) continue;
    const el = n.parentElement;
    if (!el || el.closest("[aria-hidden='true'], .sr-only")) continue;
    range.selectNodeContents(n);
    Array.from(range.getClientRects()).forEach(add);
  }
  qa<HTMLElement>(root, ".btn, [data-hero-ctas] a").forEach((el) => add(el.getBoundingClientRect()));
  return boxes;
}

/** Boxes that paint something (cards, strips) directly inside a section's layout, relative to `origin`. */
function paintedBoxes(root: Element, origin: DOMRect, skip: Element): SpineRect[] {
  const out: SpineRect[] = [];
  qa<HTMLElement>(root, "*").forEach((el) => {
    if (skip.contains(el) || el.contains(skip)) return;
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    const painted = (bg && bg !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(bg)) || parseFloat(cs.borderTopWidth) > 0 || el instanceof HTMLImageElement;
    if (!painted) return;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    out.push({ left: r.left - origin.left, top: r.top - origin.top, right: r.right - origin.left, bottom: r.bottom - origin.top });
  });
  return out;
}

/** Letters that ink below the baseline (Serbian Latin) — the title's only glyphs under it. */
const DESCENDERS = /[gjpqy,;]/;

/**
 * What a title actually inks, as boxes relative to `origin`: each line from
 * .8 em above its baseline down to it, plus a box under each descender
 * letter (.25 em). A Range rect spans the font's whole ascent + descent, so
 * the rects of a .95 line-height title overlap by a third of a line; the
 * figure walking the mark's baseline under the line above would read as a
 * collision where nothing is inked. `baseline` is the mark's line (viewport y).
 */
function glyphBoxes(title: Element, origin: DOMRect, baseline: number): SpineRect[] {
  const em = parseFloat(getComputedStyle(title).fontSize) || 16;
  const range = document.createRange();
  const lines: DOMRect[] = [];
  const letters: DOMRect[] = [];
  const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent ?? "";
    if (!text.trim() || n.parentElement?.closest("[aria-hidden='true'], .sr-only")) continue;
    range.selectNodeContents(n);
    lines.push(...Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0));
    for (let i = 0; i < text.length; i++) {
      if (!DESCENDERS.test(text[i]!)) continue;
      range.setStart(n, i);
      range.setEnd(n, i + 1);
      letters.push(range.getBoundingClientRect());
    }
  }
  if (!lines.length) return [];
  // every line shares the font's descent below its baseline: measure it on the mark's (last) line
  const descent = Math.max(...lines.map((r) => r.bottom)) - baseline;
  const box = (r: DOMRect, top: number, bottom: number): SpineRect => ({ left: r.left - origin.left, right: r.right - origin.left, top: top - origin.top, bottom: bottom - origin.top });
  return [
    ...lines.map((r) => box(r, r.bottom - descent - 0.8 * em, r.bottom - descent)),
    ...letters.map((r) => box(r, r.bottom - descent, r.bottom - descent + 0.25 * em)),
  ];
}

/** The nearest sticky ancestor's natural (unstuck) offset of `el`'s rect: [dx, dy] to add. */
function unstick(el: Element): [number, number] {
  for (let n = el.parentElement; n; n = n.parentElement) {
    if (getComputedStyle(n).position === "sticky") {
      const a = n.getBoundingClientRect();
      const prev = n.style.position;
      n.style.position = "static";
      const b = n.getBoundingClientRect();
      n.style.position = prev;
      return [b.left - a.left, b.top - a.top];
    }
  }
  return [0, 0];
}

/** The chrono mark's viewBox (components/ui/ChronoMark.tsx): ghost 1 at (0, 52), the landed frame at (340, 58). */
const MARK = { width: 570, first: [0, 52] as Pt, pitch: -10 } as const;
/** The second exposure: white on the hero, the mark's colour below it. */
const EXPOSURE_OPACITY = 0.88;
/** She never runs smaller than this share of the landed silhouette: where that does not fit, she is hidden instead. */
const MIN_SHARE = 0.45;
/** The silhouette's ink inside its 230 × 150 box. */
const INK = { left: 2, top: 3, right: 226, bottom: 147 } as const;
/** Her front toe in the box — the stuck landing's pivot (pass.ts TOE_FRONT). */
const TOE: Pt = [222.7, 146.7];
/** Her figure standing on the line, per unit of scale: half its width, and its height with the bounds. */
const RUNNER = { half: 114, height: 160 } as const;
/** Corner radius of the route (px). */
const CORNER = 14;
/** Route samples (px of arc length) for her facing and her visibility. */
const SAMPLE = 4;
/** She is never shown for less than this much route (px): no flash between two hidden stretches. */
const MIN_SHOWN = 48;
/**
 * Her opacity is scrubbed, not timed: it ramps over this much scroll (px) from every stretch
 * where she must not be seen (FI4-01/02, round 4) — 70–110 px of route, as the pin and the onward
 * run cover the route at different rates. A 40 px wheel notch fades her over several frames, and
 * a scroll one way can never hide and show her again (no blink).
 */
const RAMP_SCROLL = 48;
/** px she keeps from the viewport's side edges; px of air she keeps from text. */
const EDGE = 8;
const AIR = 4;
/** px of route over which the wall-to-wall floor (≥ 1680 px) retracts to the fold, where the gutter leg takes over. */
const MAT_RETRACT = 32;
/**
 * px of route over which she leaves the logo: a take-off from her front toe, which leaves the
 * mat where she landed and flies a small parabola to the fold (never below the floor). Long
 * enough (a third to a half of the pin) that one wheel notch never carries her through it …
 */
const LEAVE = 300;
/**
 * … peaking this share of her ink height above the mat, on EASE.hang. She fades out from the apex
 * (or from 24 px before the fold, where that comes later) and is gone by the time the take-off
 * has covered this share of the way to the fold — still well above the mat.
 */
const TAKEOFF = { lift: 0.3, gone: 0.8 } as const;
/** She is only seen clear of the mat: her ink ≥ this many px above its top edge (the mat is 1.5 px). */
const FLOOR_AIR = 1.5;
/** px of route over which she settles onto the mark's first frame. */
const ARRIVE = 70;
/** Samples (± 24 px of route) around a change of direction where she is hidden and turns out of sight. */
const TURN = 6;
/** The hop turn on the arrival: over its first 48 px of route she hops (lift × her ink height) and turns at the apex. */
const HOP = { length: 48, lift: 0.12 } as const;
/** At the hop's turn her opacity dips to this for 80 ms (the mirror flips in one step, never through zero width). */
const TURN_DIP = { opacity: 0.4, ms: 80 } as const;
/** The scrub's catch-up time (s); ScrollTrigger eases it with expo.out. */
const SCRUB = 0.5;
/** Marey ticks down the gutter leg: every 96 px, 6 px long, pointing out of the page; each draws over 6 px of route. */
const TICK = { every: 96, length: 6, draw: 6 } as const;

/**
 * Pins the hero for half a viewport of scroll and gives the scrub a purpose:
 * the chronophotograph stays whole while a second exposure of the landed
 * gymnast — a clone of #leap, never the logo's own silhouette, which stays to
 * cover the wordmark's „j“ — leaves the logo and runs the floor diagonal (the
 * spine) that grows under her feet: down the right margin, under the aside,
 * out of the hero, level across the band above the next section and down
 * beside its title to the title's mark. She leaves with a take-off: her front
 * toe leaves the mat where she landed and flies a small parabola toward the
 * fold (on EASE.hang, never below the floor), fading from its apex. She keeps
 * at least .45 of the landed size; where she cannot fit, and on every drop (a
 * leg steeper than 60°: the margin, the lane beside the title) she is out of
 * sight and only the line draws. Her opacity is scrubbed like everything else:
 * it ramps with her place on the route (over 48 px of scroll from each such
 * stretch), so no scroll can show her there, cut her off, or hide and show
 * her again on the way. She is only ever seen whole: she turns out of sight, and at the
 * mark in a hop whose apex flips her in one step. While the pin lives, #top
 * links scroll to the true top. The pin keeps the hero still
 * for the first stretch; the journey runs on with the page until the mark is
 * in the reading zone, where she turns and hands over ("kraguj:handoff"): the
 * mark's own landing (data-landing + data-landed) carries her the rest of the
 * way, and the line, its job done, fades out (redrawn when scrubbing back).
 * The drops are the floor carried on — the gutter leg (mat end → down the
 * margin) and the lane beside the title: the mat's 1.5 px at .6, mitred folds
 * and the mat's Marey ticks; the diagonal and the band legs are the spine, 2 px
 * steel-300 at .8. It never crosses text — a route that
 * would touch the next title stops at the hero's bottom edge instead, and
 * HeadingLandings lands the mark; everything is recomputed on refreshInit.
 */
export function pinHero(ScrollTrigger: ScrollTriggerStatic, section: HTMLElement, decor: HTMLElement, art: SVGSVGElement | undefined): () => void {
  const matSvg = q<SVGSVGElement>(decor, ".hero-mat");
  const leap = art && q<SVGGElement>(art, "[data-hero-leap]");
  if (!art || !matSvg || !leap) return () => {};
  const floor: SVGSVGElement = matSvg;
  const nextSection = section.nextElementSibling instanceof HTMLElement ? section.nextElementSibling : document.getElementById("kviz");
  const mark = document.querySelector<SVGSVGElement>("#kviz .chrono-mark");

  // ---- DOM: the spine and the exposure (created here, removed on cleanup) ----
  const spine = document.createElementNS(SVG_NS, "svg");
  spine.setAttribute("class", "hero-spine");
  spine.setAttribute("aria-hidden", "true");
  spine.setAttribute("focusable", "false");
  spine.innerHTML =
    '<defs><clipPath id="hero-spine-in"><rect/></clipPath><clipPath id="hero-spine-out"><rect/></clipPath></defs>' +
    // the gutter leg, the ticks, the spine to the lane, the lane beside the next title, the spine to the mark
    '<g class="hero-spine__ink"><path class="hero-spine__floor" pathLength="1"/><g class="hero-spine__ticks"></g><path class="hero-spine__line" pathLength="1"/>' +
    '<path class="hero-spine__floor" pathLength="1"/><path class="hero-spine__line" pathLength="1"/></g>' +
    '<g class="hero-spine__x" clip-path="url(#hero-spine-in)"><g><use href="#leap"/></g></g>' +
    '<g class="hero-spine__x hero-spine__x--out" clip-path="url(#hero-spine-out)"><g><use href="#leap"/></g></g>';
  const [legLine, laneLine] = qa<SVGPathElement>(spine, ".hero-spine__floor") as [SVGPathElement, SVGPathElement];
  const [line, lineEnd] = qa<SVGPathElement>(spine, ".hero-spine__line") as [SVGPathElement, SVGPathElement];
  const tickGroup = q<SVGGElement>(spine, ".hero-spine__ticks")!;
  let ticks: SVGPathElement[] = [];
  const clipIn = q<SVGRectElement>(spine, "#hero-spine-in rect")!;
  const clipOut = q<SVGRectElement>(spine, "#hero-spine-out rect")!;
  const xs = qa<SVGGElement>(spine, ".hero-spine__x");
  const xMoves = xs.map((g) => g.firstElementChild as SVGGElement);
  qa<SVGUseElement>(spine, "use").forEach((u) => {
    u.setAttribute("width", String(LEAP_BOX.width));
    u.setAttribute("height", String(LEAP_BOX.height));
  });
  section.prepend(spine);
  section.classList.add("hero--spine");

  // EASE.hang (registered with the intro's motion layer): the take-off's progress, hanging at the apex
  const hang = gsap.parseEase(EASE.hang) ?? ((v: number) => v);
  /** The share of the take-off at which EASE.hang reaches u (it never falls, so a bisection finds it). */
  const hangAt = (u: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (hang(mid) < u) lo = mid;
      else hi = mid;
    }
    return hi;
  };

  // ---- Layout (recomputed on refreshInit) ----
  let route = measure([]);
  let facing: number[] = [1];
  let shownAt: boolean[] = [];
  /** Her opacity share at each route sample (exposureRamp over shownAt). */
  let expo: number[] = [];
  /** Route arc length where the drawn gutter leg starts (0, or the fold when the floor runs wall to wall) and ends. */
  let legFrom = 0;
  let legTo = 0;
  /** Each drawn path and the stretch of route (arc length) it reveals as the tip passes. */
  let inks: { el: SVGPathElement; from: number; to: number }[] = [];
  /** Route arc length of each tick down the gutter leg and the lane. */
  let tickAt: number[] = [];
  let heroLen = 0;
  let start = { x: 0, y: 0, k: 1 };
  /**
   * The take-off: her toe where she landed, the run to the fold (px), the apex height, the route
   * px it takes, and the shares of it where she starts to fade (the apex) and where she is gone.
   */
  let takeoff = { x: 0, y: 0, run: 1, lift: 0, len: LEAVE, fade: 0.5, hide: 0.9 };
  let kRun = 1;
  let markPose: { x: number; y: number; k: number } | null = null;
  /** The mark's top in hero coordinates, as it sits after the pin (unstuck). */
  let markTop = 0;
  let heightOf = 0;
  /** px of the wall-to-wall floor (≥ 1680 px) past the fold. */
  let matOver = 0;

  const layout = () => {
    const s = section.getBoundingClientRect();
    const m = matSvg.getBoundingClientRect();
    const w = section.clientWidth;
    const h = section.offsetHeight;
    const matY = m.top + m.height / 2 - s.top;
    const inner = q<HTMLElement>(section, ".hero__inner");
    const ir = inner?.getBoundingClientRect();
    const containerRight = ir ? ir.right - parseFloat(getComputedStyle(inner!).paddingRight) - s.left : m.right - s.left;
    const left = ir ? parseFloat(getComputedStyle(inner!).paddingLeft) + ir.left - s.left : 48;
    const turn = containerRight + Math.min(32, (w - containerRight) / 2);
    // (wall to wall, the floor retracts to the fold, where the gutter leg takes over)
    matOver = m.right - s.left - turn;

    // where she starts: the landed silhouette (art units → section px)
    const ctm = art.getScreenCTM();
    const lt = leap.transform.baseVal.consolidate()?.matrix;
    const artK = ctm ? Math.hypot(ctm.a, ctm.b) : 1;
    if (ctm && lt) start = { x: ctm.a * lt.e + ctm.c * lt.f + ctm.e - s.left, y: ctm.b * lt.e + ctm.d * lt.f + ctm.f - s.top, k: artK };
    // the right margin fits a figure this wide (px), with 4 px of air each side
    const laneK = Math.max(0.12, (2 * Math.min(turn - containerRight, w - turn) - 8) / LEAP_BOX.width);

    // the next section's title mark, where the journey ends
    let next: SpineNext | undefined;
    /** What the route must stay out of in the next section (the guard), and what her figure must. */
    let guard: SpineRect[] = [];
    let keepNext: SpineRect[] = [];
    markPose = null;
    if (mark && nextSection) {
      const [ux, uy] = unstick(mark);
      const mr = mark.getBoundingClientRect();
      const ns = nextSection.getBoundingClientRect();
      // section coordinates of the next section as it sits right under the hero (after the pin)
      const dy = h - (ns.top - s.top);
      const k = mr.width / MARK.width;
      const mx = mr.left + ux - s.left;
      const my = mr.top + uy - s.top + dy;
      const toS = (r: SpineRect): SpineRect => ({ left: r.left + ux, right: r.right + ux, top: r.top + dy + uy, bottom: r.bottom + dy + uy });
      const heading = mark.closest("header, h2") ?? mark;
      const title = mark.closest("h2") ?? heading;
      const others = [...textBoxes(nextSection, s, 12, heading), ...paintedBoxes(nextSection, s, heading)].map((r) => ({ ...r, top: r.top + dy, bottom: r.bottom + dy }));
      const titleLines = textBoxes(heading, s, 0).map(toS);
      next = nextLeg({ bottom: h, mark: { left: mx, top: my, right: mx + mr.width, bottom: my + mr.height }, endX: mx + (MARK.first[0] + 222.7) * k, lines: titleLines, others });
      markPose = { x: mx + MARK.first[0] * k, y: my + MARK.first[1] * k, k };
      markTop = my;
      guard = [...titleLines.map((r) => grow(r, 2)), ...others];
      keepNext = [...glyphBoxes(title, s, mr.top + mr.height * (206 / 208)).map((r) => grow(toS(r), AIR)), ...others];
    }
    kRun = Math.max(Math.min(laneK, markPose?.k ?? laneK), MIN_SHARE * start.k);
    const base = { matY, matEnd: containerRight, turn, bottom: h, left, obstacles: textBoxes(section, s, 16), runner: { half: RUNNER.half * kRun, height: RUNNER.height * kRun } };
    // corners rounded by 14 px (the obstacles keep 16 px of air, so the arcs never reach text)
    let raw: RoutePt[] = spineRoute({ ...base, next });
    let pts = roundRoute(raw, CORNER);
    if (next && !routeClear(pts, guard)) {
      // The guard: the route would still touch the next title. It ends at the hero's bottom
      // edge instead, and HeadingLandings lands the mark on its own.
      next = undefined;
      markPose = null;
      keepNext = [];
      raw = spineRoute(base);
      pts = roundRoute(raw, CORNER);
    }
    route = measure(pts);
    /** The mat's top edge (its line is 1.5 px). */
    const floorTop = matY - 0.75;
    // which way she runs along the route (mirrored going left; a drop keeps the last way)
    const going: number[] = [];
    let way = 1;
    for (let s1 = 0; s1 <= route.length; s1 += SAMPLE) {
      const q1 = route.point(s1);
      if (Math.abs(q1.dx) > 0.2) way = Math.sign(q1.dx);
      going.push(way);
    }
    const n = going.length;
    const near = (flags: boolean[]) => flags.map((_, i) => flags.slice(Math.max(0, i - TURN), i + TURN + 1).some(Boolean));
    // within ±24 px of a change of direction she is out of sight: she turns there, unseen — never
    // squeezed through zero width by a mirror passing through 0
    const turning = going.map((g, i) => going.slice(Math.max(0, i - TURN), i + TURN + 1).some((o) => o !== g));
    // a drop (a leg steeper than 60°: the gutter, the lane beside the next title) is never run, nor
    // ±24 px around it: she would hang from the line like a marionette — only the line draws it
    const dropping = near(going.map((_, i) => Math.abs(route.point(i * SAMPLE).dy) > STEEP));
    // … and her figure never crosses a drop's line (a trailing foot on the lane's corner)
    const drops: SpineRect[] = [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1]!;
      const [bx, by] = pts[i]!;
      const len = Math.hypot(bx - ax, by - ay);
      if (len > 0 && Math.abs(by - ay) / len > STEEP) drops.push(grow({ left: Math.min(ax, bx), top: Math.min(ay, by), right: Math.max(ax, bx), bottom: Math.max(ay, by) }, AIR));
    }
    facing = going;
    // where she is shown on the route: her whole figure inside the viewport (8 px from its sides) and
    // clear of text by 4 px — the hero's, and the next title's inked glyphs; elsewhere only the line draws
    const keep = [...textBoxes(section, s, AIR), ...keepNext];
    const fits = (b: SpineRect) => b.left >= EDGE && b.right <= w - EDGE && !keep.some((r) => overlaps(b, r));
    const offDrops = (b: SpineRect) => !drops.some((r) => overlaps(b, r));
    const onRoute: boolean[] = [];
    for (let i = 0; i < n; i++) {
      const s1 = i * SAMPLE;
      const arriving = markPose !== null && route.length - s1 <= ARRIVE;
      const b = inkBox(routePose(s1));
      onRoute.push(!dropping[i] && offDrops(b) && (arriving || (!turning[i] && fits(b))));
    }
    // The take-off (FI4-01): her front toe leaves the mat where she landed and flies a parabola to
    // the fold, scaled about the toe from the landed size to the running size. It takes the route's
    // first 300 px — or less, so that it ends where she is out of sight on the route anyway (the
    // fold, the gutter, the turn into the diagonal): the switch onto the route is never seen.
    const toeX = start.x + TOE[0] * start.k;
    const toeY = start.y + TOE[1] * start.k;
    let foldAt = 0;
    let best = Infinity;
    pts.forEach(([x, y], i) => {
      const d = Math.hypot(x - turn, y - matY);
      if (d < best) [best, foldAt] = [d, route.at[i]!];
    });
    let hiddenTo = route.length;
    for (let i = Math.ceil(foldAt / SAMPLE); i < n; i++) {
      if (onRoute[i]) {
        hiddenTo = i * SAMPLE;
        break;
      }
    }
    const run = Math.max(1, turn - toeX);
    // she starts to fade at the apex (the middle of the hang), or 24 px before the fold where that
    // comes later, and is gone .8 of the way to the fold (her toe still ~.6 of the lift above the mat)
    const fadeU = Math.max(0.5, 1 - (TURN * SAMPLE) / run);
    const fade = hangAt(fadeU);
    takeoff = {
      x: toeX,
      y: toeY,
      run,
      lift: TAKEOFF.lift * (INK.bottom - INK.top) * ((start.k + kRun) / 2),
      len: Math.max(8 * SAMPLE, Math.min(LEAVE, hiddenTo)),
      fade,
      hide: Math.min(0.95, Math.max(fade + 0.2, hangAt(Math.max(TAKEOFF.gone, fadeU + 0.2)))),
    };
    shownAt = [];
    for (let i = 0; i < n; i++) {
      const s1 = i * SAMPLE;
      if (s1 >= takeoff.len) {
        shownAt.push(onRoute[i]!);
        continue;
      }
      // in the air: before she is gone, clear of the mat's top edge, inside the viewport and clear of text
      const b = inkBox(poseAt(s1));
      shownAt.push(s1 / takeoff.len < takeoff.hide && b.bottom <= floorTop - FLOOR_AIR && fits(b) && offDrops(b));
    }
    // without the mark she leaves with the line through the hero's bottom edge
    if (!markPose) for (let i = Math.max(0, n - MIN_SHOWN / SAMPLE); i < n; i++) shownAt[i] = false;
    // never a flash: a stretch shorter than MIN_SHOWN stays hidden (the arrival at the mark excepted)
    for (let i = 0; i < n; ) {
      let j = i;
      while (j < n && shownAt[j] === shownAt[i]) j++;
      if (shownAt[i] && j < n && (j - i) * SAMPLE < MIN_SHOWN) shownAt.fill(false, i, j);
      i = j;
    }
    // she keeps her way through each hidden stretch and takes the next one halfway along it,
    // where she has been out of sight longest: every frame she is seen in is whole (face ±1)
    facing = going.slice();
    for (let i = 0; i < n; ) {
      let j = i;
      while (j < n && shownAt[j] === shownAt[i]) j++;
      if (!shownAt[i]) {
        const before = going[Math.max(0, i - 1)]!;
        const after = going[Math.min(n - 1, j)]!;
        for (let k = i; k < j; k++) facing[k] = k < (i + j) / 2 ? before : after;
      }
      i = j;
    }
    // the hero's share of the route: up to where it leaves through the bottom edge
    heroLen = route.length;
    for (let s1 = 0; s1 <= route.length; s1 += 2) {
      if (route.point(s1).y >= h) {
        heroLen = s1;
        break;
      }
    }
    // the ramps span the same scroll on the pin (half a viewport for the hero's share of the route)
    // and on the onward run (to the mark's top at 80 % of the viewport); the one onto the mark ends
    // before her hop, so she arrives whole
    const vh = window.innerHeight;
    const pinRate = heroLen / Math.max(1, 0.5 * vh);
    const runRate = (route.length - heroLen) / Math.max(1, (h > vh + 1 ? vh - h : 0) + markTop - 0.8 * vh);
    const lastHidden = shownAt.lastIndexOf(false) * SAMPLE;
    expo = exposureRamp(shownAt, SAMPLE, (at) => {
      const r = RAMP_SCROLL * (at < heroLen ? pinRate : Math.max(pinRate, runRate));
      return markPose && at === lastHidden ? Math.min(r, Math.max(SAMPLE, route.length - at - ARRIVE - SAMPLE)) : r;
    });
    heightOf = Math.max(h, ...pts.map((p) => p[1] + 4));
    spine.setAttribute("viewBox", `0 0 ${w} ${heightOf}`);
    spine.style.height = `${heightOf}px`;
    // the gutter leg is the floor carried on: the mat's weight, a mitred fold, the mat's ticks
    const leg = gutterLeg(raw, CORNER);
    legTo = route.at[leg.split] ?? route.length;
    legFrom = 0;
    let legPts = leg.pts;
    if (matOver > 1 && leg.fold) {
      // wall to wall the floor itself runs to the fold: the leg starts there (on the mat's last px)
      let best = Infinity;
      pts.forEach(([x, y], i) => {
        const d = Math.hypot(x - leg.fold![0], y - leg.fold![1]);
        if (d < best) [best, legFrom] = [d, route.at[i]!];
      });
      legPts = [[leg.fold[0] - 1, leg.fold[1]], ...leg.pts.slice(leg.pts.indexOf(leg.fold))];
    }
    legLine.setAttribute("d", routePath(legPts));
    // the lane beside the next title is the floor folded down again (FI4-02): the mat's weight,
    // mitred corners and ticks every 96 px pointing away from the title; the spine runs to it and on
    // from it to the mark
    const lane = markPose ? laneLeg(raw, CORNER) : null;
    const rest = pts.slice(leg.split, lane ? lane.from + 1 : undefined);
    const after = lane ? pts.slice(lane.to) : [];
    const at = (i: number) => route.at[Math.min(i, route.at.length - 1)]!;
    line.setAttribute("d", rest.length > 1 ? routePath(rest) : "");
    laneLine.setAttribute("d", lane ? routePath(lane.pts) : "");
    lineEnd.setAttribute("d", after.length > 1 ? routePath(after) : "");
    inks = [
      { el: legLine, from: legFrom, to: legTo },
      { el: line, from: legTo, to: lane ? at(lane.from) : route.length },
      ...(lane
        ? [
            { el: laneLine, from: at(lane.from), to: at(lane.to) },
            { el: lineEnd, from: at(lane.to), to: route.length },
          ]
        : []),
    ];
    const legEnd = leg.pts[leg.pts.length - 1]!;
    // (x, y, route arc) of each tick: perpendicular to its leg, pointing out of the page (the floor's
    // upper side, folded down) — right of the gutter, and right of the lane, away from the title
    const tickPts: [number, number, number][] = [
      ...(leg.fold ? legTicks(leg, TICK.every).map((y): [number, number, number] => [leg.fold![0], y, legTo - (legEnd[1] - y)]) : []),
      ...(lane ? laneTicks(lane, TICK.every).map((y): [number, number, number] => [lane.top[0], y, at(lane.down) + (y - pts[lane.down]![1])]) : []),
    ];
    tickAt = tickPts.map(([, , a]) => a);
    ticks.forEach((t) => t.remove());
    ticks = tickPts.map(([x, y]) => {
      const t = document.createElementNS(SVG_NS, "path");
      t.setAttribute("class", "hero-spine__tick");
      t.setAttribute("pathLength", "1");
      t.setAttribute("d", `M${r3(x)} ${r3(y)}h${TICK.length}`);
      tickGroup.append(t);
      return t;
    });
    for (const [rect, y, hh] of [
      [clipIn, -1000, h + 1000],
      [clipOut, h, heightOf + 1000],
    ] as const) {
      rect.setAttribute("x", "-1000");
      rect.setAttribute("width", String(w + 2000));
      rect.setAttribute("y", String(y));
      rect.setAttribute("height", String(hh));
    }
    const solid = mark?.querySelector(".chrono-solid");
    xs[1]!.style.color = solid ? getComputedStyle(solid).color : "";
    draw();
  };

  // ---- The journey: progress p over the route (0 → 1) ----
  // Two scrubbed timelines move her: the pinned one over the hero's share of the route, the onward
  // one over the rest. Around the pin's end both catch up at once (a fast wheel step past it), so
  // each keeps its own progress and her place is their sum: the pinned stretch covered plus the
  // onward one — one continuous position per frame (before, the two wrote one value in turn, and
  // she jumped back and forth).
  const pinState = { p: 0 };
  const runState = { p: 0 };
  /** The hero's share of the route (the pinned timeline's end). */
  const heroShare = () => (route.length ? heroLen / route.length : 1);
  let handedOff = false;

  /** Her pose at arc length sArc: taking off from the logo, then on the route. */
  function poseAt(sArc: number): Matrix {
    return sArc < takeoff.len ? takeoffPose(sArc) : routePose(sArc);
  }

  /**
   * The take-off (FI4-01): her front toe — the stuck landing's pivot — leaves the mat where she
   * landed and flies a parabola to the fold, peaking .3 of her ink height above the mat, on
   * EASE.hang; she shrinks about the toe from the landed size to the running size on the way. The
   * toe is her lowest ink, so she is never below the floor.
   */
  function takeoffPose(sArc: number): Matrix {
    const u = hang(clamp01(sArc / takeoff.len));
    const k = start.k + (kRun - start.k) * u;
    const x = takeoff.x + takeoff.run * u;
    const y = takeoff.y - 4 * takeoff.lift * u * (1 - u);
    return [k, 0, 0, k, x - k * TOE[0], y - k * TOE[1]];
  }

  /**
   * Her pose on the route at arc length sArc: box anchor P placed at world point A, scale k,
   * mirrored by `face`, turned `rot`° about P. Running: she stands on the line (the feet), in
   * small bounds; dropping down the margin or the lane (never seen there): centred on it.
   */
  function routePose(sArc: number): Matrix {
    const L = route.length;
    const pt = route.point(sArc);
    const vertical = smooth(clamp01((Math.abs(pt.dy) - 0.7) / 0.25));
    const P: Pt = [113, 146.7 - 28.7 * vertical];
    const kMark = markPose?.k ?? kRun;
    const arrive = markPose ? smooth(clamp01(1 - (L - sArc) / ARRIVE)) : 0;
    let k = kRun;
    // ±1 only: she never shows squeezed by a mirror passing through 0 (FI3-02)
    let face = faceAt(sArc);
    const bound = (1 - vertical) * Math.abs(Math.sin((Math.PI * sArc) / (LEAP_BOX.width * k * 1.4))) * 16 * k;
    let A: Pt = [pt.x, pt.y - bound];
    let rot = 0;
    if (markPose) {
      // the last stretch: she settles exactly on the mark's first frame, pitched like its flier,
      // and on its first 48 px she hops and turns at the apex to face the way the mark flies
      const end: Pt = [markPose.x + 114 * markPose.k, markPose.y + 146.7 * markPose.k];
      A = [A[0] + (end[0] - A[0]) * arrive, A[1] + (end[1] - A[1]) * arrive];
      k += (kMark - k) * arrive;
      rot = MARK.pitch * arrive;
      const hop = (ARRIVE - (L - sArc)) / HOP.length;
      if (hop > 0 && hop < 1) A = [A[0], A[1] - HOP.lift * (INK.bottom - INK.top) * k * 4 * hop * (1 - hop)];
      if (hop >= 0.5) face = 1;
    }
    const c = Math.cos((rot * Math.PI) / 180);
    const sn = Math.sin((rot * Math.PI) / 180);
    const a = c * k * face;
    const b = sn * k * face;
    const cc = -sn * k;
    const d = c * k;
    return [a, b, cc, d, A[0] - (a * P[0] + cc * P[1]), A[1] - (b * P[0] + d * P[1])];
  }

  /** Which way she faces at arc length sArc: +1 or −1 (the arrival's hop turn aside). */
  function faceAt(sArc: number): number {
    return facing[Math.min(facing.length - 1, Math.max(0, Math.round(sArc / SAMPLE)))] ?? 1;
  }

  /** The axis-aligned box of her ink in a pose (section px). */
  function inkBox(m: Matrix): SpineRect {
    const xs1: number[] = [];
    const ys1: number[] = [];
    for (const [x, y] of [
      [INK.left, INK.top],
      [INK.right, INK.top],
      [INK.left, INK.bottom],
      [INK.right, INK.bottom],
    ] as const) {
      xs1.push(m[0] * x + m[2] * y + m[4]);
      ys1.push(m[1] * x + m[3] * y + m[5]);
    }
    return { left: Math.min(...xs1), top: Math.min(...ys1), right: Math.max(...xs1), bottom: Math.max(...ys1) };
  }

  /**
   * Her opacity share at arc length sArc (0 → 1): the route's scrubbed ramp and, in the take-off,
   * a linear fade from the apex until she is gone — a function of where she is, never of time.
   */
  function exposure(sArc: number): number {
    if (sArc < 0.5) return 0;
    const e = exposureAt(expo, SAMPLE, sArc);
    if (sArc >= takeoff.len) return e;
    const t = sArc / takeoff.len;
    return Math.min(e, 1 - clamp01((t - takeoff.fade) / Math.max(1e-6, takeoff.hide - takeoff.fade)));
  }

  let lastFace = 1;

  function draw() {
    const p = pinState.p + Math.max(0, runState.p - heroShare());
    // after the hand-off the line has done its job: it fades out, and is back as soon as she is scrubbed back
    if (handedOff) spine.toggleAttribute("data-handed", p >= 0.98);
    const L = route.length;
    if (!L) return;
    const sArc = p * L;
    // the gutter leg, the lane, their ticks and the rest of the spine draw as she passes (one tip)
    inks.forEach(({ el, from, to }) => (el.style.strokeDashoffset = String(r3(1 - clamp01((sArc - from) / Math.max(1, to - from))))));
    ticks.forEach((t, i) => (t.style.strokeDashoffset = String(r3(1 - clamp01((sArc - tickAt[i]!) / TICK.draw)))));
    const pose = poseAt(sArc);
    const m = `matrix(${pose.map(r3).join(" ")})`;
    xMoves.forEach((g) => g.setAttribute("transform", m));
    // Her opacity follows her place on the route through the scrub's own easing (FI4-01/02): she
    // fades as she nears a stretch where she must not be seen and is gone at its edge, however fast
    // the scroll — no timed fade to start early or cut short, and no hide-show-hide on one scroll.
    const e = handedOff ? 0 : exposure(sArc);
    const shown = e > 0;
    if (!handedOff) xs.forEach((g) => (g.style.opacity = String(r3(EXPOSURE_OPACITY * e))));
    // the hop turn: the mirror flips in one step at the apex, under an 80 ms dip of her opacity
    const face = Math.sign(pose[0] * pose[3] - pose[1] * pose[2]) || 1;
    if (face !== lastFace && shown) {
      xMoves.forEach((g) => g.animate([{ opacity: TURN_DIP.opacity / EXPOSURE_OPACITY }, { opacity: 1 }], { duration: TURN_DIP.ms, easing: "linear" }));
    }
    lastFace = face;
    // wide rooms: the wall-to-wall floor gives way to the gutter leg — its run past the fold
    // retracts as she sets off, so the floor folds down at its end (no T-junction)
    floor.style.clipPath = matOver > 1 && sArc > 0 ? `inset(-4px ${r3(matOver * clamp01(sArc / MAT_RETRACT))}px -4px 0)` : "";
  }

  // ---- Hand-off: the mark lands; she stays with it ----
  const handoff = () => {
    // a route stopped by the guard never reaches the mark: HeadingLandings lands it
    if (handedOff || !markPose) return;
    handedOff = true;
    spine.setAttribute("data-handed", "");
    xs.forEach((g) => {
      g.style.transition = "opacity var(--dur-tap) linear";
      g.style.opacity = "0";
    });
    if (mark && !mark.hasAttribute("data-landed")) {
      mark.setAttribute("data-landing", "");
      mark.setAttribute("data-landed", "");
    }
    window.dispatchEvent(new CustomEvent("kraguj:handoff", { detail: { mark } }));
  };

  // ---- Timelines ----
  // Pinned: the plate stays whole while she runs the hero's stretch of the spine.
  const pinned = gsap
    .timeline({ defaults: { ease: "none" }, onUpdate: draw })
    .fromTo(pinState, { p: 0 }, { p: () => heroShare(), duration: 1, immediateRender: false }, 0);
  // Released: she runs on with the page to the next title and hands over when it is in the reading zone.
  const onward = gsap
    .timeline({ defaults: { ease: "none" }, onUpdate: draw, onComplete: handoff })
    .fromTo(runState, { p: () => heroShare() }, { p: 1, duration: 1, immediateRender: false });

  layout();
  ScrollTrigger.addEventListener("refreshInit", layout);

  // A hero taller than the viewport pins when its bottom reaches the viewport bottom.
  const tall = () => section.offsetHeight > window.innerHeight + 1;
  const pin = ScrollTrigger.create({
    trigger: section,
    start: () => (tall() ? "bottom bottom" : "top top"),
    end: "+=50%",
    pin: true,
    scrub: SCRUB,
    animation: pinned,
    invalidateOnRefresh: true,
  });
  const run = mark
    ? ScrollTrigger.create({
        trigger: section,
        start: () => pin.end,
        // the mark's top low in the reading zone (HeadingLandings lands marks at 65 %; this comes
        // first, with room for the scrub's .5 s to settle her on the mark's first frame).
        // Measured unstuck (the title is sticky on desktop), from the hero's top at the pin's end.
        end: () => pin.end + (tall() ? window.innerHeight - section.offsetHeight : 0) + markTop - window.innerHeight * 0.8,
        scrub: SCRUB,
        animation: onward,
        invalidateOnRefresh: true,
      })
    : null;
  ScrollTrigger.refresh();

  // ---- Back to the top (MD3-03) ----
  // The pin moves the hero down its spacer, so the browser's own #top jump would land mid-scrub
  // (the hero's pinned offset minus the scroll padding). While the pin lives, a click on a #top
  // link (the header logo) scrolls to the true top, where the hero rests whole, and moves focus
  // to its H1 as the jump would have (it is not focusable by itself: tabindex −1).
  const title = q<HTMLElement>(section, "h1");
  const onTop = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!(e.target instanceof Element) || !e.target.closest('a[href="#top"]')) return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    if (window.location.hash !== "#top") window.history.replaceState(window.history.state, "", "#top");
    if (title) {
      if (!title.hasAttribute("tabindex")) title.setAttribute("tabindex", "-1");
      title.focus({ preventScroll: true });
    }
  };
  document.addEventListener("click", onTop);

  return () => {
    document.removeEventListener("click", onTop);
    ScrollTrigger.removeEventListener("refreshInit", layout);
    run?.kill();
    pin.kill(true);
    spine.remove();
    floor.style.clipPath = "";
    section.classList.remove("hero--spine");
  };
}
