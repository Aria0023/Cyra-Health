/* The website and the web app's address (docs/plans/website.md). Run with `npm run test:unit`.
   Task 1: the hosting rules the local server follows are the ones render.yaml gives Render; the retiring worker at
   /sw.js only deletes the old shell, unregisters and reloads; the one script on "/" asks nothing of a network and
   stores nothing; the phone build is not the web build. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { APP_BASE, REWRITES, NO_CACHE, fileFor, rewriteFor } from "../../site/build/hosting.mjs";
import { nativeDistProblems } from "../../site/build/native-check.mjs";
import { sitePages } from "../../site/build/site.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/* ---------- hosting ---------- */

test("render.yaml gives Render the rules the local server follows", () => {
  const yaml = read("render.yaml");
  const site = yaml.slice(yaml.indexOf("name: cyra-health"), yaml.indexOf("name: cyra-backend"));
  assert.match(site, /buildCommand: npm install && npm run build\n/);
  assert.match(site, /staticPublishPath: \.\/dist\n/);
  const routes = [...site.matchAll(/- type: rewrite\n\s+source: (\S+)\n\s+destination: (\S+)/g)].map(([, source, destination]) => ({ source, destination }));
  assert.deepEqual(routes, REWRITES.map((r) => ({ ...r })));
  assert.ok(!routes.some((r) => r.source === "/*"), "no catch-all rewrite: an unknown address is a 404");
  const headers = [...site.matchAll(/- path: (\S+)\n\s+name: Cache-Control\n\s+value: no-cache/g)].map((m) => m[1]);
  assert.deepEqual(headers.sort(), [...NO_CACHE].sort());
  for (const p of ["/index.html", "/sw.js", `${APP_BASE}index.html`, `${APP_BASE}sw.js`, `${APP_BASE}manifest.webmanifest`]) assert.ok(NO_CACHE.includes(p), `${p} is revalidated`);
});

test("fileFor and rewriteFor: files first, /app/* to the app, nothing climbs out", () => {
  assert.equal(fileFor("/"), "index.html");
  assert.equal(fileFor("/app/"), "app/index.html");
  assert.equal(fileFor("/legal/privacy.html"), "legal/privacy.html");
  assert.equal(fileFor("/support/"), "support/index.html");
  assert.equal(fileFor("/a%20b.txt"), "a b.txt");
  for (const bad of ["/../x", "/a/../../x", "/%2e%2e/x", "/a\0b", "x", "/%zz"]) assert.equal(fileFor(bad), null, bad);
  assert.equal(rewriteFor("/app/anything/here"), "/app/index.html");
  assert.equal(rewriteFor("/app/"), "/app/index.html");
  for (const p of ["/", "/nope", "/legal/nope.html", "/application", "/apps/x"]) assert.equal(rewriteFor(p), null, p);
});

test("the web build and the phone build are different commands, and Capacitor refuses the web build", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts.build, "node scripts/build-web.mjs");
  assert.equal(pkg.scripts["build:native"], "vite build");
  assert.equal(pkg.scripts["cap:sync"], "npm run build:native && cap sync");
  assert.equal(pkg.scripts["capacitor:copy:before"], "node site/build/native-check.mjs");
  assert.equal(JSON.parse(read("capacitor.config.json")).webDir, "dist");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "solia-native-"));
  try {
    assert.equal(nativeDistProblems(tmp).length, 1, "an empty folder is refused");
    fs.writeFileSync(path.join(tmp, "index.html"), '<!doctype html><body><div id="root"></div></body>');
    fs.mkdirSync(path.join(tmp, "legal")); fs.writeFileSync(path.join(tmp, "sw.js"), "");
    assert.deepEqual(nativeDistProblems(tmp), [], "the app at the root, with its legal pages and worker file: the phone build");
    fs.mkdirSync(path.join(tmp, "app")); fs.writeFileSync(path.join(tmp, "app", "index.html"), "");
    fs.writeFileSync(path.join(tmp, "go.js"), "");
    assert.deepEqual(nativeDistProblems(tmp), ["app/index.html belongs to the website", "go.js belongs to the website"]);
    fs.writeFileSync(path.join(tmp, "index.html"), "<!doctype html><body><main></main></body>");
    assert.ok(nativeDistProblems(tmp).includes("index.html is not the app's page"));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

/* ---------- the retiring worker (/sw.js) ---------- */

function loadRetiring() {
  const listeners = {};
  const log = { deleted: [], unregistered: 0, navigated: [], skipWaiting: 0, order: [] };
  const store = new Map([
    ["cyra-shell-old1", new Set(["/index.html", "/assets/index-old.js"])],
    ["cyra-shell-new1", new Set(["/app/index.html", "/app/assets/index-new.js"])],
    ["someone-elses", new Set(["/index.html"])],
  ]);
  const self = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => { log.skipWaiting++; },
    registration: { unregister: async () => { log.unregistered++; log.order.push("unregister"); return true; } },
    clients: { matchAll: async (o) => { log.matchAll = o; return [{ url: "https://x.test/", navigate: async (u) => { log.navigated.push(u); log.order.push("navigate"); } }, { url: "https://x.test/app/", navigate: async () => { throw new Error("not controlled"); } }]; } },
  };
  const caches = {
    keys: async () => [...store.keys()],
    open: async (name) => ({ match: async (p) => (store.get(name)?.has(p) ? {} : undefined) }),
    delete: async (name) => { log.deleted.push(name); log.order.push("delete"); return store.delete(name); },
  };
  vm.runInNewContext(read("site/static/sw.js"), { self, caches });
  return { listeners, log, store };
}

test("the retiring worker deletes only the old shell's caches, unregisters, then reloads its pages", async () => {
  const w = loadRetiring();
  assert.deepEqual(Object.keys(w.listeners).sort(), ["activate", "install"], "no fetch, push or message handler");
  w.listeners.install({});
  assert.equal(w.log.skipWaiting, 1);
  let done;
  w.listeners.activate({ waitUntil: (p) => { done = p; } });
  await done;
  assert.deepEqual(w.log.deleted, ["cyra-shell-old1"], "the new app's cache and other caches stay");
  assert.equal(w.log.unregistered, 1);
  assert.deepEqual(w.log.navigated, ["https://x.test/"], "each page is reloaded at its own address; one that refuses is skipped");
  assert.deepEqual({ ...w.log.matchAll }, { type: "window" });
  assert.deepEqual(w.log.order, ["delete", "unregister", "navigate"]);
  const src = read("site/static/sw.js");
  assert.ok(!/indexedDB|fetch\(|\.put\(|importScripts|postMessage/.test(src), "it opens no database, fetches nothing and keeps nothing");
});

/* ---------- the script on "/" (go.js) ---------- */

/* A fake window for go.js: the address, display mode and IndexedDB contents are given; replace() and the wait flag are recorded. */
function runGo({ search = "", hash = "", standalone = false, iosStandalone = false, db = "none", noIdb = false } = {}) {
  const log = { replaced: null, wait: [], opened: [], aborted: 0, timers: [] };
  const root = { setAttribute: (k) => { log.wait.push(`+${k}`); }, removeAttribute: (k) => { log.wait.push(`-${k}`); } };
  const open = () => {
    const req = { transaction: { abort: () => { log.aborted++; } } };
    queueMicrotask(() => {
      if (db === "none") { req.onupgradeneeded?.(); req.onerror?.({ preventDefault() {} }); return; }
      const stores = db === "empty-db" ? [] : ["state"];
      const value = db === "record" ? { v: 1 } : undefined;
      req.result = {
        objectStoreNames: { contains: (n) => stores.includes(n) },
        close: () => { log.closed = true; },
        transaction: (name, mode) => { log.mode = mode; return { objectStore: () => ({ get: (key) => { log.key = key; const g = {}; queueMicrotask(() => { g.result = value; g.onsuccess?.(); }); return g; } }) }; },
      };
      req.onsuccess?.();
    });
    return req;
  };
  const window = {
    location: { search, hash, replace: (u) => { log.replaced = u; } },
    matchMedia: (q) => ({ matches: standalone && /display-mode: standalone/.test(q) }),
    navigator: { standalone: iosStandalone },
    setTimeout: (fn, ms) => { log.timers.push(ms); return 1; },
    indexedDB: noIdb ? undefined : { open: (name, version) => { log.opened.push([name, version]); return open(); } },
  };
  vm.runInNewContext(read("site/static/go.js"), { window, document: { documentElement: root } });
  return new Promise((resolve) => setTimeout(() => resolve(log), 5));
}

test("go.js: an existing record, an installed app or an app link goes to /app/ with the query and hash kept", async () => {
  assert.equal((await runGo({ db: "record" })).replaced, "/app/");
  assert.equal((await runGo({ db: "record", search: "?x=1", hash: "#pricing" })).replaced, "/app/?x=1#pricing");
  assert.equal((await runGo({ standalone: true })).replaced, "/app/");
  assert.equal((await runGo({ iosStandalone: true })).replaced, "/app/");
  assert.equal((await runGo({ hash: "#/you/privacy" })).replaced, "/app/#/you/privacy");
  assert.equal((await runGo({ hash: "#oauth=abc" })).replaced, "/app/#oauth=abc");
  assert.equal((await runGo({ search: "?org=lakeside" })).replaced, "/app/?org=lakeside");
  assert.equal((await runGo({ search: "?utm=x&org=lakeside", hash: "#/shop" })).replaced, "/app/?utm=x&org=lakeside#/shop");
  // an app link never waits for the database
  assert.deepEqual((await runGo({ hash: "#/you" })).opened, []);
});

test("go.js: a first-time visitor, ?site=1 and a browser without IndexedDB see the website", async () => {
  for (const db of ["none", "empty-db", "no-record"]) {
    const log = await runGo({ db });
    assert.equal(log.replaced, null, db);
    assert.deepEqual(log.wait, ["+data-wait", "-data-wait"], `${db}: hidden only while the record is looked up`);
  }
  assert.equal((await runGo({ db: "none" })).aborted, 1, "looking never creates the database");
  const kept = await runGo({ db: "record", search: "?site=1" });
  assert.equal(kept.replaced, null); assert.deepEqual(kept.opened, []); assert.deepEqual(kept.wait, []);
  assert.equal((await runGo({ db: "record", search: "?a=1&site=1", standalone: true, hash: "#/you" })).replaced, null, "?site=1 wins over everything");
  assert.equal((await runGo({ search: "?website=1", db: "none" })).replaced, null);
  const none = await runGo({ noIdb: true });
  assert.equal(none.replaced, null); assert.deepEqual(none.wait, []);
  const looked = await runGo({ db: "record" });
  assert.deepEqual(looked.opened, [["cyra", undefined]], "opened without a version, so nothing is upgraded");
  assert.equal(looked.key, "v1"); assert.equal(looked.mode, "readonly");
  assert.deepEqual(looked.timers, [700], "the page is shown after 700 ms whatever the database does");
});

test("go.js is the record's real address: the same database, store and key lib/storage.js uses", () => {
  const storage = read("src/lib/storage.js");
  assert.match(storage, /const DB = "cyra", STORE = "state", KEY = "v1"/);
  const go = read("site/static/go.js");
  for (const s of ['indexedDB.open("cyra")', '"state"', '.get("v1")']) assert.ok(go.includes(s), s);
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|document\.cookie|localStorage|sessionStorage|\.put\(|\.add\(|\.delete\(|createObjectStore|import\(/.test(go), "no request, no cookie, nothing stored or changed");
});

/* ---------- pages ---------- */

test("every site page is a complete document with one h1; only the front page loads go.js", () => {
  const pages = sitePages();
  assert.ok(pages.some(([rel]) => rel === "index.html") && pages.some(([rel]) => rel === "404.html"));
  for (const [rel, html] of pages) {
    assert.match(html, /^<!doctype html>\n<html lang="en">/, rel);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/, rel);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${rel}: one h1`);
    assert.equal(html.includes('<script src="/go.js"></script>'), rel === "index.html", `${rel}: go.js`);
    assert.ok(!html.includes("BUILD 2026.10.07-D"), `${rel}: the build stamp stays in the app, once`);
  }
});
