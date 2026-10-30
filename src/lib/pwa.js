/* The installable web app (spec A14.1): the offline service worker, its updates, and the
   install offer. Web only — in the phone app (isNative()) nothing here registers a worker,
   listens for an install prompt or shows install UI.

   The worker (public/sw.js) keeps only Cyra's own app files so Cyra opens without a
   connection; it never stores health data or any server answer. It is registered only in a
   production build, only while this device holds a record (App.jsx, phase "app"), at the
   same URL lib/notifications.js uses for reminders, so there is one registration. Delete
   everything unregisters it and deletes its caches (clearShellCaches).

   The pure helpers at the top are unit-tested (src/lib/pwa.test.mjs); the rest is browser glue. */
import { isNative } from "./native.js";

export const SHELL_CACHE_PREFIX = "cyra-shell-";
export const INSTALL_HINT_AFTER = 1; // logged days before Home shows the install tip (L11: after the first saved check-in, never during onboarding)
export const UPDATE_CHECK_GAP_MS = 3600000; // at most one update check an hour when Cyra comes back on screen
const PROD = (() => { try { return !!import.meta.env.PROD; } catch { return false; } })();
/* The script this page runs. In the build that is /assets/index-<hash>.js, the entry chunk this
   module is bundled into; a waiting worker built from the same files names the same entry. */
const PAGE_ENTRY = (() => { try { return new URL(import.meta.url).pathname; } catch { return null; } })();

/* ---------- pure ---------- */

/** An iPhone, iPod or iPad (iPadOS in desktop mode reports a Mac with a touch screen). */
export function isIOSDevice(ua, platform, maxTouchPoints) {
  return /iPhone|iPad|iPod/.test(String(ua || "")) || (platform === "MacIntel" && Number(maxTouchPoints) > 1);
}

/** "none" | "standalone" | "ios" | "prompt": what this browser can offer, in that precedence. */
export function installModeFor({ native = false, standalone = false, ios = false, hasPrompt = false } = {}) {
  if (native) return "none";
  if (standalone) return "standalone";
  if (ios) return "ios";
  if (hasPrompt) return "prompt";
  return "none";
}

/** The stored installHint: "dismissed" | "installed" | null. */
export const cleanInstallHint = (v) => (v === "dismissed" || v === "installed" ? v : null);

const HINT_RANK = { installed: 2, dismissed: 1 };
/** The stronger of two hints (installed > dismissed > null), so a stale tab can't bring the tip back. */
export function mergeInstallHint(a, b) {
  const x = cleanInstallHint(a), y = cleanInstallHint(b);
  return (HINT_RANK[x] || 0) >= (HINT_RANK[y] || 0) ? x : y;
}

/** Home's install tip: only where install can be offered, from INSTALL_HINT_AFTER logged days, never once hidden or installed. */
export function showInstallHint({ mode, daysLogged = 0, installHint = null, stored = false } = {}) {
  return (mode === "prompt" || mode === "ios") && !!stored && daysLogged >= INSTALL_HINT_AFTER && !cleanInstallHint(installHint);
}

/** Settings → Install: shown in the same modes, whenever the record is in IndexedDB. */
export const offersInstall = ({ mode, stored = false } = {}) => (mode === "prompt" || mode === "ios") && !!stored;

/** A waiting worker built from the files this page already runs is adopted silently; any other one is offered. */
export const updateAction = (pageEntry, waitingEntry) => (pageEntry && waitingEntry && pageEntry === waitingEntry ? "adopt" : "prompt");

/* ---------- browser ---------- */

export const swSupported = () => !isNative() && PROD && typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof window !== "undefined" && window.isSecureContext !== false;

/** Cyra opened from the home screen or app list (its own window). */
export function displayStandalone() {
  if (typeof window === "undefined") return false;
  try {
    if (typeof window.matchMedia === "function" && (window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches)) return true;
  } catch { /* no media queries: fall through */ }
  return typeof navigator !== "undefined" && navigator.standalone === true;
}

/* Chromium's install prompt, captured once per page. preventDefault also keeps Chrome's own
   mini-infobar away during onboarding: install is offered only where Cyra offers it. */
let deferred = null;
const subscribers = new Set();
const notify = (kind) => { for (const s of [...subscribers]) { try { s(kind); } catch { /* one listener's error stays its own */ } } };
if (typeof window !== "undefined" && !isNative()) {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; notify("prompt"); });
  window.addEventListener("appinstalled", () => { deferred = null; notify("installed"); });
}

export function currentInstallMode() {
  const nav = typeof navigator !== "undefined" ? navigator : {};
  return installModeFor({ native: isNative(), standalone: displayStandalone(), ios: isIOSDevice(nav.userAgent, nav.platform, nav.maxTouchPoints), hasPrompt: !!deferred });
}

/** Hear about a captured prompt (replayed at once if one is already held) and an install. Returns unsubscribe. */
export function listenForInstall({ onPrompt, onInstalled } = {}) {
  const fn = (kind) => { if (kind === "prompt") onPrompt?.(); else if (kind === "installed") onInstalled?.(); };
  subscribers.add(fn);
  if (deferred) fn("prompt");
  return () => { subscribers.delete(fn); };
}

/** Show the browser's install dialog once: "accepted" | "dismissed" | "unavailable". */
export async function promptInstall() {
  const e = deferred;
  if (!e) return "unavailable";
  deferred = null; // a prompt can be used once
  try { await e.prompt(); } catch { return "unavailable"; }
  try { const choice = await e.userChoice; return choice?.outcome === "accepted" ? "accepted" : "dismissed"; } catch { return "dismissed"; }
}

let regPromise = null;
let reg = null;
let lastCheck = 0;
let onUpdate = null;

/** Which build a worker carries: { version, entry } over a MessageChannel, or null. */
export function askBuild(worker, timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (!worker || typeof MessageChannel === "undefined") { resolve(null); return; }
    const ch = new MessageChannel();
    const t = setTimeout(() => { ch.port1.close(); resolve(null); }, timeoutMs);
    ch.port1.onmessage = (e) => {
      clearTimeout(t); ch.port1.close();
      const d = e.data || {};
      resolve({ version: typeof d.version === "string" ? d.version : null, entry: typeof d.entry === "string" ? d.entry : null });
    };
    try { worker.postMessage({ type: "CYRA_BUILD" }, [ch.port2]); } catch { clearTimeout(t); resolve(null); }
  });
}

/* A worker that finished installing while this page is controlled by an older one: the same
   build as this page → take over quietly; a different one → offer Reload. On a first install
   (no controller) there's nothing to update. */
async function consider(w) {
  if (!w || typeof navigator === "undefined" || !navigator.serviceWorker?.controller) return;
  const build = await askBuild(w);
  if (updateAction(PAGE_ENTRY, build?.entry) === "adopt") { try { w.postMessage({ type: "CYRA_SKIP_WAITING" }); } catch { /* it activates on the next launch */ } }
  else onUpdate?.();
}
const watchInstalling = (w) => { if (w) w.addEventListener("statechange", () => { if (w.state === "installed") consider(w); }); };

/** Register /sw.js (web, production build only). Memoized; a failed registration is tried again on the next call. */
export function registerWorker({ onUpdateReady } = {}) {
  if (onUpdateReady) onUpdate = onUpdateReady;
  if (!swSupported()) return Promise.resolve(null);
  if (regPromise) return regPromise;
  regPromise = navigator.serviceWorker.register("/sw.js").then((r) => {
    reg = r; lastCheck = Date.now();
    if (r.waiting) consider(r.waiting);
    watchInstalling(r.installing);
    r.addEventListener("updatefound", () => watchInstalling(r.installing));
    return r;
  }, () => { regPromise = null; return null; });
  return regPromise;
}

/** true once the registration has an active worker; false if its worker turns redundant or timeoutMs passes. */
export function whenActive(registration, timeoutMs = 20000) {
  if (!registration) return Promise.resolve(false);
  if (registration.active) return Promise.resolve(true);
  const w = registration.installing || registration.waiting;
  if (!w) return Promise.resolve(false);
  return new Promise((resolve) => {
    let t = null;
    const done = (v) => { clearTimeout(t); w.removeEventListener("statechange", check); resolve(v); };
    const check = () => { if (w.state === "activated") done(true); else if (w.state === "redundant") done(false); };
    t = setTimeout(() => done(!!registration.active), timeoutMs);
    w.addEventListener("statechange", check);
    check();
  });
}

/** This browser holds Cyra's offline copy (a cyra-shell-* cache). */
export async function hasShellCache() {
  try { return typeof caches !== "undefined" && (await caches.keys()).some((k) => k.startsWith(SHELL_CACHE_PREFIX)); } catch { return false; }
}

/** Ask the browser to look for a new /sw.js, at most once per UPDATE_CHECK_GAP_MS. */
export function checkForUpdate(now = Date.now()) {
  if (!reg || now - lastCheck < UPDATE_CHECK_GAP_MS) return false;
  lastCheck = now;
  try { reg.update().catch(() => { /* tried again later */ }); } catch { /* tried again later */ }
  return true;
}

/** Reload: the waiting worker takes over first (or the timeout passes), then the page reloads. */
export async function applyUpdate({ timeoutMs = 4000 } = {}) {
  let w = reg?.waiting || null;
  if (!w && typeof navigator !== "undefined" && navigator.serviceWorker?.getRegistration) w = (await navigator.serviceWorker.getRegistration().catch(() => null))?.waiting || null;
  if (w) {
    await new Promise((resolve) => {
      let t = null;
      const sw = navigator.serviceWorker;
      const done = () => { clearTimeout(t); sw.removeEventListener("controllerchange", done); w.removeEventListener("statechange", onState); resolve(); };
      const onState = () => { if (w.state === "activated" || w.state === "redundant") done(); };
      t = setTimeout(done, timeoutMs);
      sw.addEventListener("controllerchange", done);
      w.addEventListener("statechange", onState);
      try { w.postMessage({ type: "CYRA_SKIP_WAITING" }); } catch { done(); }
    });
  }
  // With no waiting worker another tab already activated it: a reload is all that's left.
  window.location.reload();
}

/** Delete every cyra-shell-* cache (Delete everything). */
export async function clearShellCaches() {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith(SHELL_CACHE_PREFIX)).map((k) => caches.delete(k)));
}
