/* Solia Health website, the one script on "/" (docs/plans/website.md Task 1). It sends someone who already uses the
   web app straight to it at /app/, and does nothing else: no request, no cookie, nothing stored.
   She goes to the app (keeping the query and the hash) when
     - the page runs as an installed app (its own window from the home screen or app list), or
     - the address carries an app link: a hash route (#/…), a sign-in return (#oauth=…) or an organization link (?org=…), or
     - this browser already holds a Solia Health record (IndexedDB "cyra", store "state", key "v1"; read here, never
       created or changed).
   ?site=1 always shows the website. While the record is being looked up the page stays hidden (html[data-wait], at
   most 700 ms), so a returning user never sees the website flash before the app. Loaded from <head> without defer. */
(function () {
  var loc = window.location, query = loc.search || "", hash = loc.hash || "", root = document.documentElement;
  if (/[?&]site=1(&|$)/.test(query)) return;
  var toApp = function () { loc.replace("/app/" + query + hash); };
  var standalone = false;
  try { standalone = window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || window.navigator.standalone === true; } catch (e) { standalone = false; }
  if (standalone || /^#(\/|oauth=)/.test(hash) || /[?&]org=/.test(query)) { toApp(); return; }
  var done = false;
  var show = function () { if (done) return; done = true; root.removeAttribute("data-wait"); };
  var found = function () { if (done) return; done = true; toApp(); };
  try {
    if (!window.indexedDB) return;
    root.setAttribute("data-wait", "");
    window.setTimeout(show, 700);
    var open = window.indexedDB.open("cyra");
    // No database yet: stop the open so this page never creates one.
    open.onupgradeneeded = function () { try { open.transaction.abort(); } catch (e) { /* aborting */ } };
    open.onerror = function (e) { if (e && e.preventDefault) e.preventDefault(); show(); };
    open.onblocked = show;
    open.onsuccess = function () {
      var db = open.result;
      try {
        if (!db.objectStoreNames.contains("state")) { db.close(); show(); return; }
        var get = db.transaction("state", "readonly").objectStore("state").get("v1");
        get.onsuccess = function () { var has = get.result != null; db.close(); if (has) found(); else show(); };
        get.onerror = function () { db.close(); show(); };
      } catch (e) { try { db.close(); } catch (e2) { /* closed */ } show(); }
    };
  } catch (e) { show(); }
})();
