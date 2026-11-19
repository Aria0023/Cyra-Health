/* The partner portal's reporting screens (docs/plans/tracking-reports.md): Clicks (anonymous shop tap totals; an owner
   sees every brand, a partner its own brands only), and for owners People, Affiliates and the Weekly report. Built with
   the DOM helpers portal.js hands over (textContent only, never innerHTML). Everything here is a total: no row is about
   one person, and nothing here is health data. Talks only to this origin's /api/shop and /api/reports. */

const WINDOWS = [[7, "7 days"], [30, "30 days"], [90, "90 days"]];
const SVG = "http://www.w3.org/2000/svg";

export function reportViews(L) {
  const { h, api, show, msgBox, tell, isOwner } = L;
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

  return { renderClicks, renderPeople, peopleCard, table, td, num, barChart, windowSeg, download };
}
