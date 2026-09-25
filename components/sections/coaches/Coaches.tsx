import { Picture } from "@/components/ui/Picture";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { COACHES, COACHES_COPY, type Coach } from "@/content/copy";
import { LEAP_VIEWBOX } from "@/components/brand/sprite-paths.generated";
import { BrushStroke } from "./BrushStroke";
import { CoachesMotion } from "./CoachesMotion";
import { LicenceStamp } from "./LicenceStamp";

/** Portrait box aspect (w/h). Photo 06 is 1170×1426 (0.82) — 4:5 crops almost nothing. */
const PORTRAIT_ASPECT = 4 / 5;
/** Photo 05 (1200×1600) shown wide: a 3:2 crop at ≤600 CSS px (native / 2). */
const TEAM_ASPECT = 3 / 2;

/**
 * No portrait of Slađana Kovačević exists yet: the leaping silhouette stands in,
 * in the same contact-sheet frame, labelled „Portret uskoro“.
 * TODO(klub): request a portrait in club kit (dosije §7, item 7) → then set photoId in content/copy.ts.
 */
function PortraitPending() {
  return (
    <figure className="frame coach__frame">
      <div className="photo photo-placeholder coach__pending" style={{ aspectRatio: String(PORTRAIT_ASPECT) }} data-coach-reveal="">
        <svg
          viewBox={`0 0 ${LEAP_VIEWBOX.width} ${LEAP_VIEWBOX.height}`}
          className="photo-placeholder__leap coach__pending-leap"
          aria-hidden="true"
          focusable="false"
        >
          <use href="#leap" width={LEAP_VIEWBOX.width} height={LEAP_VIEWBOX.height} />
        </svg>
      </div>
      <figcaption className="frame-foot">
        <span className="frame-label">{COACHES_COPY.portraitFrame}</span>
      </figcaption>
    </figure>
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
                sizes="(min-width: 640px) 232px, 46vw"
              />
            ) : (
              <PortraitPending />
            )}
          </div>
          <LicenceStamp uid={`${index + 1}`} label={COACHES_COPY.badge} />
        </div>

        <div className="coach__body">
          <h3 id={nameId} className="coach__name text-h3">
            {coach.name}
          </h3>
          <ul className="coach__roles" role="list">
            {coach.roles.map((role) => (
              <li key={role.text} className="coach__role">
                {role.text}
              </li>
            ))}
          </ul>
          {/* `bio` stays empty until the club writes one — never invented. */}
          {coach.bio ? <p className="coach__bio measure">{coach.bio}</p> : null}
        </div>
      </article>
    </li>
  );
}

/**
 * S6 — „Trenerice“ (§5 S6, §4 Coaches). Light theme; heading on the left.
 * Two coach cards (roles in order, „Licenca GSS“ stamp each), then photo 05 as a
 * wide „Na takmičenju“ print with the white brush annotation (one of the page's two).
 * Static markup is the final state; CoachesMotion lazily adds the portrait reveal,
 * the stamp and the DrawSVG stroke.
 */
export function Coaches() {
  return (
    <Section id="treneri" theme="light" labelledBy="treneri-title" className="coaches">
      <div className="container-site">
        <SectionHeading id="treneri-title" title={COACHES_COPY.heading} align="left" />

        <ul className="coaches__cards" role="list">
          {COACHES.map((coach, i) => (
            <CoachCard key={coach.name} coach={coach} index={i} />
          ))}
        </ul>

        <div className="coaches__team">
          <div className="coaches-team" data-coaches-team="">
            <Picture
              id="05"
              frame
              aspect={TEAM_ASPECT}
              position="50% 29%"
              caption={COACHES_COPY.groupPhotoCaption}
              sizes="(min-width: 640px) 600px, calc(100vw - 52px)"
            />
            <BrushStroke />
          </div>
        </div>
      </div>
      <CoachesMotion />
    </Section>
  );
}
