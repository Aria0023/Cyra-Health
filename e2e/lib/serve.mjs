/* The e2e server (Playwright globalSetup): builds the demo-wearables web build into dist-e2e/ (gitignored; the website at
   "/", the app under /app/, scripts/build-web.mjs) and serves it on a free port of 127.0.0.1 the way Render is configured
   to (site/build/serve.mjs). The APP's address reaches the specs as process.env.E2E_URL (http://127.0.0.1:<port>/app, so
   `${E2E_URL}/` is the app and `${E2E_URL}/#/you` a route in it) and the website's as process.env.E2E_SITE_URL (the
   origin); Playwright passes globalSetup's environment to its workers. Nothing else is started: the build has no
   VITE_API_BASE, so the app has no server to talk to, which privacy.spec.mjs asserts.
     E2E_SKIP_BUILD=1   serve the existing dist-e2e/ (faster while writing a spec)
     E2E_DIST=<dir>     another out dir
   The build flags: VITE_DEMO_WEARABLES=true (illustrative readings, the Home card in every build), VITE_DEMO_SEED=true
   (75 days of illustrative check-ins, so the Report has something to print) and VITE_FEATURES=wearables,devGallery,proDev
   (the Wearables door, deviceSync for the phone and glucose rows (Task B), the gallery at #/dev/ui for screenshots, the Pro parts unlocked). */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serveStatic } from "../../site/build/serve.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DIST = process.env.E2E_DIST || "dist-e2e";
export const BUILD_ENV = Object.freeze({ VITE_DEMO_WEARABLES: "true", VITE_DEMO_SEED: "true", VITE_FEATURES: "wearables,deviceSync,shop,signin,devGallery,proDev,trialGate", VITE_SUPPORT_EMAIL: "help@solia.example", CYRA_SKIP_POLICY_FETCH: "1" });
/* The second bundle (dist-e2e-api/, Task 1-3 specs): the shipping defaults plus proDev, with a backend at API_BASE, a host that
   never resolves. Every request to it is answered by the spec itself (page.route, e2e/lib/api.mjs), so no real server runs. */
export const API_BASE = "https://api.solia.test";
export const API_DIST = process.env.E2E_API_DIST || "dist-e2e-api";
export const API_BUILD_ENV = Object.freeze({ VITE_API_BASE: API_BASE, VITE_FEATURES: "proDev", CYRA_SKIP_POLICY_FETCH: "1" });
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const run = (cmd, args, env) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  p.stdout.on("data", (d) => { out += d; });
  p.stderr.on("data", (d) => { out += d; });
  p.on("exit", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}\n${out}`))));
});

const stampCount = (assetsDir) => fs.readdirSync(assetsDir).filter((f) => /^index-.*\.js$/.test(f))
  .map((f) => (fs.readFileSync(path.join(assetsDir, f), "utf8").match(/BUILD 2026\.10\.07-D/g) || []).length).reduce((a, b) => a + b, 0);

/** Builds (unless E2E_SKIP_BUILD) and serves; resolves { url, site, stop }: url is the app (…/app), site the origin. */
export async function startServer({ distName = DIST, env = BUILD_ENV } = {}) {
  const dist = path.join(ROOT, distName);
  if (process.env.E2E_SKIP_BUILD !== "1" || !fs.existsSync(path.join(dist, "app", "index.html"))) {
    const out = await run(process.execPath, ["scripts/build-web.mjs", "--outDir", distName], env);
    const stamps = stampCount(path.join(dist, "app", "assets"));
    if (stamps !== 1) throw new Error(`expected the build stamp exactly once in the bundle, found ${stamps}\n${out}`);
  }
  const s = await serveStatic({ root: dist });
  return { url: `${s.url}/app`, site: s.url, stop: s.stop };
}

/* The app the way it was served before the move (and the way the phone build still is): plain `vite build`, the app at
   the root of its out dir, its worker at /sw.js. Built on demand by e2e/site-move.spec.mjs into dist-e2e-root/ and served
   by that spec on its own port, which it then switches to the web build to prove the move keeps her record. */
export const ROOT_DIST = process.env.E2E_ROOT_DIST || "dist-e2e-root";
export async function buildRootApp({ distName = ROOT_DIST, env = BUILD_ENV } = {}) {
  const dist = path.join(ROOT, distName);
  if (process.env.E2E_SKIP_BUILD !== "1" || !fs.existsSync(path.join(dist, "index.html"))) {
    const out = await run(npx, ["vite", "build", "--outDir", distName], env);
    const stamps = stampCount(path.join(dist, "assets"));
    if (stamps !== 1) throw new Error(`expected the build stamp exactly once in the bundle, found ${stamps}\n${out}`);
  }
  return dist;
}

/* Playwright globalSetup: start, publish the URL, return the teardown. */
export default async function globalSetup() {
  const a = await startServer();
  const b = await startServer({ distName: API_DIST, env: API_BUILD_ENV });
  process.env.E2E_URL = a.url;
  process.env.E2E_API_URL = b.url;
  process.env.E2E_SITE_URL = a.site;
  process.env.E2E_API_SITE_URL = b.site;
  fs.mkdirSync(path.join(ROOT, "e2e", "shots"), { recursive: true });
  return async () => { await a.stop(); await b.stop(); };
}
