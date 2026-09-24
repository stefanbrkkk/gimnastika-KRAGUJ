// Static serving for QA: the same `serve` binary as §10 (`npx serve out -l 4173`),
// started on demand and always stopped again. Never kills a server it did not start.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import net from "node:net";
import { join } from "node:path";
import { AUTOSERVE, ROOT, portOf } from "./env.mjs";

export function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port);
  });
}

export async function isUp(url) {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(3000) });
    return res.status > 0;
  } catch {
    return false;
  }
}

async function waitUp(url, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await isUp(url)) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

/** Starts `serve <dir> -l <port>`; resolves once it answers. */
export async function startStatic(dir, port) {
  if (!(await isPortFree(port))) throw new Error(`Port ${port} is already in use — stop that server or pick another port.`);
  const bin = join(ROOT, "node_modules/.bin/serve");
  const child = spawn(bin, [dir, "-l", String(port), "--no-clipboard", "--no-port-switching", "-L"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const url = `http://localhost:${port}`;
  if (!(await waitUp(`${url}/`, 20000))) {
    child.kill("SIGTERM");
    throw new Error(`serve did not start on ${port}: ${log.trim().slice(-400)}`);
  }
  return {
    url,
    started: true,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", () => resolve());
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 3000).unref();
      }),
  };
}

/**
 * Makes sure `baseUrl` serves `outDir`. If something already answers there it is
 * reused (and compared with outDir/index.html, so a stale server is reported);
 * otherwise, unless QA_AUTOSERVE=0, `serve outDir` is started on that port.
 * Returns { url, started, stop, matchesOut }.
 */
export async function ensureServed(baseUrl, outDir) {
  if (await isUp(`${baseUrl}/`)) {
    let matchesOut = null;
    try {
      const served = await (await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(5000) })).text();
      matchesOut = served === readFileSync(join(outDir, "index.html"), "utf8");
    } catch {
      matchesOut = null;
    }
    return { url: baseUrl, started: false, matchesOut, stop: async () => {} };
  }
  if (!AUTOSERVE) throw new Error(`${baseUrl} is not reachable and QA_AUTOSERVE=0 — start "npx serve out -l ${portOf(baseUrl)}" first.`);
  const handle = await startStatic(outDir, portOf(baseUrl));
  return { ...handle, url: baseUrl, matchesOut: true };
}
