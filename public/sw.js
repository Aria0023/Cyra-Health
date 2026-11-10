/* Cyra service worker (web only; the phone app never registers it).
   1. Shows reminder pushes and opens the app on tap. The payload is a generic reminder —
      never health content.
   2. Keeps Cyra's own files (index.html, the script, styles, fonts, icons, manifest) so Cyra
      opens without a connection (spec A14.1). It stores nothing else: never health data
      (that stays in IndexedDB, which this worker never opens), never an answer from Cyra's
      server or any other site, never anything under /api/.
   BUILD is filled in by vite.config.js (cyraServiceWorker) at build time; in `vite dev` it
   stays empty and the worker only handles reminders, as before. */
const BUILD = {"version":"dev","base":"/","entry":null,"index":"/index.html","files":[]}; // @cyra-build
/* Passive tracking S3 (plan §2.6): a payload with type "confirm-night" carries two action buttons, Looks right and Open. The
   local day is this device's (the night ends on the wake day). Everything else is the plain reminder as before. */
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  if (data.type === "confirm-night") {
    const day = typeof data.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.day) ? data.day : localDay();
    event.waitUntil(self.registration.showNotification(data.title || "Solia Health", { body: data.body || "Last night synced. Looks right?", tag: "cyra-confirm", renotify: false, data: { type: "confirm-night", day }, actions: [{ action: "ok", title: "Looks right" }, { action: "open", title: "Open" }] }));
    return;
  }
  event.waitUntil(self.registration.showNotification(data.title || "Solia Health", { body: data.body || "Time for your 30-second check-in.", tag: data.tag || "cyra-checkin", renotify: false }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = (event.notification && event.notification.data) || {};
  if (data.type === "confirm-night") {
    // Looks right: tell an open Solia Health page (it writes the confirmation), or open the page at #/confirm/<day>, which
    // writes it on load. Open (or a tap on the body): focus or open Home.
    const day = typeof data.day === "string" ? data.day : localDay();
    event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const w = list.find((c) => "focus" in c);
      if (event.action === "ok") {
        if (w && typeof w.postMessage === "function") { w.postMessage({ type: "confirm-night", day }); return w.focus(); }
        return self.clients.openWindow(`/#/confirm/${day}`);
      }
      return w ? w.focus() : self.clients.openWindow("/");
    }));
    return;
  }
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => { const w = list.find((c) => "focus" in c); return w ? w.focus() : self.clients.openWindow("/"); }));
});

/* The page asks which build this worker carries (lib/pwa.js askBuild), to adopt an update
   silently when it already runs that build, and tells a waiting worker to take over when she
   taps Reload. */
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "CYRA_BUILD") {
    const port = event.ports && event.ports[0];
    if (port) port.postMessage({ version: BUILD.version, entry: BUILD.entry });
  } else if (data.type === "CYRA_SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* The offline shell. Only in a build (dev keeps a push-only worker). */
if (BUILD.files.length) {
  const CACHE = "cyra-shell-" + BUILD.version;
  const NAV_TIMEOUT_MS = 4000;
  const FILES = new Set(BUILD.files);

  // Atomic: if any file can't be fetched the install fails and the older worker keeps serving.
  self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(BUILD.files.map((u) => new Request(u, { cache: "reload" })))));
  });

  // Only Cyra's own older shell caches go; any other cache name is left alone. Open pages are
  // never claimed: a page that loaded without this worker stays that way until it is reloaded.
  self.addEventListener("activate", (event) => {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("cyra-shell-") && k !== CACHE).map((k) => caches.delete(k)))));
  });

  const cached = async (path) => (await caches.open(CACHE)).match(path);

  // App navigations: the network answer when it comes within NAV_TIMEOUT_MS (never written to
  // the cache), otherwise the precached index.html.
  const networkFirst = (req) => new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const fallback = async () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      let hit = null;
      try { hit = await cached(BUILD.index); } catch { hit = null; }
      resolve(hit || Response.error());
    };
    timer = setTimeout(fallback, NAV_TIMEOUT_MS);
    fetch(req).then((res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res);
    }, fallback);
  });

  // Precached files: from the cache, or from the network if the cache has lost one (not stored).
  const cacheFirst = async (req, url) => {
    let hit = null;
    try { hit = await cached(url.pathname); } catch { hit = null; }
    return hit || fetch(req);
  };

  self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    // Cyra's server, Oura, Terra, any other site, and anything under /api/: never touched.
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith(BUILD.base + "api/")) return;
    if (req.mode === "navigate") {
      // App routes only (index.html or a path with no file extension); a navigation to a
      // file such as /fonts/OFL-Karla.txt goes to the network untouched.
      if (url.pathname === BUILD.index || !/\.[a-z0-9]+$/i.test(url.pathname)) event.respondWith(networkFirst(req));
      return;
    }
    if (FILES.has(url.pathname)) event.respondWith(cacheFirst(req, url));
  });
}
