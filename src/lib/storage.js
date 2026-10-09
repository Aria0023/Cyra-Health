/* On-device persistence. NOT localStorage: the web build uses IndexedDB, the
   phone build uses the app's own sandbox through the Capacitor Filesystem plugin:
   Directory.Library + "NoCloud/cyra-state.json". On iOS the app creates
   Library/NoCloud at launch, excludes it from iCloud/device backup and gives it
   complete file protection; on Android Library is the app's internal files
   directory and app backup is switched off. One document holds the whole health
   record. Nothing here talks to a network.

   The phone save is atomic: the record is written to cyra-state.json.tmp and then
   renamed over cyra-state.json, so a crash mid-write never leaves half a record.
   The web driver is probed (open + write + read back) before the UI names it (the
   app shows no storage sentence until then). A failed save reports "stale" when any
   copy of the record may still be on this device — the last saved one, or the temp
   file of an interrupted save, which is removed when it isn't the only copy and kept
   (and counted) when it is — and "memory" only when none can be. On the web, a record
   that exists but couldn't be read reports "unreadable" (never "memory"), so the
   privacy copy in Settings → Your data never says less is stored than really is.

   The hold: one tiny value outside the record — the ISO week in which this device last
   sent weekly counts (no stage, no flags, no dates or values; it shows only that this
   device shared counts that week). Each send writes it, and Delete everything and Start
   over leave it, so a fresh record made on this device that week sends no counts again
   (lib/pulse.js: each flag at most once a week from this browser or app install). Web:
   its own IndexedDB database "cyra-hold"; phone: NoCloud/cyra-hold.json. It is deleted
   at the first start after that week ends (and by Delete everything, if stale). */
import { isNative, Filesystem, Directory, Encoding } from "./native.js";

const DB = "cyra", STORE = "state", KEY = "v1", PROBE_KEY = "probe";
/* @capacitor/filesystem 8.1.4 rejects a read of a missing file with this code on both
   platforms (ios FilesystemError.fileNotFound = 8; android FilesystemErrors.doesNotExist
   = formatErrorCode(8)). Every other failure is "can't read it right now". */
const NOT_FOUND = "OS-PLUG-FILE-0008";
/* iOS: the file exists but is protected (Complete protection while the phone is locked)
   — the plugin reports a permission failure for it. */
const NO_PERMISSION = "OS-PLUG-FILE-0013";
export class StorageUnavailableError extends Error {
  constructor(code) { super("Your saved record couldn't be opened"); this.name = "StorageUnavailableError"; this.code = code || null; this.locked = code === NO_PERMISSION; }
}
const FILE = { path: "NoCloud/cyra-state.json", directory: Directory.Library };
const TMP = { path: "NoCloud/cyra-state.json.tmp", directory: Directory.Library };
const HOLD = { path: "NoCloud/cyra-hold.json", directory: Directory.Library };
const HOLD_DB = "cyra-hold";

function idb(name = DB) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
/* Open a database only if it already exists (reading the hold must never create one). */
function idbIfExists(name) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(name);
    req.onupgradeneeded = () => { try { req.transaction.abort(); } catch { /* aborting */ } };
    req.onsuccess = () => { const db = req.result; if (db.objectStoreNames.contains(STORE)) resolve(db); else { db.close(); reject(new Error("no hold")); } };
    req.onerror = () => reject(req.error || new Error("no hold"));
  });
}
const tx = (db, mode, fn) => new Promise((resolve, reject) => { const t = db.transaction(STORE, mode); const r = fn(t.objectStore(STORE)); t.oncomplete = () => resolve(r?.result); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); });

let probed = null;     // web: null = not probed yet, true = a write+read round trip worked, false = it didn't
let saveFailed = false; // any failed save: what's on screen is no longer being kept
let persistAsked = false;
let hasRecord = false;  // a record (or a copy of it) may be stored on this device (loaded, saved, or left by a failed save)
let loadFailed = false; // web: a record may exist but couldn't be read

async function probeIdb() {
  try {
    const db = await idb();
    const token = Math.random().toString(36).slice(2);
    await tx(db, "readwrite", (s) => s.put(token, PROBE_KEY));
    const back = await tx(db, "readonly", (s) => s.get(PROBE_KEY));
    await tx(db, "readwrite", (s) => s.delete(PROBE_KEY));
    db.close();
    return back === token;
  } catch { return false; }
}

const readNative = async (f) => (await Filesystem.readFile({ ...f, encoding: Encoding.UTF8 })).data;
/* Saves and deletes run one at a time, in order: two saves never interleave their
   write + rename, and a delete waits for a save already under way (so that save can't
   bring the record back after it). */
let queue = Promise.resolve();
const inOrder = (fn) => { const run = queue.then(fn); queue = run.catch(() => {}); return run; };

export const storage = {
  /** Which driver is really in use — surfaced in the UI so the privacy copy stays literally true. */
  driver: () => {
    if (!isNative() && loadFailed && !hasRecord) return "unreadable";
    if (saveFailed) return hasRecord ? "stale" : "memory";
    if (isNative()) return "app-sandbox";
    return typeof indexedDB !== "undefined" && (hasRecord || probed !== false) ? "indexeddb" : "memory";
  },
  /** Web: test IndexedDB once (open + write + read back). Resolves the driver. */
  async probe() {
    if (!isNative() && probed === null) probed = await probeIdb();
    return storage.driver();
  },
  /** The saved record, or null when there is none. On the phone, a file that exists
      but can't be read (iOS keeps it locked while the device is locked; a damaged
      file) throws StorageUnavailableError, never null — so the app never mistakes it
      for "no record" and saves a fresh one over it. */
  async load() {
    if (isNative()) {
      let data;
      try { data = await readNative(FILE); }
      catch (e) {
        if (e?.code !== NOT_FOUND) throw new StorageUnavailableError(e?.code);
        // No record — unless a save was interrupted between writing the temp file and the rename.
        try { data = await readNative(TMP); } catch (e2) { if (e2?.code === NOT_FOUND) return null; throw new StorageUnavailableError(e2?.code); }
      }
      let parsed;
      try { parsed = JSON.parse(data); } catch { throw new StorageUnavailableError("parse"); }
      if (parsed != null) hasRecord = true;
      return parsed;
    }
    try { const db = await idb(); const v = await tx(db, "readonly", (s) => s.get(KEY)); db.close(); loadFailed = false; if (v != null) hasRecord = true; return v ?? null; }
    catch { loadFailed = true; return null; } // reported as "unreadable" until a save works
  },
  /** Save the whole record (phone: temp file + rename; web: one IndexedDB put). */
  save(state) { return inOrder(() => saveNow(state)); },
  /** Delete the record. Phone: anything but "it wasn't there" is an error the caller must show. */
  clear() { return inOrder(clearNow); },
  /** The week-only hold Delete everything leaves (see the header). Never throws. */
  async getHold() {
    try {
      if (isNative()) return JSON.parse((await Filesystem.readFile({ ...HOLD, encoding: Encoding.UTF8 })).data)?.week || null;
      const db = await idbIfExists(HOLD_DB); const v = await tx(db, "readonly", (s) => s.get(KEY)); db.close(); return v?.week || null;
    } catch { return null; }
  },
  /** Remove the hold (a refused send counted nothing). Never throws. */
  async clearHold() {
    try {
      if (isNative()) await Filesystem.deleteFile(HOLD);
      else await new Promise((resolve) => { try { const q = indexedDB.deleteDatabase(HOLD_DB); q.onsuccess = q.onerror = q.onblocked = () => resolve(); } catch { resolve(); } setTimeout(resolve, 2000); });
    } catch { /* not there */ }
  },
  /** Remove a hold whose week is over. Never throws. */
  async dropStaleHold(week) { const h = await storage.getHold(); if (h && h !== week) await storage.clearHold(); },
  async setHold(week) {
    try {
      if (isNative()) await Filesystem.writeFile({ ...HOLD, encoding: Encoding.UTF8, data: JSON.stringify({ week }), recursive: true });
      else { const db = await idb(HOLD_DB); await tx(db, "readwrite", (s) => s.put({ week }, KEY)); db.close(); }
    } catch { /* best effort */ }
  },
  /** Web: drop the whole database (after clear()). Resolves even when another tab holds it open. */
  dropDatabase() {
    if (isNative() || typeof indexedDB === "undefined") return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => resolve();
      try { const q = indexedDB.deleteDatabase(DB); q.onsuccess = q.onerror = q.onblocked = done; } catch { done(); }
      setTimeout(done, 2000);
    });
  },
};

async function saveNow(state) {
  try {
    if (isNative()) {
      await Filesystem.writeFile({ ...TMP, encoding: Encoding.UTF8, data: JSON.stringify(state), recursive: true });
      try { await Filesystem.rename({ from: TMP.path, to: FILE.path, directory: Directory.Library, toDirectory: Directory.Library }); }
      catch (e) {
        if (e?.code === NOT_FOUND) throw e; // the temp file is gone (deleted meanwhile): never touch the record
        // Some platforms refuse to rename over an existing file: remove it and rename again.
        // If the app dies in between, load() still finds the complete record in the temp file.
        await Filesystem.deleteFile(FILE).catch(() => { /* not there */ });
        await Filesystem.rename({ from: TMP.path, to: FILE.path, directory: Directory.Library, toDirectory: Directory.Library });
      }
    } else {
      const db = await idb(); await tx(db, "readwrite", (s) => s.put(state, KEY)); db.close();
      if (!persistAsked) { persistAsked = true; navigator.storage?.persist?.().catch(() => { /* best effort */ }); }
    }
    saveFailed = false;
    hasRecord = true; loadFailed = false;
  } catch (e) {
    saveFailed = true;
    if (isNative()) await tidyAfterFailedSave();
    throw e;
  }
}

/* Phone, after a failed save: the temp file may hold some or all of the newer record. When
   the saved record is still there (or none was ever stored), remove the temp file; when it
   can't be removed, or is the only copy (the record was replaced mid-rename), keep it and
   count it as stored, so Settings never says nothing is saved while a copy is on disk. */
async function tidyAfterFailedSave() {
  let fileThere = false;
  try { await Filesystem.stat(FILE); fileThere = true; } catch { /* missing or unreadable */ }
  if (fileThere || !hasRecord) {
    try { await Filesystem.deleteFile(TMP); return; } catch (e) { if (e?.code === NOT_FOUND) return; }
  }
  hasRecord = true;
}

/* Delete the record and confirm it is gone (web: read back after clearing; phone: both
   files deleted, each tried even when the other fails). Any failure reaches the caller,
   which says the record couldn't be deleted (or, phone, that only a leftover copy is left,
   err.partial) and shows which earlier steps — reminders off, wearables disconnected —
   already happened. */
async function clearNow() {
  if (isNative()) {
    const errs = [];
    for (const f of [FILE, TMP]) {
      try { await Filesystem.deleteFile(f); } catch (e) { if (e?.code !== NOT_FOUND) errs.push([f, e]); }
    }
    if (errs.length) throw Object.assign(errs[0][1] instanceof Error ? errs[0][1] : new Error("delete failed"), { partial: !errs.some(([f]) => f === FILE) });
    hasRecord = false; saveFailed = false; loadFailed = false;
    return;
  }
  if (typeof indexedDB === "undefined") return; // this browser can't store anything, so there is nothing to delete
  const db = await idb();
  try {
    await tx(db, "readwrite", (s) => s.clear());
    let left;
    try { left = await tx(db, "readonly", (s) => s.get(KEY)); }
    catch { left = await tx(db, "readonly", (s) => s.get(KEY)); } // the read-back itself failed: check once more
    if (left !== undefined) throw new Error("the record is still there");
  } finally { db.close(); }
  hasRecord = false; saveFailed = false; loadFailed = false;
}
