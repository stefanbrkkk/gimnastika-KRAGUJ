// OWNED BY THE SEO AGENT — metadata + JSON-LD builders. Scaffold stub.
import type { Metadata } from "next";
import { FLAGS, SEO, SITE_URL } from "@/content/site";

export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SEO.title,
  description: SEO.description,
  alternates: { canonical: "/" },
  robots: FLAGS.INDEXABLE ? { index: true, follow: true } : { index: false, follow: false },
};
