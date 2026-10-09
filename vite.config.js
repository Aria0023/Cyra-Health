import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

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

export default defineConfig({ plugins: [react(), policyLinksCheck(), policyLinksFetch()] });
