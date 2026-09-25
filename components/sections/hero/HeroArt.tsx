import { GHOST_COLOR, GHOST_OPACITY, LEAP_BOX } from "./constants";
import { CHALK, RIG_CLIP, type PassVariant } from "./pass";

const { width: W, height: H } = LEAP_BOX;

/**
 * The gymnast: the logo's silhouette as three clipped copies of #leap — torso,
 * back leg, front leg (pass.ts, "The rig"). `back`/`front` turn the legs about
 * their hip joints; without them the three parts are the logo, exactly.
 */
function Gymnast({ rig, back, front }: { rig: string; back?: string; front?: string }) {
  return (
    <>
      <use href="#leap" width={W} height={H} clipPath={`url(#${rig}-torso)`} />
      <use href="#leap" width={W} height={H} clipPath={`url(#${rig}-back)`} transform={back} data-hero-leg="back" />
      <use href="#leap" width={W} height={H} clipPath={`url(#${rig}-front)`} transform={front} data-hero-leg="front" />
    </>
  );
}

/**
 * One art variant, in logo units: compact (the high pass — phones, portrait
 * tablets, portrait touch ≥ 1024 px) or wide (the long pass — landscape
 * ≥ 640 px, or ≥ 1024 px with a fine pointer). CSS shows one (hero.css).
 *
 * Static state = the FINAL composition, a chronophotograph of the floor pass:
 * six ghost frames (the running bounds, the takeoff, the legs opening to the
 * split on the rise and at the apex), each the gymnast at one shutter time
 * (pass.ts), a frame mark on the mat under each, the wordmark, and the
 * gymnast landed in the logo. The chalk puff is hidden at rest.
 *
 * Every silhouette carries an invisible 230 × 150 box (the landed one is the
 * easter egg's tap target).
 */
export function HeroArt({ variant, name }: { variant: PassVariant; name: "compact" | "wide" }) {
  const [lx, ly] = variant.logo;
  const [fx, fy] = variant.landed;
  const [tx, ty] = variant.touchdown;
  const rig = `hero-rig-${name}`;
  return (
    <svg
      className={`hero-art hero-art--${name}`}
      viewBox={`0 0 ${variant.width} ${variant.height}`}
      data-hero-variant={name}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={`${rig}-torso`}>
          <path d={RIG_CLIP.torso} />
          {RIG_CLIP.torsoDiscs.map(([cx, cy, r]) => (
            <circle key={cx} cx={cx} cy={cy} r={r} />
          ))}
        </clipPath>
        <clipPath id={`${rig}-back`}>
          <path d={RIG_CLIP.back} />
        </clipPath>
        <clipPath id={`${rig}-front`}>
          <path d={RIG_CLIP.front} />
        </clipPath>
      </defs>
      <g className="hero-art__ticks">
        {variant.ghosts.map((g, i) => (
          <line
            key={i}
            x1={g.x}
            x2={g.x}
            y1={variant.height}
            y2={variant.height - (name === "wide" ? 9 : 16)}
            data-hero-tick=""
            style={{ opacity: GHOST_OPACITY[i]! * 2.4 }}
          />
        ))}
      </g>
      <g className="hero-art__ghosts">
        {variant.ghosts.map((g, i) => (
          <g key={i} transform={g.transform} data-hero-ghost="" style={{ color: GHOST_COLOR[i], opacity: GHOST_OPACITY[i] }}>
            <rect width={W} height={H} fill="none" />
            <Gymnast rig={rig} back={g.back} front={g.front} />
          </g>
        ))}
      </g>
      <use className="hero-art__wordmark" href="#wordmark" x={lx} y={ly} width={490} height={213} data-hero-wordmark="" />
      <g className="hero-art__leap" transform={`translate(${fx} ${fy})`} data-hero-leap="">
        <rect className="hero-art__hit" width={W} height={H} fill="none" data-hero-leap-hit="" />
        <Gymnast rig={rig} />
      </g>
      <g className="hero-art__chalk" data-hero-chalk="">
        {CHALK.map(([, , size], i) => (
          <circle key={i} cx={tx} cy={ty} r={variant.spec.chalkR * size} />
        ))}
      </g>
    </svg>
  );
}
