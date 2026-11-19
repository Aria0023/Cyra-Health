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

  /* ----- AI costs (an estimate) ----- */
  const SVG = "http://www.w3.org/2000/svg";
  const svg = (tag, attrs = {}, ...kids) => { const el = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v)); el.append(...kids); return el; };
  const usd = (v) => (v == null ? "–" : `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const num = L.num;
  const BUDGET_WORD = { none: "No budget set", ok: "Within budget", warn: "Past 80% of budget", over: "Budget passed" };
  const budgetLine = (b, est) => (b.level === "none" ? "No monthly budget is set." : `${usd(est)} of ${usd(b.budgetUsd)}: ${b.percent}% of this month's budget.`);
  /** A small column chart of the estimate per day (decorative beside its table, which holds every number). */
  function costChart(label, days) {
    const top = Math.max(0.01, ...days.map((d) => d.usd)), W = 640, H = 150, pad = 22, bw = (W - 8) / Math.max(days.length, 1);
    const best = days.reduce((a, b) => (b.usd > a.usd ? b : a), days[0]), total = days.reduce((n, d) => n + d.usd, 0);
    const g = svg("svg", { class: "bars cols", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${label}: ${usd(total)} in all${total ? `; the most on ${best.day} (${usd(best.usd)})` : ""}` });
    g.append(svg("line", { class: "bars-axis", x1: 4, x2: W - 4, y1: H - pad, y2: H - pad }));
    days.forEach((d, i) => { const bh = Math.round((d.usd / top) * (H - pad - 14)); if (d.usd > 0) g.append(svg("rect", { class: "bars-bar", x: 4 + i * bw + 2, y: H - pad - Math.max(bh, 2), width: Math.max(2, bw - 4), height: Math.max(bh, 2), rx: 2 })); });
    g.append(svg("text", { class: "bars-lab", x: 4, y: H - 5 }, days[0].day), svg("text", { class: "bars-lab", x: W - 4, y: H - 5, "text-anchor": "end" }, days.at(-1).day), svg("text", { class: "bars-val", x: 4, y: 12 }, `Most in a day: ${usd(best.usd)}`));
    return h("figure", { class: "panel chart" }, h("figcaption", { class: "preview-lab" }, label), g);
  }
  const PRICE_LABEL = [["inputPerMTok", "Input, per million tokens"], ["outputPerMTok", "Output, per million tokens"], ["cacheWritePerMTok", "Cache writes, per million tokens"], ["cacheReadPerMTok", "Cache reads, per million tokens"], ["webSearchPer1000", "Web searches, per 1,000"]];
  async function renderAiCosts(note = null) {
    const c = await api("GET", "/api/insights/ai-costs");
    const box = msgBox();
    const fail = (err) => tell(box, err.message, "err");
    const b = c.budget;
    const budgetIn = L.textIn("ai-budget", b.budgetUsd ?? "", { inputmode: "decimal", autocomplete: "off", "aria-describedby": "ai-budget-help" });
    const budgetForm = h("form", { class: "panel narrow", novalidate: true },
      h("h2", {}, "Monthly budget"),
      h("p", { "data-budget": b.level }, h("span", { class: `badge st-${b.level === "ok" ? "ready" : b.level === "none" ? "not-set-up" : "problem"}` }, BUDGET_WORD[b.level]), " ", budgetLine(b, c.estimateUsd)),
      L.field("ai-budget", "Budget in US dollars per month", budgetIn, "One email goes to the weekly report's addresses when the estimate first passes 80% of this in a month, and one more at 100%. Leave empty and save for no budget."),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Save budget")),
      h("p", { class: "note" }, c.noShutoffLine),
      b.alerts.p80 || b.alerts.p100 ? h("p", { class: "note", "data-alerts": "" }, `Alerts sent this month: ${[b.alerts.p80 && `80% on ${fmtTime(b.alerts.p80)}`, b.alerts.p100 && `100% on ${fmtTime(b.alerts.p100)}`].filter(Boolean).join("; ")}.`) : null,
      c.email === "not set up" ? h("p", { class: "err", role: "alert" }, "Email isn't set up on this server (RESEND_API_KEY and EMAIL_FROM), so no alert can be sent.") : null,
      c.email === "development" ? h("p", { class: "note" }, "Development server: an alert is written to the server's console instead of being emailed.") : null);
    budgetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = budgetIn.value.trim().replace(/^\$/, "");
      const v = raw === "" ? null : Number(raw);
      if (v !== null && !(Number.isFinite(v) && v > 0)) { tell(box, "Enter the budget as a number above 0, like 150, or leave it empty for no budget.", "err"); budgetIn.focus(); return; }
      try { await api("PUT", "/api/insights/ai-costs/budget", { usd: v }); await renderAiCosts(v === null ? "The budget is removed." : `The budget is ${usd(v)} a month.`); } catch (err) { fail(err); }
    });
    const priceIns = PRICE_LABEL.map(([k, label]) => [k, label, L.textIn(`ai-price-${k}`, c.prices[k], { inputmode: "decimal", autocomplete: "off" })]);
    const priceForm = h("form", { class: "panel narrow", novalidate: true },
      h("h2", {}, "Prices used for the estimate"),
      h("p", { "data-prices-edited": c.prices.editedAt || "" }, c.prices.editedAt ? `Last edited ${fmtTime(c.prices.editedAt)}.` : `Never edited here: these are the defaults in the server's config for ${c.prices.model}, checked 2026-11-03.`),
      c.prices.modelDiffers ? h("p", { class: "err", role: "alert" }, `The server's model is ${c.model}, but these prices are for ${c.prices.model}. Enter ${c.model}'s prices.`) : null,
      priceIns.map(([k, label, input]) => L.field(`ai-price-${k}`, `${label} (USD)`, input)),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Save prices"),
        c.prices.editedAt ? h("button", { type: "button", class: "btn", onclick: async () => { try { await api("PUT", "/api/insights/ai-costs/prices", { reset: true }); await renderAiCosts("The prices are back to the config's defaults."); } catch (err) { fail(err); } } }, "Back to the defaults") : null),
      h("p", { class: "note" }, "Prices change. Check them against Anthropic's pricing page and edit them here; every amount on this page is recalculated with the prices shown."));
    priceForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {};
      for (const [k, label, input] of priceIns) { const v = Number(input.value.trim()); if (input.value.trim() === "" || !Number.isFinite(v) || v < 0) { tell(box, `${label}: enter a number, 0 or more.`, "err"); input.focus(); return; } body[k] = v; }
      try { await api("PUT", "/api/insights/ai-costs/prices", body); await renderAiCosts("The prices are saved, and the amounts are recalculated."); } catch (err) { fail(err); }
    });
    show("AI costs",
      h("p", { class: "lead" }, "What the app's AI features have used this month, as an estimate in US dollars."),
      h("p", { class: "panel", "data-estimate-note": "" }, h("b", {}, c.estimateLine)),
      box,
      h("ul", { class: "stats", "aria-label": "AI cost estimate" },
        h("li", { "data-stat": "ai-month" }, h("b", {}, usd(c.estimateUsd)), h("span", {}, `Estimate, ${c.month} so far (UTC)`)),
        h("li", { "data-stat": "ai-projected" }, h("b", {}, usd(c.projectedUsd)), h("span", {}, "Estimated month end, at this pace")),
        h("li", { "data-stat": "ai-person" }, h("b", {}, usd(c.perPersonUsd)), h("span", {}, `Estimated average per person (${num(c.people)} used AI this month)`)),
        h("li", { "data-stat": "ai-requests" }, h("b", {}, num(c.totals.requests)), h("span", {}, "Answered requests"))),
      h("h2", {}, "By kind"),
      L.table("Estimated AI cost by kind", ["Kind", "Requests", "Input tokens", "Output tokens", "Cache tokens", "Web searches", "Estimated cost"], c.byKind.map((k) => h("tr", { "data-kind": k.kind },
        h("th", { scope: "row" }, k.label), L.td(num(k.requests), true), L.td(num(k.input), true), L.td(num(k.output), true), L.td(num(k.cacheWrite + k.cacheRead), true), L.td(num(k.searches), true), L.td(usd(k.usd), true)))),
      h("h2", {}, "By day"),
      costChart(`Estimated cost per day, ${c.month} (UTC)`, c.byDay),
      L.table("Estimated AI cost by day", ["Day (UTC)", "Requests", "Estimated cost"], c.byDay.slice().reverse().map((d) => h("tr", {}, h("th", { scope: "row" }, d.day), L.td(num(d.requests), true), L.td(usd(d.usd), true)))),
      h("div", { class: "acts" }, h("button", { type: "button", class: "btn", onclick: () => L.download("/api/insights/ai-costs.csv", "solia-ai-costs.csv", box) }, "Export CSV")),
      budgetForm,
      priceForm,
      h("p", { class: "note" }, `Totals only: the server keeps how many tokens and web searches each kind of request used per day, for ${c.keptDays} days. It keeps no question, no answer and nothing about who asked. "Per person" is this month's estimate divided by the number of accounts that used a counted AI feature this month. The estimate uses the prices above for every request, also when Anthropic answered with a different model.`));
    if (note) tell(document.querySelector(".msgbox"), note);
  }
  /** The Overview's AI costs card (null when the server has no insights module). */
  async function aiCostsCard() {
    let c;
    try { c = await api("GET", "/api/insights/ai-costs"); } catch { return null; }
    return h("section", { "aria-labelledby": "ov-ai" },
      h("h2", { id: "ov-ai" }, "AI costs"),
      h("ul", { class: "stats", "aria-label": "AI costs" },
        h("li", { "data-stat": "ov-ai-month" }, h("b", {}, usd(c.estimateUsd)), h("span", {}, `Estimate, ${c.month} so far`)),
        h("li", { "data-stat": "ov-ai-budget" }, h("b", {}, c.budget.level === "none" ? "–" : `${c.budget.percent}%`), h("span", {}, c.budget.level === "none" ? "No budget set" : `Of the ${usd(c.budget.budgetUsd)} budget: ${BUDGET_WORD[c.budget.level].toLowerCase()}`))),
      h("p", {}, h("a", { href: "#/ai-costs" }, "See AI costs"), " ", h("span", { class: "note" }, "An estimate; Anthropic's console is the bill of record.")));
  }

  /* ----- Feedback: what people sent from the app (free text; treat as private) ----- */
  const KIND_WORD = { feedback: "Feedback", problem: "Problem" };
  const PLATFORM_WORD = { web: "Web", ios: "iOS", android: "Android" };
  let fbKind = "", fbStatus = "open";
  async function renderFeedback(note = null) {
    const q = [fbKind && `kind=${fbKind}`, fbStatus && `status=${fbStatus}`].filter(Boolean).join("&");
    const r = await api("GET", `/api/feedback${q ? `?${q}` : ""}`);
    const box = msgBox();
    const fail = (err) => tell(box, err.message, "err");
    const redraw = (n) => renderFeedback(n).catch(fail);
    const seg = (label, opts, cur, pick) => h("div", { class: "seg", role: "group", "aria-label": label }, opts.map(([v, l]) => h("button", { type: "button", "aria-pressed": String(cur === v), onclick: () => pick(v) }, l)));
    const item = (m) => {
      const what = `${KIND_WORD[m.kind]} from ${m.day}`;
      return h("li", { class: "panel fb-item", "data-feedback": m.id, "data-kind": m.kind, "data-status": m.status },
        h("div", { class: "ready-head" },
          h("h2", { class: "fb-h" }, KIND_WORD[m.kind], " ", h("span", { class: "ready-need" }, `${m.day} (UTC) · ${PLATFORM_WORD[m.platform] || m.platform} · ${m.build || "no build"} · ${m.language}`)),
          h("span", { class: `badge ${m.status === "open" ? "pending" : "published"}` }, m.status === "open" ? "Open" : `Handled ${m.handledDay || ""}`.trim())),
        h("p", { class: "fb-text" }, m.message),
        m.reply ? h("p", { class: "note" }, "She said it's OK to reply: ", h("a", { href: `mailto:${m.email}?subject=${encodeURIComponent("Your message to Solia Health")}`, "data-reply": "" }, `Reply to ${m.email}`), ".")
          : h("p", { class: "note" }, "Sent without a reply address: it isn't linked to an account, so there is nobody to answer."),
        h("div", { class: "acts" },
          h("button", { type: "button", class: "btn", "aria-label": `${m.status === "open" ? "Mark handled" : "Reopen"}: ${what}`, onclick: async () => { try { await api("PATCH", `/api/feedback/${encodeURIComponent(m.id)}`, { status: m.status === "open" ? "handled" : "open" }); await redraw(m.status === "open" ? "Marked handled." : "Reopened."); } catch (err) { fail(err); } } }, m.status === "open" ? "Mark handled" : "Reopen"),
          h("button", { type: "button", class: "btn danger", "aria-label": `Delete: ${what}`, onclick: async () => { if (!confirm("Delete this message for good?")) return; try { await api("DELETE", `/api/feedback/${encodeURIComponent(m.id)}`); await redraw("Deleted."); } catch (err) { fail(err); } } }, "Delete")));
    };
    show("Feedback",
      h("p", { class: "lead" }, "What people sent from the app's You → Help: feedback and problem reports, newest first."),
      box,
      h("ul", { class: "stats", "aria-label": "Feedback" },
        h("li", { "data-stat": "fb-open" }, h("b", {}, num(r.open)), h("span", {}, "Open")),
        h("li", { "data-stat": "fb-total" }, h("b", {}, num(r.total)), h("span", {}, `Kept (last ${r.keptDays} days)`))),
      seg("Kind", [["", "All kinds"], ["feedback", "Feedback"], ["problem", "Problems"]], fbKind, (v) => { fbKind = v; redraw(); }),
      seg("Status", [["open", "Open"], ["handled", "Handled"], ["", "All"]], fbStatus, (v) => { fbStatus = v; redraw(); }),
      r.items.length ? h("ul", { class: "ready-list", "aria-label": "Messages" }, r.items.map(item)) : h("p", { class: "note", "data-empty": "" }, r.total ? "No messages match these filters." : "No feedback yet."),
      h("p", { class: "note" }, `Each message is what its writer typed, with the app version, platform and language, and the date it arrived (no time). Nothing from anyone's log is attached, and people are asked not to include health details; if someone did, treat it as private and delete the message once it is dealt with. An email address shows only where the writer turned on "It's OK to reply to me". Messages are deleted after ${r.keptDays} days, and a message linked to an account is deleted with that account. The text is never sent to the AI or put in the weekly report, which carries the count of open messages only.`));
    if (note) tell(document.querySelector(".msgbox"), note);
  }
  /** The Overview's count of open feedback (null when the server has no feedback module). */
  async function feedbackCard() {
    let c;
    try { c = await api("GET", "/api/feedback/count"); } catch { return null; }
    return h("section", { "aria-labelledby": "ov-fb" },
      h("h2", { id: "ov-fb" }, "Feedback"),
      h("ul", { class: "stats", "aria-label": "Feedback" }, h("li", { "data-stat": "ov-fb-open" }, h("b", {}, num(c.open)), h("span", {}, c.open === 1 ? "Open message" : "Open messages"))),
      h("p", {}, h("a", { href: "#/feedback" }, "Read feedback")));
  }

  return { renderReadiness, renderAiCosts, aiCostsCard, renderFeedback, feedbackCard };
}
