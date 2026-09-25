import { Picture, isPhotoVisible } from "@/components/ui/Picture";
import { QuietBoundary } from "@/components/ui/QuietBoundary";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ABOUT } from "@/content/copy";
import { typesetSr } from "@/lib/typeset";
import { Timeline } from "./Timeline";
import { TimelineMotion } from "./TimelineMotion";

/**
 * The mission's first sentence as a display statement (phones: about.css). Display-only:
 * the text stays one <p>, character for character. It splits only before a capital letter,
 * so an ordinal („2007. godine“) never cuts it; no match → no split.
 */
function Mission({ text }: { text: string }) {
  const m = text.match(/\.\s+(?=\p{Lu})/u);
  if (m?.index === undefined) return <>{text}</>;
  const cut = m.index + 1;
  return (
    <>
      <span className="about__lead-first">{text.slice(0, cut)}</span>
      {text.slice(cut)}
    </>
  );
}

/**
 * S5 — „O nama“ (§5 S5). Ice theme; heading on the right (floor diagonal).
 * Mission + history render exactly from content/copy.ts. Photo 03 sits in a
 * contact-sheet frame (≤533 CSS px: 1066 px native / 2); photo 02 joins it only
 * when CAMP_GROUP_PHOTOS is on. The timeline (content/timeline.ts) is static
 * and complete without JS; TimelineMotion lazily adds the GSAP line.
 */
export function About() {
  const showCampGroup = isPhotoVisible("02");
  return (
    <Section id="o-nama" theme="ice" labelledBy="o-nama-title" className="about">
      <div className="container-site">
        <SectionHeading id="o-nama-title" title={typesetSr(ABOUT.heading)} align="right" />

        <div className="about__grid">
          <div className="about__mission">
            <h3 className="about__label label-caps">{typesetSr(ABOUT.missionLabel)}</h3>
            <p className="about__lead measure">
              <Mission text={typesetSr(ABOUT.mission)} />
            </p>
          </div>

          <div className={["about__prints", showCampGroup ? "about__prints--pair" : ""].filter(Boolean).join(" ")}>
            <div className="about__print">
              <Picture
                id="03"
                frame
                sizes="(min-width: 1440px) 524px, (min-width: 1024px) calc((100vw - 96px) * 0.4), (min-width: 640px) 521px, calc(100vw - 52px)"
              />
            </div>
            {showCampGroup ? (
              <div className="about__print about__print--second">
                <Picture id="02" frame sizes="(min-width: 1024px) 420px, (min-width: 640px) 480px, calc(100vw - 72px)" />
              </div>
            ) : null}
          </div>

          <div className="about__history">
            <h3 className="about__label label-caps">{typesetSr(ABOUT.historyLabel)}</h3>
            <p className="about__text measure">{typesetSr(ABOUT.history)}</p>
          </div>
        </div>

        <div className="about__chrono">
          <h3 className="about__chrono-title text-h3" id="o-nama-hronologija">
            {typesetSr(ABOUT.timelineLabel)}
          </h3>
          <Timeline labelledBy="o-nama-hronologija" />
        </div>
      </div>
      <QuietBoundary>
        <TimelineMotion />
      </QuietBoundary>
    </Section>
  );
}
