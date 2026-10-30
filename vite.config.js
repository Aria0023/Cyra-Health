import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { precacheList, injectBuild } from "./src/lib/swBuild.js";
import { parseFeatures, parseDevFlags, unknownFeatures, FEATURE_NAMES, DEV_FLAG_NAMES } from "./src/lib/features.js";

/* The consent step links the Terms and the Privacy Policy (src/lib/links.js). Until the
   attorney-reviewed documents are published and VITE_TERMS_URL / VITE_PRIVACY_URL are set
   (Render → Environment for the static site; .env.local for phone builds), the build
   still passes but says so loudly, and the app says the documents "aren't published yet"
   rather than showing a link that goes nowhere. */
function policyLinksCheck() {
  let warned = false;
  return {
    name: "cyra-policy-links-check",
    configResolved(config) {
      if (warned || config.command !== "build") return;
      const env = loadEnv(config.mode, config.envDir || process.cwd(), "VITE_");
      const missing = ["VITE_TERMS_URL", "VITE_PRIVACY_URL"].filter((k) => !/^https:\/\//i.test(String(env[k] || process.env[k] || "").trim()));
      if (missing.length) {
        warned = true;
        console.warn(`\n[cyra] WARNING: ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not set to an https:// URL. ` +
          "This build says on the consent step that the missing document isn't published yet, instead of a link. " +
          "Set both before a public release.\n");
      }
    },
  };
}

/* A release build (vite build, production mode) with a policy URL set checks that the URL
   really serves a document (2xx, HTML or PDF) and fails otherwise, so "Read the Terms" can't
   point at a placeholder or a 404. CYRA_SKIP_POLICY_FETCH=1 skips it (offline CI only; a
   loud warning is printed). The person releasing still confirms the documents are the final,
   attorney-reviewed ones and match this build (A12 checklist). */
function policyLinksFetch() {
  let mode = "development", command = "serve", env = {};
  return {
    name: "cyra-policy-links-fetch",
    configResolved(config) { mode = config.mode; command = config.command; env = loadEnv(config.mode, config.envDir || process.cwd(), "VITE_"); },
    async buildStart() {
      if (command !== "build" || mode !== "production") return;
      const urls = ["VITE_TERMS_URL", "VITE_PRIVACY_URL"].map((k) => [k, String(env[k] || process.env[k] || "").trim()]).filter(([, v]) => /^https:\/\//i.test(v));
      if (!urls.length) return;
      if (process.env.CYRA_SKIP_POLICY_FETCH === "1") { console.warn("\n[cyra] WARNING: CYRA_SKIP_POLICY_FETCH=1 — the Terms / Privacy Policy URLs were NOT checked.\n"); return; }
      for (const [k, url] of urls) {
        let ok = false, why = "";
        try {
          const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
          const type = r.headers.get("content-type") || "";
          ok = r.ok && /text\/html|application\/pdf/i.test(type); why = `${r.status} ${type}`;
        } catch (e) { why = e?.message || "no answer"; }
        if (!ok) throw new Error(`[cyra] ${k}=${url} doesn't serve a document (${why}). Fix it, unset it, or set CYRA_SKIP_POLICY_FETCH=1 for an offline build.`);
      }
    },
  };
}

/* Offline shell (spec A14.1): lists only Cyra's own files — index.html, the bundle under
   assets/, manifest.webmanifest and icons/*.png (never sw.js, source maps or the font licence
   texts) — and writes that list, a content-hash version and the entry script into the one
   `// @cyra-build` line of the sw.js copied into the out dir (public/sw.js keeps its dev
   placeholder). Identical rebuilds give an identical version; it works with any --outDir.
   Build only: `vite dev` serves public/sw.js as it is, a reminders-only worker. */
function cyraServiceWorker() {
  let config = null;
  const listPublic = (dir) => {
    if (!dir || !fs.existsSync(dir)) return [];
    const out = [];
    const walk = (abs, rel) => {
      for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) walk(path.join(abs, e.name), r);
        else if (e.isFile()) out.push(r);
      }
    };
    walk(dir, "");
    return out.sort();
  };
  return {
    name: "cyra-service-worker",
    apply: "build",
    configResolved(c) { config = c; },
    writeBundle(options, bundle) {
      // Vite copied public/ into the out dir before writing the bundle, so sw.js is there.
      const outDir = options.dir || config.build.outDir;
      const pub = listPublic(config.publicDir);
      const files = precacheList({ bundleFiles: Object.keys(bundle), publicFiles: pub, base: config.base });
      const h = createHash("sha256");
      for (const name of Object.keys(bundle).sort()) {
        const item = bundle[name];
        h.update(name); h.update("\0"); h.update(item.type === "chunk" ? item.code : item.source); h.update("\0");
      }
      for (const name of pub) { h.update(name); h.update("\0"); h.update(fs.readFileSync(path.join(config.publicDir, name))); h.update("\0"); }
      const version = h.digest("hex").slice(0, 16);
      const entryChunk = Object.values(bundle).find((b) => b.type === "chunk" && b.isEntry);
      const entry = entryChunk ? config.base + entryChunk.fileName : null;
      const swPath = path.join(outDir, "sw.js");
      if (!fs.existsSync(swPath)) { config.logger.warn("\n[cyra] WARNING: no sw.js in the out dir, so this build has no offline shell.\n"); return; }
      fs.writeFileSync(swPath, injectBuild(fs.readFileSync(swPath, "utf8"), { version, base: config.base, entry, index: config.base + "index.html", files }));
      const missing = [config.base + "manifest.webmanifest", ...["icon-192.png", "icon-512.png", "icon-maskable-192.png", "icon-maskable-512.png", "apple-touch-icon.png"].map((f) => `${config.base}icons/${f}`)].filter((f) => !files.includes(f));
      if (missing.length) config.logger.warn(`\n[cyra] WARNING: the offline shell is missing ${missing.join(", ")} (run python3 scripts/make-icons.py).\n`);
    },
  };
}

/* Feature flags (local-first L4, src/lib/features.js): a build says which optional features it offers,
   so a release can't ship a different set by accident, and warns about a name it doesn't know. The app
   itself reads the same value (import.meta.env.VITE_FEATURES, inlined by Vite). Build only. */
function featureFlagsReport() {
  let said = false;
  return {
    name: "cyra-feature-flags",
    configResolved(config) {
      if (said || config.command !== "build") return;
      said = true;
      const raw = loadEnv(config.mode, config.envDir || process.cwd(), "VITE_").VITE_FEATURES ?? process.env.VITE_FEATURES;
      const f = parseFeatures(raw);
      const dev = parseDevFlags(raw);
      const on = FEATURE_NAMES.filter((n) => f[n]);
      const unset = raw == null || !String(raw).trim();
      console.log(`[cyra] features: ${on.length ? on.join(", ") : "none"}${unset ? " (VITE_FEATURES unset: the shipping defaults)" : ""}`);
      // Developer-only flags (calm R1) on their own line, so the product line above stays as it was.
      const devOn = DEV_FLAG_NAMES.filter((n) => dev[n]);
      if (devOn.length) console.log(`[cyra] dev flags: ${devOn.join(", ")} (not product features)`);
      const bad = unknownFeatures(raw);
      if (bad.length) console.warn(`[cyra] WARNING: VITE_FEATURES names unknown features: ${bad.join(", ")} (known: ${[...FEATURE_NAMES, ...DEV_FLAG_NAMES].join(", ")}, all, none)`);
    },
  };
}

/* The dev gallery flag (calm R1, src/lib/features.js parseDevFlags) as a build-time constant, so main.jsx's
   `__CYRA_DEV_GALLERY__ && import("./dev/DevGallery.jsx")` is dropped from a build without it (no chunk, no route). */
export default defineConfig(({ mode }) => {
  const raw = loadEnv(mode, process.cwd(), "VITE_").VITE_FEATURES ?? process.env.VITE_FEATURES;
  return {
    plugins: [react(), policyLinksCheck(), policyLinksFetch(), cyraServiceWorker(), featureFlagsReport()],
    define: { __CYRA_DEV_GALLERY__: JSON.stringify(parseDevFlags(raw).devGallery) },
  };
});
