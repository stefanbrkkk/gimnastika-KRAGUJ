import type { ReactNode } from "react";
import { Picture, isPhotoVisible } from "@/components/ui/Picture";
import { QuietBoundary } from "@/components/ui/QuietBoundary";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SourceLink } from "@/components/ui/SourceLink";
import { COACHES, COACHES_COPY, type Coach } from "@/content/copy";
import { PHOTOS } from "@/content/photos";
import { LEAP_VIEWBOX } from "@/components/brand/sprite-paths.generated";
import { typesetSr } from "@/lib/typeset";
import { BrushStroke } from "./BrushStroke";
import { CoachesMotion } from "./CoachesMotion";
import { LicenceStamp } from "./LicenceStamp";

/** Portrait box aspect (w/h). Photo 06 is 1170×1426 (0.82) — 4:5 crops almost nothing. */
const PORTRAIT_ASPECT = 4 / 5;
/** Photo 05 (1200×1600): a 3:2 crop under the cards (<1024 px); on desktop the print fills
 *  the column beside the cards (coaches.css). BrushStroke maps its loop onto both crops. */
const TEAM_PHOTO = "05" as const;
const TEAM_ASPECT = 3 / 2;

/** The plate's space (4:5, like the portraits) and one exposure of the leap in it. */
const PLATE = { w: 100, h: 125 } as const;
const EXPOSURE_W = 34;
const EXPOSURE_H = (EXPOSURE_W * LEAP_VIEWBOX.height) / LEAP_VIEWBOX.width;
/** The mat line the leap takes off from and sticks on. */
const MAT_Y = 86;
/** Four exposures of one leap on a parabola (take-off → flight → landing); the last is solid. */
const EXPOSURES = [
  { x: 3, y: MAT_Y - EXPOSURE_H - 3.5, ghost: 1 },
  { x: 22, y: 42, ghost: 2 },
  { x: 42, y: 39, ghost: 3 },
  { x: 62, y: MAT_Y - EXPOSURE_H, ghost: 0 },
] as const;

/**
 * No portrait of Slađana Kovačević exists yet: her frame is a Marey plate instead of an empty
 * slot — four exposures of the club's leaping gymnast across the navy plate, from take-off
 * to a stuck landing on the mat line (a small reprise of the hero; she is also the club's
 * licensed judge). Marked only with its frame code (the empty slot of excluded photo 07) —
 * no promise in the UI. The plate carries the dark theme, so the ghosts use the shared
 * dark-section steps (--ghost-1/2/3). Purely decorative, hidden from assistive tech (the name
 * and roles carry the card). coaches-motion.ts exposes the frames one after another.
 * TODO(klub): request a portrait in club kit (dosije §7, item 7) → then set photoId in content/copy.ts.
 */
function PortraitPending() {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return (
    <div className="frame coach__frame" aria-hidden="true">
      <div className="photo photo-placeholder coach__plate" data-theme="dark" style={{ aspectRatio: String(PORTRAIT_ASPECT) }} data-coach-plate="">
        <svg viewBox={`0 0 ${PLATE.w} ${PLATE.h}`} className="coach__plate-art" focusable="false">
          <line className="coach__plate-mat" x1="4" y1={MAT_Y} x2="96" y2={MAT_Y} />
          {EXPOSURES.map((e) => (
            <line key={`tick-${e.x}`} className="coach__plate-tick" x1={r1(e.x + EXPOSURE_W / 2)} y1={MAT_Y + 1.5} x2={r1(e.x + EXPOSURE_W / 2)} y2={MAT_Y + 4.5} />
          ))}
          {EXPOSURES.map((e) => (
            <use
              key={`leap-${e.x}`}
              href="#leap"
              x={r1(e.x)}
              y={r1(e.y)}
              width={EXPOSURE_W}
              height={r1(EXPOSURE_H)}
              className={e.ghost ? `coach__plate-ghost coach__plate-ghost--${e.ghost}` : "coach__plate-solid"}
              {...(e.ghost ? { "data-plate-ghost": "" } : { "data-plate-solid": "" })}
            />
          ))}
        </svg>
      </div>
      <div className="frame-foot">
        <span className="frame-label">{COACHES_COPY.portraitFrame}</span>
      </div>
    </div>
  );
}

/**
 * A role line. Its „izvor ↗“ sits below it on phones and tablets and inline after it on
 * desktop; the last word and the link are bound together, so the link never starts a line
 * on its own (coaches.css).
 */
function RoleText({ text, source }: { text: string; source: ReactNode }) {
  // The last two words never part („… gimnastiku (GSS)“): no lone „(GSS)“ on a line.
  const t = typesetSr(text).replace(/ (\S+)$/, "\u00a0$1");
  const cut = source ? t.lastIndexOf(" ") + 1 : t.length;
  return (
    <span className="coach__role-text">
      {t.slice(0, cut)}
      {source ? (
        <span className="coach__role-tail">
          {t.slice(cut)}
          {source}
        </span>
      ) : null}
    </span>
  );
}

function CoachCard({ coach, index }: { coach: Coach; index: number }) {
  const nameId = `trenerica-${index + 1}`;
  return (
    <li className="coach" data-coach="">
      <article className="coach__inner" aria-labelledby={nameId}>
        <div className="coach__media">
          <div className="coach__portrait" data-coach-portrait="">
            {coach.photoId ? (
              <Picture
                id={coach.photoId}
                frame
                aspect={PORTRAIT_ASPECT}
                position="50% 30%"
                className="coach__frame"
                sizes="(min-width: 640px) 224px, 132px"
              />
            ) : (
              <PortraitPending />
            )}
          </div>
          <LicenceStamp uid={`${index + 1}`} label={COACHES_COPY.badge} />
        </div>

        <div className="coach__body">
          <h3 id={nameId} className="coach__name text-h3">
            {typesetSr(coach.name)}
          </h3>
          <ul className="coach__roles" role="list">
            {coach.roles.map((role) => (
              <li key={role.text} className="coach__role">
                <RoleText
                  text={role.text}
                  source={
                    // Licence lines link their ✅ GSS list (docs/dosije.md §3) — never the licence number or category.
                    role.sourceUrl ? (
                      <SourceLink href={role.sourceUrl} context={`${coach.name} — ${role.text}`} className="coach__source" />
                    ) : null
                  }
                />
              </li>
            ))}
          </ul>
          {/* `bio` stays empty until the club writes one — never invented. */}
          {coach.bio ? <p className="coach__bio measure">{typesetSr(coach.bio)}</p> : null}
        </div>
      </article>
    </li>
  );
}

/**
 * Photo 05 as the „Na takmičenju“ print. The frame is built here (not by Picture's
 * `frame`) so the brush overlay can sit exactly on the photo box at every crop.
 */
function TeamPrint() {
  if (!isPhotoVisible(TEAM_PHOTO)) return null;
  return (
    <figure className="frame coaches-team" data-coaches-team="">
      <div className="coaches-team__shot">
        <Picture
          id={TEAM_PHOTO}
          aspect={TEAM_ASPECT}
          className="coaches-team__photo"
          sizes="(min-width: 1024px) 524px, (min-width: 640px) 600px, calc(100vw - 52px)"
        />
        <BrushStroke />
      </div>
      <div className="frame-foot">
        <span className="frame-label" aria-hidden="true">
          {PHOTOS[TEAM_PHOTO].frame}
        </span>
        <figcaption className="frame-caption">{typesetSr(COACHES_COPY.groupPhotoCaption)}</figcaption>
      </div>
    </figure>
  );
}

/**
 * S6 — „Trenerice“ (§5 S6, §4 Coaches). Light theme; heading on the left.
 * Two coach cards (roles in order, licence lines with „izvor ↗“, an inked „Licenca GSS“
 * stamp each; compact athlete-card layout on phones), then photo 05 with the white brush
 * annotation (one of the page's two): under the cards on mobile/tablet; on desktop the cards
 * stack in cols 1–7 and the print fills cols 8–12 at the same height (heading top-left →
 * print right). Static markup is the final state; CoachesMotion lazily adds the portrait
 * rise, the Marey plate's exposures, the stamp press and the hand-speed brush.
 */
export function Coaches() {
  return (
    <Section id="treneri" theme="light" labelledBy="treneri-title" className="coaches">
      <div className="container-site">
        <SectionHeading id="treneri-title" title={typesetSr(COACHES_COPY.heading)} align="left" />

        <div className="coaches__layout">
          <ul className="coaches__cards" role="list">
            {COACHES.map((coach, i) => (
              <CoachCard key={coach.name} coach={coach} index={i} />
            ))}
          </ul>

          <div className="coaches__team">
            <TeamPrint />
          </div>
        </div>
      </div>
      <QuietBoundary>
        <CoachesMotion />
      </QuietBoundary>
    </Section>
  );
}
