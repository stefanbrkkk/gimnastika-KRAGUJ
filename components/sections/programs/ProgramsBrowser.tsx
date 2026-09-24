"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType, type MouseEvent, type ReactNode } from "react";
import { loadMotion } from "@/lib/load-motion";
import { DUR, EASE, motionAllowed, prefersLessMotion, STAGGER, whenNear } from "@/lib/motion-env";

/**
 * Programs island (initial bundle — keep it small, no gsap import here).
 * - Age chips filter the server-rendered cards (Flip ≤280ms, loaded lazily;
 *   reduced motion: instant + 150ms crossfade). Status in an aria-live region.
 * - Tap on a card (or its + button) opens the detail sheet, a lazily loaded chunk
 *   (prefetched together with Flip when the section is ≤1 viewport away).
 * - Apparatus icons draw once when their card enters (CSS, data-drawn).
 * - Pager for the mobile scroll-snap row (native scrolling stays the primary input).
 * Without JS: chips, pager and + buttons are hidden by CSS; every card is visible.
 */

type SheetModule = typeof import("./ProgramSheet");
type SheetComponent = SheetModule["default"];
/** One import() call site = one chunk, shared by the near-prefetch and the first tap. */
let sheetModule: Promise<SheetModule> | null = null;
const loadSheet = () => (sheetModule ??= import("./ProgramSheet"));

export interface BrowserChip {
  key: string;
  label: string;
  /** Visible program ids the chip keeps. */
  ids: readonly string[];
  /** aria-live status text ("" = nothing hidden). */
  status: string;
}

interface ProgramsBrowserProps {
  heading: ReactNode;
  chips: readonly BrowserChip[];
  filtersLabel: string;
  pager: { prev: string; next: string };
  total: number;
  /** Server-rendered cards (+ the photo frame). */
  children: ReactNode;
}

interface PagerState {
  i: number;
  n: number;
  atStart: boolean;
  atEnd: boolean;
}

const CARD = "[data-program-card]";

const visibleItems = (strip: HTMLElement) => Array.from(strip.children).filter((el): el is HTMLElement => el instanceof HTMLElement && !el.hidden);

export function ProgramsBrowser({ heading, chips, filtersLabel, pager, total, children }: ProgramsBrowserProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const filterRun = useRef(0);
  const [active, setActive] = useState(chips[0]?.key ?? "");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<{ id: string; card: HTMLElement } | null>(null);
  const [Sheet, setSheet] = useState<ComponentType<Parameters<SheetComponent>[0]> | null>(null);
  const [page, setPage] = useState<PagerState>({ i: 0, n: total, atStart: true, atEnd: false });

  /* Pager: index of the card at the snap start; rAF-throttled, no loop. */
  const measure = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const items = visibleItems(strip);
    const cards = items.filter((el) => el.matches(CARD));
    const pad = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
    const x = strip.scrollLeft;
    const max = strip.scrollWidth - strip.clientWidth;
    let i = 0;
    let best = Infinity;
    cards.forEach((c, k) => {
      const d = Math.abs(c.offsetLeft - pad - x);
      if (d < best) {
        best = d;
        i = k;
      }
    });
    const atEnd = x >= max - 2;
    if (atEnd) i = cards.length - 1;
    const next = { i, n: cards.length, atStart: x <= 2, atEnd };
    setPage((prev) =>
      prev.i === next.i && prev.n === next.n && prev.atStart === next.atStart && prev.atEnd === next.atEnd ? prev : next,
    );
  }, []);

  useEffect(() => {
    const strip = stripRef.current;
    const root = rootRef.current;
    if (!strip || !root) return;

    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => ((raf = 0), measure()));
    };
    strip.addEventListener("scroll", onScroll, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onScroll) : null;
    ro?.observe(strip);
    measure();

    /* Icons draw once on enter. Without motion they are simply drawn. */
    const cards = Array.from(strip.querySelectorAll<HTMLElement>(CARD));
    let io: IntersectionObserver | null = null;
    if (!motionAllowed() || typeof IntersectionObserver === "undefined") {
      cards.forEach((c) => c.setAttribute("data-drawn", ""));
    } else {
      io = new IntersectionObserver(
        (entries) => {
          let k = 0;
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const el = e.target as HTMLElement;
            el.style.setProperty("--draw-delay", `${Math.min(k++ * STAGGER.cards, STAGGER.maxTotal)}s`);
            el.setAttribute("data-drawn", "");
            io?.unobserve(el);
          }
        },
        { threshold: 0.35 },
      );
      cards.forEach((c) => io!.observe(c));
    }

    /* Warm up the sheet chunk and Flip when the section is ≤1 viewport away. */
    const stopNear = whenNear(root, () => {
      void loadSheet();
      if (motionAllowed()) void loadMotion().then((m) => m.loadFlip());
    });

    return () => {
      strip.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      stopNear();
    };
  }, [measure]);

  const applyFilter = useCallback(
    async (chip: BrowserChip) => {
      const strip = stripRef.current;
      if (!strip) return;
      const run = ++filterRun.current;
      setActive(chip.key);
      setStatus(chip.status);

      const items = Array.from(strip.children).filter((el): el is HTMLElement => el instanceof HTMLElement);
      const apply = () => {
        for (const el of items) {
          if (el.matches(CARD)) el.hidden = !chip.ids.includes(el.dataset.programId ?? "");
        }
        strip.scrollTo({ left: 0, behavior: "instant" });
      };

      if (motionAllowed()) {
        const { gsap, loadFlip } = await loadMotion();
        const Flip = await loadFlip();
        if (run !== filterRun.current) return;
        const state = Flip.getState(items);
        apply();
        Flip.from(state, {
          duration: DUR.base,
          ease: EASE.stick,
          scale: true,
          absoluteOnLeave: true,
          onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: DUR.base, ease: EASE.stick }),
          onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.96, duration: DUR.fast, ease: EASE.takeoff }),
          onComplete: measure,
        });
      } else {
        apply();
        for (const el of items) {
          el.style.opacity = "";
          el.style.transform = "";
        }
        if (typeof strip.animate === "function") strip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "linear" });
        measure();
      }
    },
    [measure],
  );

  const onStripClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    const card = target.closest<HTMLElement>(CARD);
    if (!card || !stripRef.current?.contains(card)) return;
    if (target.closest("a")) return; // CTAs are handled by the booking/schedule delegates
    if (target.closest("button") && !target.closest("[data-program-open]")) return;
    if (!target.closest("[data-program-open]") && window.getSelection()?.toString()) return; // text selection, not a tap
    const next = { id: card.dataset.programId ?? "", card };
    void loadSheet().then((m) => {
      setSheet(() => m.default);
      setOpen(next);
    });
  };

  const go = (dir: 1 | -1) => {
    const strip = stripRef.current;
    if (!strip) return;
    const items = visibleItems(strip);
    const pad = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
    const x = strip.scrollLeft;
    const starts = items.map((el) => el.offsetLeft - pad);
    const target = dir > 0 ? starts.find((s) => s > x + 4) : [...starts].reverse().find((s) => s < x - 4);
    strip.scrollTo({ left: target ?? (dir > 0 ? strip.scrollWidth : 0), behavior: prefersLessMotion() ? "instant" : "smooth" });
  };

  return (
    <div ref={rootRef} className="programs-browser">
      <div className="pg-head">
        {heading}
        <div className="pg-filters">
          <div className="pg-chips" role="group" aria-label={filtersLabel}>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="pg-chip"
                aria-pressed={active === chip.key}
                aria-controls="programi-lista"
                onClick={() => void applyFilter(chip)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="pg-chip__check">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
                {chip.label}
              </button>
            ))}
          </div>
          <p className="pg-status text-small" role="status" aria-live="polite">
            {status}
          </p>
        </div>
      </div>

      <div ref={stripRef} id="programi-lista" className="pg-strip" data-programs-strip="" onClick={onStripClick}>
        {children}
      </div>

      <div className="pg-pager" hidden={page.atStart && page.atEnd}>
        <button type="button" className="pg-pager__btn" aria-label={pager.prev} disabled={page.atStart} onClick={() => go(-1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M14.5 6l-6 6 6 6" />
          </svg>
        </button>
        <span className="pg-pager__count label-caps tabular" aria-hidden="true">
          {page.i + 1} / {page.n}
        </span>
        <button type="button" className="pg-pager__btn" aria-label={pager.next} disabled={page.atEnd} onClick={() => go(1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9.5 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      {open && Sheet ? <Sheet programId={open.id} card={open.card} onClosed={() => setOpen(null)} /> : null}
    </div>
  );
}
