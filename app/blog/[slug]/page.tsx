/* eslint-disable @next/next/no-html-link-for-pages -- Full-document navigation preserves the static export postprocessed CSS and RSC payload. */
import { FLAGS } from "@/content/site";
import { notFound } from "next/navigation";
import { ARTICLES, getArticle } from "@/content/articles";
import { buildArticleJsonLd, buildEditorialMetadata } from "@/lib/editorial";
import { serializeJsonLd } from "@/lib/seo";
import styles from "../blog.module.css";

export const dynamicParams = false;
export function generateStaticParams() { return ARTICLES.map(article => ({ slug: article.slug })); }
export async function generateMetadata({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  const article = getArticle(slug);
  if (!article) notFound();
  return buildEditorialMetadata({title:article.title,description:article.description,path:`/blog/${article.slug}`,article});
}
export default async function ArticlePage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  const article = getArticle(slug);
  if (!article) notFound();
  const related = article.relatedSlugs.map(getArticle).filter(a => a !== undefined);
  return <>
    <nav className={styles.breadcrumbs} aria-label="Putanja stranice"><a href="/">Početna</a><span aria-hidden="true">/</span><a href="/blog">Vodiči za roditelje</a><span aria-hidden="true">/</span><span aria-current="page">{article.title}</span></nav>
    <article className={styles.article}>
      <header><p className={styles.eyebrow}>{article.category}</p><h1 className={styles.title}>{article.title}</h1>
        <p className={styles.meta}>Autor: GSU „Kraguj“ · Objavljeno <time dateTime={article.published}>{formatDate(article.published)}</time>{article.updated !== article.published && <> · Ažurirano <time dateTime={article.updated}>{formatDate(article.updated)}</time></>}</p>
        <p className={styles.lead}>{article.intro}</p>
      </header>
      <nav aria-label="Sadržaj članka" className={styles.toc}><p>U ovom vodiču</p><ul>{article.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.heading}</a></li>)}</ul></nav>
      {article.sections.map(section => <section key={section.id} id={section.id} className={styles.section}>
        <h2>{section.heading}</h2>{section.paragraphs.map(p => <p key={p}>{p}</p>)}
        {section.bullets && <ul>{section.bullets.map(b => <li key={b}>{b}</li>)}</ul>}
      </section>)}
      {article.faq.length > 0 && <section className={styles.section}><h2>Česta pitanja</h2>{article.faq.map(item => <div key={item.question}><h3>{item.question}</h3><p>{item.answer}</p></div>)}</section>}
      <aside className={styles.cta}><h2>Prvi korak je probni trening.</h2><p>U klubu Kraguj u Kragujevcu trenerica predlaže grupu prema uzrastu i iskustvu. Pozovite nas da dogovorimo dolazak. {FLAGS.FREE_TRIAL ? "Probni trening je besplatan." : "Za uslove probnog treninga javite se trenerici."}</p><a className={styles.button} href="/#kontakt">Dogovorite probni trening</a><a href="/#programi">Programi i aktuelni termini</a></aside>
      <section className={styles.sources}><h2>Izvori i informacije</h2><p>Podaci o grupama i upisu odnose se na klub Kraguj. Opšti delovi vodiča oslanjaju se na navedene izvore. Za aktuelan raspored i izbor grupe proverite <a href="/#programi">programe kluba</a> ili se javite trenerici.</p><ul>{article.sources.map(s => <li key={s.url}><a href={s.url}>{s.label}</a></li>)}</ul></section>
    </article>
    <aside className={styles.related}><h2>Pročitajte i</h2><ul>{related.map(a => <li key={a.slug}><a href={`/blog/${a.slug}`}>{a.title}</a></li>)}</ul></aside>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:serializeJsonLd(buildArticleJsonLd(article))}} />
  </>;
}
function formatDate(date: string) { return new Date(`${date}T12:00:00Z`).toLocaleDateString("sr-Latn-RS",{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Belgrade"}); }
