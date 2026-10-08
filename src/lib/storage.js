/* On-device persistence. NOT localStorage: the web build uses IndexedDB, the
   phone build uses the app's own sandbox through the Capacitor Filesystem plugin:
   Directory.Library + "NoCloud/cyra-state.json". On iOS the app creates
   Library/NoCloud at launch, excludes it from iCloud/device backup and gives it
   complete file protection; on Android Library is the app's internal files
   directory and app backup is switched off. One document holds the whole health
   record. Nothing here talks to a network. */
import { isNative, Filesystem, Directory, Encoding } from "./native.js";

const DB = "cyra", STORE = "state", KEY = "v1";
/* @capacitor/filesystem 8.1.4 rejects a read of a missing file with this code on both
   platforms (ios FilesystemError.fileNotFound = 8; android FilesystemErrors.doesNotExist
   = formatErrorCode(8)). Every other failure is "can't read it right now". */
const NOT_FOUND = "OS-PLUG-FILE-0008";
export class StorageUnavailableError extends Error {
  constructor() { super("Your saved record couldn't be opened"); this.name = "StorageUnavailableError"; }
}
const FILE = { path: "NoCloud/cyra-state.json", directory: Directory.Library };

function idb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const tx = (db, mode, fn) => new Promise((resolve, reject) => { const t = db.transaction(STORE, mode); const r = fn(t.objectStore(STORE)); t.oncomplete = () => resolve(r?.result); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); });

export const storage = {
  /** Which driver is in use — surfaced in the UI so the privacy copy stays literally true. */
  driver: () => (isNative() ? "app-sandbox" : typeof indexedDB !== "undefined" ? "indexeddb" : "memory"),
  /** The saved record, or null when there is none. On the phone, a file that exists
      but can't be read (iOS keeps it locked while the device is locked; a damaged
      file) throws StorageUnavailableError, never null — so the app never mistakes it
      for "no record" and saves a fresh one over it. */
  async load() {
    if (isNative()) {
      let data;
      try { ({ data } = await Filesystem.readFile({ ...FILE, encoding: Encoding.UTF8 })); }
      catch (e) { if (e?.code === NOT_FOUND) return null; throw new StorageUnavailableError(); }
      try { return JSON.parse(data); } catch { throw new StorageUnavailableError(); }
    }
    try { const db = await idb(); const v = await tx(db, "readonly", (s) => s.get(KEY)); db.close(); return v ?? null; } catch { return null; }
  },
  async save(state) {
    if (isNative()) { await Filesystem.writeFile({ ...FILE, encoding: Encoding.UTF8, data: JSON.stringify(state), recursive: true }); return; }
    const db = await idb(); await tx(db, "readwrite", (s) => s.put(state, KEY)); db.close();
  },
  async clear() {
    if (isNative()) { try { await Filesystem.deleteFile(FILE); } catch { /* already gone */ } return; }
    try { const db = await idb(); await tx(db, "readwrite", (s) => s.clear()); db.close(); } catch { /* nothing stored */ }
  },
};
