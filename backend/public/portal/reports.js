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

  return { renderClicks, table, td, num, barChart, windowSeg, download };
}
