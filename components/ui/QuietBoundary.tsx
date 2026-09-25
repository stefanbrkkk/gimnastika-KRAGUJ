"use client";

import { Component, type ReactNode } from "react";

/**
 * Error boundary for OPTIONAL enhancements (motion layers, lazy chunks): if the
 * chunk fails to load or throws, it renders `fallback` (default nothing) instead
 * of letting the error reach Next's root error screen. The server-rendered page
 * underneath stays complete — every enhancement here is decorative or has a
 * no-JS path.
 */
export class QuietBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    if (process.env.NODE_ENV !== "production") console.info("[QuietBoundary] enhancement skipped:", error);
  }

  render(): ReactNode {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
