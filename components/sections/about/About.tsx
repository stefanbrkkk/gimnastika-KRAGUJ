import { Picture, isPhotoVisible } from "@/components/ui/Picture";
import { QuietBoundary } from "@/components/ui/QuietBoundary";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ABOUT } from "@/content/copy";
import { typesetSr } from "@/lib/typeset";
import { AboutMotion } from "./AboutMotion";
import { Timeline } from "./Timeline";

/**
 * The mission's first sentence as a display statement (about.css, every width). Display-only:
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

/** The history's founding year („2007.“) set bold in the sentence — display-only, same characters. */
function History({ text }: { text: string }) {
  const m = text.match(/\b\d{4}\./);
  if (m?.index === undefined) return <>{text}</>;
  const end = m.index + m[0].length;
  return (
    <>
      {text.slice(0, m.index)}
      <span className="about__year">{m[0]}</span>
      {text.slice(end)}
    </>
  );
}

/**
 * The floor diagonal the darkroom band is cut on (the shared .edge-cut / .edge-line from
 * styles/ui.css, used inside the section rather than on it).
 */
function EdgeLine() {
  return (
    <svg className="edge-line" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line x1="0" y1="10" x2="100" y2="0" />
    </svg>
  );
}

/**
 * S5 — „O nama“ (§5 S5). Light theme (as §5 says); heading on the right (floor diagonal).
 * Mission + history render exactly from content/copy.ts: the mission's first sentence is
 * the statement, the rest body copy. Photo 03 sits in a contact-sheet frame (≤533 CSS px:
 * 1066 px native / 2); photo 02 joins it only when CAMP_GROUP_PHOTOS is on.
 * „Hronologija“ lives in a full-bleed darkroom band (dark theme, cut on the floor diagonal):
 * the club's years as a chronophotograph plate — static and complete without JS;
 * AboutMotion lazily adds the print's landing and the flier riding the rail.
 */
export function About() {
  const showCampGroup = isPhotoVisible("02");
  return (
    <Section id="o-nama" theme="light" labelledBy="o-nama-title" className="about">
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
            <div className="about__print" data-about-print="">
              {/* Two paper ghosts: the print lands through them (second exposures); invisible at rest. */}
              <span className="about__ghost" aria-hidden="true" data-print-ghost="" />
              <span className="about__ghost" aria-hidden="true" data-print-ghost="" />
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
            <p className="about__text measure">
              <History text={typesetSr(ABOUT.history)} />
            </p>
          </div>
        </div>
      </div>

      <div className="about__band edge-cut" data-theme="dark" data-edge="up" data-header-band>
        <EdgeLine />
        <div className="container-site about__chrono">
          <h3 className="about__label about__chrono-title label-caps" id="o-nama-hronologija">
            {typesetSr(ABOUT.timelineLabel)}
          </h3>
          <Timeline labelledBy="o-nama-hronologija" />
        </div>
      </div>
      <QuietBoundary>
        <AboutMotion />
      </QuietBoundary>
    </Section>
  );
}
