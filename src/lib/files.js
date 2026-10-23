/* Hands a file she made (the appointment PDF from the Report, or the POTS report PDF or
   spreadsheet) to wherever she chooses (design 6.5, L9). Started only by her own tap; nothing
   here talks to a server.

   - Web: a Blob and a temporary <a download>; the object URL is revoked after 2 s. No copy is
     written to app storage.
   - Phone: the file is written to the app's cache, handed to the share sheet, and deleted in
     `finally`, so it goes on success, cancel and error alike. Unlike the backup, this cached
     file is plaintext for the seconds it exists. iOS Caches and Android cache dirs are excluded
     from device and cloud backup, and the sweep covers interrupted shares (App.jsx
     sweepBackupCache runs at every launch and on Delete everything / Start over, and removes
     leftover cyra-report-*.pdf, cyra-summary-*.pdf and cyra-data-*.csv files). Android's FileProvider already
     covers the cache directory (cache-path "."), so no native change is needed.

   The backup export (App.jsx exportBackup) is deliberately not moved onto this helper in v1,
   so its tested path doesn't change. */
import { isNative, Filesystem, Directory, Encoding, Share } from "./native.js";

/** Base64 of bytes, in chunks (no spread of a large array into one call). */
export function toBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Save or share one file. data: a string (written as UTF-8) or a Uint8Array. title: the
    share sheet's title (neutral, e.g. "Cyra report"). onReady(): called on the phone once the
    file is ready and the share sheet is about to open.
    -> "shared" | "downloaded" | "cancelled"; throws an Error with a message she can read. */
export async function saveFile({ name, data, mime, title, onReady }) {
  if (isNative()) {
    const bin = typeof data !== "string";
    let uri;
    try {
      ({ uri } = await Filesystem.writeFile(bin
        ? { path: name, directory: Directory.Cache, data: toBase64(data) }
        : { path: name, directory: Directory.Cache, data, encoding: Encoding.UTF8 }));
    } catch { throw new Error("Couldn't prepare the file on this phone"); }
    try {
      onReady?.();
      await Share.share({ title, files: [uri] });
      return "shared";
    } catch (e) {
      const m = String(e?.message || e);
      if (/cancel/i.test(m)) return "cancelled";
      if (/must provide|in progress/i.test(m)) throw new Error("Couldn't open the share sheet on this phone");
      throw new Error("Sharing didn't finish. Check whether the file arrived");
    } finally {
      await Filesystem.deleteFile({ path: name, directory: Directory.Cache }).catch(() => { /* already gone */ });
    }
  }
  const blob = new Blob([data], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return "downloaded";
}
