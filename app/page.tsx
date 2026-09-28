import { BookingSheet } from "@/components/booking/BookingSheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { About } from "@/components/sections/about/About";
import { Camp } from "@/components/sections/camp/Camp";
import { Coaches } from "@/components/sections/coaches/Coaches";
import { Contact } from "@/components/sections/contact/Contact";
import { Enrollment } from "@/components/sections/enrollment/Enrollment";
import { Footer } from "@/components/sections/footer/Footer";
import { Gallery } from "@/components/sections/gallery/Gallery";
import { Header } from "@/components/sections/header/Header";
import { StickyBar } from "@/components/sections/header/StickyBar";
import { Hero } from "@/components/sections/hero/Hero";
import { Programs } from "@/components/sections/programs/Programs";
import { Quiz } from "@/components/sections/quiz/Quiz";
import { Results } from "@/components/sections/results/Results";

/**
 * One page (§5). Section order, ids and themes:
 * S1 #top dark · S2 #kviz light · S3 #programi dark (programs + times) ·
 * S5 #o-nama light (dark „Hronologija“ band) · S6 #treneri light · S7 #uspesi darker · S8 #kamp light ·
 * S9 #galerija darker (edge up) · S10 #upis light · S11 #kontakt dark
 */
export default function HomePage() {
  return (
    <>
      <Header />
      <main id="sadrzaj" tabIndex={-1}>
        <Hero />
        <Quiz />
        <Programs />
        <About />
        <Coaches />
        <Results />
        <Camp />
        <Gallery />
        <Enrollment />
        <Contact />
      </main>
      <Footer />
      <StickyBar />
      <BookingSheet />
      <JsonLd />
    </>
  );
}
