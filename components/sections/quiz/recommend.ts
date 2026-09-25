/**
 * Quiz → programs hand-off (QP-10). When the quiz shows a result it dispatches
 *   window „kraguj:recommend“ { ids: ProgramId[], age: number | null }
 * and S3 stamps the recommended cards („Preporuka · 9 god.“). Leaving the result
 * (Nazad / Počnite ponovo) dispatches { ids: [], age: null }: the stamps clear.
 * Client-safe (no content imports).
 */
export const RECOMMEND_EVENT = "kraguj:recommend";

export interface RecommendDetail {
  /** Recommended program ids (content/programs.ts), in display order; [] = none. */
  ids: readonly string[];
  /** The child's age from step 1; null when cleared. */
  age: number | null;
}

export function announceRecommendation(detail: RecommendDetail): void {
  window.dispatchEvent(new CustomEvent<RecommendDetail>(RECOMMEND_EVENT, { detail }));
}
