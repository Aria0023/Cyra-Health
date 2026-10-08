/* Cyra service worker: shows reminder pushes and opens the app on tap.
   The payload is a generic reminder — never health content. */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  event.waitUntil(self.registration.showNotification(data.title || "Cyra", { body: data.body || "Time for your 30-second check-in.", tag: data.tag || "cyra-checkin", renotify: false }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => { const w = list.find((c) => "focus" in c); return w ? w.focus() : self.clients.openWindow("/"); }));
});
