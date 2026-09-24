/**
 * Build-time art for the share image, the favicon/app icons and the raster logo.
 * Pure SVG strings from the same sprite paths as the site (no new drawing), so
 * the icons and the OG image always match the logo. Rasterised by
 * app/og.png/route.tsx and app/icons/[file]/route.tsx (next/og ImageResponse).
 */
import { LEAP_PATH, WORDMARK_PATH } from "@/components/brand/sprite-paths.generated";
import { buildVariant, type VariantSpec } from "@/components/sections/hero/geometry";

/** Palette (§3) as literal hex — the rasteriser cannot resolve CSS variables. */
export const ART = {
  navy950: "#0a1a38",
  navy900: "#112d5f",
  steel300: "#8da9c6",
  ice50: "#eef3fa",
  chalk: "#f6f8fc",
  white: "#ffffff",
  /** Ghost fills step through the leotard gradient: #cfe6ff → #c9b8ff → #8e78f0. */
  ghosts: ["#cfe6ff", "#cfe6ff", "#c9b8ff", "#c9b8ff", "#8e78f0", "#8e78f0"],
} as const;

/** The silhouette symbol box inside the logo (viewBox 0 0 490 213). */
const LEAP_BOX = { x: 262, y: 48, width: 230, height: 150 } as const;
/** Measured ink bounds of the silhouette (logo units) — for optical centring in icons. */
export const LEAP_INK = { x: 264, y: 50.2, width: 224.1, height: 144.6 } as const;

const leap = (fill: string, extra = "") => `<path fill="${fill}" fill-rule="evenodd"${extra} d="${LEAP_PATH}"/>`;
const wordmark = (fill: string) => `<path fill="${fill}" fill-rule="evenodd" d="${WORDMARK_PATH}"/>`;
const svgDoc = (w: number, h: number, body: string, viewBox = `0 0 ${w} ${h}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">${body}</svg>`;

export const svgDataUri = (svg: string): string => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

// ---------------------------------------------------------------------------
// Share image (1200 × 630): navy, the white logo, ghost frames of the leap.
// A still of the hero's final composition, drawn with the hero's own geometry.
// ---------------------------------------------------------------------------

export const OG_SIZE = { width: 1200, height: 630 } as const;
/** px per logo unit. */
const OG_SCALE = 1.2;

/** Art in logo units: 1000 × 525 units = 1200 × 630 px. The mat line is at y = 420 (504 px). */
export const OG_SPEC: VariantSpec = {
  width: OG_SIZE.width / OG_SCALE,
  mat: 420,
  logo: [OG_SIZE.width / OG_SCALE - 490 - 44, 420 - 196],
  takeoffX: 34,
  apexY: 178,
};

/** Ghost opacities: the hero's .10 → .28 ramp, lifted for a thumbnail on a phone. */
const OG_GHOST_OPACITY = [0.16, 0.2, 0.25, 0.3, 0.36, 0.42] as const;

export function ogArtSvg(): string {
  const v = buildVariant(OG_SPEC);
  const [lx, ly] = v.logo;
  const [fx, fy] = v.landed;
  const unitsH = OG_SIZE.height / OG_SCALE;
  // LEAP_PATH is in logo coordinates: a box top-left (x, y) = translate(x − 262, y − 48).
  const ghosts = v.ghosts
    .map(([x, y], i) => `<g transform="translate(${round(x - LEAP_BOX.x)} ${round(y - LEAP_BOX.y)})" opacity="${OG_GHOST_OPACITY[i]}">${leap(ART.ghosts[i]!)}</g>`)
    .join("");
  const ticks = v.ghostPoints
    .map(([x], i) => `<line x1="${x}" x2="${x}" y1="${v.height}" y2="${v.height - 12}" stroke="${ART.steel300}" stroke-width="1.6" opacity="${Math.min(1, OG_GHOST_OPACITY[i]! * 2)}"/>`)
    .join("");
  const body = [
    `<rect width="${OG_SPEC.width}" height="${unitsH}" fill="${ART.navy900}"/>`,
    // the flight path, very faint, and the mat line (steel-300 at 60%)
    `<path d="${v.d}" fill="none" stroke="${ART.steel300}" stroke-width="1.2" stroke-dasharray="2 7" stroke-linecap="round" opacity=".45"/>`,
    `<line x1="0" x2="${OG_SPEC.width}" y1="${v.height}" y2="${v.height}" stroke="${ART.steel300}" stroke-width="1.6" opacity=".6"/>`,
    ticks,
    ghosts,
    `<g transform="translate(${lx} ${ly})">${wordmark(ART.white)}</g>`,
    `<g transform="translate(${fx - LEAP_BOX.x} ${fy - LEAP_BOX.y})">${leap(ART.white)}</g>`,
  ].join("");
  return svgDoc(OG_SIZE.width, OG_SIZE.height, body, `0 0 ${OG_SPEC.width} ${unitsH}`);
}

// ---------------------------------------------------------------------------
// Icons: the silhouette alone. Navy on chalk (light) / white on navy (dark).
// ---------------------------------------------------------------------------

interface IconOptions {
  size: number;
  /** Ink width as a share of the icon size. */
  fill: number;
  fg: string;
  bg?: string;
  /** Corner radius as a share of the size (0 = full bleed square). */
  radius?: number;
}

/** Silhouette optically centred in a square, ink width = fill × size. */
function placeLeap(size: number, fill: number): string {
  const k = (fill * size) / LEAP_INK.width;
  const tx = (size - LEAP_INK.width * k) / 2 - LEAP_INK.x * k;
  // a hair above centre: the raised arms read lighter than the legs
  const ty = (size - LEAP_INK.height * k) / 2 - LEAP_INK.y * k - size * 0.01;
  return `translate(${round(tx)} ${round(ty)}) scale(${round(k, 5)})`;
}

const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

export function iconSvg({ size, fill, fg, bg, radius = 0 }: IconOptions): string {
  const r = round(radius * size);
  const back = bg ? `<rect width="${size}" height="${size}" rx="${r}" fill="${bg}"/>` : "";
  return svgDoc(size, size, `${back}<g transform="${placeLeap(size, fill)}">${leap(fg)}</g>`);
}

/**
 * The SVG favicon follows the browser's colour scheme: navy silhouette on light
 * tab strips, ice-50 on dark ones. Transparent, so the silhouette can be large.
 */
export function faviconSvg(): string {
  const size = 64;
  const style = `<style>path{fill:${ART.navy900}}@media (prefers-color-scheme:dark){path{fill:${ART.ice50}}}</style>`;
  return svgDoc(size, size, `${style}<g transform="${placeLeap(size, 0.98)}">${leap(ART.navy900)}</g>`);
}

/** Full logo, navy on transparent (JSON-LD `logo`; Google shows it on white). */
export function logoSvg(width = 980): string {
  const height = Math.round((width * 213) / 490);
  return svgDoc(width, height, `${wordmark(ART.navy900)}${leap(ART.navy900)}`, "0 0 490 213");
}

export interface IconSpec {
  /** File name under /icons/. */
  file: string;
  width: number;
  height: number;
  svg: () => string;
}

/** Every raster/vector icon generated at build (see lib/seo.ts ICON_FILES). */
export const ICON_SPECS: readonly IconSpec[] = [
  { file: "icon.svg", width: 64, height: 64, svg: faviconSvg },
  // browsers without SVG favicons (Safari): white on a navy rounded square
  { file: "icon-32.png", width: 32, height: 32, svg: () => iconSvg({ size: 32, fill: 0.9, fg: ART.white, bg: ART.navy900, radius: 0.2 }) },
  // iOS masks the corners itself and needs an opaque square
  { file: "apple-touch-icon.png", width: 180, height: 180, svg: () => iconSvg({ size: 180, fill: 0.74, fg: ART.white, bg: ART.navy900 }) },
  { file: "icon-192.png", width: 192, height: 192, svg: () => iconSvg({ size: 192, fill: 0.74, fg: ART.white, bg: ART.navy900 }) },
  { file: "icon-512.png", width: 512, height: 512, svg: () => iconSvg({ size: 512, fill: 0.74, fg: ART.white, bg: ART.navy900 }) },
  // maskable: the ink stays inside the 80 % safe circle
  { file: "icon-maskable-512.png", width: 512, height: 512, svg: () => iconSvg({ size: 512, fill: 0.6, fg: ART.white, bg: ART.navy900 }) },
  { file: "logo.png", width: 980, height: 426, svg: () => logoSvg(980) },
];
