import { Picture } from "@/components/ui/Picture";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SourceLink } from "@/components/ui/SourceLink";
import { RESULTS, RESULTS_COPY, STATS, TRUST_ROW, type ResultItem, type StatTile } from "@/content/results";
import { Brush, Podium, type MedalKind } from "./art";
import { ResultsMotion } from "./ResultsMotion";

const NEW_WINDOW = "(otvara se u novom prozoru)";

function StatValue({ stat }: { stat: StatTile }) {
  const head = stat.value.slice(0, -1);
  const last = stat.value.slice(-1);
  return (
    <p className="stat__value">
      {stat.prefix ? <span className="stat__prefix">{stat.prefix} </span> : null}
      <span className="stat__num font-dot tabular" aria-hidden="true">
        {head}
        <span className="stat__flap" data-flip="">
          {last}
        </span>
      </span>
      <span className="sr-only">{stat.value}</span>
    </p>
  );
}

function ResultRow({ item, marks }: { item: ResultItem; marks?: readonly MedalKind[] }) {
  return (
    <li className="result-row">
      {marks?.length ? (
        <span className="result-row__marks" aria-hidden="true">
          {marks.map((m) => (
            <span key={m} className={`medal-mark medal-fill--${m}`} />
          ))}
        </span>
      ) : null}
      <div className="result-row__body">
        <p className="result-row__text">{item.text}</p>
        <p className="result-row__meta tabular">{item.date}</p>
      </div>
      <SourceLink href={item.sourceUrl} context={`${item.text}, ${item.date}`} label={RESULTS_COPY.sourceLabel} className="result-row__source" />
    </li>
  );
}

function ExternalIcon() {
  return (
    <svg className="trust-link__icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M7 5h8v8M15 5 5.5 14.5" />
    </svg>
  );
}

/**
 * S7 — „Uspesi“ (§5 S7, §4 Results). Darker theme: the judges' scoreboard.
 * Everything here is the complete final state; ResultsMotion (lazy, motion allowed only)
 * plays, in sequence and never overlapping: the title's line mask → the last digit of each
 * numeral flips once → the podium line draws → the brush stroke over photo 01 draws.
 */
export function Results() {
  const medals = RESULTS.filter((r) => r.kind === "medalja");
  const appearances = RESULTS.filter((r) => r.kind === "nastup");

  return (
    <Section id="uspesi" theme="darker" labelledBy="uspesi-title" className="results">
      <div className="container-site" data-results="">
        <SectionHeading id="uspesi-title" title={RESULTS_COPY.heading} align="right" className="results__heading" />

        <ul className="scoreboard" data-scoreboard="">
          {STATS.map((stat) => (
            <li key={stat.label} className="stat">
              <StatValue stat={stat} />
              <p className="stat__label">{stat.label}</p>
              <SourceLink
                href={stat.sourceUrl}
                context={`${stat.prefix ? `${stat.prefix} ` : ""}${stat.value} ${stat.label}`}
                label={RESULTS_COPY.sourceLabel}
                className="stat__source"
              />
            </li>
          ))}
        </ul>

        <div className="results__body">
          <div className="results__photo">
            <div className="results__photo-inner">
              <Picture
                id="01"
                sizes="(min-width: 1440px) 760px, (min-width: 1024px) 54vw, (min-width: 640px) calc(100vw - 64px), calc(100vw - 40px)"
                frame
                caption={RESULTS_COPY.photoCaption}
                className="results__figure"
              />
              <Brush />
            </div>
          </div>

          <div className="results__lists">
            <div className="medals" data-medals="">
              <div className="medals__band" aria-hidden="true">
                <Podium />
              </div>
              <div className="medals__body">
                <h3 className="medals__title text-h3">{RESULTS_COPY.medalsHeading}</h3>
                <ul className="result-list">
                  {medals.map((item) => (
                    <ResultRow key={item.sourceUrl} item={item} marks={item.medals} />
                  ))}
                </ul>
              </div>
            </div>

            <div className="appearances">
              <h3 className="appearances__title">{RESULTS_COPY.appearancesHeading}</h3>
              <ul className="result-list result-list--plain">
                {appearances.map((item) => (
                  <ResultRow key={item.sourceUrl} item={item} />
                ))}
              </ul>
            </div>
          </div>
        </div>

        <ul className="trust-row">
          {TRUST_ROW.map((t) => (
            <li key={t.href + t.text}>
              <a className="trust-link" href={t.href} target="_blank" rel="noopener noreferrer">
                <span>{t.text}</span>
                <ExternalIcon />
                <span className="sr-only">{` ${NEW_WINDOW}`}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <ResultsMotion />
    </Section>
  );
}
