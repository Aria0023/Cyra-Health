/* On-device persistence. NOT localStorage: the web build uses IndexedDB, the
   phone build uses the app's sandboxed Filesystem (Capacitor "Filesystem"
   plugin, Directory.Data — protected by the OS's app sandbox and, on iOS, Data
   Protection). One document holds the whole health record. Nothing here talks
   to a network. */
const DB = "cyra", STORE = "state", KEY = "v1", FILE = "cyra-state.json";

const native = () => (typeof window !== "undefined" && window.Capacitor?.Plugins?.Filesystem) || null;

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
  driver: () => (native() ? "app-sandbox" : typeof indexedDB !== "undefined" ? "indexeddb" : "memory"),
  async load() {
    const fs = native();
    if (fs) { try { const { data } = await fs.readFile({ path: FILE, directory: "DATA", encoding: "utf8" }); return JSON.parse(data); } catch { return null; } }
    try { const db = await idb(); const v = await tx(db, "readonly", (s) => s.get(KEY)); db.close(); return v ?? null; } catch { return null; }
  },
  async save(state) {
    const fs = native();
    if (fs) return fs.writeFile({ path: FILE, directory: "DATA", encoding: "utf8", data: JSON.stringify(state), recursive: true });
    const db = await idb(); await tx(db, "readwrite", (s) => s.put(state, KEY)); db.close();
  },
  async clear() {
    const fs = native();
    if (fs) { try { await fs.deleteFile({ path: FILE, directory: "DATA" }); } catch { /* already gone */ } return; }
    try { const db = await idb(); await tx(db, "readwrite", (s) => s.clear()); db.close(); } catch { /* nothing stored */ }
  },
};
