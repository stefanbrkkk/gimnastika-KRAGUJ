/**
 * The share image's art (app/og.png): a still of the hero's final composition,
 * drawn by the same floor pass (pass.ts) — the rigged ghost frames, the frame
 * marks, the halftone behind the landing, the logo — as one self-contained SVG
 * string (no sprite references: the rasteriser sees only this document).
 * Build-time only; nothing here ships to the browser.
 */
import { LEAP_PATH, WORDMARK_PATH } from "@/components/brand/sprite-paths.generated";
import { ART, OG_SIZE } from "@/components/seo/art";
import { COMPACT_PASS, HIP_BACK, HIP_FRONT, RIG, buildPass, type PassSpec } from "./pass";

/** px per art unit: the art is 1000 × 525 units = 1200 × 630 px, the mat at y = 420 (504 px). */
const OG_SCALE = 1.2;

/**
 * The high pass of the phones' plate, laid on the share image's wider floor:
 * the logo right of centre, the pass arcing in from the left over the „K“.
 */
export const OG_PASS: PassSpec = {
  ...COMPACT_PASS,
  width: OG_SIZE.width / OG_SCALE,
  mat: 420,
  logo: [OG_SIZE.width / OG_SCALE - 490 - 44, 420 - 196],
  enterX: 150,
  depth: [0.54, 0.62],
  // a lower arc: the raised hands stay clear of the eyebrow at the top of the card
  lift: 185,
  // the share image keeps its six frames (the phones' plate has five)
  ghosts: [0.05, 0.252, 0.372, 0.527, 0.723, 0.893],
};

/** Ghost opacities: the hero's .10 → .28 ramp, lifted to survive a phone thumbnail. */
const OG_GHOST_OPACITY = [0.16, 0.2, 0.25, 0.3, 0.36, 0.42] as const;

const round = (v: number) => Math.round(v * 1000) / 1000;
/** LEAP_PATH is drawn in logo coordinates; the rig works in its 230 × 150 box. */
const leap = (fill: string) => `<path transform="translate(-262 -48)" fill="${fill}" fill-rule="evenodd" d="${LEAP_PATH}"/>`;

function gymnast(fill: string, back = "", front = ""): string {
  const joints = RIG.joints.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`).join("");
  return (
    `<g clip-path="url(#og-torso)">${leap(fill)}</g>${joints}` +
    `<g transform="${back}"><g clip-path="url(#og-back)">${leap(fill)}</g></g>` +
    `<g transform="${front}"><g clip-path="url(#og-front)">${leap(fill)}</g></g>`
  );
}

export function ogPlateSvg(): string {
  const v = buildPass(OG_PASS);
  const [lx, ly] = v.logo;
  const [fx, fy] = v.landed;
  const unitsH = OG_SIZE.height / OG_SCALE;
  const defs =
    `<defs>` +
    `<clipPath id="og-torso"><path clip-rule="evenodd" d="${RIG.torso}"/></clipPath>` +
    `<clipPath id="og-back"><path d="${RIG.back}"/></clipPath>` +
    `<clipPath id="og-front"><path d="${RIG.front}"/></clipPath>` +
    // the club banner's halftone, behind the landing only
    `<pattern id="og-dots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1.3" fill="${ART.steel300}"/></pattern>` +
    `<radialGradient id="og-fade" cx="${round(fx + 112)}" cy="${OG_PASS.mat}" r="330" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".55" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<mask id="og-dot-mask"><rect width="${OG_PASS.width}" height="${OG_PASS.mat}" fill="url(#og-fade)"/></mask>` +
    `</defs>`;
  const dots = `<rect width="${OG_PASS.width}" height="${OG_PASS.mat}" fill="url(#og-dots)" opacity=".42" mask="url(#og-dot-mask)"/>`;
  const ticks = v.ghosts
    .map((g, i) => `<line x1="${g.x}" x2="${g.x}" y1="${v.height}" y2="${v.height - 14}" stroke="${ART.steel300}" stroke-width="1.6" opacity="${Math.min(1, OG_GHOST_OPACITY[i]! * 2)}"/>`)
    .join("");
  const ghosts = v.ghosts.map((g, i) => `<g transform="${g.transform}" opacity="${OG_GHOST_OPACITY[i]}">${gymnast(ART.ghosts[i]!, g.back, g.front)}</g>`).join("");
  const body = [
    `<rect width="${OG_PASS.width}" height="${unitsH}" fill="${ART.navy900}"/>`,
    dots,
    // the mat line (steel-300 at 60 %), wall to wall
    `<line x1="0" x2="${OG_PASS.width}" y1="${v.height}" y2="${v.height}" stroke="${ART.steel300}" stroke-width="1.6" opacity=".6"/>`,
    ticks,
    ghosts,
    `<g transform="translate(${lx} ${ly})"><path fill="${ART.white}" fill-rule="evenodd" d="${WORDMARK_PATH}"/></g>`,
    `<g transform="translate(${fx} ${fy})">${gymnast(ART.white, `rotate(0 ${HIP_BACK[0]} ${HIP_BACK[1]})`, `rotate(0 ${HIP_FRONT[0]} ${HIP_FRONT[1]})`)}</g>`,
  ].join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_SIZE.width}" height="${OG_SIZE.height}" viewBox="0 0 ${OG_PASS.width} ${unitsH}">${defs}${body}</svg>`;
}
