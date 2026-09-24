// SCAFFOLD STUB — replaced by the quiz section implementation.
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { QUIZ } from "@/content/copy";

export function Quiz() {
  return (
    <Section id="kviz" theme="light" labelledBy="kviz-title">
      <div className="container-site">
        <SectionHeading id="kviz-title" n={2} title={QUIZ.heading} align="left" />
        <p className="text-muted">TODO: quiz</p>
      </div>
    </Section>
  );
}
