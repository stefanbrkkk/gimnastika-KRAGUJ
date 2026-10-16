/* eslint-disable @next/next/no-html-link-for-pages -- Full-document navigation preserves the static export postprocessed CSS and RSC payload. */
import { FLAGS } from "@/content/site";
import { ARTICLES } from "@/content/articles";
import { buildBlogJsonLd, buildEditorialMetadata } from "@/lib/editorial";
import { serializeJsonLd } from "@/lib/seo";
import styles from "./blog.module.css";

export const metadata = buildEditorialMetadata({
  title: "Gimnastika za decu — vodiči za roditelje", path: "/blog",
  description: "Prvi trening, izbor grupe i razlike između sportske i aerobne gimnastike. Praktični vodiči za roditelje iz kluba Kraguj u Kragujevcu.",
});
export default function BlogPage() {
  return <>
    <p className={styles.eyebrow}>Kraguj · vodiči za roditelje</p>
    <h1 className={styles.title}>Gimnastika počinje dobrim pitanjem.</h1>
    <p className={styles.lead}>Od prvog treninga do izbora programa: jasni odgovori o gimnastici za decu, uz informacije o radu našeg kluba u Kragujevcu.</p>
    <div className={styles.list}>
      {ARTICLES.map(article => <article key={article.slug} className={styles.card}>
        <p className={styles.eyebrow}>{article.category}</p>
        <h2><a href={`/blog/${article.slug}`}>{article.title}</a></h2>
        <p>{article.description}</p>
        <p className={styles.meta}>GSU „Kraguj“ · <time dateTime={article.updated}>{new Date(article.updated).toLocaleDateString("sr-Latn-RS",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Belgrade"})}</time></p>
      </article>)}
    </div>
    <aside className={styles.cta}><h2>Tražite gimnastiku u Kragujevcu?</h2><p>Početne grupe su za decu od 3. godine i starije početnike od 8 godina. Upis traje cele godine. {FLAGS.FREE_TRIAL ? "Probni trening je besplatan uz prethodni dogovor." : "Za uslove probnog treninga javite se trenerici."}</p><a className={styles.button} href="/#programi">Pogledajte programe i termine</a></aside>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:serializeJsonLd(buildBlogJsonLd())}} />
  </>;
}
