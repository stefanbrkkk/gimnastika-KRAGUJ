"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { loadMotion } from "@/lib/load-motion";
import { DUR, EASE, motionAllowed, whenNear } from "@/lib/motion-env";
import { filterStatus, GALLERY_UI, type ChipKey, type GalleryChip, type LightboxPhoto } from "./model";

/**
 * Gallery island (initial bundle — tiny, no gsap import here).
 * - Chips filter the server-rendered sheet (`hidden` on the items; Flip ≤280ms,
 *   lazily loaded; reduced motion: instant + 150ms crossfade). aria-live status.
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
  const [active, setActive] = useState<ChipKey>("all");
  const [status, setStatus] = useState("");
  const [Lightbox, setLightbox] = useState<LightboxComponent | null>(null);
  const [open, setOpen] = useState<OpenState | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll("[data-gallery-open]").forEach((a) => a.setAttribute("aria-haspopup", "dialog"));
    // Warm the lightbox chunk (+ Flip/Observer) when the sheet is ≤1 viewport away.
    return whenNear(root, () => {
      void loadLightbox().then((m) => m.prepareLightbox(motionAllowed()));
    });
  }, []);

  const applyFilter = async (chip: GalleryChip) => {
    const root = rootRef.current;
    if (!root || chip.key === active) return;
    const run = ++filterRun.current;
    setActive(chip.key);
    setStatus(filterStatus(chip.label, chip.count));

    const items = Array.from(root.querySelectorAll<HTMLElement>(ITEM));
    const apply = () => {
      for (const el of items) el.hidden = chip.key !== "all" && el.dataset.category !== chip.key;
    };

    if (motionAllowed()) {
      const { gsap, loadFlip } = await loadMotion();
      const Flip = await loadFlip();
      if (run !== filterRun.current) return;
      const state = Flip.getState(items.filter((el) => !el.hidden));
      apply();
      Flip.from(state, {
        targets: items.filter((el) => !el.hidden),
        duration: DUR.base,
        ease: EASE.stick,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: DUR.base, ease: EASE.stick }),
      });
    } else {
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
    if (open) return;

    // The lightbox shows the photos the sheet currently shows, in sheet order.
    const shown = new Set(
      Array.from(root.querySelectorAll<HTMLElement>(ITEM))
        .filter((el) => !el.hidden)
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
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="gl-chip__check">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
                {chip.label}
                <span className="gl-chip__count tabular">{chip.count}</span>
              </button>
            ))}
          </div>
          <p className="gl-status text-small" role="status" aria-live="polite">
            {status}
          </p>
        </div>
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
