import { isPhotoPlaceholder, Picture } from "@/components/ui/Picture";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PROGRAMS_COPY, visiblePrograms } from "@/content/programs";
import { DAYS, SCHEDULE_UI } from "@/content/schedule";
import { FLAGS } from "@/content/site";
import { typesetSr } from "@/lib/typeset";
import { dayStripRows, filterHint, filterStatus, PROGRAMS_UI, programSlotTable, usableChips } from "./model";
import { ProgramCalendar } from "./ProgramCalendar";
import { ProgramCard } from "./ProgramCard";
import { ProgramsBrowser, type BrowserChip } from "./ProgramsBrowser";
import { ProgramTimes } from "./ProgramTimes";

/**
 * S3 „Programi“ (§5 S3, §4 Programs). A contact sheet of program frames on a navy-900
 * "darkroom" (AD-02) whose top edge is cut on the floor diagonal (QP-11, shared edge="up").
 * Mobile/tablet = a native scroll-snap row that opens on KR-04 — the club's girl in flight on
 * the airtrack (QP-09/ID-05) — with a progress rail under it; desktop ≥1024 = a 2/3-column
 * sheet. Cards are server-rendered and complete without JS.
 * With MINOR_PHOTOS=false the photo is a placeholder, which must never open the row: it stays
 * the last frame at every width (data-placeholder).
 */
export function Programs() {
  const programs = visiblePrograms(FLAGS.SHOW_TRAMPOLINE);
  const ids = programs.map((p) => p.id);
  const chips: BrowserChip[] = usableChips(ids).map((c) => ({
    key: c.key,
    label: c.label,
    ids: c.ids === null ? ids : ids.filter((id) => c.ids!.includes(id)),
    // Typeset here (server) so the client island ships no typesetting code.
    status: typesetSr(filterStatus(c, ids)),
    hint: typesetSr(filterHint(c, ids)),
  }));
  const photoPlaceholder = isPhotoPlaceholder("04");
  const calendars = Object.fromEntries(programs.map((p) => [p.id, <ProgramCalendar key={p.id} program={p} />]));
  const times = {
    slots: programSlotTable(programs),
    names: programs.map((p) => typesetSr(p.title)),
    accusatives: DAYS.map((d) => d.accusative),
    nextLabel: SCHEDULE_UI.next,
  };

  return (
    <Section id="programi" theme="dark" labelledBy="programi-title" className="programs" edge="up">
      <div className="container-site">
        <ProgramsBrowser
          heading={<SectionHeading id="programi-title" title={PROGRAMS_COPY.heading} intro={PROGRAMS_COPY.intro} align="right" />}
          chips={chips}
          dots={programs.map((p) => ({ id: p.id, color: p.color }))}
          filtersLabel={PROGRAMS_UI.filtersLabel}
          pager={{ prev: PROGRAMS_UI.prev, next: PROGRAMS_UI.next }}
          stamp={{ unit: PROGRAMS_UI.ageUnit }}
          total={programs.length}
          times={times}
          calendars={calendars}
        >
          {programs.map((p) => (
            <ProgramCard key={p.id} program={p} />
          ))}
          <div
            className="pg-photo"
            data-program-photo=""
            {...(photoPlaceholder ? { "data-placeholder": "" } : {})}
          >
            {/* The drawn (cover-cropped) image is ≤533 CSS px: the box is ≤533px tall on phones and
                in the ≥1024 sheet, and a square cover draws at the box's longer side. Where the row
                is taller than that, the white paper stretches to the row and KR-04 sits at its foot
                (programs.css). */}
            <Picture
              id="04"
              frame
              aspect={1}
              sizes="(min-width: 1280px) 533px, (min-width: 1024px) 460px, 533px"
            />
          </div>
        </ProgramsBrowser>
        <ProgramTimes rows={dayStripRows(programs)} />
      </div>
    </Section>
  );
}
