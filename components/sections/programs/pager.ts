/**
 * Where the phone row's „Prethodni / Sledeći program“ buttons scroll to (the swipe alternative,
 * WCAG 2.5.7). Pure, so it is unit-tested (tests/programs.test.ts) and ships in the island as a
 * few bytes.
 *
 * `starts` are the snap starts (offsetLeft − the row's padding) of the visible frames in DOM
 * order. The KR-04 photo is last in the DOM but first on screen (CSS order −1), so the starts are
 * sorted before searching (QP2-01: unsorted, „back“ always found the photo's 0 first and jumped
 * to the start of the row). One step = the nearest start more than 4px away in that direction;
 * past the last reachable start, the row's end (or its start).
 */
export function pagerTarget(starts: readonly number[], x: number, dir: 1 | -1, max: number): number {
  const sorted = [...starts].sort((a, b) => a - b);
  const target = dir > 0 ? sorted.find((s) => s > x + 4) : [...sorted].reverse().find((s) => s < x - 4);
  return Math.min(Math.max(target ?? (dir > 0 ? max : 0), 0), max);
}

/**
 * Where the row rests after an age filter (QP4-01): the first kept program's snap start
 * (`first`; null = „Sve“, which opens on the photo at 0), clamped to the end of the FINAL row —
 * `end` is the right edge of the last kept frame plus the row's end padding, measured on the
 * frames that stay, never on scrollWidth (it still counts the absolutely positioned leavers
 * while the Flip runs). In range once the leavers are hidden, so nothing snaps after the landing.
 */
export function restTarget(first: number | null, end: number, clientWidth: number): number {
  return Math.max(0, Math.min(first ?? 0, end - clientWidth));
}
