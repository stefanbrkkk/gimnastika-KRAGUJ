/**
 * The desktop scrub (loaded with ScrollTrigger after the intro, on (min-width:
 * 1024px) and (pointer:fine) only — never part of the initial animation chunk).
 * See pinHero().
 */
import { gsap } from "@/lib/motion";
import type { loadScrollTrigger } from "@/lib/motion";
import { LEAP_BOX } from "./constants";
import type { Pt } from "./pass";
import { measure, roundRoute, routePath, spineRoute, type SpineRect } from "./spine";

type ScrollTriggerStatic = Awaited<ReturnType<typeof loadScrollTrigger>>;

const SVG_NS = "http://www.w3.org/2000/svg";
const q = <T extends Element>(root: ParentNode, sel: string) => root.querySelector<T>(sel);
const qa = <T extends Element>(root: ParentNode, sel: string) => Array.from(root.querySelectorAll<T>(sel));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const smooth = (s: number) => s * s * (3 - 2 * s);

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

/**
 * Pins the hero for 80% of a viewport of scroll and gives the scrub a purpose:
 * while the ghost frames fade oldest-first (afterimages), a second exposure
 * of the landed gymnast — a clone of #leap, never the logo's own silhouette,
 * which stays to cover the wordmark's „j“ — leaves the logo and runs down the
 * floor diagonal (the spine) that grows under her feet: along the right
 * margin, under the aside, out of the hero, level across the band above the
 * next section and down beside its title to the title's mark. The pin keeps
 * the hero still for the first stretch; the journey runs on with the page
 * until the mark is in the reading zone, where she turns and hands over
 * ("kraguj:handoff"): the mark's own landing (data-landing + data-landed)
 * carries her the rest of the way. The spine is 2 px steel-300 at .8 and never
 * crosses text; everything is recomputed on refreshInit.
 */
export function pinHero(ScrollTrigger: ScrollTriggerStatic, section: HTMLElement, decor: HTMLElement, art: SVGSVGElement | undefined): () => void {
  const matSvg = q<SVGSVGElement>(decor, ".hero-mat");
  const leap = art && q<SVGGElement>(art, "[data-hero-leap]");
  if (!art || !matSvg || !leap) return () => {};
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
  let heroLen = 0;
  let start = { x: 0, y: 0, k: 1 };
  let laneK = 1;
  let markPose: { x: number; y: number; k: number } | null = null;
  /** The mark's top in hero coordinates, as it sits after the pin (unstuck). */
  let markTop = 0;
  let heightOf = 0;

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

    // where she starts: the landed silhouette (art units → section px)
    const ctm = art.getScreenCTM();
    const lt = leap.transform.baseVal.consolidate()?.matrix;
    const artK = ctm ? Math.hypot(ctm.a, ctm.b) : 1;
    if (ctm && lt) start = { x: ctm.a * lt.e + ctm.c * lt.f + ctm.e - s.left, y: ctm.b * lt.e + ctm.d * lt.f + ctm.f - s.top, k: artK };
    // the right margin fits a figure this wide (px), with 4 px of air each side
    laneK = Math.max(0.12, (2 * Math.min(turn - containerRight, w - turn) - 8) / LEAP_BOX.width);

    // the next section's title mark, where the journey ends
    let next;
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
      const toS = (r: SpineRect): SpineRect => ({ left: r.left, right: r.right, top: r.top + dy + uy, bottom: r.bottom + dy + uy });
      const heading = mark.closest("header, h2") ?? mark;
      const others = [...textBoxes(nextSection, s, 12, heading), ...paintedBoxes(nextSection, s, heading)].map((r) => ({ ...r, top: r.top + dy, bottom: r.bottom + dy }));
      const titleLines = textBoxes(heading, s, 0).map(toS);
      const contentTop = Math.min(my, ...titleLines.map((r) => r.top), ...others.map((r) => r.top));
      const floorY = h + Math.max(20, Math.min(72, (contentTop - h) / 2));
      const markRight = mx + mr.width;
      // the lane beside the title: right of the mark, left of whatever comes next on that level
      const baseline = my + mr.height * (206 / 208);
      const beside = others.filter((r) => r.left >= markRight - 1 && r.top < baseline && r.bottom > floorY);
      const wall = Math.min(markRight + 80, ...beside.map((r) => r.left));
      const dropX = markRight + Math.max(6, Math.min(32, (wall - markRight) / 2));
      markPose = { x: mx + MARK.first[0] * k, y: my + MARK.first[1] * k, k };
      markTop = my;
      next = { floorY, dropX, end: [markPose.x + 222.7 * k, baseline] as Pt };
    }
    const obstacles = textBoxes(section, s, 16);
    // corners rounded by 14 px (the obstacles keep 16 px of air, so the arcs never reach text)
    const pts = roundRoute(spineRoute({ matY, matEnd: containerRight, turn, bottom: h, left, obstacles, next }), 14);
    route = measure(pts);
    // which way she faces along the route (mirrored going left; a drop keeps the last way), eased
    // over ±24 px around a change — a turn, not a flip
    const going: number[] = [];
    let way = 1;
    for (let s1 = 0; s1 <= route.length; s1 += 4) {
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
  const LEAVE = 170; // px of route over which she leaves the logo
  const ARRIVE = 70; // px over which she turns and settles onto the mark's first frame

  function draw() {
    const p = state.p;
    line.style.strokeDashoffset = String(r3(1 - p));
    const L = route.length;
    if (!L) return;
    const sArc = p * L;
    const pt = route.point(sArc);
    // Pose = box anchor P (box units) placed at world point A, scale k,
    // mirrored by `face`, turned `rot`° about P.
    // Running: she stands on the line (the feet), in small bounds; dropping
    // down the margin or the lane: centred on it.
    const vertical = smooth(clamp01((Math.abs(pt.dy) - 0.7) / 0.25));
    const P: Pt = [113, 146.7 - 28.7 * vertical];
    const kMark = markPose?.k ?? laneK;
    const kRun = Math.min(laneK, kMark);
    const arrive = markPose ? smooth(clamp01(1 - (L - sArc) / ARRIVE)) : 0;
    const leave = smooth(clamp01(sArc / LEAVE));
    let k = kRun;
    let face = facing[Math.min(facing.length - 1, Math.round(sArc / 4))]!;
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
    const m = `matrix(${[a, b, cc, d, A[0] - (a * P[0] + cc * P[1]), A[1] - (b * P[0] + d * P[1])].map(r3).join(" ")})`;
    xMoves.forEach((g) => g.setAttribute("transform", m));
    const shown = handedOff || sArc < 0.5 ? 0 : EXPOSURE_OPACITY;
    xs.forEach((g) => (g.style.opacity = String(shown)));
  }

  // ---- Hand-off: the mark lands; she stays with it ----
  const handoff = () => {
    if (handedOff) return;
    handedOff = true;
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
  const ghosts = qa<SVGGElement>(art, "[data-hero-ghost]");
  const ticks = qa<SVGLineElement>(art, "[data-hero-tick]");
  const heroShare = () => (route.length ? heroLen / route.length : 1);
  // Pinned: oldest frames decay first, like afterimages, while she runs the hero's stretch of the spine.
  const pinned = gsap
    .timeline({ defaults: { ease: "none" }, onUpdate: draw })
    .to(ghosts, { opacity: 0, duration: 0.2, stagger: 0.09 }, 0)
    .to(ticks, { opacity: 0, duration: 0.2, stagger: 0.09 }, 0)
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
    end: "+=80%",
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
    section.classList.remove("hero--spine");
  };
}
