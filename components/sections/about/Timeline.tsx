import { Fragment } from "react";
import { Picture, isPhotoVisible } from "@/components/ui/Picture";
import { SourceLink } from "@/components/ui/SourceLink";
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
 * „Hronologija“: an ordered list of years on a vertical rail, one ringed dot per year (UI
 * chrome, no figure: plan-figure-system R5). The static markup is the final state — full rail,
 * every year's dot filled. timeline-motion.ts then lets a lavender bead ride the rail year by
 * year (take-off, flight, stuck landing), each ring filling as the bead reaches it. The
 * 2007 → 2017 leg carries an axis break (ten years compressed; about.css).
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
      {/* The bead (motion only): CSS keeps it hidden until the timeline motion arms. */}
      <span className="timeline__flier" aria-hidden="true" data-timeline-flier="">
        <span className="timeline__bead" data-timeline-bead="" />
      </span>
      <ol className="timeline__list" aria-labelledby={labelledBy}>
        {groups.map((group) => (
          <Fragment key={group.year}>
            <li className="timeline__item" data-timeline-item="">
              <span className="timeline__node" aria-hidden="true" data-timeline-node="" />
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
                    // The last two words never part („torta kluba“): no lone word under the print (AC4-02, display only).
                    caption={typesetSr(TIMELINE_PHOTO.caption).replace(/ (\S+)$/, " $1")}
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
