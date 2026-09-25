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
 * „Hronologija“: an ordered list of years on a vertical line. The static markup
 * is the final state (full line, every node filled) — TimelineMotion only adds
 * the growing line (GSAP scaleY) when motion is allowed.
 * Photo 17 (club birthday cake) sits between 2017 and 2022 with no date claim; from 1024 px
 * it hangs in the empty cols 1–4 as a margin print (about.css), its list position unchanged.
 */
export function Timeline({ labelledBy }: { labelledBy: string }) {
  const groups = groupByYear(TIMELINE);
  const photoVisible = isPhotoVisible(TIMELINE_PHOTO.photoId);
  return (
    <div className="timeline" data-timeline="">
      <span className="timeline__track" aria-hidden="true" />
      <span className="timeline__progress" aria-hidden="true" data-timeline-line="" />
      <ol className="timeline__list" aria-labelledby={labelledBy}>
        {groups.map((group) => (
          <Fragment key={group.year}>
            <li className="timeline__item" data-timeline-item="">
              <span className="timeline__node" aria-hidden="true" data-timeline-node="">
                <span className="timeline__dot" />
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
                    aspect={4 / 3}
                    caption={typesetSr(TIMELINE_PHOTO.caption)}
                    sizes="(min-width: 640px) 288px, min(288px, calc(100vw - 112px))"
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
