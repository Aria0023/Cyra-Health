/* Clipboard hand-off with a toast. The text goes to the device's clipboard through
   navigator.clipboard.writeText and nowhere else; Cyra never reads the clipboard back.
   Resolves true when the copy landed (so a button can show "Copied"), false when the
   browser refused it, in which case the blocked sentence is toasted instead. */
export const COPY_BLOCKED = "Copy blocked — select the text and copy it yourself";

export function copyText(text, okMsg, ping, blockedMsg = COPY_BLOCKED) {
  const blocked = () => { ping(blockedMsg); return false; };
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return Promise.resolve(blocked());
  return navigator.clipboard.writeText(text).then(() => { ping(okMsg); return true; }, blocked);
}
