/* The partner portal's reporting screens (docs/plans/tracking-reports.md): Clicks (anonymous shop tap totals; an owner
   sees every brand, a partner its own brands only), and for owners People, Affiliates and the Weekly report. Built with
   the DOM helpers portal.js hands over (textContent only, never innerHTML). Everything here is a total: no row is about
   one person, and nothing here is health data. Talks only to this origin's /api/shop and /api/reports. */

const WINDOWS = [[7, "7 days"], [30, "30 days"], [90, "90 days"]];
const SVG = "http://www.w3.org/2000/svg";

export function reportViews(L) {
  const { h, api, show, field, area, msgBox, tell, isOwner } = L;
  const num = (n) => Number(n || 0).toLocaleString();
  const svg = (tag, attrs = {}, ...kids) => { const el = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v)); el.append(...kids); return el; };
  const table = (caption, cols, rows) => h("div", { class: "tablewrap", role: "region", tabindex: "0", "aria-label": caption },
    h("table", { class: "tbl" }, h("caption", { class: "sr-only" }, caption),
      h("thead", {}, h("tr", {}, cols.map((c, i) => h("th", { scope: "col", class: i && /^\d|taps|clicks|sales|amount|commission|accounts|share/i.test(c) ? "numcol" : null }, c)))),
      h("tbody", {}, rows)));
  const td = (v, numeric = false) => h("td", { class: numeric ? "numcol" : null }, v);
  /** The window switch: three pressed-state buttons; onPick(days) redraws. */
  const windowSeg = (days, onPick) => h("div", { class: "seg", role: "group", "aria-label": "Period" }, WINDOWS.map(([d, l]) =>
    h("button", { type: "button", "aria-pressed": String(days === d), onclick: () => onPick(d) }, `Last ${l}`)));
  async function download(path, name, box) {
    try {
      const r = await api("GET", path);
      const url = URL.createObjectURL(await r.blob());
      const a = h("a", { href: url, download: name, class: "sr-only" }, "download");
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      tell(box, "The CSV file is downloading.");
    } catch (err) { tell(box, err.message, "err"); }
  }

  /** A small horizontal bar chart (decorative beside its table: the table holds every number). items: [{ label, value }]. */
  function barChart(label, items, max = 8) {
    const list = items.filter((i) => i.value > 0).slice(0, max);
    if (!list.length) return null;
    const top = Math.max(...list.map((i) => i.value)), rowH = 30, W = 640, labelW = 230, barW = W - labelW - 70;
    const g = svg("svg", { class: "bars", viewBox: `0 0 ${W} ${list.length * rowH + 4}`, role: "img", "aria-label": `${label}: ${list.map((i) => `${i.label} ${num(i.value)}`).join(", ")}`, preserveAspectRatio: "xMinYMin meet" });
    list.forEach((it, i) => {
      const y = i * rowH + 4, w = Math.max(2, Math.round((it.value / top) * barW));
      const name = it.label.length > 30 ? `${it.label.slice(0, 29)}…` : it.label;
      g.append(svg("text", { class: "bars-lab", x: labelW - 10, y: y + 17, "text-anchor": "end" }, name),
        svg("rect", { class: "bars-bar", x: labelW, y: y + 3, width: w, height: rowH - 10, rx: 4 }),
        svg("text", { class: "bars-val", x: labelW + w + 8, y: y + 17 }, num(it.value)));
    });
    return h("figure", { class: "panel chart" }, h("figcaption", { class: "preview-lab" }, label), g);
  }

  /* ----- Clicks: anonymous shop taps (owner: all brands; partner: its own) ----- */
  let clickDays = 30;
  async function renderClicks() {
    const r = await api("GET", `/taps?days=${clickDays}`);
    const box = msgBox();
    show("Clicks",
      h("p", { class: "lead" }, isOwner()
        ? "How often people opened each product from the app's Shop. Daily totals per product: nothing here says who tapped."
        : "How often people opened your products from the app's Shop. Daily totals per product: nothing here says who tapped."),
      box,
      windowSeg(clickDays, (d) => { clickDays = d; renderClicks().catch((e) => tell(box, e.message, "err")); }),
      h("ul", { class: "stats", "aria-label": "Shop taps" },
        h("li", { "data-stat": "taps" }, h("b", {}, num(r.total)), h("span", {}, `Taps, ${r.from} to ${r.to} (UTC)`)),
        h("li", {}, h("b", {}, num(r.products.length)), h("span", {}, "Products tapped")),
        h("li", {}, h("b", {}, num(r.brands.length)), h("span", {}, "Brands tapped"))),
      r.total ? barChart("Most-tapped products", r.products.map((p) => ({ label: p.name, value: p.taps }))) : null,
      h("h2", {}, "By brand"),
      r.brands.length ? table("Taps by brand", ["Brand", "Taps"], r.brands.map((b) => h("tr", { "data-brand": b.brandId }, h("th", { scope: "row" }, b.name), td(num(b.taps), true))))
        : h("p", { class: "note" }, "No taps in this period yet."),
      h("h2", {}, "By product"),
      r.products.length ? table("Taps by product", ["Product", "Brand", "Taps"], r.products.map((p) => h("tr", { "data-product": p.productId }, h("th", { scope: "row" }, p.name), td(p.brand), td(num(p.taps), true))))
        : h("p", { class: "note" }, "No taps in this period yet."),
      h("div", { class: "acts" }, h("button", { type: "button", class: "btn", onclick: () => download(`/taps.csv?days=${clickDays}`, `solia-shop-taps-${clickDays}d.csv`, box) }, "Export CSV")),
      h("p", { class: "note" }, "A tap is counted when someone opens a product from the Shop page with tap counting on (it is on unless she turns it off in the app). The app sends only the product's id; the server keeps one total per product per day, for 400 days."));
  }

  /* ----- People: account and sign-in totals (owner). Counts only: no email, no name, no list of people. ----- */
  const SIGNIN_LABEL = { apple: "Apple", google: "Google", facebook: "Facebook", email: "Email code" };
  const PEOPLE_NOTE = "Counts only: this page never shows who. \"Used\" means the account signed in, or the app was opened while signed in, on that day (UTC). The server keeps one date per account for this, with no time of day.";
  /** A small column chart of a daily series (decorative beside its table). points: [{ day, count }]. */
  function dayChart(label, points) {
    const top = Math.max(1, ...points.map((p) => p.count)), W = 640, H = 150, pad = 22, bw = (W - 8) / points.length;
    const total = points.reduce((n, p) => n + p.count, 0), best = points.reduce((a, b) => (b.count > a.count ? b : a), points[0]);
    const g = svg("svg", { class: "bars cols", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${label}: ${num(total)} in all${total ? `; the most on ${best.day} (${num(best.count)})` : ""}` });
    g.append(svg("line", { class: "bars-axis", x1: 4, x2: W - 4, y1: H - pad, y2: H - pad }));
    points.forEach((p, i) => {
      const bh = Math.round((p.count / top) * (H - pad - 14));
      if (p.count) g.append(svg("rect", { class: "bars-bar", x: 4 + i * bw + 2, y: H - pad - bh, width: Math.max(2, bw - 4), height: bh, rx: 2 }));
    });
    g.append(svg("text", { class: "bars-lab", x: 4, y: H - 5 }, points[0].day), svg("text", { class: "bars-lab", x: W - 4, y: H - 5, "text-anchor": "end" }, points.at(-1).day), svg("text", { class: "bars-val", x: 4, y: 12 }, `Most in a day: ${num(top === 1 && !total ? 0 : top)}`));
    return h("figure", { class: "panel chart" }, h("figcaption", { class: "preview-lab" }, label), g);
  }
  const peopleStats = (p) => [["people-total", num(p.total), "Accounts"], ["people-new7", num(p.new7), "New, last 7 days"], ["people-new30", num(p.new30), "New, last 30 days"], ["people-active1", num(p.active1), "Used today"], ["people-active7", num(p.active7), "Used, last 7 days"], ["people-active30", num(p.active30), "Used, last 30 days"]];
  /** The Overview's People card: three numbers and a link (null when the server has no insights module). */
  async function peopleCard() {
    let p;
    try { p = await api("GET", "/api/insights/people"); } catch { return null; }
    return h("section", { "aria-labelledby": "ov-people" },
      h("h2", { id: "ov-people" }, "People"),
      h("ul", { class: "stats", "aria-label": "People" }, peopleStats(p).filter(([id]) => ["people-total", "people-new7", "people-active7"].includes(id)).map(([id, v, l]) => h("li", { "data-stat": id }, h("b", {}, v), h("span", {}, l)))),
      h("p", {}, h("a", { href: "#/people" }, "See People"), " ", h("span", { class: "note" }, "Counts only.")));
  }
  async function renderPeople() {
    const p = await api("GET", "/api/insights/people");
    const share = (n) => (p.total ? `${Math.round((n / p.total) * 100)}%` : "0%");
    show("People",
      h("p", { class: "lead" }, "How many accounts there are, how many are new, and how many are in use. Totals for the whole app."),
      h("ul", { class: "stats", "aria-label": "Accounts" }, peopleStats(p).map(([id, v, l]) => h("li", { "data-stat": id }, h("b", {}, v), h("span", {}, l)))),
      h("p", { class: "note" }, PEOPLE_NOTE, p.neverSeen ? ` ${num(p.neverSeen)} ${p.neverSeen === 1 ? "account has" : "accounts have"} no day noted yet: ${p.neverSeen === 1 ? "it hasn't" : "they haven't"} been used since this count began (2026-11-19).` : ""),
      h("h2", {}, "By sign-in method"),
      table("Accounts by sign-in method", ["Sign-in", "Accounts", "Share"], Object.entries(SIGNIN_LABEL).map(([k, l]) => h("tr", { "data-signin": k }, h("th", { scope: "row" }, l), td(num(p.byProvider[k]), true), td(share(p.byProvider[k] || 0), true)))),
      h("h2", {}, "New accounts by day"),
      dayChart("New accounts per day, last 30 days (UTC)", p.newByDay),
      h("details", { class: "panel guide" }, h("summary", {}, "The 30 days as a table"),
        table("New accounts by day", ["Day (UTC)", "New accounts"], p.newByDay.slice().reverse().map((d) => h("tr", {}, h("th", { scope: "row" }, d.day), td(num(d.count), true))))),
      h("p", { class: "note" }, `As of ${p.asOf} (UTC). A deleted account leaves every count at once.`));
  }

  /* ----- Affiliates (owner): Solia taps beside what the networks report, per brand ----- */
  const money = (v) => (v == null ? "–" : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const count = (v) => (v == null ? "–" : num(v));
  let affDays = 30;
  function impactSetup(im) {
    return h("div", { class: "panel" },
      h("h2", {}, "Impact isn't connected to this server yet"),
      h("p", {}, "Clicks, sales and commission come from your Impact account. Add these to the backend's environment (Render → cyra-backend → Environment), then redeploy:"),
      h("ul", { class: "envlist" }, [im.env.sid, im.env.token].map((k) => h("li", {}, h("code", {}, k), im.missing.includes(k) ? " (not set)" : " (set)"))),
      h("p", { class: "note" }, "Both are on Impact → Settings → API. ", h("code", {}, im.env.token), " is a secret: it stays on the server and is never shown here or put in the app. ", h("code", {}, im.env.report), " is optional (the report to read). Step by step: see ", h("code", {}, "docs/AFFILIATES.md"), ", section 5. Your taps below don't need Impact."));
  }
  async function renderAffiliates(refresh = false) {
    const a = await api("GET", `/api/insights/affiliates?days=${affDays}${refresh ? "&refresh=1" : ""}`);
    const box = msgBox();
    const redraw = (r = false) => renderAffiliates(r).catch((e) => tell(box, e.message, "err"));
    const im = a.impact;
    const file = h("input", { id: "az-file", type: "file", accept: ".csv,.tsv,.txt,text/csv,text/plain", "aria-describedby": "az-file-help" });
    const upload = h("form", { class: "panel narrow", novalidate: true },
      h("h3", {}, a.amazon.uploaded ? "Upload a newer report" : "Upload the earnings report"),
      h("div", { class: "field" }, h("label", { for: "az-file" }, "Amazon Associates earnings report (CSV)"),
        h("p", { class: "help", id: "az-file-help" }, "Associates Central → Reports → Download reports → Earnings, as CSV, at most 1 MB. Only the date, items shipped, revenue and earnings are read, as one total per day; product names and tracking IDs are not kept. Days in a new upload replace the same days from an earlier one."), file),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Upload report"),
        a.amazon.uploaded ? h("button", { type: "button", class: "btn danger", onclick: async () => { if (!confirm("Remove the uploaded Amazon totals?")) return; try { await api("DELETE", "/api/insights/amazon"); await renderAffiliates(); tell(document.querySelector(".msgbox"), "The Amazon totals were removed."); } catch (err) { tell(box, err.message, "err"); } } }, "Remove the Amazon totals") : null));
    upload.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = file.files?.[0];
      if (!f) { tell(box, "Choose the report file first.", "err"); file.focus(); return; }
      if (f.size > 1024 * 1024) { tell(box, "That file is larger than 1 MB. Download a shorter period.", "err"); return; }
      try {
        const r = await api("POST", "/api/insights/amazon", await f.text(), { raw: true, type: "text/csv" });
        await renderAffiliates();
        tell(document.querySelector(".msgbox"), `Report read: ${num(r.rows)} rows over ${num(r.days)} days, ${r.from} to ${r.to}${r.skipped ? `; ${num(r.skipped)} rows couldn't be read and were skipped` : ""}.`);
      } catch (err) { tell(box, err.message, "err"); }
    });
    const az = a.amazon;
    show("Affiliates",
      h("p", { class: "lead" }, "Taps on each brand's products in the app's Shop, beside the clicks, sales and commission the affiliate networks report for that brand. Totals only."),
      box,
      windowSeg(affDays, (d) => { affDays = d; redraw(); }),
      h("ul", { class: "stats", "aria-label": "Affiliate totals" },
        h("li", { "data-stat": "aff-taps" }, h("b", {}, num(a.totals.taps)), h("span", {}, "Solia taps")),
        ...(im.configured && !im.error ? [
          h("li", { "data-stat": "aff-clicks" }, h("b", {}, num(a.totals.clicks)), h("span", {}, "Impact clicks")),
          h("li", { "data-stat": "aff-sales" }, h("b", {}, num(a.totals.actions)), h("span", {}, "Impact sales")),
          h("li", { "data-stat": "aff-amount" }, h("b", {}, money(a.totals.saleAmount)), h("span", {}, "Sale amount")),
          h("li", { "data-stat": "aff-commission" }, h("b", {}, money(a.totals.commission)), h("span", {}, "Commission"))] : [])),
      h("p", { class: "note" }, `${a.from} to ${a.to} (UTC). Amounts are in your Impact account's currency.`),
      h("h2", {}, "Impact"),
      !im.configured ? impactSetup(im) : null,
      im.configured && im.error ? h("p", { class: "err", role: "alert" }, `Impact couldn't be read: ${im.error}. Your taps are below; Impact's numbers will show once it answers.`) : null,
      im.configured ? h("p", { class: "note", "data-updated": im.fetchedAt || "" }, im.fetchedAt ? `Last updated ${fmtTimeOf(im.fetchedAt)}; kept for ${im.cachedMinutes} minutes. ` : "", h("button", { type: "button", class: "linkbtn", onclick: () => redraw(true) }, "Refresh now")) : null,
      a.rows.length ? table("Taps and Impact results by brand", ["Brand", "Solia taps", "Impact campaign", "Clicks", "Sales", "Sale amount", "Commission"], a.rows.map((r) => h("tr", { "data-brand": r.brandId },
        h("th", { scope: "row" }, h("a", { href: `#/brand/${encodeURIComponent(r.brandId)}` }, r.brand)), td(num(r.taps), true),
        td(r.campaign ? `${r.campaign} (${r.campaignId})` : r.linked ? `${r.campaignId}: no results in this period` : "Not linked"),
        td(count(r.clicks), true), td(count(r.actions), true), td(money(r.saleAmount), true), td(money(r.commission), true))))
        : h("p", { class: "note" }, "No taps and no linked campaigns in this period yet."),
      h("p", { class: "note" }, "A dash means there is no number: the brand isn't linked to a campaign, or Impact reported nothing for it. To link a brand, open it and fill in \"Impact campaign ID\"."),
      a.unlinked.length ? h("h3", {}, "Impact campaigns not linked to a brand") : null,
      a.unlinked.length ? table("Impact campaigns not linked to a brand", ["Campaign", "Campaign ID", "Clicks", "Sales", "Sale amount", "Commission"], a.unlinked.map((u) => h("tr", { "data-campaign": u.campaignId || "" },
        h("th", { scope: "row" }, u.campaign), td(u.campaignId || "–"), td(num(u.clicks), true), td(num(u.actions), true), td(money(u.saleAmount), true), td(money(u.commission), true)))) : null,
      h("h2", {}, "Amazon Associates"),
      h("p", { class: "note" }, "Amazon has no reporting connection for a new Associates account, so its numbers come from the earnings report you upload. They are for your whole Associates account, not per brand."),
      az.uploaded ? h("ul", { class: "stats", "aria-label": "Amazon Associates totals" },
        h("li", { "data-stat": "az-items" }, h("b", {}, num(az.window.items)), h("span", {}, "Items shipped")),
        h("li", { "data-stat": "az-revenue" }, h("b", {}, money(az.window.revenue)), h("span", {}, "Revenue")),
        h("li", { "data-stat": "az-earnings" }, h("b", {}, money(az.window.earnings)), h("span", {}, "Earnings"))) : h("p", { class: "note" }, "No report uploaded yet."),
      az.uploaded ? h("p", { class: "note", "data-uploaded": az.uploadedAt }, `Uploaded ${fmtTimeOf(az.uploadedAt)}. The report covers ${az.from} to ${az.to}; ${num(az.window.days)} of its days fall in this period.`) : null,
      upload);
  }
  const fmtTimeOf = (iso) => L.fmtTime(iso);

  /* ----- Weekly report (owner): on/off, who gets it, preview, send now ----- */
  const sentLine = (st) => {
    const r = st.lastResult;
    if (!st.lastSentAt || !r) return "Not sent yet.";
    const what = r.ok ? `sent to ${num(r.sent)} ${r.sent === 1 ? "address" : "addresses"}${r.failed ? `, ${num(r.failed)} failed` : ""}` : `not sent (${r.error || "the email couldn't be sent"})`;
    return `Last one: ${fmtTimeOf(st.lastSentAt)}, the week of ${r.week?.from} to ${r.week?.to}, ${what}; ${r.scheduled ? "on schedule" : "sent by hand"}; ${r.writer === "claude" ? "summary by Claude" : "plain template"}${r.dev ? " (development server: written to the console, not emailed)" : ""}.`;
  };
  async function renderWeekly(note = null, draft = null) {
    const st = await api("GET", "/api/insights/weekly");
    const box = msgBox();
    const fail = (err) => tell(box, err.message, "err");
    const onOff = h("button", { type: "button", class: "btn", role: "switch", "aria-checked": String(st.enabled), "aria-labelledby": "wk-on-lab", "data-weekly-switch": "" }, st.enabled ? "On" : "Off");
    onOff.addEventListener("click", async () => { try { const next = await api("PUT", "/api/insights/weekly", { enabled: !st.enabled }); await renderWeekly(next.enabled ? "The weekly report is on." : "The weekly report is off. Nothing is sent on Mondays; Send now still works."); } catch (err) { fail(err); } });
    const who = area("wk-to", st.recipients.join("\n"), { rows: "3", maxlength: "2000", autocomplete: "off", spellcheck: "false", "aria-describedby": "wk-to-help" });
    const form = h("form", { class: "panel narrow", novalidate: true },
      h("h2", {}, "Who gets it"),
      field("wk-to", "Email addresses", who, st.usingOwners ? "One per line, at most 10. Right now it goes to the portal's owners (ADMIN_EMAILS on the server)." : "One per line, at most 10. Leave empty and save to go back to the portal's owners (ADMIN_EMAILS)."),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Save addresses")));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try { await api("PUT", "/api/insights/weekly", { recipients: who.value.trim() ? who.value : null }); await renderWeekly("Saved."); } catch (err) { fail(err); }
    });
    const previewBox = h("div", { id: "wk-preview" });
    const drawDraft = (d) => previewBox.replaceChildren(
      h("h2", { id: "wk-prev-h", tabindex: "-1" }, "Preview: exactly what would be sent"),
      h("p", { class: "note" }, d.writer === "claude" ? "The summary at the top was written by Claude from this week's totals." : `The plain template (${d.why || "no AI summary"}).`, ` To: ${d.recipients.join(", ")}. This preview can be sent as it is for ${d.goodForMinutes} minutes.`),
      h("div", { class: "panel mail", role: "group", "aria-labelledby": "wk-prev-h" },
        h("p", { class: "mail-subject" }, h("b", {}, "Subject: "), d.subject),
        h("pre", { class: "mail-body", tabindex: "0", "aria-label": "The email's text" }, d.text)),
      h("div", { class: "acts" }, h("button", { type: "button", class: "btn primary", onclick: () => send(d.id) }, "Send this now")));
    const busy = (btn, on, label) => { btn.disabled = on; if (label) btn.textContent = label; };
    const previewBtn = h("button", { type: "button", class: "btn primary" }, "Preview");
    previewBtn.addEventListener("click", async () => {
      busy(previewBtn, true, "Writing the preview…");
      try { const d = await api("POST", "/api/insights/weekly/preview", {}); drawDraft(d); busy(previewBtn, false, "Preview again"); document.getElementById("wk-prev-h").focus(); tell(box, "The preview is ready below."); }
      catch (err) { busy(previewBtn, false, "Preview"); fail(err); }
    });
    const sendBtn = h("button", { type: "button", class: "btn" }, "Send now");
    async function send(previewId = null) {
      if (!confirm(`Send the weekly report now to ${st.recipients.join(", ")}?`)) return;
      busy(sendBtn, true);
      try {
        const r = await api("POST", "/api/insights/weekly/send", previewId ? { previewId } : {});
        await renderWeekly(r.dev ? "Development server: the report was written to the server's console, not emailed." : `Sent to ${num(r.sent)} ${r.sent === 1 ? "address" : "addresses"}${r.failed ? `; ${num(r.failed)} could not be sent` : ""}.`);
      } catch (err) { busy(sendBtn, false); fail(err); }
    }
    sendBtn.addEventListener("click", () => send(null));
    show("Weekly report",
      h("p", { class: "lead" }, "A short email every Monday at 14:00 UTC with last week's numbers: accounts, subscriptions, shop taps, affiliate results, partner activity and AI use, and anything that moved more than 30%."),
      box,
      h("div", { class: "panel narrow" },
        h("p", { class: "switchrow" }, h("b", { id: "wk-on-lab" }, "Send the weekly report"), onOff),
        h("p", { class: "note", "data-next": st.nextAt || "" }, st.enabled ? `${st.dueNow ? `The report for ${st.week.from} to ${st.week.to} hasn't gone out yet: it is sent at the server's next hourly check. ` : ""}Next: ${fmtTimeOf(st.nextAt)}, for the week of ${st.nextWeek.from} to ${st.nextWeek.to}.` : "Off: nothing is sent on Mondays."),
        h("p", { class: "note", "data-last": st.lastSentAt || "" }, sentLine(st))),
      st.email === "not set up" ? h("p", { class: "err", role: "alert" }, "Email isn't set up on this server (RESEND_API_KEY and EMAIL_FROM), so nothing can be sent. Preview still works.") : null,
      st.email === "development" ? h("p", { class: "note" }, "Development server: reports are written to the server's console instead of being emailed.") : null,
      h("p", { class: "note" }, st.ai ? "The summary is written by Claude (Anthropic) from the week's totals; the same totals are listed under it. If Claude can't be reached, the plain template is sent." : "ANTHROPIC_API_KEY isn't set on the server, so the report is the plain template: the same numbers without a written summary."),
      h("div", { class: "acts" }, previewBtn, sendBtn),
      previewBox,
      form,
      h("p", { class: "note" }, "Totals only; no personal or health data. The report is built from counts: nothing in it is about one person, and the server holds no health data. To write the summary the totals are sent to Anthropic, and the email is delivered by Resend."));
    if (draft) drawDraft(draft);
    if (note) tell(document.querySelector(".msgbox"), note);
  }

  return { renderClicks, renderPeople, peopleCard, renderAffiliates, renderWeekly, table, td, num, barChart, windowSeg, download };
}
