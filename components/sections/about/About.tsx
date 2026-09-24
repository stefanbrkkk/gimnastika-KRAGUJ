// SCAFFOLD STUB — replaced by the about section implementation.
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ABOUT } from "@/content/copy";

export function About() {
  return (
    <Section id="o-nama" theme="ice" labelledBy="o-nama-title">
      <div className="container-site">
        <SectionHeading id="o-nama-title" n={5} title={ABOUT.heading} align="right" />
        <p className="text-muted">TODO: about</p>
      </div>
    </Section>
  );
}
