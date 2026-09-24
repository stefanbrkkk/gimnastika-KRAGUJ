// SCAFFOLD STUB — replaced by the programs section implementation.
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PROGRAMS_COPY } from "@/content/programs";

export function Programs() {
  return (
    <Section id="programi" theme="ice" labelledBy="programi-title">
      <div className="container-site">
        <SectionHeading id="programi-title" n={3} title={PROGRAMS_COPY.heading} align="right" />
        <p className="text-muted">TODO: programs</p>
      </div>
    </Section>
  );
}
