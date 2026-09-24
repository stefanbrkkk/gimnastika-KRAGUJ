// SCAFFOLD STUB — replaced by the gallery section implementation.
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GALLERY_COPY } from "@/content/gallery";

export function Gallery() {
  return (
    <Section id="galerija" theme="ice" labelledBy="galerija-title">
      <div className="container-site">
        <SectionHeading id="galerija-title" n={9} title={GALLERY_COPY.heading} align="right" />
        <p className="text-muted">TODO: gallery</p>
      </div>
    </Section>
  );
}
