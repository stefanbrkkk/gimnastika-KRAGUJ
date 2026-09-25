import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { visiblePrograms } from "@/content/programs";
import { DAYS, SCHEDULE, SCHEDULE_LOCATION } from "@/content/schedule";
import { FLAGS } from "@/content/site";
import { typesetSr } from "@/lib/typeset";
import { ScheduleBoard } from "./ScheduleBoard";
import { DayPanels, GroupCards, LocationCard } from "./ScheduleViews";

/**
 * S4 "Raspored treninga" (§5 S4, §4 "Schedule: clarity first").
 * Server Component: every group card, day panel and link is static HTML;
 * the ScheduleBoard island adds tabs, filters, the day strip and "Sledeći trening".
 * Groups are ordered like the program cards in S3 (program 1…5), matching the
 * filter pills; groups of hidden programs (Trampolina) are left out.
 */
export function Schedule() {
  const programs = visiblePrograms(FLAGS.SHOW_TRAMPOLINE).filter((p) => SCHEDULE.some((g) => g.programId === p.id));
  const rank = new Map(programs.map((p, i) => [p.id, i] as const));
  const groups = SCHEDULE.filter((g) => rank.has(g.programId)).toSorted(
    (a, b) => (rank.get(a.programId) ?? 0) - (rank.get(b.programId) ?? 0),
  );
  // Build date (Europe/Belgrade) = first DTSTART of the Google Calendar links (no-JS fallback; the island
  // recomputes the dates after mount); same rule as the static .ics files.
  const anchor = new Date();

  return (
    <Section id="raspored" theme="light" labelledBy="raspored-title" className="sched-section">
      <div className="container-site">
        <SectionHeading id="raspored-title" title={SCHEDULE_LOCATION.heading} align="left" intro={typesetSr(SCHEDULE_LOCATION.sub)} />
        <ScheduleBoard
          programs={programs.map((p) => ({ id: p.id, label: p.short, color: p.color }))}
          days={DAYS.map((d) => ({ code: d.code, short: d.short, full: d.full, accusative: d.accusative, iso: d.iso }))}
          byGroup={<GroupCards groups={groups} anchor={anchor} />}
          byDay={<DayPanels groups={groups} />}
          aside={<LocationCard />}
        />
      </div>
    </Section>
  );
}
