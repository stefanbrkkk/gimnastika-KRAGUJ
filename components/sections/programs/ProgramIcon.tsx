import type { ApparatusIcon } from "@/content/programs";

/**
 * Apparatus line icons, drawn for this site (viewBox 48, one 2-unit round stroke).
 * Each icon is ONE path with pathLength=1 so CSS can draw it with
 * stroke-dashoffset (styles/sections/programs.css). Static without motion.
 *   parter  — the floor: a square mat in perspective
 *   greda   — a long beam on two legs
 *   razboj  — uneven bars: a low and a high rail on uprights, with guy wires
 *   preskok — the vault table
 *   aerobik — a figure in a star jump
 */
const PATHS: Record<ApparatusIcon, string> = {
  parter: "M4 31L13 21H44L35 31ZM4 31V36H35V31M35 36L44 26V21",
  greda: "M5 16.5H43A1.5 1.5 0 0 1 44.5 18V19A1.5 1.5 0 0 1 43 20.5H5A1.5 1.5 0 0 1 3.5 19V18A1.5 1.5 0 0 1 5 16.5ZM12 20.5L10.5 37M36 20.5L37.5 37M6 37H15M33 37H42",
  razboj: "M13 11H43M16 11V42M46 42L40 11V42M4 26H32M29 26V42M7 42V26L2 42",
  preskok: "M9 11H39A3 3 0 0 1 42 14V15A3 3 0 0 1 39 18H9A3 3 0 0 1 6 15V14A3 3 0 0 1 9 11ZM20 18V33M28 18V33M12 33H36L39 39H9Z",
  aerobik: "M27.5 8.5A3.5 3.5 0 1 1 20.5 8.5A3.5 3.5 0 1 1 27.5 8.5ZM24 12.5V27M12 6.5L24 17L36 6.5M14 42L24 27L34 42",
};

interface ProgramIconProps {
  icon: ApparatusIcon;
  /** Accessible name (content/programs.ts iconLabel). */
  label: string;
  className?: string;
}

export function ProgramIcon({ icon, label, className }: ProgramIconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" role="img" aria-label={label} focusable="false">
      <path d={PATHS[icon]} pathLength={1} data-draw="" />
    </svg>
  );
}
