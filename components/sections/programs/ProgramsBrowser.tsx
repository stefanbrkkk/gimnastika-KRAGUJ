"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { loadMotion } from "@/lib/load-motion";
import { DUR, EASE, motionAllowed, prefersLessMotion, queuePrimaryMotion, STAGGER, whenNear } from "@/lib/motion-env";

/**
 * Programs island (initial bundle — keep it small, no gsap import here).
 * - Age chips filter the server-rendered cards (Flip ≤280ms, loaded lazily;
 *   reduced motion: instant + 150ms crossfade). Status in an aria-live region.
 * - Tap on a card (or its + button) opens the detail sheet, a lazily loaded chunk
 *   (prefetched together with Flip when the section is ≤1 viewport away).
 * - Apparatus icons draw once when their card's plate is in view (CSS, data-drawn), after
 *   the section title has landed and through the page-wide primary-motion queue. Watching
 *   the 108px plate (not the whole card) makes every visible icon draw in one batch.
 * - Filter Flip: the state is captured BEFORE React commits the chip, status line and pager,
 *   so every layout change of the tap (status row, ✓ width, pager) moves inside the Flip.
 * - Pager for the mobile/tablet scroll-snap row (native scrolling stays the primary
 *   input). It sits above the row, next to the filter status, so it never floats
 *   under a short card; it counts program cards only (not the photo frame).
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
/** The colored plate that holds the apparatus icon (what the draw is about). */
const PLATE = ".pc-plate";
/** Set on cards that are leaving during a filter Flip: they must stay rendered while they fade
 *  (Tailwind's preflight makes [hidden] display:none!important, which Flip cannot override). */
const OUT = "data-out";
/** Section title landing (styles/ui.css .chrono-solid: 0.2s delay + 0.6s). */
const LAND_MS = 800;
/** Icon draw (programs.css): 0.6s + its stagger. */
const DRAW_MS = DUR.reveal * 1000;

const visibleItems = (strip: HTMLElement) =>
  Array.from(strip.children).filter((el): el is HTMLElement => el instanceof HTMLElement && !el.hidden && !el.hasAttribute(OUT));

export function ProgramsBrowser({ heading, chips, filtersLabel, pager, total, children }: ProgramsBrowserProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const filterRun = useRef(0);
  /** Flip is loaded (near warm-up done): a tap can capture the layout before anything commits. */
  const flipReady = useRef(false);
  const [active, setActive] = useState(chips[0]?.key ?? "");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<{ id: string; card: HTMLElement } | null>(null);
  const [Sheet, setSheet] = useState<ComponentType<Parameters<SheetComponent>[0]> | null>(null);
  const [page, setPage] = useState<PagerState>({ i: 0, n: total, atStart: true, atEnd: false });
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  /** Pager arrow that last had focus (cleared when focus moves on to something else). */
  const pagerFocus = useRef<HTMLButtonElement | null>(null);
  const prevOff = page.atStart;
  const nextOff = page.atEnd || page.i >= page.n - 1;

  /* An arrow that disables itself while focused would drop keyboard focus to <body>:
     hand it to the other arrow instead. */
  useEffect(() => {
    const was = pagerFocus.current;
    const active = document.activeElement;
    if (!was || (active !== was && active !== document.body)) return;
    if (nextOff && was === nextRef.current && !prevOff) prevRef.current?.focus();
    else if (prevOff && was === prevRef.current && !nextOff) nextRef.current?.focus();
  }, [prevOff, nextOff]);
  const pagerFocusProps = {
    onFocus: (e: FocusEvent<HTMLButtonElement>) => (pagerFocus.current = e.currentTarget),
    onBlur: (e: FocusEvent<HTMLButtonElement>) => {
      if (e.relatedTarget) pagerFocus.current = null;
    },
  };

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
    const next = { i: Math.max(i, 0), n: cards.length, atStart: x <= 2, atEnd };
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

    /* Icons draw once on enter. Without motion they are simply drawn. With motion, a batch
       waits for the section title's landing to finish, then for the page-wide primary-motion
       queue (§4: one primary motion per viewport). The plate is observed, not the card: a
       tall card is barely 35% visible while its plate is fully in view, which split the two
       desktop rows into two draws and could leave row-2 plates empty at rest. */
    const cards = Array.from(strip.querySelectorAll<HTMLElement>(CARD));
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    const timers = new Set<number>();
    let disposed = false;
    if (!motionAllowed() || typeof IntersectionObserver === "undefined") {
      cards.forEach((c) => c.setAttribute("data-drawn", ""));
    } else {
      const mark = root.closest("section")?.querySelector(".chrono-mark[data-land]") ?? null;
      let landedAt = mark && !mark.hasAttribute("data-landed") ? Infinity : -Infinity;
      if (mark && landedAt === Infinity) {
        mo = new MutationObserver(() => {
          if (!mark.hasAttribute("data-landed")) return;
          landedAt = performance.now();
          mo?.disconnect();
        });
        mo.observe(mark, { attributes: true, attributeFilter: ["data-landed"] });
      }
      const draw = (batch: HTMLElement[]) => {
        if (disposed) return;
        batch.forEach((el, k) => {
          el.style.setProperty("--draw-delay", `${Math.min(k * STAGGER.cards, STAGGER.maxTotal)}s`);
          el.setAttribute("data-drawn", "");
        });
      };
      /* Plates that came into view and are waiting for their draw. Everything that arrives
         before the draw starts joins the same batch (one staggered motion), so two desktop
         rows crossing the threshold a moment apart still draw together. Only plates that are
         really in view join: never the off-screen cards of the phone row. */
      let pending: HTMLElement[] = [];
      let waiting = false;
      io = new IntersectionObserver(
        (entries) => {
          const hits = entries.filter((e) => e.isIntersecting);
          if (!hits.length) return;
          hits.forEach((e) => io?.unobserve(e.target));
          pending.push(...hits.map((e) => (e.target.closest<HTMLElement>(CARD) ?? e.target) as HTMLElement));
          if (waiting) return;
          waiting = true;
          // Title not landed yet (it lands as it enters): give it its full landing time.
          const wait = landedAt === Infinity ? LAND_MS : Math.max(0, landedAt + LAND_MS - performance.now());
          const t = window.setTimeout(() => {
            timers.delete(t);
            const stagger = Math.min((pending.length - 1) * STAGGER.cards, STAGGER.maxTotal) * 1000;
            void queuePrimaryMotion(DRAW_MS + stagger).then(() => {
              const batch = pending;
              pending = [];
              waiting = false;
              draw(batch);
            });
          }, wait);
          timers.add(t);
        },
        { threshold: 0.6 },
      );
      cards.forEach((c) => io!.observe(c.querySelector(PLATE) ?? c));
    }

    /* Warm up the sheet chunk and Flip when the section is ≤1 viewport away. */
    const stopNear = whenNear(root, () => {
      void loadSheet();
      if (motionAllowed())
        void loadMotion()
          .then((m) => m.loadFlip())
          .then(() => {
            flipReady.current = true;
          });
    });

    return () => {
      disposed = true;
      strip.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      mo?.disconnect();
      timers.forEach((t) => clearTimeout(t));
      stopNear();
    };
  }, [measure]);

  const applyFilter = useCallback(
    async (chip: BrowserChip) => {
      const strip = stripRef.current;
      if (!strip) return;
      const run = ++filterRun.current;

      const items = Array.from(strip.children).filter((el): el is HTMLElement => el instanceof HTMLElement);
      const cards = items.filter((el) => el.matches(CARD));
      const keeps = (el: HTMLElement) => chip.ids.includes(el.dataset.programId ?? "");
      /** Final state: filtered-out cards are hidden (a11y tree included). */
      const settle = () => {
        for (const el of cards) {
          el.hidden = !keeps(el);
          el.removeAttribute(OUT);
        }
      };

      if (motionAllowed()) {
        // Tap before the near warm-up finished (rare): press the chip now, the rest follows.
        if (!flipReady.current) setActive(chip.key);
        const { gsap, loadFlip } = await loadMotion();
        const Flip = await loadFlip();
        flipReady.current = true;
        if (run !== filterRun.current) return;
        // getState() completes a Flip still running from a previous chip. It runs before the
        // chip / status / pager commit, so their layout shift is part of the Flip.
        const state = Flip.getState(items);
        // Leaving cards get data-out (display:none in CSS, which Flip's inline display beats) so
        // their fade actually renders; `hidden` is set once the Flip is done.
        for (const el of cards) {
          if (keeps(el)) {
            el.hidden = false;
            el.removeAttribute(OUT);
          } else if (!el.hidden) {
            el.setAttribute(OUT, "");
          }
        }
        strip.scrollTo({ left: 0, behavior: "instant" });
        // One commit: pressed chip, status line and the real pager state of the final row
        // (measure() reads the DOM above, where leaving cards are already display:none).
        flushSync(() => {
          setActive(chip.key);
          setStatus(chip.status);
          measure();
        });
        Flip.from(state, {
          duration: DUR.base,
          ease: EASE.stick,
          scale: true,
          absoluteOnLeave: true,
          // Same enter/leave as the S4/S9 filters: a linear fade, so a leaving card is already
          // half gone while the others glide past it; the exit scale keeps the takeoff ease.
          onEnter: (els) =>
            gsap.fromTo(
              els,
              { opacity: 0, scale: 0.96 },
              { opacity: 1, scale: 1, duration: DUR.base, ease: EASE.stick, clearProps: "opacity,transform" },
            ),
          onLeave: (els) =>
            gsap
              .timeline()
              .to(els, { opacity: 0, duration: DUR.fast, ease: "none" }, 0)
              .to(els, { scale: 0.96, duration: DUR.fast, ease: EASE.takeoff }, 0),
          onComplete: () => {
            if (run === filterRun.current) settle();
            measure();
          },
        });
      } else {
        setActive(chip.key);
        setStatus(chip.status);
        settle();
        strip.scrollTo({ left: 0, behavior: "instant" });
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
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="pg-chip__check ui-icon">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
                {chip.label}
              </button>
            ))}
          </div>
          <p className="pg-status text-small" role="status" aria-live="polite">
            {status}
          </p>
          {/* Controls precede the row they drive; hidden when there is nothing to page through. */}
          <div className="pg-pager" hidden={page.n <= 1 || (page.atStart && page.atEnd)}>
            <button
              ref={prevRef}
              type="button"
              className="icon-btn pg-pager__btn"
              aria-label={pager.prev}
              aria-controls="programi-lista"
              disabled={prevOff}
              {...pagerFocusProps}
              onClick={() => go(-1)}
            >
              <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M14.5 6l-6 6 6 6" />
              </svg>
            </button>
            <span className="pg-pager__count label-caps tabular" aria-hidden="true">
              {page.i + 1} / {page.n}
            </span>
            <button
              ref={nextRef}
              type="button"
              className="icon-btn pg-pager__btn"
              aria-label={pager.next}
              aria-controls="programi-lista"
              disabled={nextOff}
              {...pagerFocusProps}
              onClick={() => go(1)}
            >
              <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9.5 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div ref={stripRef} id="programi-lista" className="pg-strip" data-programs-strip="" onClick={onStripClick}>
        {children}
      </div>

      {open && Sheet ? <Sheet programId={open.id} card={open.card} onClosed={() => setOpen(null)} /> : null}
    </div>
  );
}
