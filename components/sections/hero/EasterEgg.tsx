"use client";

/**
 * Easter egg (loaded on the third tap on the landed silhouette): a Doto
 * scoreboard shows „10.00“ and flips to „1.00“ — Montreal 1976, when the
 * board could not show a perfect ten. The story text is announced by the
 * hero's aria-live region (HeroMotionLoader); the numerals are decorative.
 */
import { useEffect, useRef, useState } from "react";
import { HERO } from "@/content/copy";
import { DUR } from "@/lib/motion-env";
import { typesetSr } from "@/lib/typeset";

const CLOSE_LABEL = "Zatvorite";
/**
 * Display typesetting (a dash never starts a line, „1976. dobila“ holds). This
 * lazy chunk is the only place the story is shown, so the helper adds nothing
 * to the first load.
 */
const STORY = typesetSr(HERO.easterEgg.tooltip);

export default function EasterEgg({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const panel = ref.current;
    const section = document.getElementById("top");
    if (!panel || !section) return;

    // Anchor under the landed silhouette of the visible art variant, inside the section.
    const place = () => {
      const hit = Array.from(section.querySelectorAll<SVGRectElement>("[data-hero-leap-hit]"))
        .map((el) => el.getBoundingClientRect())
        .find((r) => r.width > 0);
      if (!hit) return;
      const s = section.getBoundingClientRect();
      const margin = 16;
      const width = panel.offsetWidth;
      const left = Math.min(Math.max(hit.right - s.left - width, margin), section.clientWidth - width - margin);
      panel.style.left = `${Math.round(left)}px`;
      panel.style.top = `${Math.round(hit.bottom - s.top + 8)}px`;
    };
    place();
    window.addEventListener("resize", place);

    // „10.00“ holds for a beat (the reveal duration), then the board flips.
    const timer = window.setTimeout(() => setFlipped(true), DUR.reveal * 1000);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !panel.contains(e.target)) onClose();
    };
    document.addEventListener("keydown", onKey);
    // Next tick, so the tap that opened the egg does not close it.
    const arm = window.setTimeout(() => document.addEventListener("pointerdown", onDown), 0);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(arm);
      window.removeEventListener("resize", place);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="hero-egg" data-flipped={flipped ? "" : undefined}>
      <div className="hero-egg__board" aria-hidden="true">
        <span className="hero-egg__face hero-egg__face--from font-dot">{HERO.easterEgg.scoreFrom}</span>
        <span className="hero-egg__face hero-egg__face--to font-dot">{HERO.easterEgg.scoreTo}</span>
      </div>
      <p className="hero-egg__text">{STORY}</p>
      <button type="button" className="hero-egg__close" onClick={onClose} aria-label={CLOSE_LABEL}>
        <svg className="ui-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}
