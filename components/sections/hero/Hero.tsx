// SCAFFOLD STUB — replaced by the hero implementation.
import { HERO } from "@/content/copy";

export function Hero() {
  return (
    <section id="top" data-theme="dark" aria-labelledby="hero-title" className="relative min-h-[100svh]">
      <div className="container-site pt-32 pb-16">
        <p className="label-caps text-muted">{HERO.eyebrow}</p>
        <h1 id="hero-title" className="text-display-xl mt-6">{HERO.h1}</h1>
        <p className="mt-6 measure">{HERO.sub}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a className="btn btn-primary" href="#kontakt" data-booking="">{HERO.ctaPrimary}</a>
          <a className="btn btn-secondary" href="tel:+381600287631">{HERO.ctaSecondary}</a>
        </div>
      </div>
    </section>
  );
}
