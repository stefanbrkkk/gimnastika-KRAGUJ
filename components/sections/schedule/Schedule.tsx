// SCAFFOLD STUB — replaced by the schedule section implementation.
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SCHEDULE_LOCATION } from "@/content/schedule";

export function Schedule() {
  return (
    <Section id="raspored" theme="light" labelledBy="raspored-title">
      <div className="container-site">
        <SectionHeading id="raspored-title" n={4} title={SCHEDULE_LOCATION.heading} align="left" />
        <p className="text-muted">TODO: schedule</p>
      </div>
    </Section>
  );
}
