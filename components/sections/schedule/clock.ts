"use client";

import { useSyncExternalStore } from "react";
import { belgradeNow, type BelgradeNow } from "@/lib/time";

/**
 * One shared Europe/Belgrade minute clock for the whole schedule section:
 * ONE setInterval (aligned to the next full minute), started by the first
 * subscriber, cleared by the last one, paused while the tab is hidden.
 * SSR and hydration read `null` (time-independent markup, no mismatch);
 * the real time arrives right after mount.
 */
let snapshot: BelgradeNow | null = null;
const listeners = new Set<() => void>();
let align: ReturnType<typeof setTimeout> | undefined;
let interval: ReturnType<typeof setInterval> | undefined;

function tick(): void {
  snapshot = belgradeNow();
  listeners.forEach((l) => l());
}

function start(): void {
  stop();
  tick();
  align = setTimeout(() => {
    tick();
    interval = setInterval(tick, 60_000);
  }, 60_000 - (Date.now() % 60_000) + 20);
}

function stop(): void {
  clearTimeout(align);
  clearInterval(interval);
  align = interval = undefined;
}

function onVisibility(): void {
  if (document.hidden) stop();
  else start();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    if (document.hidden) tick();
    else start();
    document.addEventListener("visibilitychange", onVisibility);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

const getSnapshot = (): BelgradeNow | null => snapshot;
const getServerSnapshot = (): BelgradeNow | null => null;

/** Europe/Belgrade "now", updated every minute; null during SSR/hydration. */
export function useBelgradeMinute(): BelgradeNow | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
