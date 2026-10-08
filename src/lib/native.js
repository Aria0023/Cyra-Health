/* The one door to the phone. Every Capacitor plugin the app uses is reached
   through this file, and every caller checks isNative() first — so in the web
   build nothing here is ever called and no plugin's web fallback is loaded.

   On iOS/Android the native shell injects plugin headers at launch; the
   registerPlugin() proxies below route each call to native code. "CyraHealth"
   is Cyra's own plugin (HealthKit / Health Connect, read on the device) and
   deliberately has no web implementation. */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
export { LocalNotifications } from "@capacitor/local-notifications";
export { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
export { Share } from "@capacitor/share";
export { App, Browser };

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform(); // "ios" | "android" | "web"
export const hasPlugin = (name) => Capacitor.isPluginAvailable(name);

/* Bridge contract (ios/App/App/CyraHealthPlugin.swift and the Android plugin):
     available()            → { available: boolean }
     requestAuthorization() → { granted: boolean }
     readDaily({ from, to }) "YYYY-MM-DD" → { days: [{ date, temp, rhr, hrv, sleep }] } */
export const CyraHealth = registerPlugin("CyraHealth");

/* Sign-in and connect flows on the phone run outside the web view and come back
   through the app's own link: cyrahealth://auth/<oauth|oura|terra>?a=<attempt>#…
   iOS: CyraAuth (ASWebAuthenticationSession, ios/App/App/CyraAuthPlugin.swift) hands
   the link only to the window that asked for it, even if another app claims the
   scheme. Android (and iOS without CyraAuth): the system browser (Browser plugin) and
   App's appUrlOpen event. */
export const APP_SCHEME = "cyrahealth";
const CyraAuth = registerPlugin("CyraAuth");

const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** A return link for one attempt at `flow`. The random attempt id makes every attempt's
    link different, so a stale link (an earlier attempt that timed out, a late "Open in
    Cyra?" tap, a link Capacitor kept from before anyone listened, or one planted by
    another app or a web page) can never be taken as this attempt's answer. */
export const appReturnUrl = (flow) => `${APP_SCHEME}://auth/${flow}?a=${b64u(crypto.getRandomValues(new Uint8Array(16)))}`;

/** A fresh one-time verifier and its challenge, base64url(SHA-256(verifier)).
    Another app could register the same link scheme and see the code that comes
    back; the backend only redeems that code together with this verifier, which
    never leaves this app's memory except in that one exchange request. */
export async function newAppVerifier() {
  const verifier = b64u(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64u(new Uint8Array(digest)) };
}

/** The fragment of `link` as URLSearchParams when `link` is exactly `returnUrl#…`, else null. */
function matchLink(link, returnUrl) {
  const text = String(link || ""), hash = text.indexOf("#");
  if ((hash < 0 ? text : text.slice(0, hash)) !== returnUrl) return null;
  return new URLSearchParams(hash < 0 ? "" : text.slice(hash + 1));
}

/** Open `url` and wait for this attempt's link `returnUrl` (from appReturnUrl) to come
    back; resolves with its fragment as URLSearchParams. Rejects with a plain-language
    error on timeout, when the person closes the window without finishing, or when the
    window can't be opened. */
export function waitForAppUrl(returnUrl, url, timeoutMs = 5 * 60_000) {
  const useAuthSession = Capacitor.getPlatform() === "ios" && hasPlugin("CyraAuth") && /^https:\/\//i.test(url);
  return useAuthSession ? viaAuthSession(returnUrl, url, timeoutMs) : viaBrowser(returnUrl, url, timeoutMs);
}

function viaAuthSession(returnUrl, url, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err, value) => { if (settled) return; settled = true; clearTimeout(timer); if (err) reject(err); else resolve(value); };
    const timer = setTimeout(() => { CyraAuth.cancel().catch(() => { /* already closed */ }); finish(new Error("The connection window timed out")); }, timeoutMs);
    // ephemeral: the window shares no cookies or browsing data with Safari.
    CyraAuth.open({ url, ephemeral: true }).then(
      (out) => { const back = matchLink(out?.url, returnUrl); finish(back ? null : new Error("The connection didn't complete"), back); },
      (e) => finish(new Error(e?.code === "CANCELED" ? "The connection window was closed" : "Couldn't open the sign-in window on this phone")),
    );
  });
}

function viaBrowser(returnUrl, url, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false, closedTimer = null;
    const subs = [];
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer); clearTimeout(closedTimer);
      for (const s of subs) s.then((h) => h.remove()).catch(() => { /* already gone */ });
      // iOS keeps the in-app Safari sheet open after the link fires, so close it. On
      // Android the link brings the app's singleTask activity forward, which already
      // clears the Custom Tab; closing again there can race the browser's own teardown.
      if (Capacitor.getPlatform() === "ios") Browser.close().catch(() => { /* already closed */ });
      if (err) reject(err); else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error("The connection window timed out")), timeoutMs);
    // Capacitor keeps an appUrlOpen that arrived while nobody listened and replays it to
    // the next listener; matchLink drops it unless it carries this attempt's id.
    subs.push(App.addListener("appUrlOpen", (event) => {
      const back = matchLink(event?.url, returnUrl);
      if (back) finish(null, back);
    }));
    // "Done" / back without finishing. On Android this can also fire just before the
    // link arrives, so give the link a moment to win.
    subs.push(Browser.addListener("browserFinished", () => {
      clearTimeout(closedTimer);
      closedTimer = setTimeout(() => finish(new Error("The connection window was closed")), 2500);
    }));
    Promise.all(subs)
      .then(() => (settled ? undefined : Browser.open({ url })))
      .catch(() => finish(new Error("Couldn't open the browser on this phone")));
  });
}
