// SCAFFOLD STUB — replaced by the results section implementation.
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RESULTS_COPY } from "@/content/results";

export function Results() {
  return (
    <Section id="uspesi" theme="darker" labelledBy="uspesi-title">
      <div className="container-site">
        <SectionHeading id="uspesi-title" n={7} title={RESULTS_COPY.heading} align="right" />
        <p className="text-muted">TODO: results</p>
      </div>
    </Section>
  );
}
