/**
 * SEO: metadata, robots.txt, sitemap.xml and JSON-LD (§5 SEO, §6 Indexing).
 *
 * Every builder is a pure function of its options, so tests can exercise both
 * values of a flag. The exported constants (siteMetadata …) apply the current
 * flags from content/site.ts.
 *
 * INDEXABLE policy (DECISIONS): the flag controls ONLY the robots meta,
 * robots.txt and the sitemap.
 *   false → <meta name="robots" content="noindex, nofollow, noimageindex">;
 *           robots.txt keeps the HTML crawlable (a crawler must fetch a page to
 *           see its noindex; a Disallow would let the bare URL be indexed from
 *           links) but disallows /img/ so compliant crawlers never fetch the
 *           photos; no Sitemap line; sitemap.xml is an empty <urlset>.
 *   true  → index, follow; robots.txt allows everything and points to the
 *           sitemap; sitemap.xml lists SITE_URL/.
 * noindex is NOT consent: per-image publication rights and the photo flags decide what is emitted.
 */
import type { Metadata, MetadataRoute } from "next";
import { ARTICLES } from "@/content/articles";
import { COACHES, type Coach } from "@/content/copy";
import { visibleFaq, type FaqItem } from "@/content/faq";
import { CLUB, EMAIL, FLAGS, GSS, PAGE_UPDATED, PHONES, PRESS, PRIMARY_PHONE, SEO, SITE_URL, SOCIAL, VENUE } from "@/content/site";

/** Build-time generated assets (app/og.png/route.tsx, app/icons/[file]/route.tsx). */
export const OG_IMAGE = {
  path: "/og.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "Gimnastički klub Kraguj — logo kluba i silueta gimnastičarke u skoku",
} as const;

export const ICON_FILES = {
  svg: "icon.svg",
  png32: "icon-32.png",
  apple: "apple-touch-icon.png",
  png192: "icon-192.png",
  png512: "icon-512.png",
  maskable512: "icon-maskable-512.png",
  /** Full logo (wordmark + silhouette), navy on transparent — JSON-LD `logo`. */
  logo: "logo.png",
} as const;

export type IconFile = (typeof ICON_FILES)[keyof typeof ICON_FILES];
export const iconPath = (file: IconFile): string => `/icons/${file}`;

/** Home page URL with the trailing slash (sitemap, JSON-LD). */
export const homeUrl = (siteUrl: string = SITE_URL): string => `${siteUrl.replace(/\/$/, "")}/`;
/** Absolute URL for a root-relative path. */
export const absoluteUrl = (path: string, siteUrl: string = SITE_URL): string => new URL(path, homeUrl(siteUrl)).toString();

export interface IndexOptions {
  indexable: boolean;
  siteUrl?: string;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const robotsMeta = (indexable: boolean): NonNullable<Metadata["robots"]> =>
  indexable ? { index: true, follow: true } : { index: false, follow: false, noimageindex: true };

export function buildMetadata({ indexable, siteUrl = SITE_URL }: IndexOptions): Metadata {
  const ogImage = { url: OG_IMAGE.path, width: OG_IMAGE.width, height: OG_IMAGE.height, alt: OG_IMAGE.alt, type: OG_IMAGE.type };
  return {
    metadataBase: new URL(homeUrl(siteUrl)),
    title: SEO.title,
    description: SEO.description,
    applicationName: CLUB.brandName,
    alternates: { canonical: "/" },
    robots: robotsMeta(indexable),
    openGraph: {
      type: "website",
      locale: SEO.locale,
      url: "/",
      siteName: CLUB.brandName,
      title: SEO.title,
      description: SEO.description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: SEO.title,
      description: SEO.description,
      images: [ogImage],
    },
    icons: {
      icon: [
        { url: iconPath(ICON_FILES.svg), type: "image/svg+xml" },
        { url: iconPath(ICON_FILES.png32), sizes: "32x32", type: "image/png" },
      ],
      apple: [{ url: iconPath(ICON_FILES.apple), sizes: "180x180", type: "image/png" }],
    },
    // iOS home-screen label (the full <title> would be truncated); stays a normal browser page
    appleWebApp: { capable: false, title: "Kraguj" },
  };
}

export const siteMetadata: Metadata = buildMetadata({ indexable: FLAGS.INDEXABLE });

// ---------------------------------------------------------------------------
// robots.txt / sitemap.xml
// ---------------------------------------------------------------------------

export function buildRobots({ indexable, siteUrl = SITE_URL }: IndexOptions): MetadataRoute.Robots {
  if (indexable) {
    return { rules: { userAgent: "*", allow: "/" }, sitemap: absoluteUrl("/sitemap.xml", siteUrl) };
  }
  return { rules: { userAgent: "*", allow: "/", disallow: "/img/" } };
}

/** The newest article change — the blog index lists every article, so it changes with them. */
export const blogUpdated = (): string =>
  ARTICLES.map((article) => article.updated).reduce((latest, date) => (Date.parse(date) > Date.parse(latest) ? date : latest));

/**
 * Loc + lastmod: Google ignores changefreq/priority. Every lastmod is a real content-change
 * date kept by hand (PAGE_UPDATED, article.updated) — never the build time, which would teach
 * crawlers to distrust it.
 */
export function buildSitemap({ indexable, siteUrl = SITE_URL }: IndexOptions): MetadataRoute.Sitemap {
  return indexable ? [
    { url: homeUrl(siteUrl), lastModified: PAGE_UPDATED.home },
    { url: absoluteUrl("/blog", siteUrl), lastModified: blogUpdated() },
    ...ARTICLES.map(article => ({ url: absoluteUrl(`/blog/${article.slug}`, siteUrl), lastModified: article.updated })),
  ] : [];
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

type JsonLdNode = Record<string, unknown>;

export interface ClubJsonLdOptions {
  siteUrl?: string;
  showFacebook?: boolean;
  freeTrial?: boolean;
}

export const CLUB_ID = "#klub";
export const WEBSITE_ID = "#sajt";
export const HOME_PAGE_ID = "#pocetna";

const GSS_NODE: JsonLdNode = { "@type": "SportsOrganization", name: GSS.name, url: GSS.url };

/** „Slađana Kovačević“ → „sladjana-kovacevic“ (fragment ids for the coaches' Person nodes). */
const SLUG_MAP: Record<string, string> = { đ: "dj", č: "c", ć: "c", š: "s", ž: "z" };
export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[đčćšž]/g, (ch) => SLUG_MAP[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const coachId = (coach: Pick<Coach, "name">, siteUrl: string = SITE_URL): string => absoluteUrl(`/#${slugify(coach.name)}`, siteUrl);

export function buildAddress(): JsonLdNode {
  return {
    "@type": "PostalAddress",
    streetAddress: VENUE.street,
    postalCode: VENUE.postalCode,
    addressLocality: VENUE.city,
    addressCountry: VENUE.country,
  };
}

/**
 * The club (§5 SEO). No foundingDate — the founding year is not a verified date.
 *
 * Two types on purpose: SportsClub (a LocalBusiness — the place parents bring a child to) and
 * SportsOrganization (an association in a federation). `sport` exists only on the latter;
 * on a bare SportsClub validator.schema.org reports it as an unknown field.
 *
 * `address` is the TRAINING VENUE (where a parent actually goes), named again in `location`.
 * The registered seat (GSS directory: Cara Dušana 21) is deliberately not emitted — the club
 * has not asked to publish it, and two addresses on one LocalBusiness confuse map listings.
 * No openingHours (training times differ per group), no ratings, no reviews.
 */
export function buildSportsClub({
  siteUrl = SITE_URL,
  showFacebook = FLAGS.SHOW_FACEBOOK,
  freeTrial = FLAGS.FREE_TRIAL,
}: ClubJsonLdOptions = {}): JsonLdNode {
  const sameAs: string[] = [SOCIAL.instagram];
  if (showFacebook) sameAs.push(SOCIAL.facebook);
  return {
    "@type": ["SportsClub", "SportsOrganization"],
    "@id": absoluteUrl(`/${CLUB_ID}`, siteUrl),
    name: CLUB.legalName,
    alternateName: [CLUB.brandName, CLUB.instagramName],
    description: SEO.description,
    url: homeUrl(siteUrl),
    logo: absoluteUrl(iconPath(ICON_FILES.logo), siteUrl),
    image: absoluteUrl(OG_IMAGE.path, siteUrl),
    telephone: PRIMARY_PHONE.e164,
    email: EMAIL,
    contactPoint: PHONES.map((phone) => ({
      "@type": "ContactPoint",
      telephone: phone.e164,
      contactType: "upis i probni trening",
      availableLanguage: "sr",
    })),
    address: buildAddress(),
    location: {
      "@type": "Place",
      name: VENUE.name,
      address: buildAddress(),
      hasMap: VENUE.mapsUrl,
    },
    areaServed: { "@type": "City", name: CLUB.city },
    sameAs,
    memberOf: GSS_NODE,
    sport: ["Sportska gimnastika", "Aerobna gimnastika"],
    ...(freeTrial
      ? {
          makesOffer: {
            "@type": "Offer",
            name: "Besplatan probni trening",
            price: 0,
            priceCurrency: "RSD",
            url: absoluteUrl("/#kontakt", siteUrl),
            itemOffered: { "@type": "Service", name: "Probni trening gimnastike za decu", areaServed: CLUB.city },
          },
        }
      : {}),
    // Independent coverage (content/site.ts PRESS). CreativeWork, not NewsArticle: these are
    // other publishers' pages, not articles on this site.
    subjectOf: PRESS.map((item) => ({
      "@type": "CreativeWork",
      name: item.headline,
      url: item.url,
      datePublished: item.datePublished,
      publisher: { "@type": "Organization", name: item.publisher },
    })),
  };
}

/**
 * The coaches as Person nodes, built from the same COACHES list the „Trenerice“ section
 * renders: the job titles are the visible role lines, and a credential is emitted only for a
 * role that links its GSS source (licence lists). No bios, birth dates, licence numbers or
 * photos — nothing that is not on the page.
 */
export function buildCoaches({ siteUrl = SITE_URL }: { siteUrl?: string } = {}): JsonLdNode[] {
  return COACHES.map((coach) => {
    const credentials = coach.roles.filter((role) => role.sourceUrl);
    return {
      "@type": "Person",
      "@id": coachId(coach, siteUrl),
      name: coach.name,
      jobTitle: coach.roles.map((role) => role.text),
      affiliation: { "@id": absoluteUrl(`/${CLUB_ID}`, siteUrl) },
      url: absoluteUrl("/#treneri", siteUrl),
      ...(credentials.length > 0
        ? {
            hasCredential: credentials.map((role) => ({
              "@type": "EducationalOccupationalCredential",
              name: role.text,
              credentialCategory: "licenca",
              recognizedBy: GSS_NODE,
              url: role.sourceUrl,
            })),
          }
        : {}),
    };
  });
}

/** The home page itself: what it is about, and when its content last really changed. */
export function buildHomePage({ siteUrl = SITE_URL }: { siteUrl?: string } = {}): JsonLdNode {
  return {
    "@type": "WebPage",
    "@id": absoluteUrl(`/${HOME_PAGE_ID}`, siteUrl),
    url: homeUrl(siteUrl),
    name: SEO.title,
    description: SEO.description,
    inLanguage: "sr-Latn",
    isPartOf: { "@id": absoluteUrl(`/${WEBSITE_ID}`, siteUrl) },
    about: { "@id": absoluteUrl(`/${CLUB_ID}`, siteUrl) },
    primaryImageOfPage: { "@type": "ImageObject", url: absoluteUrl(OG_IMAGE.path, siteUrl), width: OG_IMAGE.width, height: OG_IMAGE.height },
    dateModified: PAGE_UPDATED.home,
  };
}

/** WebSite node: gives search engines the site name „Gimnastički klub Kraguj“. */
export function buildWebSite({ siteUrl = SITE_URL }: { siteUrl?: string } = {}): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": absoluteUrl(`/${WEBSITE_ID}`, siteUrl),
    name: CLUB.brandName,
    alternateName: [CLUB.shortName, CLUB.legalName],
    url: homeUrl(siteUrl),
    inLanguage: "sr-Latn",
    publisher: { "@id": absoluteUrl(`/${CLUB_ID}`, siteUrl) },
  };
}

/** FAQPage from the FAQ items visible under the current flags (content/faq.ts). */
export function buildFaqPage(items: readonly FaqItem[] = visibleFaq(), siteUrl: string = SITE_URL): JsonLdNode {
  return {
    "@type": "FAQPage",
    "@id": absoluteUrl("/#pitanja", siteUrl),
    inLanguage: "sr-Latn",
    mainEntity: items
      .filter((item) => item.a !== "")
      .map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
  };
}

export interface JsonLdOptions extends ClubJsonLdOptions {
  faq?: readonly FaqItem[];
}

/** One @graph: WebSite + the club + the home WebPage + the coaches + FAQPage. */
export function buildJsonLd({
  siteUrl = SITE_URL,
  showFacebook = FLAGS.SHOW_FACEBOOK,
  freeTrial = FLAGS.FREE_TRIAL,
  faq = visibleFaq(),
}: JsonLdOptions = {}): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildWebSite({ siteUrl }),
      buildSportsClub({ siteUrl, showFacebook, freeTrial }),
      buildHomePage({ siteUrl }),
      ...buildCoaches({ siteUrl }),
      buildFaqPage(faq, siteUrl),
    ],
  };
}

/**
 * Characters escaped in inline JSON-LD: "<" (so no "</script>" or "<!--" can end
 * the element), ">" and "&", and the JS line separators U+2028/U+2029.
 * Built from a string: a U+2028 inside a regex literal is a syntax error once a
 * compiler emits it raw.
 */
const UNSAFE_IN_SCRIPT = new RegExp("[<>&\\u2028\\u2029]", "g");

/** JSON for an inline <script type="application/ld+json">. JSON.parse returns the identical object. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(UNSAFE_IN_SCRIPT, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
