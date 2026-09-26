import { Logo } from "@/components/brand/Logo";

/**
 * Footer mark: the full club logo in white, the last frame of the page's roll.
 * Static — the take-off ghost stream that used to follow it is gone (the logo is
 * the brand, not a trail: plan-figure-system §5.11). The menu sheet's „you are
 * here“ is a lavender bar in header.css, no figure (R5).
 */
export function FooterMark({ className, title }: { className?: string; title: string }) {
  return <Logo className={className} title={title} />;
}
