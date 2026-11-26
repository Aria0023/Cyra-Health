/* The web build (docs/plans/website.md Task 1): the website at "/", the app under /app/, in one out dir.
     npm run build                      → dist/            (what Render publishes)
     node scripts/build-web.mjs --outDir dist-e2e          (the e2e harness)
   Steps:
     1. `vite build` with base /app/ into <out>/app/: the same app as the phone build, at another address.
     2. public/legal/ moves from <out>/app/legal/ to <out>/legal/: the legal pages keep their address (/legal/…).
     3. The app's manifest gets "id": "/" (the installed web app's identity before the move), so a browser can update
        an app installed from the old address instead of treating /app/ as a different app.
     4. The website (site/build/site.mjs) is written beside it: its pages, its own files under /site/ and the
        retiring /sw.js.
   The phone build is NOT this script: `npm run build:native` is plain `vite build` (the app at the root of dist/, no
   website), which `npm run cap:sync` copies into the iOS and Android projects (docs/NATIVE.md §2). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { buildSite } from "../site/build/site.mjs";
import { APP_BASE } from "../site/build/hosting.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const outArg = args.indexOf("--outDir") >= 0 ? args[args.indexOf("--outDir") + 1] : "dist";
const out = path.resolve(ROOT, outArg);
if (!out.startsWith(ROOT + path.sep)) throw new Error(`[solia] --outDir must be inside the project (${out})`);

fs.rmSync(out, { recursive: true, force: true });
await build({ root: ROOT, base: APP_BASE, build: { outDir: path.join(out, "app"), emptyOutDir: true } });

const legal = path.join(out, "app", "legal");
if (fs.existsSync(legal)) fs.renameSync(legal, path.join(out, "legal"));

const manifestPath = path.join(out, "app", "manifest.webmanifest");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.id = "/";
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

const written = await buildSite({ outDir: out });
console.log(`[solia] website: ${written.length} files beside ${path.relative(ROOT, path.join(out, "app"))}/ (${written.filter((f) => f.endsWith(".html")).join(", ")}; the rest under site/)`);
