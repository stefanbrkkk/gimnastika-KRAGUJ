import type { ReactNode } from "react";

/**
 * Page-chrome line icons, drawn for this site: 24×24 grid, 1.75 stroke, round
 * caps and joins, currentColor. Always paired with a visible text label.
 */
function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={["chrome-icon", className].filter(Boolean).join(" ")}
    >
      {children}
    </svg>
  );
}

type IconProps = { className?: string };

/** Menu: two bars at different heights — the uneven bars (dvovisinski razboj). */
export const MenuIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M3.5 8h17" />
    <path d="M3.5 16h11" />
  </Icon>
);

export const CloseIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const PhoneIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M7 3.5h2.6l1.4 4.1-2.1 1.5a11.5 11.5 0 0 0 6 6l1.5-2.1 4.1 1.4V17a2.5 2.5 0 0 1-2.7 2.5A15.8 15.8 0 0 1 4.5 6.2 2.5 2.5 0 0 1 7 3.5z" />
  </Icon>
);

export const MessageIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-8.5L6 20v-3.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5z" />
    <path d="M8 9.5h8M8 12.5h5" />
  </Icon>
);

/** Viber: a rounded speech bubble with a handset inside (only when FLAGS.SHOW_VIBER). */
export const ViberIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M12 3.5c4.8 0 8.5 2.9 8.5 7.4s-3.7 7.4-8.5 7.4c-.8 0-1.6-.1-2.3-.3L6 20.5v-3.6C4.4 15.6 3.5 13.4 3.5 10.9 3.5 6.4 7.2 3.5 12 3.5z" />
    <path d="M9.6 8.2h1.2l.6 1.7-.8.6a4.6 4.6 0 0 0 2.2 2.2l.6-.8 1.7.6v1.2a1 1 0 0 1-1.1 1A5.8 5.8 0 0 1 8.6 9.3a1 1 0 0 1 1-1.1z" />
  </Icon>
);

/** Schedule: a calendar page with the week's training dots. */
export const ScheduleIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    <path d="M7.5 13.5h.01M12 13.5h.01M16.5 13.5h.01M7.5 17h.01M12 17h.01" strokeWidth="2.4" />
  </Icon>
);

export const InstagramIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="3.9" />
    <path d="M17.2 6.8h.01" strokeWidth="2.4" />
  </Icon>
);

export const FacebookIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <path d="M15.5 8h-1.7a2.3 2.3 0 0 0-2.3 2.3V20.5M9.5 13h5" />
  </Icon>
);

/** External link arrow (↗) as a drawn icon. */
export const ExternalIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M7.5 16.5l9-9M9.5 7.5h7v7" />
  </Icon>
);
