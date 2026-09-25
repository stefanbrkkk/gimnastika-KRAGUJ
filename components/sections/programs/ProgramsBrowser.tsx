"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { motionAllowed, prefersLessMotion, whenNear } from "@/lib/motion-env";
import { pagerTarget } from "./pager";

/**
 * Programs island (initial bundle — keep it small: no gsap, no motion code here).
 * - Age chips filter the server-rendered cards. With motion the change is a take-off/landing
 *   Flip (./programs-motion, lazy); reduced motion: instant + 150ms crossfade. The pressed chip
 *   carries the program count; the status line is an aria-live region (sr-only on phones).
 * - Tap on a card (or its +) opens the detail sheet, a lazily loaded chunk.
 * - Progress rail under the phone row: prev · one dot per program (the active one in its
 *   colour, the club silhouette hopping onto it) · next. Native scrolling stays the primary input.
 * - Quiz hand-off (QP-10): on „kraguj:recommend“ the recommended cards get a stamp and, while
 *   the row is off-screen, the phone row opens on the first of them.
 * - Motion (icon draw + perform or scene mount, seam line, stamp-in, filter Flip) lives in ./programs-motion,
 *   loaded when the section is ≤1 viewport away and motion is allowed.
 * Without JS: chips, rail and + buttons are hidden by CSS; every card is visible and drawn.
 */

type SheetModule = typeof import("./ProgramSheet");
type SheetComponent = SheetModule["default"];
/** One import() call site = one chunk, shared by the near-prefetch and the first tap. */
let sheetModule: Promise<SheetModule> | null = null;
const loadSheet = () => (sheetModule ??= import("./ProgramSheet"));
type MotionModule = typeof import("./programs-motion");
let motionModule: Promise<MotionModule> | null = null;
const loadProgramsMotion = () => (motionModule ??= import("./programs-motion"));

/** Quiz → programs hand-off (dispatched by the S2 quiz when it shows a result). */
const RECOMMEND_EVENT = "kraguj:recommend";
interface RecommendDetail {
  ids?: readonly string[];
  /** The child's age from the quiz („Preporuka · 9 god.“). */
  age?: number;
}

export interface BrowserChip {
  key: string;
  label: string;
  /** Visible program ids the chip keeps. */
  ids: readonly string[];
  /** aria-live status text ("" = nothing hidden). */
  status: string;
  /** Visible hint under the phone row („Pitajte trenericu i za aerobnu gimnastiku.“), or "". */
  hint: string;
}

interface ProgramsBrowserProps {
  heading: ReactNode;
  chips: readonly BrowserChip[];
  /** Program colours for the rail dots, in card order. */
  dots: readonly { id: string; color: string }[];
  filtersLabel: string;
  pager: { prev: string; next: string };
  stamp: { unit: string };
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
/** Set on cards that are leaving during a filter Flip: they must stay rendered while they fade
 *  (Tailwind's preflight makes [hidden] display:none!important, which Flip cannot override). */
const OUT = "data-out";
const NB = " ";

const visibleItems = (strip: HTMLElement) =>
  Array.from(strip.children).filter((el): el is HTMLElement => el instanceof HTMLElement && !el.hidden && !el.hasAttribute(OUT));
const padStart = (strip: HTMLElement) => parseFloat(getComputedStyle(strip).paddingLeft) || 0;

export function ProgramsBrowser({ heading, chips, dots, filtersLabel, pager, stamp, total, children }: ProgramsBrowserProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const filterRun = useRef(0);
  /** Filter motion is loaded (near warm-up done): a tap can capture the layout before anything commits. */
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
  const activeChip = chips.find((c) => c.key === active) ?? chips[0];
  const railDots = dots.filter((d) => activeChip?.ids.includes(d.id) ?? true);

  /* An arrow that disables itself while focused would drop keyboard focus to <body>:
     hand it to the other arrow instead. */
  useEffect(() => {
    const was = pagerFocus.current;
    const activeEl = document.activeElement;
    if (!was || (activeEl !== was && activeEl !== document.body)) return;
    if (nextOff && was === nextRef.current && !prevOff) prevRef.current?.focus();
    else if (prevOff && was === prevRef.current && !nextOff) nextRef.current?.focus();
  }, [prevOff, nextOff]);
  const pagerFocusProps = {
    onFocus: (e: FocusEvent<HTMLButtonElement>) => (pagerFocus.current = e.currentTarget),
    onBlur: (e: FocusEvent<HTMLButtonElement>) => {
      if (e.relatedTarget) pagerFocus.current = null;
    },
  };

  /* Pager: index of the program card at the snap start; rAF-throttled, no loop. */
  const measure = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const cards = visibleItems(strip).filter((el) => el.matches(CARD));
    const pad = padStart(strip);
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

    let disposed = false;
    let disarm: (() => void) | null = null;
    /* ≤1 viewport away: warm up the sheet chunk and, with motion, arm the section's motion
       (icon draw/perform, seam line) and preload Flip. If the motion chunk cannot load, the
       drawings are shown finished instead of waiting for a draw that never comes. */
    const stopNear = whenNear(root, () => {
      void loadSheet();
      if (!motionAllowed()) return;
      loadProgramsMotion()
        .then(async (m) => {
          if (disposed) return;
          disarm = m.armPrograms(root, strip);
          await m.warmFlip();
          flipReady.current = true;
        })
        .catch(() => strip.querySelectorAll(CARD).forEach((c) => c.setAttribute("data-drawn", "")));
    });

    return () => {
      disposed = true;
      strip.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      ro?.disconnect();
      stopNear();
      disarm?.();
    };
  }, [measure]);

  /* Quiz hand-off (QP-10): stamp the recommended cards. */
  useEffect(() => {
    const onRecommend = (e: Event) => {
      const strip = stripRef.current;
      if (!strip) return;
      const { ids = [], age } = (e as CustomEvent<RecommendDetail>).detail ?? {};
      const picked: HTMLElement[] = [];
      for (const card of Array.from(strip.querySelectorAll<HTMLElement>(CARD))) {
        const on = ids.includes(card.dataset.programId ?? "");
        card.toggleAttribute("data-recommended", on);
        const el = card.querySelector<HTMLElement>("[data-stamp]");
        if (!el) continue;
        el.hidden = !on;
        const ageEl = el.querySelector(".pc-stamp__age");
        if (ageEl) ageEl.textContent = on && Number.isInteger(age) ? `${NB}·${NB}${age}${NB}${stamp.unit}` : "";
        if (on) picked.push(card);
      }
      // Phone row: open on the first recommended card — only while the row is off-screen, so
      // nothing moves under the reader's eyes.
      const first = picked.find((c) => !c.hidden);
      const r = strip.getBoundingClientRect();
      if (first && strip.scrollWidth > strip.clientWidth && (r.bottom < 0 || r.top > window.innerHeight)) {
        strip.scrollTo({ left: first.offsetLeft - padStart(strip), behavior: "instant" });
      }
      if (picked.length && motionAllowed()) void loadProgramsMotion().then((m) => m.stampIn(picked), () => {});
    };
    window.addEventListener(RECOMMEND_EVENT, onRecommend);
    return () => window.removeEventListener(RECOMMEND_EVENT, onRecommend);
  }, [stamp.unit]);

  const applyFilter = useCallback(
    async (chip: BrowserChip) => {
      const strip = stripRef.current;
      if (!strip) return;
      const run = ++filterRun.current;

      const items = Array.from(strip.children).filter((el): el is HTMLElement => el instanceof HTMLElement);
      const cards = items.filter((el) => el.matches(CARD));
      const keeps = (el: HTMLElement) => chip.ids.includes(el.dataset.programId ?? "");
      /** Filtered-out cards leave (a11y tree included). While a Flip runs they only get data-out
       *  (display:none in CSS, beaten by Flip's inline display) and `hidden` once it is done. */
      const apply = (fading: boolean) => {
        for (const el of cards) {
          if (keeps(el)) {
            el.hidden = false;
            el.removeAttribute(OUT);
          } else if (fading) {
            if (!el.hidden) el.setAttribute(OUT, "");
          } else {
            el.hidden = true;
            el.removeAttribute(OUT);
          }
        }
        // The ≥1024 sheet drops the photo when it would leave an orphan card (QP-20, CSS).
        strip.dataset.count = String(chip.ids.length);
        // „Sve“ opens on the photo again; a filter opens on its first program.
        const first = chip.ids.length < total ? cards.find(keeps) : undefined;
        strip.scrollTo({ left: first ? first.offsetLeft - padStart(strip) : 0, behavior: "instant" });
      };
      /** After the Flip: leavers become `hidden` (unless another chip took over meanwhile). */
      const settle = () => {
        if (run === filterRun.current)
          for (const el of cards) {
            if (!keeps(el)) el.hidden = true;
            el.removeAttribute(OUT);
          }
        measure();
      };
      const commit = () =>
        flushSync(() => {
          setActive(chip.key);
          setStatus(chip.status);
          measure();
        });

      if (motionAllowed()) {
        // Tap before the near warm-up finished (rare): press the chip now, the rest follows.
        if (!flipReady.current) setActive(chip.key);
        const m = await loadProgramsMotion();
        if (run !== filterRun.current) return;
        // The layout is captured before the chip / status / rail commit, so their shift is part of the Flip.
        await m.flipFilter({ items, apply: () => apply(true), commit, done: settle });
        flipReady.current = true;
      } else {
        apply(false);
        setActive(chip.key);
        setStatus(chip.status);
        for (const el of items) {
          el.style.opacity = "";
          el.style.transform = "";
        }
        if (typeof strip.animate === "function") strip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "linear" });
        measure();
      }
    },
    [measure, total],
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

  /* One frame back / forward. The photo is first on screen but last in the DOM: pagerTarget
     sorts the starts (QP2-01). */
  const go = (dir: 1 | -1) => {
    const strip = stripRef.current;
    if (!strip) return;
    const pad = padStart(strip);
    const starts = visibleItems(strip).map((el) => el.offsetLeft - pad);
    const left = pagerTarget(starts, strip.scrollLeft, dir, strip.scrollWidth - strip.clientWidth);
    strip.scrollTo({ left, behavior: prefersLessMotion() ? "instant" : "smooth" });
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
                {/* How many programs the pressed chip shows (the status line says it to screen readers). */}
                <span className="pg-chip__count tabular" aria-hidden="true">
                  {chip.ids.length}
                </span>
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

      {/* Progress rail (<1024): under the row it drives, where the thumb swipes. */}
      <div
        className="pg-rail"
        hidden={page.n <= 1 || (page.atStart && page.atEnd)}
        style={{ "--i": page.i, "--n": Math.max(railDots.length, 1) } as CSSProperties}
        data-hop={page.i % 2}
      >
        <button
          ref={prevRef}
          type="button"
          className="icon-btn pg-rail__btn"
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
        <div className="pg-rail__track" aria-hidden="true">
          <ol className="pg-rail__dots">
            {railDots.map((d, k) => (
              <li
                key={d.id}
                className="pg-rail__dot"
                style={{ "--dot": d.color } as CSSProperties}
                {...(k === page.i ? { "data-on": "" } : {})}
              />
            ))}
          </ol>
          <span className="pg-rail__flier">
            <svg className="pg-rail__leap" viewBox="0 0 230 150" focusable="false">
              <use href="#leap" width="230" height="150" />
            </svg>
          </span>
        </div>
        <button
          ref={nextRef}
          type="button"
          className="icon-btn pg-rail__btn"
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

      {activeChip?.hint ? (
        <p className="pg-hint text-small" aria-hidden="true">
          {activeChip.hint}
        </p>
      ) : null}

      {open && Sheet ? <Sheet programId={open.id} card={open.card} onClosed={() => setOpen(null)} /> : null}
    </div>
  );
}
