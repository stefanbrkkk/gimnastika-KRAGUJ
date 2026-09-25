import { Picture } from "@/components/ui/Picture";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PROGRAMS_COPY, visiblePrograms } from "@/content/programs";
import { FLAGS } from "@/content/site";
import { typesetSr } from "@/lib/typeset";
import { filterStatus, PROGRAMS_UI, usableChips } from "./model";
import { ProgramCard } from "./ProgramCard";
import { ProgramsBrowser, type BrowserChip } from "./ProgramsBrowser";

/**
 * S3 „Programi“ (§5 S3, §4 Programs). A contact sheet of program frames:
 * mobile/tablet = a native scroll-snap row (next card peeks, pager with JS);
 * desktop ≥1024 = a 3-column sheet (2 columns at 1024–1279) where photo 04 is
 * the sixth frame. Cards are server-rendered and complete without JS.
 * Theme: a navy-900 "darkroom" section (final review AD-02, replaces „ice“ in
 * D-20): the cards are white light-theme prints on it, KR-04 keeps the dark frame.
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
  }));

  return (
    <Section id="programi" theme="dark" labelledBy="programi-title" className="programs">
      <div className="container-site">
        <ProgramsBrowser
          heading={<SectionHeading id="programi-title" title={PROGRAMS_COPY.heading} align="right" />}
          chips={chips}
          filtersLabel={PROGRAMS_UI.filtersLabel}
          pager={{ prev: PROGRAMS_UI.prev, next: PROGRAMS_UI.next }}
          total={programs.length}
        >
          {programs.map((p) => (
            <ProgramCard key={p.id} program={p} />
          ))}
          <div className="pg-photo" data-program-photo="">
            <Picture
              id="04"
              frame
              aspect={1}
              sizes="(min-width: 1280px) 480px, (min-width: 1024px) 440px, (min-width: 640px) 308px, calc(100vw - 84px)"
            />
          </div>
        </ProgramsBrowser>
      </div>
    </Section>
  );
}
