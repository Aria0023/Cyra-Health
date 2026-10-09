/* Links that leave the app: the Terms and the Privacy Policy.
   Their addresses are public build-time config (VITE_TERMS_URL, VITE_PRIVACY_URL;
   see .env.example). When either is missing the build still succeeds, but
   vite.config.js prints a warning, and POLICY_LINKS_READY is false so the consent
   step says the documents aren't published yet instead of showing a dead link.
   openExternal() opens a link outside Cyra: the system browser on the phone
   (Capacitor Browser), a new tab on the web. Nothing from Cyra is added to the URL. */
import { isNative, Browser } from "./native.js";

const clean = (v) => {
  const s = String(v || "").trim();
  try { return /^https:\/\//i.test(s) ? new URL(s).href : ""; } catch { return ""; }
};
export const TERMS_URL = clean(import.meta.env.VITE_TERMS_URL);
export const PRIVACY_URL = clean(import.meta.env.VITE_PRIVACY_URL);
export const POLICY_LINKS_READY = !!(TERMS_URL && PRIVACY_URL);

export function openExternal(url) {
  if (!url) return;
  if (isNative()) { Browser.open({ url }).catch(() => { /* no browser available */ }); return; }
  window.open(url, "_blank", "noopener,noreferrer");
}
