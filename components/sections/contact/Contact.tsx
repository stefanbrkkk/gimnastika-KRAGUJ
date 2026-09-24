// SCAFFOLD STUB — replaced by the contact section implementation.
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CONTACT } from "@/content/copy";

export function Contact() {
  return (
    <Section id="kontakt" theme="dark" labelledBy="kontakt-title">
      <div className="container-site">
        <SectionHeading id="kontakt-title" n={11} title={CONTACT.heading} align="right" />
        <p className="text-muted">TODO: contact</p>
      </div>
    </Section>
  );
}
