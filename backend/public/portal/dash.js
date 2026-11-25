/* Organization dashboards (docs/plans/upgrade-enterprise.md Task 4): TOTALS ONLY. An organization's admins sign in to the same
   portal and see only their organization; owners see every one. Any number under 10 arrives from the server already as
   "fewer than 10". No list of people, no emails, no health data (the server has none). Talks only to /api/orgs/mine and
   /api/orgs/:slug/stats on this origin. Built with the DOM helpers portal.js hands over (textContent only). */

export function dashViews(L) {
  const { h, api, show, fmtTime } = L;
  const weekWord = (w) => { try { return new Date(`${w}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }); } catch { return w; } };
  const stat = (id, label, x, note = null) => h("li", { "data-stat": id }, h("b", {}, x.text), h("span", {}, label), note ? h("span", { class: "row-sub" }, note) : null);

  async function card(slug) {
    const s = await api("GET", `/api/orgs/${encodeURIComponent(slug)}/stats`);
    return h("section", { class: "panel", "aria-labelledby": `dash-${slug}-h`, "data-dash": slug },
      h("h2", { id: `dash-${slug}-h` }, s.name),
      h("ul", { class: "stats" },
        stat("joined", "people joined", s.joined),
        stat("signed-in", "signed-in accounts", s.signedIn),
        stat("pro", "Pro subscribers", s.pro, s.pro.unavailable || null)),
      L.table(`${s.name}: joins per week`, ["Week of", "Joins"], s.joinsByWeek.map((w) => h("tr", {}, h("th", { scope: "row" }, weekWord(w.week)), L.td(w.text, true)))),
      h("p", { class: "note" }, `Totals as of ${s.asOf} (UTC). Any number under ${s.small} shows as "fewer than ${s.small}". "People joined" counts every join with this organization's link or invite code, with or without an account; "signed-in accounts" are accounts that joined it.`));
  }

  async function renderDashboards() {
    const { orgs } = await api("GET", "/api/orgs/mine");
    const cards = [];
    for (const o of orgs) cards.push(await card(o.slug));
    show(orgs.length === 1 ? `${orgs[0].name} dashboard` : "Organization dashboards",
      h("p", { class: "lead" }, "Totals only: how many people joined, how many signed-in accounts and Pro subscribers, and joins per week. Nobody's name, email or health information is shown, and Solia Health's server holds no health information."),
      ...(cards.length ? cards : [h("p", { class: "note" }, "No organizations yet.")]),
      h("p", { class: "note" }, `Shown ${fmtTime(new Date().toISOString())}.`));
  }
  async function renderDashboard(slug) {
    const c = await card(slug);
    show(`${c.querySelector("h2").textContent} dashboard`, h("p", {}, h("a", { href: `#/org/${encodeURIComponent(slug)}` }, "Edit this organization")), c);
  }
  return { renderDashboards, renderDashboard };
}
