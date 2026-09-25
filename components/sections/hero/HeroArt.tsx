import { GHOST_COLOR, GHOST_OPACITY, LEAP_BOX } from "./constants";
import type { ArtVariant } from "./geometry";

const { width: W, height: H } = LEAP_BOX;

/**
 * One art variant, in logo units: compact (the high leap — phones, portrait
 * tablets, portrait touch ≥ 1024 px) or wide (the long, low leap — landscape
 * ≥ 640 px, or ≥ 1024 px with a fine pointer). CSS shows one (hero.css).
 * Static state = the FINAL composition: 6 ghost frames along the parabola,
 * the wordmark fully revealed and the white silhouette landed in the logo.
 * Everything is a <use> of the #leap / #wordmark sprite symbols.
 *
 * Every silhouette carries an invisible 230 × 150 box so its bbox (what
 * MotionPathPlugin aligns with alignOrigin [.5, .6]) is exactly the symbol box.
 */
export function HeroArt({ variant, name }: { variant: ArtVariant; name: "compact" | "wide" }) {
  const [lx, ly] = variant.logo;
  const [fx, fy] = variant.landed;
  return (
    <svg
      className={`hero-art hero-art--${name}`}
      viewBox={`0 0 ${variant.width} ${variant.height}`}
      data-hero-variant={name}
      aria-hidden="true"
      focusable="false"
    >
      <path className="hero-art__path" d={variant.d} data-hero-path="" />
      <g className="hero-art__ticks">
        {variant.ghostPoints.map(([x], i) => (
          <line
            key={i}
            x1={x}
            x2={x}
            y1={variant.height}
            y2={variant.height - (name === "wide" ? 9 : 16)}
            data-hero-tick=""
            style={{ opacity: GHOST_OPACITY[i]! * 2.4 }}
          />
        ))}
      </g>
      <g className="hero-art__ghosts">
        {variant.ghosts.map(([x, y], i) => (
          <g
            key={i}
            transform={`translate(${x} ${y})`}
            data-hero-ghost=""
            style={{ color: GHOST_COLOR[i], opacity: GHOST_OPACITY[i] }}
          >
            <rect width={W} height={H} fill="none" />
            <use href="#leap" width={W} height={H} />
          </g>
        ))}
      </g>
      <use className="hero-art__wordmark" href="#wordmark" x={lx} y={ly} width={490} height={213} data-hero-wordmark="" />
      <g className="hero-art__leap" transform={`translate(${fx} ${fy})`} data-hero-leap="">
        <rect className="hero-art__hit" width={W} height={H} fill="none" data-hero-leap-hit="" />
        <use href="#leap" width={W} height={H} />
      </g>
    </svg>
  );
}
