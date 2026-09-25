"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { loadMotion } from "@/lib/load-motion";
import { DUR, EASE, motionAllowed, whenNear } from "@/lib/motion-env";
import { filterStatus, GALLERY_UI, type ChipKey, type GalleryChip, type LightboxPhoto } from "./model";

/**
 * Gallery island (initial bundle — tiny, no gsap import here).
 * - Chips filter the server-rendered sheet (`hidden` on the items; Flip ≤280ms,
 *   lazily loaded: prints move, leavers fade out in place (linear fade, takeoff
 *   shrink), newcomers fade in; reduced motion: instant + 150ms crossfade).
 *   aria-live status. No chips (public variant with one category) = no filter row.
 * - A tap on a print opens the lightbox, a lazily loaded chunk that is warmed
 *   (with Flip + Observer) when the section is ≤1 viewport away.
 * Without JS the chips are hidden (CSS) and each print links to its file.
 */

type LightboxModule = typeof import("./GalleryLightbox");
type LightboxComponent = LightboxModule["GalleryLightbox"];
/** One import() call site = one chunk, shared by the near-prefetch and the first tap. */
let lightboxModule: Promise<LightboxModule> | null = null;
const loadLightbox = () => (lightboxModule ??= import("./GalleryLightbox"));

const ITEM = "[data-gallery-grid] > li";

interface OpenState {
  key: number;
  photos: readonly LightboxPhoto[];
  start: number;
  /** Grid thumbnail URLs already in the cache (instant low-res backdrop while the large file loads). */
  thumbs: Readonly<Record<string, string>>;
}

interface GalleryBrowserProps {
  heading: ReactNode;
  chips: readonly GalleryChip[];
  /** Openable photos (placeholders excluded), in sheet order. */
  photos: readonly LightboxPhoto[];
  children: ReactNode;
}

export function GalleryBrowser({ heading, chips, photos, children }: GalleryBrowserProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const filterRun = useRef(0);
  const openSeq = useRef(0);
  /** The running filter Flip (a timeline), so a new filter can land it first. */
  const flipRef = useRef<{ progress: (value: number) => unknown; kill: () => unknown } | null>(null);
  const [active, setActive] = useState<ChipKey>("all");
  const [status, setStatus] = useState("");
  const [Lightbox, setLightbox] = useState<LightboxComponent | null>(null);
  const [open, setOpen] = useState<OpenState | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll("[data-gallery-open]").forEach((a) => a.setAttribute("aria-haspopup", "dialog"));
    // Warm the lightbox chunk (+ Flip/Observer) when the sheet is ≤1 viewport away.
    const stopNear = whenNear(root, () => {
      void loadLightbox().then((m) => m.prepareLightbox(motionAllowed()));
    });
    return () => {
      stopNear();
      flipRef.current?.kill();
    };
  }, []);

  const applyFilter = async (chip: GalleryChip) => {
    const root = rootRef.current;
    if (!root || chip.key === active) return;
    const run = ++filterRun.current;
    setActive(chip.key);
    setStatus(filterStatus(chip.label, chip.count));

    const items = Array.from(root.querySelectorAll<HTMLElement>(ITEM));
    const shows = (el: HTMLElement) => chip.key === "all" || el.dataset.category === chip.key;
    const apply = () => {
      for (const el of items) el.hidden = !shows(el);
    };

    if (motionAllowed()) {
      const { gsap, loadFlip } = await loadMotion();
      const Flip = await loadFlip();
      if (run !== filterRun.current) return;
      flipRef.current?.progress(1); // a filter still in flight lands first (its leavers get `hidden`)
      const before = items.filter((el) => !el.hidden);
      const state = Flip.getState(before);
      // Leaving prints fade out where they stood. They are marked with data-leaving (display:none
      // in CSS, which Flip's inline display can override) instead of `hidden`: Tailwind's
      // [hidden]{display:none!important} would cut them on the first frame. `hidden` follows on complete.
      const leaving = before.filter((el) => !shows(el));
      for (const el of leaving) el.setAttribute("data-leaving", "");
      for (const el of items) if (shows(el)) el.hidden = false;
      const done = () => {
        for (const el of leaving) {
          el.hidden = true;
          el.removeAttribute("data-leaving");
        }
        if (leaving.length) gsap.set(leaving, { clearProps: "all" }); // an empty target list would warn
      };
      flipRef.current = Flip.from(state, {
        targets: [...items.filter(shows), ...leaving],
        duration: DUR.base,
        ease: EASE.stick,
        absoluteOnLeave: true,
        // One recipe for the S3/S4/S9 filters: the fade is linear, so a leaving print is already
        // half gone while the others glide past it; only its shrink keeps the takeoff ease.
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
        onComplete: done,
        onInterrupt: done,
      });
    } else {
      flipRef.current?.progress(1);
      apply();
      const grid = root.querySelector<HTMLElement>("[data-gallery-grid]");
      if (grid && typeof grid.animate === "function") grid.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "linear" });
    }
  };

  const onGridClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; // new tab etc. keeps the link
    const link = (event.target as Element).closest<HTMLAnchorElement>("[data-gallery-open]");
    const root = rootRef.current;
    if (!link || !root?.contains(link)) return;
    event.preventDefault();
    if (open || link.closest("[data-leaving]")) return; // a print fading out of a filter is not a target

    // The lightbox shows the photos the sheet currently shows, in sheet order.
    const shown = new Set(
      Array.from(root.querySelectorAll<HTMLElement>(ITEM))
        .filter((el) => !el.hidden && !el.hasAttribute("data-leaving"))
        .map((el) => el.dataset.photo),
    );
    const list = photos.filter((p) => shown.has(p.id));
    const start = Math.max(
      0,
      list.findIndex((p) => p.id === link.dataset.galleryOpen),
    );
    const thumbs: Record<string, string> = {};
    for (const p of list) {
      const img = root.querySelector<HTMLImageElement>(`[data-gallery-open="${p.id}"] img`);
      if (img?.complete && img.currentSrc) thumbs[p.id] = img.currentSrc;
    }
    const key = ++openSeq.current;
    void loadLightbox()
      .then(async (m) => {
        await m.prepareLightbox(motionAllowed());
        return m;
      })
      .then((m) => {
        if (key !== openSeq.current) return;
        setLightbox(() => m.GalleryLightbox);
        setOpen({ key, photos: list, start, thumbs });
      })
      .catch(() => {
        // Chunk failed (offline): fall back to the plain link target.
        window.location.href = link.href;
      });
  };

  return (
    <div ref={rootRef} className="gallery-browser" onClick={onGridClick}>
      <div className="gl-head">
        {heading}
        {chips.length > 0 ? (
          <div className="gl-filters">
            <div className="gl-chips" role="group" aria-label={GALLERY_UI.filtersLabel}>
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="gl-chip"
                  aria-pressed={active === chip.key}
                  aria-controls="galerija-lista"
                  onClick={() => void applyFilter(chip)}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="gl-chip__check ui-icon">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                  {chip.label}
                  <span className="gl-chip__count tabular">{chip.count}</span>
                </button>
              ))}
            </div>
            {/* Screen readers only: on screen the pressed chip (✓ + count) already says it. */}
            <p className="gl-status sr-only" role="status" aria-live="polite">
              {status}
            </p>
          </div>
        ) : null}
      </div>

      {children}

      {open && Lightbox ? (
        <Lightbox
          key={open.key}
          photos={open.photos}
          start={open.start}
          thumbs={open.thumbs}
          onClosed={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}
