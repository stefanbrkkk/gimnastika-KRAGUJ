/**
 * The 404 h1 as four phrases, display only (content/copy.ts and the document title
 * keep the plain sentence): „Ups —“ · „ova stranica“ · „je izgubila“ · „ravnotežu.“
 * The h1 breaks only between them, and which of the three breaks are taken is set
 * per width in styles/sections/notfound.css (.nf__br--1/2/3), at the rag Mona Sans
 * sets there. Every fallback face is narrower than Mona Sans at 104–120% width, so
 * with the breaks fixed a slow font swaps the glyphs but never changes the number of
 * lines, and nothing under the h1 moves when it arrives (MD3-02).
 * Non-breaking spaces as typesetSr() sets them (the dash stays with „Ups“), plus
 * „ova stranica“: the demonstrative never leaves its noun.
 */
const PHRASES = ["Ups —", "ova stranica", "je izgubila", "ravnotežu."] as const;

/** The phrases when they still spell `title`, else null (the h1 then renders as one typeset string). */
export function titlePhrases(title: string): readonly string[] | null {
  return PHRASES.join(" ").replace(/ /g, " ") === title ? PHRASES : null;
}
