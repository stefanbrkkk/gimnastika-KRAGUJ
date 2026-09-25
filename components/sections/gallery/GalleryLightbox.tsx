"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent,
} from "react";
import type { Flip as FlipPlugin } from "gsap/Flip";
import type { Observer as ObserverPlugin } from "gsap/Observer";
import { DUR, EASE, gsap, loadFlip, loadObserver, motionAllowed, prefersLessMotion, registerMotion } from "@/lib/motion";
import { counterLabel, flipId, GALLERY_UI, lightboxSizes, nativeHalf, srcSet, type LightboxPhoto } from "./model";

/**
 * Gallery lightbox — a LAZY chunk (imported only by GalleryBrowser on intent),
 * so gsap may be imported statically here.
 *
 * - Native <dialog> + showModal(): inert page, Esc (animated via `cancel`), plus a
 *   strict Tab wrap; focus returns to the print of the photo being viewed.
 * - Open: Flip from the grid print to the full photo; close: Flip.fit back to the
 *   print (scrolled into view first). Reduced motion: 150ms crossfade, no Flip.
 * - Native horizontal scroll-snap between photos (touch-action: pan-x), prev/next
 *   buttons, ←/→/Home/End, an „n / total“ status (aria-live).
 * - Swipe down to close: Observer (vertical axis only) + distance/velocity threshold.
 * - Photos render at most native/2 CSS px wide (CSS clamp + `sizes`); photo 08 and
 *   every other photo keep their native aspect (never cropped).
 */

let flip: typeof FlipPlugin | null = null;
let observer: typeof ObserverPlugin | null = null;

/** Loads the plugins before the first open (idempotent; also used to warm the chunk). */
export async function prepareLightbox(withFlip: boolean): Promise<void> {
  registerMotion();
  const [f, o] = await Promise.all([withFlip ? loadFlip() : Promise.resolve(null), loadObserver()]);
  if (f) flip = f;
  observer = o;
}

/** Swipe-down close thresholds: distance (px) or release velocity (px/s). */
const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 900;
const CROSSFADE_MS = 150;

const clamp = (i: number, n: number) => Math.min(Math.max(i, 0), n - 1);

/**
 * Brings a grid print fully into the free band between the header and the
 * sticky bar (the page's scroll-padding + 12px air) with one instant scroll.
 * Every close path calls it while the lightbox still covers the page, so the
 * jump is hidden, the close Flip measures the final spot, and the focus return
 * (preventScroll) never scrolls the page after the photo has landed. It measures
 * the whole print link (frame + caption foot = the focus target, whose ring the
 * 2.4.11 focus guard would otherwise still correct), not only the photo inside
 * it. A print taller than the band keeps its top edge in view.
 */
const revealPrint = (thumb: HTMLElement | null) => {
  if (!thumb || thumb.offsetParent === null) return;
  const print = thumb.closest<HTMLElement>("[data-gallery-open]") ?? thumb;
  const cs = getComputedStyle(document.documentElement);
  const top = (parseFloat(cs.scrollPaddingTop) || 0) + 12;
  const bottom = window.innerHeight - (parseFloat(cs.scrollPaddingBottom) || 0) - 12;
  const b = print.getBoundingClientRect();
  const dy = b.top < top ? b.top - top : b.bottom > bottom ? Math.min(b.bottom - bottom, b.top - top) : 0;
  // Whole pixels, rounded outward: a fractional rest would leave the ring 1px over the band.
  if (dy) window.scrollBy({ top: dy > 0 ? Math.ceil(dy) : Math.floor(dy), behavior: "instant" });
};

interface GalleryLightboxProps {
  photos: readonly LightboxPhoto[];
  start: number;
  thumbs: Readonly<Record<string, string>>;
  onClosed: () => void;
}

export function GalleryLightbox({ photos, start, thumbs, onClosed }: GalleryLightboxProps) {
  const n = photos.length;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const mediaRefs = useRef<(HTMLDivElement | null)[]>([]);
  const indexRef = useRef(start);
  const closing = useRef(false);
  const finalized = useRef(false);
  const scrollRaf = useRef(0);

  const [index, setIndex] = useState(start);
  // Slides whose large file may load: the current one and its neighbours (kept once seen).
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set([start - 1, start, start + 1]));

  const chrome = () => [topRef.current, navRef.current].filter((el): el is HTMLDivElement => el !== null);
  const printOf = (photo: LightboxPhoto | undefined) =>
    photo ? document.querySelector<HTMLElement>(`[data-gallery-grid] [data-flip-id="${flipId(photo.id)}"]`) : null;

  /* ---------------------------------------------------------------- open -- */
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const track = trackRef.current;
    if (!dialog || !track) return;
    const ctx = gsap.context(() => {});
    const thumb = printOf(photos[start]);
    const Flip = motionAllowed() ? flip : null;
    // Capture the print before the scroll lock (no layout shift thanks to scrollbar-gutter).
    const state = Flip && thumb ? Flip.getState(thumb) : null;

    document.documentElement.setAttribute("data-lightbox-open", "");
    if (!dialog.open) dialog.showModal();
    track.scrollLeft = start * track.clientWidth;
    closeRef.current?.focus({ preventScroll: true });

    const media = mediaRefs.current[start];
    if (Flip && state && media) {
      ctx.add(() => {
        gsap.fromTo(scrimRef.current, { opacity: 0 }, { opacity: 1, duration: DUR.base, ease: "none" });
        gsap.fromTo(chrome(), { opacity: 0 }, { opacity: 1, duration: DUR.base, delay: DUR.fast, ease: "none" });
        Flip.from(state, { targets: media, duration: DUR.reveal, ease: EASE.stick, scale: true });
      });
    } else if (typeof dialog.animate === "function") {
      dialog.animate([{ opacity: 0 }, { opacity: 1 }], { duration: CROSSFADE_MS, easing: "linear" });
    }
    return () => ctx.revert();
    // Mount-only: a new open request remounts this component (keyed by the island).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------------------------------------------- close -- */
  const finalize = () => {
    if (finalized.current) return;
    finalized.current = true;
    document.documentElement.removeAttribute("data-lightbox-open");
    const photo = photos[indexRef.current];
    // A close that bypassed requestClose (forced by the browser) still brings the print into view.
    if (!closing.current) revealPrint(printOf(photo));
    const link = photo ? document.querySelector<HTMLAnchorElement>(`[data-gallery-open="${photo.id}"]`) : null;
    link?.focus({ preventScroll: true });
    onClosed();
  };

  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || closing.current) return;
    closing.current = true;
    const i = indexRef.current;
    const media = mediaRefs.current[i];
    const thumb = printOf(photos[i]);
    // Before either close path, while the scrim still hides the page: the landing spot is final.
    revealPrint(thumb);
    const Flip = motionAllowed() ? flip : null;
    const done = () => {
      if (dialog.open) dialog.close();
      // Now, not on the queued `close` event: the native focus restore to the opener never
      // paints a ring for a frame before focus moves to the current print (finalize is idempotent).
      finalize();
    };

    if (Flip && media && thumb && thumb.offsetParent !== null) {
      gsap.to(chrome(), { opacity: 0, duration: DUR.fast, ease: "none", overwrite: true });
      // An exit (≤200ms, §4): the veil is gone by the time the photo has visually landed.
      gsap.to(scrimRef.current, { opacity: 0, duration: DUR.fast, ease: "none", overwrite: true });
      Flip.fit(media, thumb, { duration: DUR.base, ease: EASE.stick, scale: true, onComplete: done });
    } else if (typeof dialog.animate === "function") {
      const fade = dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CROSSFADE_MS, easing: "linear", fill: "forwards" });
      fade.finished.then(done, done);
    } else {
      done();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault(); // Esc → animated close (a forced close still lands in onClose)
    requestClose();
  };

  /* ---------------------------------------------------------- swipe down -- */
  useEffect(() => {
    const Obs = observer;
    const track = trackRef.current;
    if (!Obs || !track) return;
    let dy = 0;
    let media: HTMLElement | null = null;
    const less = prefersLessMotion();
    const obs = Obs.create({
      target: track,
      type: "touch,pointer",
      lockAxis: true,
      dragMinimum: 8,
      onDragStart: () => {
        dy = 0;
        media = mediaRefs.current[indexRef.current] ?? null;
      },
      onDrag: (self) => {
        if (self.axis !== "y" || closing.current || !media) return;
        dy += self.deltaY;
        const d = Math.max(0, dy);
        gsap.set(media, { y: d, scale: 1 - Math.min(d / 1800, 0.1) });
        gsap.set(scrimRef.current, { opacity: 1 - Math.min(d / 520, 0.75) });
        gsap.set(chrome(), { opacity: d > 12 ? 0 : 1 });
      },
      onDragEnd: (self) => {
        if (self.axis !== "y" || closing.current || !media) return;
        if (dy > CLOSE_DISTANCE || self.velocityY > CLOSE_VELOCITY) {
          requestClose();
          return;
        }
        const back = less ? 0 : DUR.base;
        gsap.to(media, { y: 0, scale: 1, duration: back, ease: EASE.stick });
        gsap.to(scrimRef.current, { opacity: 1, duration: back, ease: "none" });
        gsap.to(chrome(), { opacity: 1, duration: less ? 0 : DUR.fast, ease: "none" });
      },
    });
    return () => obs.kill();
  }, [requestClose]);

  useEffect(
    () => () => {
      cancelAnimationFrame(scrollRaf.current);
      document.documentElement.removeAttribute("data-lightbox-open");
    },
    [],
  );

  /* ---------------------------------------------------------- navigation -- */
  const onTrackScroll = () => {
    if (scrollRaf.current) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0;
      const track = trackRef.current;
      if (!track || !track.clientWidth) return;
      const i = clamp(Math.round(track.scrollLeft / track.clientWidth), n);
      if (i === indexRef.current) return;
      indexRef.current = i;
      setIndex(i);
      setSeen((prev) => (prev.has(i - 1) && prev.has(i + 1) ? prev : new Set([...prev, i - 1, i, i + 1])));
    });
  };

  const go = (to: number) => {
    const track = trackRef.current;
    if (!track || closing.current) return;
    const i = clamp(to, n);
    track.scrollTo({ left: i * track.clientWidth, behavior: prefersLessMotion() ? "instant" : "smooth" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      go(indexRef.current + (event.key === "ArrowRight" ? 1 : -1));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      go(event.key === "Home" ? 0 : n - 1);
      return;
    }
    if (event.key !== "Tab") return;
    // Strict focus wrap inside the dialog (photo track · close · prev · next).
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(".lb-track, button")).filter((el) => el.offsetParent !== null);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // A tap on the dark area around the photo closes (not on the photo itself).
  const onTrackClick = (event: MouseEvent<HTMLUListElement>) => {
    if ((event.target as Element).classList.contains("lb-slide")) requestClose();
  };

  const current = photos[index];

  return (
    <dialog
      ref={dialogRef}
      className="lightbox"
      data-theme="darker"
      aria-label={GALLERY_UI.dialogLabel}
      onCancel={onCancel}
      onClose={finalize}
      onKeyDown={onKeyDown}
    >
      <div ref={scrimRef} className="lb-scrim" aria-hidden="true" />

      {/* Focusable scroller (axe scrollable-region-focusable); ←/→/Home/End are handled on the dialog. */}
      <ul
        ref={trackRef}
        className="lb-track"
        tabIndex={0}
        aria-label={GALLERY_UI.dialogLabel}
        onScroll={onTrackScroll}
        onClick={onTrackClick}
      >
        {photos.map((p, i) => {
          const thumb = thumbs[p.id];
          const style = {
            "--ar": `${p.width} / ${p.height}`,
            "--r": String(p.width / p.height),
            "--cap": `${nativeHalf(p)}px`,
            ...(thumb ? { backgroundImage: `url("${thumb}")` } : {}),
          } as CSSProperties;
          return (
            <li key={p.id} className="lb-slide" aria-hidden={i === index ? undefined : true}>
              <div
                ref={(el) => {
                  mediaRefs.current[i] = el;
                }}
                className="lb-media"
                data-flip-id={flipId(p.id)}
                style={style}
              >
                {seen.has(i) ? (
                  <picture>
                    <source type="image/avif" srcSet={srcSet(p, "avif")} sizes={lightboxSizes(p)} />
                    <source type="image/webp" srcSet={srcSet(p, "webp")} sizes={lightboxSizes(p)} />
                    <img
                      src={`/img/${p.slug}-${p.widths.includes(960) ? 960 : p.widths[p.widths.length - 1]}.webp`}
                      width={p.width}
                      height={p.height}
                      alt={p.alt}
                      sizes={lightboxSizes(p)}
                      decoding="async"
                      draggable={false}
                      data-native-width={p.width}
                    />
                  </picture>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div ref={topRef} className="lb-top">
        <p className="lb-count" aria-live="polite" aria-atomic="true">
          <span className="tabular" aria-hidden="true">
            {index + 1} / {n}
          </span>
          <span className="sr-only">{counterLabel(index + 1, n)}</span>
        </p>
        <span className="lb-frame" aria-hidden="true">
          {current?.frame}
        </span>
        <button ref={closeRef} type="button" className="lb-btn lb-close" aria-label={GALLERY_UI.close} onClick={requestClose}>
          <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
          </svg>
        </button>
      </div>

      <div ref={navRef} className="lb-nav" hidden={n < 2}>
        <button
          type="button"
          className="lb-btn"
          aria-label={GALLERY_UI.prev}
          aria-disabled={index === 0}
          onClick={() => go(indexRef.current - 1)}
        >
          <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M14.5 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          className="lb-btn"
          aria-label={GALLERY_UI.next}
          aria-disabled={index === n - 1}
          onClick={() => go(indexRef.current + 1)}
        >
          <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9.5 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </dialog>
  );
}
