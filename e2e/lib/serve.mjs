/* The e2e server (Playwright globalSetup): builds the demo-wearables bundle into dist-e2e/ (gitignored) and serves it
   with `vite preview` on a free port of 127.0.0.1. The URL reaches the specs as process.env.E2E_URL (Playwright passes
   globalSetup's environment to its workers). Nothing else is started: the build has no VITE_API_BASE, so the app has
   no server to talk to, which privacy.spec.mjs asserts.
     E2E_SKIP_BUILD=1   serve the existing dist-e2e/ (faster while writing a spec)
     E2E_DIST=<dir>     another out dir
   The build flags: VITE_DEMO_WEARABLES=true (illustrative readings, the Home card in every build), VITE_DEMO_SEED=true
   (75 days of illustrative check-ins, so the Report has something to print) and VITE_FEATURES=wearables,devGallery,proDev
   (the Wearables door, the gallery at #/dev/ui for screenshots, the Pro parts unlocked). */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DIST = process.env.E2E_DIST || "dist-e2e";
export const BUILD_ENV = Object.freeze({ VITE_DEMO_WEARABLES: "true", VITE_DEMO_SEED: "true", VITE_FEATURES: "wearables,signin,devGallery,proDev", CYRA_SKIP_POLICY_FETCH: "1" });
/* The second bundle (dist-e2e-api/, Task 1-3 specs): the shipping defaults plus proDev, with a backend at API_BASE, a host that
   never resolves. Every request to it is answered by the spec itself (page.route, e2e/lib/api.mjs), so no real server runs. */
export const API_BASE = "https://api.solia.test";
export const API_DIST = process.env.E2E_API_DIST || "dist-e2e-api";
export const API_BUILD_ENV = Object.freeze({ VITE_API_BASE: API_BASE, VITE_FEATURES: "proDev", CYRA_SKIP_POLICY_FETCH: "1" });
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const freePort = () => new Promise((resolve, reject) => {
  const s = createServer();
  s.on("error", reject);
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
});
const run = (cmd, args, env) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  p.stdout.on("data", (d) => { out += d; });
  p.stderr.on("data", (d) => { out += d; });
  p.on("exit", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}\n${out}`))));
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Builds (unless E2E_SKIP_BUILD) and serves; resolves { url, stop }. */
export async function startServer({ distName = DIST, env = BUILD_ENV } = {}) {
  const dist = path.join(ROOT, distName);
  if (process.env.E2E_SKIP_BUILD !== "1" || !fs.existsSync(path.join(dist, "index.html"))) {
    const out = await run(npx, ["vite", "build", "--outDir", distName], env);
    const bundle = fs.readdirSync(path.join(dist, "assets")).filter((f) => /^index-.*\.js$/.test(f));
    const stamps = bundle.map((f) => (fs.readFileSync(path.join(dist, "assets", f), "utf8").match(/BUILD 2026\.10\.07-D/g) || []).length).reduce((a, b) => a + b, 0);
    if (stamps !== 1) throw new Error(`expected the build stamp exactly once in the bundle, found ${stamps}\n${out}`);
  }
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const proc = spawn(npx, ["vite", "preview", "--outDir", distName, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: ROOT, env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  proc.stdout.on("data", (d) => { log += d; });
  proc.stderr.on("data", (d) => { log += d; });
  let exited = false;
  proc.on("exit", () => { exited = true; });
  for (let i = 0; i < 100; i++) {
    if (exited) throw new Error(`vite preview exited\n${log}`);
    try { const r = await fetch(url + "/index.html"); if (r.ok) break; } catch { /* not up yet */ }
    await wait(150);
    if (i === 99) { proc.kill(); throw new Error(`vite preview never answered on ${url}\n${log}`); }
  }
  const stop = () => new Promise((resolve) => { if (exited) return resolve(); proc.once("exit", resolve); proc.kill(); setTimeout(() => { try { proc.kill("SIGKILL"); } catch { /* gone */ } resolve(); }, 3000); });
  return { url, stop };
}

/* Playwright globalSetup: start, publish the URL, return the teardown. */
export default async function globalSetup() {
  const a = await startServer();
  const b = await startServer({ distName: API_DIST, env: API_BUILD_ENV });
  process.env.E2E_URL = a.url;
  process.env.E2E_API_URL = b.url;
  fs.mkdirSync(path.join(ROOT, "e2e", "shots"), { recursive: true });
  return async () => { await a.stop(); await b.stop(); };
}
