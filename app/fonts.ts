import { Mona_Sans } from "next/font/google";
import localFont from "next/font/local";

/**
 * Mona Sans variable (wght 200–900, wdth 75–125), latin + latin-ext.
 * Google Fonts is fetched at build time (needs network). Offline fallback:
 * replace this export with
 *   localFont({ src: "../fonts/mona-sans-latin-ext.woff2", variable: "--font-mona",
 *     weight: "200 900", display: "swap",
 *     declarations: [{ prop: "font-stretch", value: "75% 125%" }] })
 * (OFL woff2 from github.com/github/mona-sans, subset to Latin + Latin Extended-A).
 */
export const mona = Mona_Sans({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-mona",
  display: "swap",
});

/** Doto dot-matrix, subset to digits . : – ~ (scoreboard numerals + easter egg only, ≥32px). */
export const doto = localFont({
  src: "../fonts/doto-scoreboard.woff2",
  variable: "--font-doto",
  weight: "400 900",
  display: "swap",
  preload: false,
  fallback: ["ui-monospace", "monospace"],
});
