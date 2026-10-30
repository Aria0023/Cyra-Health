/* Unit tests for the offline shell (spec A14.1): the build-time helpers in lib/swBuild.js and
   public/sw.js itself, run in node:vm with a fake service-worker global. Run with
   `npm run test:unit`. Checks: the precache list holds only Heard Health's own files; the BUILD line is
   filled in literally and nothing else in the file changes; the dev placeholder stays a
   reminders-only worker; the push and notificationclick handlers are the ones from before L1,
   word for word, and behave as before; install precaches exactly BUILD.files, activate removes
   only older cyra-shell-* caches; fetch never touches other sites, /api/ or non-GET requests,
   serves app navigations network-first with the cached index.html as the fallback and listed
   files cache-first; the worker answers CYRA_BUILD and CYRA_SKIP_WAITING; and the source never
   writes to a cache, opens IndexedDB or claims pages. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { precacheList, injectBuild } from "./swBuild.js";

const SW_PATH = new URL("../../public/sw.js", import.meta.url);
const SOURCE = fs.readFileSync(SW_PATH, "utf8");

/* The two handlers exactly as public/sw.js had them before L1 (`git show main:public/sw.js`). */
const PUSH_STMT = `self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  event.waitUntil(self.registration.showNotification(data.title || "Heard Health", { body: data.body || "Time for your 30-second check-in.", tag: data.tag || "cyra-checkin", renotify: false }));
});`;
const CLICK_STMT = `self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => { const w = list.find((c) => "focus" in c); return w ? w.focus() : self.clients.openWindow("/"); }));
});`;
const MAIN_SW = `/* Heard Health service worker: shows reminder pushes and opens the app on tap.
   The payload is a generic reminder — never health content. */
${PUSH_STMT}
${CLICK_STMT}
`;

const BUILD = { version: "0123456789abcdef", base: "/", entry: "/assets/index-abc.js", index: "/index.html", files: ["/assets/index-abc.js", "/assets/index-x.css", "/icons/icon-192.png", "/index.html", "/manifest.webmanifest"] };

/* A fake service-worker global: listeners, notifications, clients, caches and fetch, all recorded. */
function load(source, { fetchImpl, setTimeoutImpl } = {}) {
  const listeners = {};
  const log = { notifications: [], opened: [], focused: 0, skipWaiting: 0, fetches: [], added: {}, deleted: [] };
  const store = new Map(); // cache name -> Map(path -> response)
  const cacheOf = (name) => {
    if (!store.has(name)) store.set(name, new Map());
    const m = store.get(name);
    return {
      addAll: async (reqs) => { log.added[name] = reqs.map((r) => ({ url: r.url, cache: r.init?.cache })); for (const r of reqs) m.set(r.url, { body: `cached ${r.url}` }); },
      match: async (p) => m.get(typeof p === "string" ? p : p.url) || undefined,
      keys: async () => [...m.keys()],
    };
  };
  const caches = {
    open: async (name) => cacheOf(name),
    keys: async () => [...store.keys()],
    delete: async (name) => { log.deleted.push(name); return store.delete(name); },
  };
  class FakeRequest { constructor(url, init) { this.url = url; this.init = init; } }
  const ERROR = { error: true };
  const self = {
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    registration: { showNotification: (title, opts) => { log.notifications.push([title, opts]); return Promise.resolve(); } },
    clients: { windows: [], matchAll: async (o) => { log.matchAll = o; return self.clients.windows; }, openWindow: async (u) => { log.opened.push(u); } },
    location: { origin: "https://app.test" },
    skipWaiting: () => { log.skipWaiting++; return Promise.resolve(); },
  };
  const ctx = {
    self, caches, Request: FakeRequest, URL, Promise,
    Response: { error: () => ERROR },
    fetch: (req) => { log.fetches.push(req.url || req); return fetchImpl ? fetchImpl(req) : Promise.resolve({ network: req.url }); },
    setTimeout: setTimeoutImpl || setTimeout, clearTimeout,
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  const fire = (type, event) => { for (const fn of listeners[type] || []) fn(event); return event; };
  return { listeners, log, store, caches, fire, ERROR, self };
}
// Objects made inside the vm context have that realm's prototypes: compare their JSON shape.
const plain = (v) => JSON.parse(JSON.stringify(v));
const ext = (overrides = {}) => { const e = { waitUntil(p) { this.p = p; }, ...overrides }; return e; };
const fetchEvent = (url, { method = "GET", mode = "cors" } = {}) => ({ request: { url, method, mode }, responded: null, respondWith(p) { this.responded = p; } });

/* ---------- swBuild.js ---------- */

test("precacheList: bundle files minus maps and sw.js, plus the manifest and icons, sorted and base-prefixed", () => {
  const bundleFiles = ["index.html", "assets/index-abc.js", "assets/index-abc.js.map", "assets/index-x.css", "assets/karla.woff2", "sw.js", "assets/index-abc.js"];
  const publicFiles = ["sw.js", "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png", "icons/favicon.svg", "icons/sub/deep.png", "icons/readme.txt", "fonts/OFL-Karla.txt", "fonts/OFL-Fraunces.txt", "other.webmanifest"];
  const out = precacheList({ bundleFiles, publicFiles, base: "/" });
  assert.deepEqual(out, ["/assets/index-abc.js", "/assets/index-x.css", "/assets/karla.woff2", "/icons/apple-touch-icon.png", "/icons/favicon.svg", "/icons/icon-192.png", "/index.html", "/manifest.webmanifest"]);
  assert.ok(out.includes("/index.html"));
  assert.ok(!out.some((f) => f.endsWith(".map") || f.endsWith("sw.js") || f.includes("/fonts/")));
  assert.deepEqual([...out].sort(), out);
  assert.equal(new Set(out).size, out.length);
  const sub = precacheList({ bundleFiles, publicFiles, base: "/app/" });
  assert.deepEqual(sub, out.map((f) => "/app" + f));
  assert.deepEqual(precacheList({ bundleFiles: ["index.html"] }), ["/index.html"]);
});

test("injectBuild: replaces only the marker line, literally", () => {
  const filled = injectBuild(SOURCE, BUILD);
  const a = SOURCE.split("\n"), b = filled.split("\n");
  assert.equal(a.length, b.length);
  const changed = a.map((l, i) => (l === b[i] ? null : i)).filter((i) => i != null);
  assert.equal(changed.length, 1);
  assert.equal(b[changed[0]], `const BUILD = ${JSON.stringify(BUILD)}; // @cyra-build`);
  assert.throws(() => injectBuild("self.addEventListener('push', () => {});\n", BUILD), /\[cyra\] public\/sw\.js has no BUILD line/);
  const odd = { ...BUILD, files: ["/assets/a$&b$1.js", "/assets/$$.js"] };
  const out = injectBuild(SOURCE, odd);
  assert.ok(out.includes(`"/assets/a$&b$1.js"`) && out.includes(`"/assets/$$.js"`));
});

/* ---------- public/sw.js ---------- */

test("public/sw.js keeps the dev placeholder: a reminders-only worker (push, notificationclick, message)", () => {
  assert.equal(SOURCE.split("\n").filter((l) => l.includes("// @cyra-build")).length, 1);
  assert.ok(SOURCE.includes(`const BUILD = {"version":"dev","base":"/","entry":null,"index":"/index.html","files":[]}; // @cyra-build`));
  const w = load(SOURCE);
  assert.deepEqual(Object.keys(w.listeners).sort(), ["message", "notificationclick", "push"]);
});

test("push and notificationclick are the pre-L1 statements, word for word, and behave as before", async () => {
  assert.ok(MAIN_SW.includes(PUSH_STMT) && MAIN_SW.includes(CLICK_STMT));
  assert.ok(SOURCE.includes(PUSH_STMT), "push statement unchanged");
  assert.ok(SOURCE.includes(CLICK_STMT), "notificationclick statement unchanged");
  for (const src of [SOURCE, injectBuild(SOURCE, BUILD)]) {
    const w = load(src);
    let e = w.fire("push", ext({ data: { json: () => ({ title: "Hi", body: "Check in", tag: "t1" }) } }));
    await e.p;
    assert.deepEqual(plain(w.log.notifications.at(-1)), ["Hi", { body: "Check in", tag: "t1", renotify: false }]);
    e = w.fire("push", ext({ data: null }));
    await e.p;
    assert.deepEqual(plain(w.log.notifications.at(-1)), ["Heard Health", { body: "Time for your 30-second check-in.", tag: "cyra-checkin", renotify: false }]);
    e = w.fire("push", ext({ data: { json: () => { throw new Error("not json"); } } }));
    await e.p;
    assert.deepEqual(plain(w.log.notifications.at(-1)), ["Heard Health", { body: "Time for your 30-second check-in.", tag: "cyra-checkin", renotify: false }]);
    // click: closes, focuses an open window, else opens /
    let closed = 0;
    w.self.clients.windows = [{ url: "x" }, { focus: () => { w.log.focused++; } }];
    e = w.fire("notificationclick", ext({ notification: { close: () => { closed++; } } }));
    await e.p;
    assert.equal(closed, 1); assert.equal(w.log.focused, 1); assert.deepEqual(w.log.opened, []);
    assert.deepEqual(plain(w.log.matchAll), { type: "window", includeUncontrolled: true });
    w.self.clients.windows = [];
    e = w.fire("notificationclick", ext({ notification: { close: () => { closed++; } } }));
    await e.p;
    assert.equal(closed, 2); assert.deepEqual(w.log.opened, ["/"]);
  }
});

test("with a BUILD: install precaches exactly BUILD.files with cache: reload; activate drops only older cyra-shell-* caches", async () => {
  const w = load(injectBuild(SOURCE, BUILD));
  assert.deepEqual(Object.keys(w.listeners).sort(), ["activate", "fetch", "install", "message", "notificationclick", "push"]);
  const e = w.fire("install", ext());
  await e.p;
  const name = `cyra-shell-${BUILD.version}`;
  assert.deepEqual(Object.keys(w.log.added), [name]);
  assert.deepEqual(plain(w.log.added[name].map((r) => r.url)), BUILD.files);
  assert.ok(w.log.added[name].every((r) => r.cache === "reload"));
  await w.caches.open("cyra-shell-old"); await w.caches.open("other-cache");
  const a = w.fire("activate", ext());
  await a.p;
  assert.deepEqual(w.log.deleted, ["cyra-shell-old"]);
  assert.deepEqual((await w.caches.keys()).sort(), [name, "other-cache"].sort());
});

test("fetch: other sites, /api/, non-GET, file navigations and unlisted files pass through untouched", () => {
  const w = load(injectBuild(SOURCE, BUILD));
  for (const [url, opts] of [
    ["https://api.cyra.test/api/ai/ask", {}],
    ["https://api.cyra.test/api/pulse", { mode: "navigate" }],
    ["https://app.test/api/pulse", {}],
    ["https://app.test/api/oauth/apple/start", { mode: "navigate" }],
    ["https://app.test/", { method: "POST", mode: "navigate" }],
    ["https://app.test/assets/index-abc.js", { method: "POST" }],
    ["https://app.test/fonts/OFL-Karla.txt", { mode: "navigate" }],
    ["https://app.test/assets/not-listed.js", {}],
    ["https://other.example/index.html", {}],
  ]) {
    const e = w.fire("fetch", fetchEvent(url, opts));
    assert.equal(e.responded, null, `${opts.method || "GET"} ${url} ${opts.mode || ""}`);
  }
  assert.deepEqual(w.log.fetches, []);
});

test("fetch: app navigations are network-first, with the cached index.html when the network fails or hangs", async () => {
  // network answers: returned, cache untouched
  let w = load(injectBuild(SOURCE, BUILD));
  await w.fire("install", ext()).p;
  const before = JSON.stringify([...w.store.get(`cyra-shell-${BUILD.version}`).keys()]);
  let e = w.fire("fetch", fetchEvent("https://app.test/", { mode: "navigate" }));
  assert.ok(e.responded);
  assert.deepEqual(await e.responded, { network: "https://app.test/" });
  assert.equal(JSON.stringify([...w.store.get(`cyra-shell-${BUILD.version}`).keys()]), before);
  e = w.fire("fetch", fetchEvent("https://app.test/index.html", { mode: "navigate" }));
  assert.deepEqual(await e.responded, { network: "https://app.test/index.html" });
  // network rejects: the cached index.html
  w = load(injectBuild(SOURCE, BUILD), { fetchImpl: () => Promise.reject(new TypeError("offline")) });
  await w.fire("install", ext()).p;
  e = w.fire("fetch", fetchEvent("https://app.test/some/route", { mode: "navigate" }));
  assert.deepEqual(await e.responded, { body: "cached /index.html" });
  // network hangs, the timer fires at once: the cached index.html
  w = load(injectBuild(SOURCE, BUILD), { fetchImpl: () => new Promise(() => {}), setTimeoutImpl: (fn) => { fn(); return 0; } });
  await w.fire("install", ext()).p;
  e = w.fire("fetch", fetchEvent("https://app.test/", { mode: "navigate" }));
  assert.deepEqual(await e.responded, { body: "cached /index.html" });
  // nothing cached and no network: an error response
  w = load(injectBuild(SOURCE, BUILD), { fetchImpl: () => Promise.reject(new TypeError("offline")) });
  e = w.fire("fetch", fetchEvent("https://app.test/", { mode: "navigate" }));
  assert.equal(await e.responded, w.ERROR);
});

test("fetch: listed files are cache-first; a cache miss goes to the network and isn't stored", async () => {
  const w = load(injectBuild(SOURCE, BUILD));
  await w.fire("install", ext()).p;
  let e = w.fire("fetch", fetchEvent("https://app.test/assets/index-abc.js"));
  assert.deepEqual(await e.responded, { body: "cached /assets/index-abc.js" });
  assert.deepEqual(w.log.fetches, []);
  w.store.get(`cyra-shell-${BUILD.version}`).delete("/manifest.webmanifest");
  e = w.fire("fetch", fetchEvent("https://app.test/manifest.webmanifest"));
  assert.deepEqual(await e.responded, { network: "https://app.test/manifest.webmanifest" });
  assert.equal(w.store.get(`cyra-shell-${BUILD.version}`).has("/manifest.webmanifest"), false);
});

test("message: CYRA_BUILD answers on the port, CYRA_SKIP_WAITING calls skipWaiting", () => {
  for (const [src, want] of [[injectBuild(SOURCE, BUILD), { version: BUILD.version, entry: BUILD.entry }], [SOURCE, { version: "dev", entry: null }]]) {
    const w = load(src);
    const got = [];
    w.fire("message", { data: { type: "CYRA_BUILD" }, ports: [{ postMessage: (m) => got.push(m) }] });
    assert.deepEqual(plain(got), [want]);
    w.fire("message", { data: { type: "CYRA_SKIP_WAITING" }, ports: [] });
    assert.equal(w.log.skipWaiting, 1);
    w.fire("message", { data: null, ports: [] });
    w.fire("message", { data: { type: "OTHER" } });
    assert.equal(w.log.skipWaiting, 1);
  }
});

test("source: never writes a cache, opens IndexedDB, claims pages or imports scripts", () => {
  for (const banned of ["indexedDB", ".put(", "clients.claim", "importScripts"]) assert.ok(!SOURCE.includes(banned), banned);
});
