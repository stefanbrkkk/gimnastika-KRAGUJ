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

/**
 * No portrait of Slađana Kovačević exists yet: the leaping silhouette stands in,
 * in the same contact-sheet frame, marked only with its frame code (the empty
 * slot of excluded photo 07) — no promise in the UI. Purely decorative, so it is
 * hidden from assistive tech (the name and roles carry the card).
 * TODO(klub): request a portrait in club kit (dosije §7, item 7) → then set photoId in content/copy.ts.
 */
function PortraitPending() {
  return (
    <div className="frame coach__frame" aria-hidden="true">
      <div className="photo photo-placeholder coach__pending" style={{ aspectRatio: String(PORTRAIT_ASPECT) }} data-coach-reveal="">
        <svg viewBox={`0 0 ${LEAP_VIEWBOX.width} ${LEAP_VIEWBOX.height}`} className="photo-placeholder__leap coach__pending-leap" focusable="false">
          <use href="#leap" width={LEAP_VIEWBOX.width} height={LEAP_VIEWBOX.height} />
        </svg>
      </div>
      <div className="frame-foot">
        <span className="frame-label">{COACHES_COPY.portraitFrame}</span>
      </div>
    </div>
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
                sizes="(min-width: 640px) 212px, 46vw"
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
                <span className="coach__role-text">{typesetSr(role.text)}</span>
                {/* Licence lines link their ✅ GSS list (docs/dosije.md §3) — never the licence number or category. */}
                {role.sourceUrl ? (
                  <SourceLink href={role.sourceUrl} context={`${coach.name} — ${role.text}`} className="coach__source" />
                ) : null}
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
 * Two coach cards (roles in order, licence lines with „izvor ↗“, „Licenca GSS“ stamp
 * each), then photo 05 with the white brush annotation (one of the page's two):
 * under the cards on mobile/tablet; on desktop the cards stack in cols 1–7 and the
 * print fills cols 8–12 at the same height (heading top-left → print right).
 * Static markup is the final state; CoachesMotion lazily adds the portrait reveal,
 * the stamp and the DrawSVG stroke.
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
