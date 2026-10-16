/* eslint-disable @next/next/no-html-link-for-pages -- Full-document navigation preserves the static export postprocessed CSS and RSC payload. */
import type { ReactNode } from "react";
import { CLUB, PRIMARY_PHONE } from "@/content/site";
import { telHref } from "@/lib/links";
import styles from "./blog.module.css";

export default function BlogLayout({ children }: { children: ReactNode }) {
  return <div className={styles.shell}>
    <header className={styles.header}>
      <a href="/" aria-label={`${CLUB.brandName} — početna`} className={styles.brand}>
        {/* Existing vector logo is served directly, without a JS image runtime. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/kraguj-logo-navy.svg" width="138" height="60" alt={CLUB.brandName} />
      </a>
      <nav aria-label="Navigacija bloga" className={styles.nav}>
        <a href="/">Početna</a><a href="/#programi">Programi i termini</a><a href="/blog">Vodiči za roditelje</a>
      </nav>
      <a href="/#kontakt" className={styles.button}>Probni trening</a>
    </header>
    <main id="sadrzaj" tabIndex={-1} className={styles.main}>{children}</main>
    <footer className={styles.footer}>
      <p>{CLUB.legalName} · Kragujevac</p>
      <p>Treninzi: škola „Toza Dragović“, Save Kovačevića 25.</p>
      <nav aria-label="Kontakt i korisni linkovi"><a href={telHref(PRIMARY_PHONE.e164)}>{PRIMARY_PHONE.display}</a><a href="/#kontakt">Kontakt i dolazak</a><a href="/blog/rss.xml">RSS</a></nav>
    </footer>
  </div>;
}
