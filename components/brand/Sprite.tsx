import { LEAP_PATH, LEAP_VIEWBOX, WORDMARK_PATH } from "./sprite-paths.generated";

const { x, y, width, height } = LEAP_VIEWBOX;

/**
 * Inline SVG sprite, rendered once at the top of <body>.
 * - #leap: the leaping gymnast (viewBox = its box inside the logo)
 * - #wordmark: the logo without the silhouette (viewBox 0 0 490 213)
 * Both use fill="currentColor". The wordmark has a small gap in the "j" where
 * the leg crosses it — always show wordmark + silhouette together.
 */
export function Sprite() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        <symbol id="leap" viewBox={`${x} ${y} ${width} ${height}`}>
          <path fill="currentColor" fillRule="evenodd" d={LEAP_PATH} />
        </symbol>
        <symbol id="wordmark" viewBox="0 0 490 213">
          <path fill="currentColor" fillRule="evenodd" d={WORDMARK_PATH} />
        </symbol>
      </defs>
    </svg>
  );
}
