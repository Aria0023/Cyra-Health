/* The partner portal's launch tools (docs/plans/launch-tools.md), OWNER ONLY: Readiness (what is set up on this server,
   by variable NAME only: a secret's value is never sent to this page), AI costs (an estimate from token totals) and
   Feedback (what people sent from the app). Built with the DOM helpers portal.js hands over (textContent only, never
   innerHTML). Talks only to this origin's /api/insights and /api/feedback. */

const STATUS_LABEL = { ready: "Ready", "not-set-up": "Not set up", problem: "Problem" };

export function launchViews(L) {
  const { h, api, show, msgBox, tell, fmtTime } = L;
  const statusBadge = (s) => h("span", { class: `badge st-${s}` }, STATUS_LABEL[s] || s);

  /* ----- Readiness ----- */
  function readinessRow(r) {
    const missing = r.vars.filter((v) => !v.set);
    return h("li", { class: "panel ready-row", "data-row": r.id, "data-status": r.status },
      h("div", { class: "ready-head" }, h("h3", {}, r.label, " ", h("span", { class: "ready-need" }, r.required ? "Required" : "Optional")), statusBadge(r.status)),
      h("p", {}, r.what),
      r.detail ? h("p", { class: r.status === "problem" ? "err" : "note" }, r.detail) : null,
      r.status !== "ready" && r.vars.length ? h("div", {},
        h("p", { class: "note" }, missing.length ? "Set in Render → cyra-backend → Environment, then redeploy:" : "Check in Render → cyra-backend → Environment:"),
        h("ul", { class: "envlist" }, r.vars.map((v) => h("li", {}, h("code", {}, v.name), v.set ? " (set)" : " (not set)")))) : null,
      r.status === "ready" && r.vars.length ? h("p", { class: "note" }, "Set: ", r.vars.map((v, i) => [i ? ", " : "", h("code", {}, v.name)])) : null);
  }
  async function renderReadiness(note = null) {
    const r = await api("GET", "/api/insights/readiness");
    const box = msgBox();
    const fail = (err) => tell(box, err.message, "err");
    const mailBtn = h("button", { type: "button", class: "btn" }, "Send me a test email");
    mailBtn.addEventListener("click", async () => {
      mailBtn.disabled = true;
      try {
        const x = await api("POST", "/api/insights/readiness/test-email", {});
        tell(box, x.dev ? "Development server: email isn't set up here, so nothing was sent." : "A test email is on its way to the address you signed in with. If it doesn't arrive in a few minutes, check the sender domain in Resend.");
      } catch (err) { fail(err); }
      mailBtn.disabled = false;
    });
    const diskOut = h("p", { class: "note", id: "ready-disk-out" });
    const diskBtn = h("button", { type: "button", class: "btn" }, "Check storage");
    diskBtn.addEventListener("click", async () => {
      diskBtn.disabled = true;
      try {
        const x = await api("POST", "/api/insights/readiness/storage-check", {});
        const line = x.ok ? `Storage works: a test file was written, read back and deleted (${fmtTime(x.at)}).` : `Storage check failed: ${x.error || "unknown"}.`;
        diskOut.textContent = `${line} ${x.before === true ? "Data from before this server start is still there." : x.dirSet ? "Nothing from before this server start was found yet." : "DATA_DIR isn't set, so this is the server's own folder."}`;
        tell(box, line, x.ok ? "ok" : "err");
      } catch (err) { fail(err); }
      diskBtn.disabled = false;
    });
    const req = r.rows.filter((x) => x.required), opt = r.rows.filter((x) => !x.required);
    show("Readiness",
      h("p", { class: "lead" }, "What this server needs before launch, and what is set up. Only variable names are shown: a secret's value never leaves the server."),
      box,
      h("p", { class: `panel ready-sum${r.summary.needed.length ? "" : " ok"}`, "data-ready": `${r.summary.ready}/${r.summary.total}` }, h("b", {}, r.summary.line)),
      h("p", { class: "note" }, `${r.production ? "Production server" : "Development server"}, started ${fmtTime(r.startedAt)}. These are presence and shape checks: opening this page calls no other service. The two buttons below are the only live checks.`),
      h("div", { class: "acts" }, mailBtn, diskBtn),
      diskOut,
      h("h2", {}, "Required for launch"),
      h("ul", { class: "ready-list", "aria-label": "Required for launch" }, req.map(readinessRow)),
      h("h2", {}, "Optional"),
      h("ul", { class: "ready-list", "aria-label": "Optional" }, opt.map(readinessRow)),
      h("h2", {}, "Modules mounted"),
      h("p", { "data-modules": "" }, r.modules.mounted.join(", ")),
      h("p", { class: "note" }, `A production server mounts: ${r.modules.production.join(", ")}.`),
      h("h2", {}, "On the app's side"),
      h("p", {}, "The app is a separate static site, and this server can't see its settings. These are set on the static site in Render (cyra-health → Environment) and take effect at the next build. All are public build settings, never secrets."),
      h("p", { class: "panel", "data-app-seen": r.app.lastSeenAt || "" }, !r.app.tracked ? "This server doesn't note app requests."
        : r.app.lastSeenAt ? `Last request from an app origin: ${fmtTime(r.app.lastSeenAt)}. The app is reaching this server.`
          : "No request from an app origin since this server started. If the app is live, check that its VITE_API_BASE is this server's address and that CORS_ORIGIN here lists the app's address.",
      h("br", {}), h("span", { class: "note" }, "Only the time is kept, in memory: no address, and it is forgotten on a restart.")),
      L.table("The app's build settings", ["Variable", "Needed", "What it does"], r.app.vars.map((v) => h("tr", {}, h("th", { scope: "row" }, h("code", {}, v.name)), L.td(v.required ? "Required" : "Optional"), L.td(v.line)))));
    if (note) tell(document.querySelector(".msgbox"), note);
  }

  return { renderReadiness };
}
