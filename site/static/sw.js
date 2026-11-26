/* The retiring worker (docs/plans/website.md Task 1). Until 2026-11 the web app lived at "/" and registered its offline
   worker here, at /sw.js with scope "/". The app now lives under /app/ and registers /app/sw.js with scope /app/. A
   browser that still holds the old registration fetches this file on its next visit; it then
     1. deletes the old app's file caches: only "cyra-shell-…" caches that hold the old shell ("/index.html"). The new
        app's cache holds "/app/index.html" and is left alone; nothing else is touched (her record is in IndexedDB,
        which no worker ever opens);
     2. unregisters itself, so "/" has no worker any more;
     3. reloads the pages it controlled, so nobody stays on the old cached shell.
   It has no fetch, push or message handler: it keeps nothing and answers nothing. */
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      for (const name of await caches.keys()) {
        if (!name.startsWith("cyra-shell-")) continue;
        const cache = await caches.open(name);
        if (await cache.match("/index.html")) await caches.delete(name);
      }
    } catch { /* no cache storage: nothing to delete */ }
    let pages = [];
    try { pages = await self.clients.matchAll({ type: "window" }); } catch { pages = []; }
    try { await self.registration.unregister(); } catch { /* already gone */ }
    for (const page of pages) { try { await page.navigate(page.url); } catch { /* a page it no longer controls reloads on its own next visit */ } }
  })());
});
