/**
 * Web Analytics loader (lib/analytics.ts): the inline script that asks Vercel for its
 * cookieless page-view script. It must load it only on the production host, never when the
 * visitor's browser sends a privacy signal, never before the page has finished loading, and
 * it must itself store nothing on the device. The script is run here against a fake
 * window/document — the same globals it uses in a browser.
 */
import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/content/site";
import { ANALYTICS_SCRIPT, ANALYTICS_SCRIPT_SRC, analyticsHost, buildAnalyticsScript } from "@/lib/analytics";

const HOST = "www.gimnastikakraguj.rs";

interface FakeScript {
  tag: string;
  src: string;
  defer: boolean;
}

interface Env {
  hostname: string;
  readyState?: "loading" | "interactive" | "complete";
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
}

function run(script: string, env: Env) {
  const appended: FakeScript[] = [];
  const listeners = new Map<string, (() => void)[]>();
  const win: { va?: (...args: unknown[]) => void; vaq?: unknown[] } = {};
  const doc = {
    readyState: env.readyState ?? "complete",
    createElement: (tag: string): FakeScript => ({ tag, src: "", defer: false }),
    head: { appendChild: (el: FakeScript) => void appended.push(el) },
  };
  const nav = { doNotTrack: env.doNotTrack ?? null, globalPrivacyControl: env.globalPrivacyControl ?? false };
  const addEventListener = (type: string, fn: () => void) => {
    listeners.set(type, [...(listeners.get(type) ?? []), fn]);
  };
  // The loader only touches these five globals; passing them as parameters shadows the real ones.
  new Function("window", "document", "location", "navigator", "addEventListener", script)(
    win,
    doc,
    { hostname: env.hostname },
    nav,
    addEventListener,
  );
  return {
    appended,
    win,
    listening: [...listeners.keys()],
    fire: (type: string) => (listeners.get(type) ?? []).forEach((fn) => fn()),
  };
}

describe("analytics loader — where it runs", () => {
  const script = buildAnalyticsScript({ host: HOST });

  it("on the production host, once the page has loaded, requests Vercel's script exactly once", () => {
    const { appended } = run(script, { hostname: HOST });
    expect(appended).toEqual([{ tag: "script", src: "/_vercel/insights/script.js", defer: true }]);
    expect(ANALYTICS_SCRIPT_SRC).toBe("/_vercel/insights/script.js");
  });

  it("sets up Vercel's queue stub (window.va → window.vaq), as the official snippet does", () => {
    const { win } = run(script, { hostname: HOST });
    expect(typeof win.va).toBe("function");
    win.va!("pageview", { path: "/" });
    expect(win.vaq).toHaveLength(1);
  });

  it.each(["localhost", "127.0.0.1", "gimnastikakraguj.rs", "gimnastika-kraguj.vercel.app", "gimnastika-kraguj-git-x-stefanbrkkks-projects.vercel.app", "www.gimnastikakraguj.rs.example.org"])(
    "does nothing at all on %s (local builds, previews and look-alike hosts are never counted)",
    (hostname) => {
      const { appended, win, listening } = run(script, { hostname });
      expect(appended).toEqual([]);
      expect(win.va).toBeUndefined();
      expect(listening).toEqual([]);
    },
  );

  it("waits for the load event while the page is still loading — never competes with first paint", () => {
    for (const readyState of ["loading", "interactive"] as const) {
      const page = run(script, { hostname: HOST, readyState });
      expect(page.appended).toEqual([]);
      expect(page.listening).toEqual(["load"]);
      page.fire("load");
      expect(page.appended).toHaveLength(1);
    }
  });
});

describe("analytics loader — privacy", () => {
  const script = buildAnalyticsScript({ host: HOST });

  it("respects Do Not Track", () => {
    const { appended, win } = run(script, { hostname: HOST, doNotTrack: "1" });
    expect(appended).toEqual([]);
    expect(win.va).toBeUndefined();
  });

  it("respects Global Privacy Control", () => {
    const { appended, win } = run(script, { hostname: HOST, globalPrivacyControl: true });
    expect(appended).toEqual([]);
    expect(win.va).toBeUndefined();
  });

  it("counts a visitor who sends no signal (doNotTrack unset or „0“)", () => {
    for (const doNotTrack of [null, "0", "unspecified"]) expect(run(script, { hostname: HOST, doNotTrack }).appended).toHaveLength(1);
  });

  it("stores nothing on the device and talks to no other origin", () => {
    expect(script).not.toMatch(/cookie|localStorage|sessionStorage|indexedDB/i);
    expect(script).not.toMatch(/https?:|\/\/[a-z]/i);
  });

  it("is safe as an inline <script>: no markup characters, and it never throws", () => {
    expect(script).not.toMatch(/[<>&]/);
    const broken = () =>
      new Function("window", "document", "location", "navigator", "addEventListener", script)(
        {},
        { readyState: "complete", createElement: () => { throw new Error("blocked"); }, head: {} },
        { hostname: HOST },
        {},
        () => {},
      );
    expect(broken).not.toThrow();
  });
});

describe("analytics loader — configuration", () => {
  it("takes the host from the canonical SITE_URL", () => {
    expect(analyticsHost("https://www.gimnastikakraguj.rs")).toBe(HOST);
    expect(analyticsHost("https://example.rs/")).toBe("example.rs");
    expect(ANALYTICS_SCRIPT).toBe(buildAnalyticsScript({ host: analyticsHost(SITE_URL) }));
    expect(run(ANALYTICS_SCRIPT, { hostname: analyticsHost(SITE_URL) }).appended).toHaveLength(1);
  });

  it("escapes the host it is given (it is written into a string literal)", () => {
    const hostile = buildAnalyticsScript({ host: 'x";alert(1);//' });
    expect(run(hostile, { hostname: HOST }).appended).toEqual([]);
    expect(hostile).not.toMatch(/[<>&]/);
  });
});
