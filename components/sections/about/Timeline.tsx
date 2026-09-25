import { Fragment, type CSSProperties } from "react";
import { Picture, isPhotoVisible } from "@/components/ui/Picture";
import { SourceLink } from "@/components/ui/SourceLink";
import { LEAP_VIEWBOX } from "@/components/brand/sprite-paths.generated";
import { FLAGS, SOURCES } from "@/content/site";
import { TIMELINE, TIMELINE_PHOTO, type TimelineItem } from "@/content/timeline";
import { typesetSr } from "@/lib/typeset";

/**
 * Accessible context for items with more than one source (2026: GSS registration lists).
 * Visible labels come from content/timeline.ts `sourceLabels`.
 */
const SOURCE_META: Partial<Record<string, { context: string }>> = {
  [SOURCES.registered2026Zsg]: {
    context: "42 registrovane takmičarke u sportskoj gimnastici, 2026.",
  },
  [SOURCES.registered2026Aer]: {
    context: "12 registrovanih takmičarki u aerobnoj gimnastici, 2026.",
  },
};

/** KR-17 crop: 2:1 on the cake and its lettering (the native 2000×1500 allows it at 300 CSS px). */
const PHOTO_ASPECT = 2;
const PHOTO_POSITION = "50% 55%";

interface YearGroup {
  year: number;
  items: TimelineItem[];
}

/** Items whose flag is off are skipped; items of the same year share one node. */
function groupByYear(items: readonly TimelineItem[]): YearGroup[] {
  const groups: YearGroup[] = [];
  for (const item of items) {
    if (item.flag && !FLAGS[item.flag]) continue;
    const last = groups[groups.length - 1];
    if (last && last.year === item.year) last.items.push(item);
    else groups.push({ year: item.year, items: [item] });
  }
  return groups;
}

/**
 * Ghost exposure of each year: the leotard steps ice → lavender → violet from the oldest
 * year to the newest (the shared --ghost-1/2/3 tokens), the last year is the solid landing.
 */
function ghostStyle(index: number, count: number): CSSProperties {
  const step = count > 1 ? Math.min(3, 1 + Math.floor((index * 3) / (count - 1))) : 3;
  return { ["--node-c" as string]: `var(--ghost-${step})`, ["--node-o" as string]: `var(--ghost-${step}-o)` };
}

/** The club's leaping gymnast (sprite #leap), sized by CSS. */
function Leap({ className }: { className: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${LEAP_VIEWBOX.width} ${LEAP_VIEWBOX.height}`} focusable="false">
      <use href="#leap" width={LEAP_VIEWBOX.width} height={LEAP_VIEWBOX.height} />
    </svg>
  );
}

function Entry({ item }: { item: TimelineItem }) {
  const sources = item.sources ?? [];
  return (
    <>
      <p className="timeline__title">{typesetSr(item.title)}</p>
      {item.text ? <p className="timeline__text">{typesetSr(item.text)}</p> : null}
      {sources.length > 0 ? (
        <p className="timeline__sources">
          {sources.map((href, i) => {
            const meta = sources.length > 1 ? SOURCE_META[href] : undefined;
            const label = item.sourceLabels?.[i];
            return (
              <SourceLink
                key={href}
                href={href}
                context={meta?.context ?? `${item.year}. — ${item.title}`}
                {...(label ? { label } : {})}
              />
            );
          })}
        </p>
      ) : null}
    </>
  );
}

/**
 * „Hronologija“ as a Marey plate: an ordered list of years on a vertical rail, one exposure
 * of the club's leaping gymnast per year. The static markup is the final state — full rail,
 * every earlier year a ghost frame, the last year the solid landing. timeline-motion.ts then lets
 * a flier ride the rail year by year (take-off, flight, stuck landing), exposing each ghost as
 * it leaves. The 2007 → 2017 leg carries an axis break (ten years compressed; about.css).
 * Photo 17 (club birthday cake) sits between 2017 and 2022 with no date claim; from 1024 px
 * it hangs in the empty cols 1–4 as a margin print with a leader to the rail (about.css),
 * its list position unchanged.
 */
export function Timeline({ labelledBy }: { labelledBy: string }) {
  const groups = groupByYear(TIMELINE);
  const photoVisible = isPhotoVisible(TIMELINE_PHOTO.photoId);
  return (
    <div className="timeline" data-timeline="">
      <span className="timeline__track" aria-hidden="true" />
      <span className="timeline__progress" aria-hidden="true" data-timeline-line="" />
      {/* The flier (motion only): CSS keeps it hidden until the timeline motion arms. */}
      <span className="timeline__flier" aria-hidden="true" data-timeline-flier="">
        <span className="timeline__flier-body" data-timeline-flier-body="">
          <Leap className="timeline__leap" />
        </span>
      </span>
      <ol className="timeline__list" aria-labelledby={labelledBy}>
        {groups.map((group, index) => (
          <Fragment key={group.year}>
            <li className="timeline__item" data-timeline-item="" style={ghostStyle(index, groups.length)}>
              <span className="timeline__node" aria-hidden="true" data-timeline-node="">
                <Leap className="timeline__leap" />
              </span>
              <p className="timeline__year tabular">
                <time dateTime={String(group.year)}>{group.year}</time>
              </p>
              {group.items.length > 1 ? (
                <ul className="timeline__entries" role="list">
                  {group.items.map((item) => (
                    <li key={item.title} className="timeline__entry">
                      <Entry item={item} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="timeline__entries">
                  {group.items.map((item) => (
                    <div key={item.title} className="timeline__entry">
                      <Entry item={item} />
                    </div>
                  ))}
                </div>
              )}
            </li>
            {photoVisible && group.year === TIMELINE_PHOTO.afterYear ? (
              <li className="timeline__photo">
                <div className="timeline__print">
                  <Picture
                    id={TIMELINE_PHOTO.photoId}
                    frame
                    aspect={PHOTO_ASPECT}
                    position={PHOTO_POSITION}
                    caption={typesetSr(TIMELINE_PHOTO.caption)}
                    sizes="(min-width: 1024px) 288px, (min-width: 640px) 348px, min(348px, calc(100vw - 96px))"
                  />
                </div>
              </li>
            ) : null}
          </Fragment>
        ))}
      </ol>
    </div>
  );
}
