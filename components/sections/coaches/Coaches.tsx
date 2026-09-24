// SCAFFOLD STUB — replaced by the coaches section implementation.
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { COACHES_COPY } from "@/content/copy";

export function Coaches() {
  return (
    <Section id="treneri" theme="light" labelledBy="treneri-title">
      <div className="container-site">
        <SectionHeading id="treneri-title" n={6} title={COACHES_COPY.heading} align="left" />
        <p className="text-muted">TODO: coaches</p>
      </div>
    </Section>
  );
}
