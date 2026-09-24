// SCAFFOLD STUB — replaced by the enrollment section implementation.
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ENROLLMENT } from "@/content/copy";

export function Enrollment() {
  return (
    <Section id="upis" theme="light" labelledBy="upis-title">
      <div className="container-site">
        <SectionHeading id="upis-title" n={10} title={ENROLLMENT.heading} align="left" />
        <p className="text-muted">TODO: enrollment</p>
      </div>
    </Section>
  );
}
