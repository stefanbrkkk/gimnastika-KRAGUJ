/**
 * The desktop scrub (loaded with ScrollTrigger after the intro, on (min-width:
 * 1024px) and (pointer:fine) only — never part of the initial animation chunk).
 * See pinHero().
 */
import { gsap } from "@/lib/motion";
import type { loadScrollTrigger } from "@/lib/motion";
import { LEAP_BOX } from "./constants";
import type { Pt } from "./pass";
import { measure, nextLeg, roundRoute, routeClear, routePath, spineRoute, type SpineNext, type SpineRect } from "./spine";

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
/** Her figure standing on the line, per unit of scale: half its width, and its height with the bounds. */
const RUNNER = { half: 114, height: 160 } as const;
/** Corner radius of the route (px). */
const CORNER = 14;
/** Route samples (px of arc length) for her facing and her visibility. */
const SAMPLE = 4;
/** She is never shown for less than this much route (px): no flash between two hidden stretches. */
const MIN_SHOWN = 48;
/** px she keeps from the viewport's side edges; px of air she keeps from text. */
const EDGE = 8;
const AIR = 4;
/** px of route over which the wall-to-wall floor (≥ 1680 px) retracts to the spine's corner. */
const MAT_RETRACT = 32;
/** px of route over which she leaves the logo … */
const LEAVE = 170;
/** … and over which she turns and settles onto the mark's first frame. */
const ARRIVE = 70;

/**
 * Pins the hero for half a viewport of scroll and gives the scrub a purpose:
 * the chronophotograph stays whole while a second exposure of the landed
 * gymnast — a clone of #leap, never the logo's own silhouette, which stays to
 * cover the wordmark's „j“ — leaves the logo and runs the floor diagonal (the
 * spine) that grows under her feet: down the right margin, under the aside,
 * out of the hero, level across the band above the next section and down
 * beside its title to the title's mark. She keeps at least .45 of the landed
 * size; where she cannot fit (the margin, the lane beside the title) she
 * fades out (120 ms) and only the line draws. The pin keeps the hero still
 * for the first stretch; the journey runs on with the page until the mark is
 * in the reading zone, where she turns and hands over ("kraguj:handoff"): the
 * mark's own landing (data-landing + data-landed) carries her the rest of the
 * way, and the line, its job done, fades out (redrawn when scrubbing back).
 * The spine is 2 px steel-300 at .8 and never crosses text — a route that
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
    '<path class="hero-spine__line" pathLength="1"/>' +
    '<g class="hero-spine__x" clip-path="url(#hero-spine-in)"><g><use href="#leap"/></g></g>' +
    '<g class="hero-spine__x hero-spine__x--out" clip-path="url(#hero-spine-out)"><g><use href="#leap"/></g></g>';
  const line = q<SVGPathElement>(spine, "path")!;
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

  // ---- Layout (recomputed on refreshInit) ----
  let route = measure([]);
  let facing: number[] = [1];
  let shownAt: boolean[] = [];
  let heroLen = 0;
  let start = { x: 0, y: 0, k: 1 };
  let kRun = 1;
  let markPose: { x: number; y: number; k: number } | null = null;
  /** The mark's top in hero coordinates, as it sits after the pin (unstuck). */
  let markTop = 0;
  let heightOf = 0;
  /** px of the wall-to-wall floor (≥ 1680 px) past the spine's corner. */
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
    matOver = m.right - s.left - (turn - Math.min(CORNER, (turn - containerRight) / 2));

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
    let pts = roundRoute(spineRoute({ ...base, next }), CORNER);
    if (next && !routeClear(pts, guard)) {
      // The guard: the route would still touch the next title. It ends at the hero's bottom
      // edge instead, and HeadingLandings lands the mark on its own.
      next = undefined;
      markPose = null;
      keepNext = [];
      pts = roundRoute(spineRoute(base), CORNER);
    }
    route = measure(pts);
    // which way she faces along the route (mirrored going left; a drop keeps the last way), eased
    // over ±24 px around a change — a turn, not a flip
    const going: number[] = [];
    let way = 1;
    for (let s1 = 0; s1 <= route.length; s1 += SAMPLE) {
      const q1 = route.point(s1);
      if (Math.abs(q1.dx) > 0.2) way = Math.sign(q1.dx);
      going.push(way);
    }
    facing = going.map((_, i) => {
      let sum = 0;
      let n = 0;
      for (let j = Math.max(0, i - 6); j <= Math.min(going.length - 1, i + 6); j++, n++) sum += going[j]!;
      return sum / n;
    });
    // where she is shown: her whole figure inside the viewport (8 px from its sides) and clear of
    // text by 4 px — the hero's, and the next title's inked glyphs; elsewhere only the line draws
    const keep = [...textBoxes(section, s, AIR), ...keepNext];
    shownAt = [];
    for (let s1 = 0; s1 <= route.length; s1 += SAMPLE) {
      const b = inkBox(poseAt(s1));
      const arriving = markPose !== null && route.length - s1 <= ARRIVE;
      shownAt.push(arriving || (b.left >= EDGE && b.right <= w - EDGE && !keep.some((r) => overlaps(b, r))));
    }
    // without the mark she leaves with the line through the hero's bottom edge
    if (!markPose) for (let i = Math.max(0, shownAt.length - MIN_SHOWN / SAMPLE); i < shownAt.length; i++) shownAt[i] = false;
    // never a flash: a stretch shorter than MIN_SHOWN stays hidden (the arrival at the mark excepted)
    for (let i = 0; i < shownAt.length; ) {
      let j = i;
      while (j < shownAt.length && shownAt[j] === shownAt[i]) j++;
      if (shownAt[i] && j < shownAt.length && (j - i) * SAMPLE < MIN_SHOWN) shownAt.fill(false, i, j);
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
    heightOf = Math.max(h, ...pts.map((p) => p[1] + 4));
    spine.setAttribute("viewBox", `0 0 ${w} ${heightOf}`);
    spine.style.height = `${heightOf}px`;
    line.setAttribute("d", routePath(pts));
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
  const state = { p: 0 };
  let handedOff = false;

  /**
   * Her pose at arc length sArc: box anchor P placed at world point A, scale k,
   * mirrored by `face`, turned `rot`° about P. Running: she stands on the line
   * (the feet), in small bounds; dropping down the margin or the lane:
   * centred on it.
   */
  function poseAt(sArc: number): Matrix {
    const L = route.length;
    const pt = route.point(sArc);
    const vertical = smooth(clamp01((Math.abs(pt.dy) - 0.7) / 0.25));
    const P: Pt = [113, 146.7 - 28.7 * vertical];
    const kMark = markPose?.k ?? kRun;
    const arrive = markPose ? smooth(clamp01(1 - (L - sArc) / ARRIVE)) : 0;
    const leave = smooth(clamp01(sArc / LEAVE));
    let k = kRun;
    let face = facing[Math.min(facing.length - 1, Math.round(sArc / SAMPLE))] ?? 1;
    const bound = (1 - vertical) * Math.abs(Math.sin((Math.PI * sArc) / (LEAP_BOX.width * k * 1.4))) * 16 * k;
    let A: Pt = [pt.x, pt.y - bound];
    let rot = 0;
    if (markPose) {
      // the last stretch: she turns (a pirouette: the mirror passes through 0)
      // and settles exactly on the mark's first frame, pitched like its flier
      const end: Pt = [markPose.x + 114 * markPose.k, markPose.y + 146.7 * markPose.k];
      A = [A[0] + (end[0] - A[0]) * arrive, A[1] + (end[1] - A[1]) * arrive];
      k += (kMark - k) * arrive;
      face += (1 - face) * arrive;
      rot = MARK.pitch * arrive;
    }
    if (leave < 1) {
      // leaving: from the landed silhouette (same place, same size) onto the route
      const from: Pt = [start.x + P[0] * start.k, start.y + P[1] * start.k];
      A = [from[0] + (A[0] - from[0]) * leave, from[1] + (A[1] - from[1]) * leave];
      k = start.k + (k - start.k) * leave;
      face = 1 + (face - 1) * leave;
    }
    const c = Math.cos((rot * Math.PI) / 180);
    const sn = Math.sin((rot * Math.PI) / 180);
    const a = c * k * face;
    const b = sn * k * face;
    const cc = -sn * k;
    const d = c * k;
    return [a, b, cc, d, A[0] - (a * P[0] + cc * P[1]), A[1] - (b * P[0] + d * P[1])];
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

  function draw() {
    const p = state.p;
    line.style.strokeDashoffset = String(r3(1 - p));
    // after the hand-off the line has done its job: it fades out, and is back as soon as she is scrubbed back
    if (handedOff) spine.toggleAttribute("data-handed", p >= 0.98);
    const L = route.length;
    if (!L) return;
    const sArc = p * L;
    const m = `matrix(${poseAt(sArc).map(r3).join(" ")})`;
    xMoves.forEach((g) => g.setAttribute("transform", m));
    const shown = !handedOff && sArc >= 0.5 && shownAt[Math.min(shownAt.length - 1, Math.round(sArc / SAMPLE))];
    xs.forEach((g) => (g.style.opacity = shown ? String(EXPOSURE_OPACITY) : "0"));
    // wide rooms: the wall-to-wall floor gives way to the spine — its run past the corner retracts
    // as she sets off, so the line turns down at the floor's end (no T-junction)
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
  const heroShare = () => (route.length ? heroLen / route.length : 1);
  // Pinned: the plate stays whole while she runs the hero's stretch of the spine.
  const pinned = gsap
    .timeline({ defaults: { ease: "none" }, onUpdate: draw })
    .fromTo(state, { p: 0 }, { p: () => heroShare(), duration: 1, immediateRender: false }, 0);
  // Released: she runs on with the page to the next title and hands over when it is in the reading zone.
  const onward = gsap
    .timeline({ defaults: { ease: "none" }, onUpdate: draw, onComplete: handoff })
    .fromTo(state, { p: () => heroShare() }, { p: 1, duration: 1, immediateRender: false });

  layout();
  ScrollTrigger.addEventListener("refreshInit", layout);

  // A hero taller than the viewport pins when its bottom reaches the viewport bottom.
  const tall = () => section.offsetHeight > window.innerHeight + 1;
  const pin = ScrollTrigger.create({
    trigger: section,
    start: () => (tall() ? "bottom bottom" : "top top"),
    end: "+=50%",
    pin: true,
    scrub: 0.5,
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
        scrub: 0.5,
        animation: onward,
        invalidateOnRefresh: true,
      })
    : null;
  ScrollTrigger.refresh();

  return () => {
    ScrollTrigger.removeEventListener("refreshInit", layout);
    run?.kill();
    pin.kill(true);
    spine.remove();
    floor.style.clipPath = "";
    section.classList.remove("hero--spine");
  };
}
