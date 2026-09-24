// SCAFFOLD STUB — replaced by the camp section implementation.
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CAMP } from "@/content/copy";

export function Camp() {
  return (
    <Section id="kamp" theme="light" labelledBy="kamp-title">
      <div className="container-site">
        <SectionHeading id="kamp-title" n={8} title={CAMP.heading} align="left" />
        <p className="text-muted">TODO: camp</p>
      </div>
    </Section>
  );
}
