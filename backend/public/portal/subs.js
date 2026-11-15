/* The partner portal's subscriptions screens (docs/plans/portal-subscriptions.md Task 2): Subscriptions (RevenueCat's
   numbers), Promotions (scheduled, targeted banners tied to a store offer), Pro grants and Codes. Owner-only, except Codes,
   where a partner sees only its own brands' codes. Built with the DOM helpers portal.js hands over (textContent only,
   never innerHTML). The portal never names or stores a price: a promotion points at a RevenueCat offering, and the app
   shows the store's own price for it. Talks only to this origin's /api/subscriptions and /api/promotions. */

const METRIC_LABEL = { active_subscriptions: "Active subscriptions", active_trials: "Active free trials", mrr: "Monthly recurring revenue (MRR)", revenue: "Revenue, last 28 days", new_customers: "New customers, last 28 days", active_users: "Active users, last 28 days", churn: "Churn" };
const PLATFORM_LABEL = { ios: "iPhone (App Store)", android: "Android (Google Play)", web: "Web (says the offer is in the apps, no price)" };
const CODE_PLATFORM_LABEL = { ios: "iPhone (App Store offer codes)", android: "Android (Google Play promo codes)" };
const STAGE_LABEL = { periods: "My Cycle", ttc: "Trying to conceive", preg: "Pregnancy", peri: "Perimenopause", meno: "Menopause" };
const AUDIENCE_LABEL = { everyone: "Everyone", new: "New users (first used Solia Health within the last 14 days)", stages: "People at certain life stages" };
const PROMO_STATUS = { draft: "Draft", scheduled: "Scheduled", live: "Live", ended: "Ended" };
const GRANT_STATUS = { granted: "Granted", queued: "Waiting for first sign-in", revoked: "Revoked", cancelled: "Cancelled", failed: "Failed", "no-account": "No account yet: invite them to sign up" };
const CODE_STATUS = { available: "Available", given: "Given out", redeemed: "Marked redeemed", expired: "Expired" };
export const SETUP_DOC = "docs/STORE-SETUP.md";

export function subsViews(L) {
  const { h, api, show, field, textIn, area, select, checks, checked, msgBox, tell, fmtTime, isOwner } = L;
  const sub = (method, path, body, opts) => api(method, `/api/subscriptions${path}`, body, opts);
  const dateOnly = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }); } catch { return iso || ""; } };
  const pad = (n) => String(n).padStart(2, "0");
  const toLocalInput = (iso) => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d) ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` : ""; };
  const fromLocalInput = (v) => { const d = new Date(v); return v && !Number.isNaN(d.getTime()) ? d.toISOString() : ""; };
  const docRef = (section) => h("span", {}, "see ", h("code", {}, SETUP_DOC), `, section ${section}`);
  const table = (caption, cols, rows, attrs = {}) => h("div", { class: "tablewrap", role: "region", tabindex: "0", "aria-label": caption },
    h("table", { class: "tbl", ...attrs }, h("caption", { class: "sr-only" }, caption),
      h("thead", {}, h("tr", {}, cols.map((c) => h("th", { scope: "col" }, c || h("span", { class: "sr-only" }, "Action"))))),
      h("tbody", {}, rows)));

  function notConfigured(env, missing) {
    return h("div", { class: "panel" },
      h("h2", {}, "RevenueCat isn't connected to this server yet"),
      h("p", {}, "Subscription numbers and Pro grants come from RevenueCat. Add these to the backend's environment (Render → cyra-backend → Environment), then redeploy:"),
      h("ul", { class: "envlist" }, [env.key, env.project].map((k) => h("li", {}, h("code", {}, k), missing.includes(k) ? " (not set)" : " (set)"))),
      h("p", { class: "note" }, h("code", {}, env.key), " is a RevenueCat secret API key: it stays on the server and is never shown here or put in the app. ", h("code", {}, env.entitlement), " is optional (default pro). For the RevenueCat set-up, ", docRef("6"), "."));
  }

  /* ----- Subscriptions (owner) ----- */
  async function renderSubscriptions(refresh = false) {
    const [cfg, m] = await Promise.all([sub("GET", "/config"), sub("GET", `/metrics${refresh ? "?refresh=1" : ""}`)]);
    const box = msgBox();
    const fmt = (x) => x.unit === "$" ? `$${x.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : x.unit === "%" ? `${x.value.toLocaleString()}%` : x.value.toLocaleString();
    const body = !cfg.configured ? [notConfigured(cfg.env, cfg.missing)] : [
      m.error ? h("p", { class: "err", role: "alert" }, `RevenueCat couldn't be read: ${m.error}. The numbers will show once it answers.`) : null,
      m.metrics.length ? h("ul", { class: "stats", "aria-label": "Subscription numbers" }, m.metrics.map((x) => h("li", { "data-metric": x.id }, h("b", {}, fmt(x)), h("span", {}, METRIC_LABEL[x.id] || x.name)))) : (!m.error ? h("p", { class: "note" }, "RevenueCat returned no numbers yet.") : null),
      !m.metrics.some((x) => x.id === "churn") && !m.error ? h("p", { class: "note" }, "Churn isn't in RevenueCat's overview numbers; its dashboard's Charts show it.") : null,
      h("p", { class: "note" }, m.updatedAt ? `RevenueCat last updated these ${fmtTime(m.updatedAt)}. ` : "", m.fetchedAt ? `Read from RevenueCat ${fmtTime(m.fetchedAt)}; kept for 5 minutes.` : ""),
      h("div", { class: "acts" }, h("button", { type: "button", class: "btn", onclick: () => renderSubscriptions(true).catch((e) => tell(box, e.message, "err")) }, "Refresh now")),
    ];
    show("Subscriptions", h("p", { class: "lead" }, "Pro subscriptions in the iPhone and Android apps, as RevenueCat reports them. Read-only: prices, trials and refunds are managed in App Store Connect and Google Play Console."), box, ...body);
  }

  /* ----- Promotions (owner) ----- */
  function promoGuide() {
    return h("details", { class: "panel guide" },
      h("summary", {}, "Before a promotion: what to create in the stores and RevenueCat"),
      h("ol", {},
        h("li", {}, "Create the offer in the store: App Store Connect → the subscription → Promotional Offers (or an introductory offer), and Google Play Console → the subscription's base plan → Add offer. The store sets the price, the trial and who may use it."),
        h("li", {}, "In RevenueCat, make an offering (not the current one) whose packages use those products and offers, and copy its identifier."),
        h("li", {}, "Here: name the promotion, paste the offering identifier, choose who sees it and when, and write the banner. The app shows the banner with the price the store returns for that offering, and shows nothing if the store doesn't answer."),
        h("li", {}, "Start it. It goes live at its start time and ends by itself at its end time; Stop ends it at once.")),
      h("p", { class: "note" }, "Step by step: ", docRef("6"), ". The banner can't name a price or a percentage: only the store's price is shown."));
  }
  const audienceLine = (a) => a.who === "stages" ? `Stages: ${a.stages.map((s) => STAGE_LABEL[s] || s).join(", ")}` : a.who === "new" ? "New users" : "Everyone";

  async function renderPromotions() {
    const { promotions } = await sub("GET", "/promotions");
    show("Promotions",
      h("p", { class: "lead" }, "Banners in the app that point to a store offer, on a schedule, for the people you choose. Who sees one is decided on her phone; the server never learns her stage."),
      promoGuide(),
      h("div", { class: "acts" }, h("a", { href: "#/promotion/new", class: "btn primary" }, "New promotion")),
      promotions.length ? h("ul", { class: "rows" }, promotions.map((p) => h("li", { class: "row", "data-promotion": p.id },
        h("span", { class: "row-main" }, h("a", { href: `#/promotion/${encodeURIComponent(p.id)}` }, p.name),
          h("span", { class: "row-sub" }, `${fmtTime(p.startsAt)} to ${fmtTime(p.endsAt)} · ${audienceLine(p.audience)} · offering ${p.offeringId}`)),
        h("span", { class: `badge ${p.status}` }, PROMO_STATUS[p.status])))) : h("p", { class: "note" }, "No promotions yet."));
  }

  /** The app's promotion banner (src/components/PromoBanner.jsx), with a placeholder where the store's price goes. */
  function bannerPreview(title, body, platforms) {
    const phone = platforms.some((x) => x === "ios" || x === "android");
    return h("div", { class: "promobanner" },
      h("p", { class: "promobanner-title" }, title || "Banner title"),
      h("p", { class: "promobanner-body" }, body || "Banner text"),
      phone ? h("p", { class: "promobanner-price" }, h("span", { class: "pricehole" }, "Price from the store")) : null,
      platforms.includes("web") ? h("p", { class: "promobanner-web" }, "On the web: \"This offer is in the iPhone and Android apps.\" No price.") : null,
      h("span", { class: "promobanner-x", "aria-hidden": "true" }, "Not now"));
  }

  async function renderPromotion(id) {
    const [{ promotions }, offers] = await Promise.all([sub("GET", "/promotions"), sub("GET", "/offerings").catch(() => ({ offerings: [] }))]);
    const p = id === "new" ? null : promotions.find((x) => x.id === id);
    if (id !== "new" && !p) return show("Promotion not found", h("p", {}, h("a", { href: "#/promotions" }, "Back to promotions")));
    const box = msgBox();
    const v = p || { name: "", offeringId: "", platforms: ["ios", "android"], audience: { who: "everyone", stages: [] }, startsAt: new Date(Date.now() + 3_600_000).toISOString(), endsAt: new Date(Date.now() + 15 * 86_400_000).toISOString(), banner: { title: "", body: "" } };
    const known = (offers.offerings || []).map((o) => [o.id, `${o.name} (${o.id})`]);
    const offerInput = known.length && (!v.offeringId || known.some(([k]) => k === v.offeringId))
      ? select("pr-offering", [["", "Choose an offering"], ...known], v.offeringId, { "aria-describedby": "pr-offering-help" })
      : textIn("pr-offering", v.offeringId, { maxlength: "100", "aria-describedby": "pr-offering-help", autocomplete: "off", spellcheck: "false" });
    const counter = (id2) => h("p", { class: "help count-line", id: `${id2}-count`, "aria-live": "polite" }, "");
    const form = h("form", { class: "panel", novalidate: true, id: "promoform" },
      p ? h("p", {}, h("span", { class: `badge ${p.status}` }, PROMO_STATUS[p.status])) : null,
      field("pr-name", "Name (only owners see it)", textIn("pr-name", v.name, { maxlength: "80", required: true })),
      field("pr-offering", "RevenueCat offering identifier", offerInput, known.length ? "The offerings in your RevenueCat project. The app shows the prices the store returns for it." : "Copy it from RevenueCat → Offerings. The app shows the prices the store returns for it."),
      checks("pr-platforms", "Where", PLATFORM_LABEL, v.platforms),
      h("fieldset", {}, h("legend", {}, "Who sees it"),
        h("div", { class: "checks" }, Object.entries(AUDIENCE_LABEL).map(([k, l]) => { const r = h("input", { type: "radio", name: "pr-who", value: k }); r.checked = v.audience.who === k; return h("label", { class: "check" }, r, l); })),
        h("p", { class: "help" }, "Decided on her phone from her own record. Nothing about her is sent to Solia Health to decide it.")),
      h("div", { id: "pr-stages-box" }, checks("pr-stages", "Life stages", STAGE_LABEL, v.audience.stages)),
      field("pr-start", "Starts", h("input", { id: "pr-start", type: "datetime-local", value: toLocalInput(v.startsAt), required: true })),
      field("pr-end", "Ends", h("input", { id: "pr-end", type: "datetime-local", value: toLocalInput(v.endsAt), required: true, "aria-describedby": "pr-end-help" }), "It ends by itself at this time. At most a year after the start."),
      field("pr-title", "Banner title (up to 40 characters)", textIn("pr-title", v.banner.title, { maxlength: "40", required: true, "aria-describedby": "pr-title-count" })), counter("pr-title", 40),
      field("pr-body", "Banner text (up to 120 characters)", area("pr-body", v.banner.body, { maxlength: "120", required: true, "aria-describedby": "pr-body-count pr-body-help" }), "Calm and plain. No price, percentage or urgency: the app adds the store's own price."), counter("pr-body", 120));
    const acts = h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, p ? "Save changes" : "Save as draft"));
    if (p && p.status !== "live" && p.status !== "scheduled") acts.append(h("button", { type: "button", class: "btn", onclick: () => act("start") }, "Start"));
    if (p && (p.status === "live" || p.status === "scheduled")) acts.append(h("button", { type: "button", class: "btn danger", onclick: () => act("stop") }, "Stop now"));
    if (p && (p.status === "draft" || p.status === "ended")) acts.append(h("button", { type: "button", class: "btn danger", onclick: () => act("delete") }, "Delete"));
    form.append(acts);
    const preview = h("div", { class: "sticky" }, h("p", { class: "preview-lab", id: "pr-prev-lab" }, "Preview: the banner in the app"), h("div", { role: "group", "aria-labelledby": "pr-prev-lab", id: "pr-preview" }));
    const val = (s) => form.querySelector(s)?.value ?? "";
    const collect = () => ({
      name: val("#pr-name"), offeringId: val("#pr-offering").trim(), platforms: checked(form, "pr-platforms"),
      audience: { who: form.querySelector('input[name="pr-who"]:checked')?.value || "everyone", stages: checked(form, "pr-stages") },
      startsAt: fromLocalInput(val("#pr-start")), endsAt: fromLocalInput(val("#pr-end")), banner: { title: val("#pr-title"), body: val("#pr-body") },
    });
    const draw = () => {
      const c = collect();
      document.getElementById("pr-preview")?.replaceChildren(bannerPreview(c.banner.title, c.banner.body, c.platforms));
      const sb = document.getElementById("pr-stages-box"); if (sb) sb.hidden = c.audience.who !== "stages";
      for (const [k, max] of [["pr-title", 40], ["pr-body", 120]]) { const el = document.getElementById(`${k}-count`); if (el) el.textContent = `${val(`#${k}`).length} of ${max} characters`; }
    };
    async function save() {
      const body = collect();
      const r = p ? await sub("PATCH", `/promotions/${encodeURIComponent(p.id)}`, body) : await sub("POST", "/promotions", body);
      return r.promotion;
    }
    async function act(name) {
      try {
        if (name === "delete") { if (!confirm("Delete this promotion?")) return; await sub("DELETE", `/promotions/${encodeURIComponent(p.id)}`); location.hash = "#/promotions"; return; }
        if (name === "start") await save();
        const { promotion } = await sub("POST", `/promotions/${encodeURIComponent(p.id)}/${name}`, {});
        await renderPromotion(promotion.id);
        tell(document.querySelector(".msgbox"), name === "start" ? (promotion.status === "live" ? "Started: it's live in the app now." : `Started: it goes live ${fmtTime(promotion.startsAt)}.`) : "Stopped: it no longer shows in the app.");
      } catch (err) { tell(box, err.message, "err"); }
    }
    form.addEventListener("input", draw);
    form.addEventListener("change", draw);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const saved = await save();
        if (!p) { location.hash = `#/promotion/${encodeURIComponent(saved.id)}`; return; }
        await renderPromotion(saved.id);
        tell(document.querySelector(".msgbox"), saved.status === "live" ? "Saved. The app shows the new text from its next download." : "Saved.");
      } catch (err) { tell(box, err.message, "err"); }
    });
    show(p ? p.name : "New promotion", h("p", {}, h("a", { href: "#/promotions" }, "All promotions")), box, promoGuide(), h("div", { class: "grid2" }, form, preview));
    draw();
  }

  /* ----- Pro grants (owner) ----- */
  async function renderGrants() {
    const [cfg, { grants, durations }] = await Promise.all([sub("GET", "/config"), sub("GET", "/grants")]);
    const box = msgBox(), results = h("div", { id: "grant-results" });
    const form = h("form", { class: "panel", novalidate: true },
      h("h2", {}, "Give free Pro"),
      field("gr-emails", "Account emails", area("gr-emails", "", { "aria-describedby": "gr-emails-help", rows: "4" }), "One address, or up to 500: one per line, or paste a CSV (anything that isn't an email address is ignored). It's the email she signed in to Solia Health with; with Apple's \"Hide my email\" that's her private relay address."),
      field("gr-duration", "For", select("gr-duration", Object.entries(durations), "monthly")),
      field("gr-note", "Note (only owners see it)", textIn("gr-note", "", { maxlength: "200", "aria-describedby": "gr-note-help" }), "Who it's for, like \"Clinic pilot\". Never anything about anyone's health."),
      h("label", { class: "check" }, h("input", { type: "checkbox", id: "gr-queue" }), "If someone hasn't signed up yet, give it to them at their first sign-in"),
      h("p", { class: "help" }, "RevenueCat receives her account number and the length, never her email. Pro starts when RevenueCat records it; for a queued grant, at her first sign-in."),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary", disabled: !cfg.configured }, "Give Pro")));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]"); btn.disabled = true;
      try {
        const r = await sub("POST", "/grants", { emails: form.querySelector("#gr-emails").value, duration: form.querySelector("#gr-duration").value, note: form.querySelector("#gr-note").value, queue: form.querySelector("#gr-queue").checked });
        await renderGrants();
        const n = (s) => r.results.filter((x) => x.status === s).length;
        tell(document.querySelector(".msgbox"), `Done: ${n("granted")} granted, ${n("queued")} waiting for a first sign-in, ${n("no-account")} with no account yet, ${n("failed")} failed.`);
        document.getElementById("grant-results").replaceChildren(h("h2", {}, "Results"),
          table("Results of this grant", ["Email", "Result", "Until"], r.results.map((x) => h("tr", { "data-result": x.email }, h("td", {}, x.email), h("td", {}, GRANT_STATUS[x.status] + (x.error ? `: ${x.error}` : "")), h("td", {}, x.expiresAt ? dateOnly(x.expiresAt) : x.status === "granted" ? "No end date" : "")))),
          r.invalid?.length ? h("p", { class: "note" }, `Not email addresses, skipped: ${r.invalid.join(", ")}`) : null);
      } catch (err) { tell(box, err.message, "err"); btn.disabled = false; }
    });
    const revokeBtn = (g) => h("button", { type: "button", class: "btn small danger", "aria-label": `${g.status === "queued" ? "Cancel" : "Revoke"} Pro for ${g.email}`, onclick: async () => {
      if (!confirm(g.status === "queued" ? `Cancel the waiting grant for ${g.email}?` : `Revoke free Pro for ${g.email}? RevenueCat ends every free Pro grant on that account.`)) return;
      try { const r = await sub("POST", `/grants/${encodeURIComponent(g.id)}/revoke`, {}); await renderGrants(); tell(document.querySelector(".msgbox"), r.grant.status === "cancelled" ? `Cancelled the waiting grant for ${g.email}.` : `Revoked Pro for ${g.email}.`); } catch (err) { tell(box, err.message, "err"); }
    } }, g.status === "queued" ? "Cancel" : "Revoke");
    const statusOf = (g) => g.ended ? "Ended" : GRANT_STATUS[g.status] + (g.error && g.status !== "granted" ? `: ${g.error}` : "");
    const queued = grants.filter((g) => g.status === "queued");
    const rest = grants.filter((g) => g.status !== "queued");
    show("Pro grants",
      h("p", { class: "lead" }, "Free Pro for a person or a group for a set time, by the email they sign in with: for example a partner clinic's patients. Every grant and revoke is in Activity."),
      cfg.configured ? null : notConfigured(cfg.env, cfg.missing),
      box, form, results,
      h("h2", {}, "Waiting for a first sign-in"),
      queued.length ? table("Grants waiting for a first sign-in", ["Email", "For", "Note", "Added", ""], queued.map((g) => h("tr", { "data-grant": g.id }, h("td", {}, g.email), h("td", {}, durations[g.duration] || g.duration), h("td", {}, g.note || ""), h("td", {}, fmtTime(g.at)), h("td", {}, revokeBtn(g))))) : h("p", { class: "note" }, "None."),
      h("h2", {}, "Grants"),
      rest.length ? table("Grants", ["Email", "For", "Status", "Until", "Note", ""], rest.map((g) => h("tr", { "data-grant": g.id }, h("td", {}, g.email), h("td", {}, durations[g.duration] || g.duration), h("td", {}, statusOf(g)), h("td", {}, g.status === "granted" ? (g.expiresAt ? dateOnly(g.expiresAt) : "No end date") : ""), h("td", {}, g.note || ""), h("td", {}, g.status === "granted" && !g.ended && cfg.configured ? revokeBtn(g) : null)))) : h("p", { class: "note" }, "No grants yet."));
  }

  /* ----- Codes (owner and partner) ----- */
  const countsLine = (c) => `${c.available} available · ${c.given} given out · ${c.redeemed} marked redeemed${c.expired ? ` · ${c.expired} expired` : ""}`;
  const trackingNote = () => h("p", { class: "note" }, "The counts are what an owner marked here. Apple and Google don't tell this portal which code was used; their reports in App Store Connect and Play Console do. A separate store offer for each partner lets you see each partner's redemptions there.");

  async function renderCodes() {
    const data = await sub("GET", "/codes");
    if (data.role !== "owner") return renderPartnerCodes(data);
    const brands = await L.brandList();
    const box = msgBox();
    const brandOpts = [["", "No partner yet"], ...brands.map((b) => [b.id, b.name])];
    const file = h("input", { id: "cb-file", type: "file", accept: ".txt,.csv,text/plain,text/csv", "aria-describedby": "cb-file-help" });
    const up = h("form", { class: "panel", novalidate: true },
      h("h2", {}, "Upload a batch of codes"),
      h("p", { class: "note" }, "Make the codes in the store first: App Store Connect → the subscription → Offer Codes (download the one-time codes), or Play Console → Monetize → Promo codes. ", docRef("7"), "."),
      field("cb-label", "Label", textIn("cb-label", "", { maxlength: "80", required: true })),
      field("cb-platform", "Store", select("cb-platform", Object.entries(CODE_PLATFORM_LABEL), "ios")),
      field("cb-offer", "Store offer they belong to", textIn("cb-offer", "", { maxlength: "100", required: true, "aria-describedby": "cb-offer-help" }), "The offer's name or reference in App Store Connect or Play Console, so you can find it there."),
      field("cb-exp", "Codes expire on (optional)", h("input", { id: "cb-exp", type: "date" })),
      field("cb-brand", "Partner (brand)", select("cb-brand", brandOpts, "")),
      field("cb-codes", "Codes, one per line", area("cb-codes", "", { rows: "5", spellcheck: "false", "aria-describedby": "cb-codes-help" }), "Up to 2,000 in a batch. A CSV works too: the first column is read."),
      h("div", { class: "field" }, h("label", { for: "cb-file" }, "Or read them from a file"), h("p", { class: "help", id: "cb-file-help" }, "A .txt or .csv file from the store. It's read in this browser and pasted above."), file),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Upload codes")));
    file.addEventListener("change", async () => { const f = file.files?.[0]; if (!f) return; if (f.size > 90_000) { tell(box, "That file is too large: split it into batches of up to 2,000 codes.", "err"); file.value = ""; return; } up.querySelector("#cb-codes").value = await f.text(); file.value = ""; tell(box, "The file was read. Check the codes, then upload."); });
    up.addEventListener("submit", async (e) => {
      e.preventDefault();
      const q = (s) => up.querySelector(s).value;
      try {
        const r = await sub("POST", "/codes/batches", { label: q("#cb-label"), platform: q("#cb-platform"), offerRef: q("#cb-offer"), expiresAt: q("#cb-exp") ? `${q("#cb-exp")}T23:59:59Z` : null, brandId: q("#cb-brand") || null, codes: q("#cb-codes") });
        await renderCodes();
        tell(document.querySelector(".msgbox"), `Uploaded ${r.added} codes.${r.duplicates ? ` ${r.duplicates} were uploaded already and skipped.` : ""}${r.invalid ? ` ${r.invalid} lines weren't codes and were skipped.` : ""}`);
      } catch (err) { tell(box, err.message, "err"); }
    });
    const mark = h("form", { class: "panel", novalidate: true },
      h("h2", {}, "Mark codes"),
      field("cm-status", "Mark as", select("cm-status", [["given", "Given out"], ["redeemed", "Redeemed"], ["available", "Available again"]], "redeemed")),
      field("cm-codes", "Codes, one per line", area("cm-codes", "", { rows: "3", spellcheck: "false" })),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "btn" }, "Mark")));
    mark.addEventListener("submit", async (e) => {
      e.preventDefault();
      try { const r = await sub("POST", "/codes/mark", { status: mark.querySelector("#cm-status").value, codes: mark.querySelector("#cm-codes").value }); await renderCodes(); tell(document.querySelector(".msgbox"), `Marked ${r.marked} codes.${r.notFound ? ` ${r.notFound} weren't found.` : ""}`); }
      catch (err) { tell(box, err.message, "err"); }
    });
    const batchRow = (b) => {
      const sid = `cb-assign-${b.id}`;
      return h("li", { class: "row", "data-batch": b.id },
        h("span", { class: "row-main" }, h("b", {}, b.label), h("span", { class: "row-sub" }, `${CODE_PLATFORM_LABEL[b.platform]} · offer ${b.offerRef}${b.expiresAt ? ` · expires ${dateOnly(b.expiresAt)}` : ""} · ${b.brand || "no partner yet"}`), h("span", { class: "row-sub" }, countsLine(b.counts))),
        h("div", { class: "acts" },
          h("label", { for: sid, class: "sr-only" }, `Partner for ${b.label}`), select(sid, brandOpts, b.brandId || ""),
          h("button", { type: "button", class: "btn small", onclick: async () => { try { await sub("PATCH", `/codes/batches/${encodeURIComponent(b.id)}`, { brandId: document.getElementById(sid).value || null }); await renderCodes(); tell(document.querySelector(".msgbox"), `Assigned ${b.label}.`); } catch (err) { tell(box, err.message, "err"); } } }, `Assign ${b.label}`),
          h("button", { type: "button", class: "btn small", onclick: () => download(`/codes.csv?batch=${encodeURIComponent(b.id)}`, box) }, `Export ${b.label}`),
          h("button", { type: "button", class: "btn small danger", onclick: async () => { if (!confirm(`Delete the batch ${b.label} and its codes from the portal?`)) return; try { await sub("DELETE", `/codes/batches/${encodeURIComponent(b.id)}`); await renderCodes(); tell(document.querySelector(".msgbox"), `Deleted ${b.label}.`); } catch (err) { tell(box, err.message, "err"); } } }, `Delete ${b.label}`)));
    };
    show("Codes",
      h("p", { class: "lead" }, "Batches of Apple offer codes and Google Play promo codes handed to partners. A partner sees only its own codes."),
      box, trackingNote(),
      h("h2", {}, "By partner"),
      data.summary.length ? table("Codes by partner", ["Partner", "Available", "Given out", "Marked redeemed", "Expired"], data.summary.map((s) => h("tr", {}, h("td", {}, s.brand || "No partner yet"), h("td", {}, String(s.counts.available)), h("td", {}, String(s.counts.given)), h("td", {}, String(s.counts.redeemed)), h("td", {}, String(s.counts.expired))))) : h("p", { class: "note" }, "No codes yet."),
      h("div", { class: "acts" }, h("button", { type: "button", class: "btn", onclick: () => download("/codes.csv", box) }, "Export all codes (CSV)")),
      h("h2", {}, "Batches"),
      data.batches.length ? h("ul", { class: "rows" }, data.batches.map(batchRow)) : h("p", { class: "note" }, "No batches yet."),
      up, mark);
  }

  function renderPartnerCodes(data) {
    const box = msgBox();
    show("Codes",
      h("p", { class: "lead" }, "Codes Solia Health set aside for your brand. Each one gives someone the store offer it belongs to, redeemed in the Solia Health app."),
      box,
      data.summary.length ? h("ul", { class: "stats" }, data.summary.flatMap((s) => [["Available", s.counts.available], ["Given out", s.counts.given], ["Marked redeemed", s.counts.redeemed]].map(([l, n]) => h("li", {}, h("b", {}, String(n)), h("span", {}, `${l}${data.summary.length > 1 ? ` · ${s.brand}` : ""}`))))) : h("p", { class: "note" }, "No codes have been assigned to your brand yet."),
      h("p", { class: "note" }, "\"Given out\" and \"Marked redeemed\" are what Solia Health marked."),
      data.available.length ? h("div", { class: "acts" }, h("button", { type: "button", class: "btn primary", onclick: () => download("/codes.csv", box) }, "Download my available codes (CSV)")) : null,
      data.available.length ? table("Your available codes", ["Code", "Store", "Offer", "Expires"], data.available.slice(0, 200).map((c) => h("tr", {}, h("td", {}, h("code", {}, c.code)), h("td", {}, CODE_PLATFORM_LABEL[c.platform]), h("td", {}, c.offerRef), h("td", {}, c.expiresAt ? dateOnly(c.expiresAt) : "")))) : null,
      data.available.length > 200 ? h("p", { class: "note" }, `Showing 200 of ${data.available.length}; the download has them all.`) : null,
      h("h2", {}, "How people use a code"),
      h("p", {}, "iPhone: in the Solia Health app, Pro → \"Have a code?\" opens Apple's code sheet. Android: Pro → \"Have a code?\", type the code, and Google Play opens to redeem it."));
  }

  async function download(path, box) {
    try {
      const r = await sub("GET", path);
      const url = URL.createObjectURL(await r.blob());
      const a = h("a", { href: url, download: "solia-codes.csv", class: "sr-only" }, "download");
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      tell(box, "The CSV file is downloading.");
    } catch (err) { tell(box, err.message, "err"); }
  }

  return { renderSubscriptions, renderPromotions, renderPromotion, renderGrants, renderCodes, isOwner };
}
