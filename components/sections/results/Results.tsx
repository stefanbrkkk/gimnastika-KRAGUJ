import { Picture } from "@/components/ui/Picture";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SourceLink } from "@/components/ui/SourceLink";
import { RESULTS, RESULTS_COPY, STATS, TRUST_ROW, type ResultItem, type StatTile } from "@/content/results";
import { typesetSr } from "@/lib/typeset";
import { MedalBrush, Podium, type MedalKind } from "./art";
import { ResultsMotion } from "./ResultsMotion";

const NEW_WINDOW = "(otvara se u novom prozoru)";

/** A founding-year tile („2007“): a 4-digit 19xx/20xx value without a prefix. */
const isYearTile = ({ prefix, value }: StatTile): boolean => !prefix && /^(19|20)\d{2}$/.test(value);

/**
 * Presentation order (RC-17): competitive strength leads, heritage closes — the year tile
 * goes last (42 · 12 · oko 120 · 2007). content/results.ts is unchanged.
 */
const BOARD: readonly StatTile[] = [...STATS.filter((s) => !isYearTile(s)), ...STATS.filter(isYearTile)];

/**
 * What a tile's „izvor“ link proves, for its accessible name. A year tile reads like
 * the §5 S7 line („2007 — početak rada“); the others read as one phrase
 * („42 registrovane takmičarke …“, „oko 120 članova (2024)“).
 */
const statContext = (stat: StatTile): string =>
  isYearTile(stat) ? `${stat.value} — ${stat.label}` : `${stat.prefix ? `${stat.prefix} ` : ""}${stat.value} ${stat.label}`;

/**
 * The display window: a pure LED face. The prefix („oko“) is a scoreboard field tag in its
 * top-left corner (RC-11). The numeral is aria-hidden; the sr-only copy carries the value.
 */
function StatValue({ stat }: { stat: StatTile }) {
  return (
    <p className="stat__value">
      {stat.prefix ? <span className="stat__prefix">{`${stat.prefix} `}</span> : null}
      <span className="stat__num font-dot tabular" aria-hidden="true" data-score="">
        {stat.value}
      </span>
      <span className="sr-only">{stat.value}</span>
    </p>
  );
}

/**
 * One decorative medal mark per row (aria-hidden; the row text carries the meaning).
 * Several kinds („Zlato, srebro i bronza“) share ONE disc banded in the three metals —
 * kinds, never a count (§5 S7: no medal counts).
 */
function MedalMark({ kinds }: { kinds: readonly MedalKind[] }) {
  const single = kinds.length === 1 ? kinds[0] : undefined;
  return (
    <span className="result-row__marks" aria-hidden="true">
      <span className={`medal-mark ${single ? `medal-fill--${single}` : "medal-mark--mixed"}`} />
    </span>
  );
}

function ResultRow({ item, marks }: { item: ResultItem; marks?: readonly MedalKind[] }) {
  return (
    <li className="result-row">
      {marks?.length ? <MedalMark kinds={marks} /> : null}
      <div className="result-row__body">
        <p className="result-row__text">{typesetSr(item.text)}</p>
        <p className="result-row__meta">{typesetSr(item.date)}</p>
      </div>
      <SourceLink href={item.sourceUrl} context={`${item.text}, ${item.date}`} label={RESULTS_COPY.sourceLabel} className="result-row__source" />
    </li>
  );
}

function ExternalIcon() {
  return (
    <svg className="trust-link__icon ui-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M7 5h8v8M15 5 5.5 14.5" />
    </svg>
  );
}

/**
 * S7 — „Uspesi“ (§5 S7, §4 Results). Darker theme: the judges' scoreboard, its top edge cut
 * on the floor diagonal. Everything here is the complete final state; ResultsMotion (lazy,
 * motion allowed only) plays, one at a time: the title's line mask → (phones) the photo's
 * shutter opens → the medal ceremony on the podium, closed
 * by the brush underline under „Medalje“.
 */
export function Results() {
  const medals = RESULTS.filter((r) => r.kind === "medalja");
  const appearances = RESULTS.filter((r) => r.kind === "nastup");

  return (
    <Section id="uspesi" theme="darker" edge="up" labelledBy="uspesi-title" className="results">
      <div className="container-site" data-results="">
        <SectionHeading id="uspesi-title" title={typesetSr(RESULTS_COPY.heading)} align="right" className="results__heading" />

        <ul className="scoreboard" data-scoreboard="">
          {BOARD.map((stat) => (
            <li key={stat.label} className="stat">
              <StatValue stat={stat} />
              <p className="stat__label">{typesetSr(stat.label)}</p>
              <SourceLink
                href={stat.sourceUrl}
                context={statContext(stat)}
                label={RESULTS_COPY.sourceLabel}
                className="stat__source"
              />
            </li>
          ))}
        </ul>

        <div className="results__body">
          <div className="results__photo" data-results-photo="">
            <Picture
              id="01"
              sizes="(min-width: 1440px) 760px, (min-width: 1024px) 54vw, (min-width: 640px) calc(100vw - 64px), calc(100vw - 40px)"
              frame
              caption={typesetSr(RESULTS_COPY.photoCaption)}
              className="results__figure"
            />
          </div>

          <div className="results__lists">
            <div className="medals" data-medals="">
              <div className="medals__band" aria-hidden="true" data-medals-band="">
                <Podium />
              </div>
              <div className="medals__body">
                <h3 className="medals__title text-h3">
                  <span className="medals__word">
                    {typesetSr(RESULTS_COPY.medalsHeading)}
                    <MedalBrush />
                  </span>
                </h3>
                <ul className="result-list">
                  {medals.map((item) => (
                    <ResultRow key={item.sourceUrl} item={item} marks={item.medals} />
                  ))}
                </ul>
              </div>
            </div>

            <div className="appearances">
              <h3 className="appearances__title">{typesetSr(RESULTS_COPY.appearancesHeading)}</h3>
              <ul className="result-list result-list--plain">
                {appearances.map((item) => (
                  <ResultRow key={item.sourceUrl} item={item} />
                ))}
              </ul>
            </div>
          </div>

          {/* ≥1024: under the proof photo (RC-09); below: the section's closing row. */}
          <ul className="trust-row">
            {TRUST_ROW.map((t) => (
              <li key={t.href + t.text}>
                <a className="trust-link" href={t.href} target="_blank" rel="noopener noreferrer">
                  <span>{typesetSr(t.text)}</span>
                  <ExternalIcon />
                  <span className="sr-only">{` ${NEW_WINDOW}`}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <ResultsMotion />
    </Section>
  );
}
