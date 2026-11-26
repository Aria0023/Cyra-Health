/* The portal's Organizations (docs/plans/upgrade-enterprise.md Task 3), OWNER ONLY: branded versions of the app for clinics
   and employers. Create or edit an organization: name, slug, a small logo, brand colours (the app's primary and accent,
   light and dark, checked here and on the server for WCAG AA 4.5:1 on Solia's page and card), the life stages it offers,
   its Shop lineup, an invite code and its admins' emails. Talks only to this origin's /api/orgs and /api/shop/products.
   Built with the DOM helpers portal.js hands over (textContent only, never innerHTML). */

const STAGE_LABEL = { cycle: "My Cycle", ttc: "Trying to conceive", preg: "Pregnant", peri: "Perimenopause", meno: "Menopause & beyond" };
const COLOUR_FIELDS = [["primary", "Primary, light", (t) => t.primary], ["accent", "Accent, light", (t) => t.accent], ["darkPrimary", "Primary, dark", (t) => t.dark.primary], ["darkAccent", "Accent, dark", (t) => t.dark.accent]];
const LOGO_MAX = 64 * 1024;

/* WCAG 2.x contrast, the same formula as the server's check (backend/src/modules/orgs). */
const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function orgsViews(L) {
  const { h, api, show, field, textIn, area, checks, checked, msgBox, tell, fmtTime } = L;
  let pending = null; // a line to show once the next organization page has been drawn (after a create, the hash changes)

  async function renderOrgs(note = null) {
    const r = await api("GET", "/api/orgs");
    show("Organizations",
      h("p", { class: "lead" }, "Branded versions of Solia Health for clinics and employers: one app, with the organization's name, logo and colours, the life stages it offers and its Shop lineup. People join with the organization's link or invite code."),
      msgBox(),
      h("p", {}, h("a", { href: "#/org/new", class: "btn primary" }, "New organization")),
      r.orgs.length ? h("ul", { class: "rows" }, r.orgs.map((o) => h("li", { class: "row", "data-org": o.slug },
        h("span", { class: "row-main" }, h("a", { href: `#/org/${encodeURIComponent(o.slug)}` }, o.name),
          h("span", { class: "row-sub" }, `${o.slug} · invite code ${o.inviteCode} · ${o.stages.map((s) => STAGE_LABEL[s]).join(", ")} · updated ${fmtTime(o.updatedAt)}`)))))
        : h("p", { class: "note" }, "No organizations yet."));
    if (note) tell(document.querySelector(".msgbox"), note);
  }

  async function renderOrg(slug, note = null) {
    const isNew = slug === "new";
    const [list, { products }] = await Promise.all([api("GET", "/api/orgs"), api("GET", "/api/shop/products")]);
    const o = isNew ? null : list.orgs.find((x) => x.slug === slug);
    if (!isNew && !o) { show("Organization not found", h("p", { class: "err", role: "alert" }, "There's no organization with that slug."), h("p", {}, h("a", { href: "#/orgs" }, "All organizations"))); return; }
    const theme = o ? o.theme : list.solia.theme;
    const box = msgBox();
    const fail = (err) => tell(box, err.message, "err");
    const name = textIn("org-name", o?.name || "", { maxlength: "60", required: true });
    const slugIn = textIn("org-slug", o?.slug || "", { maxlength: "32", required: true, pattern: "[a-z0-9-]{3,32}", disabled: !isNew, "aria-describedby": "org-slug-help" });
    const code = textIn("org-code", o?.inviteCode || "", { maxlength: "12", autocomplete: "off", "aria-describedby": "org-code-help" });
    const admins = area("org-admins", (o?.admins || []).join("\n"), { rows: "3", "aria-describedby": "org-admins-help" });
    const colourIns = COLOUR_FIELDS.map(([k, label, get]) => [k, label, textIn(`org-${k}`, get(theme), { maxlength: "7", inputmode: "text", autocomplete: "off", "aria-describedby": `org-${k}-check` })]);
    const checkLine = (k) => h("p", { class: "help", id: `org-${k}-check`, "aria-live": "polite" });
    const colourChecks = Object.fromEntries(colourIns.map(([k]) => [k, checkLine(k)]));
    const paperOf = (k) => (k.startsWith("dark") ? list.paper.dark : list.paper.light);
    const recheck = () => {
      let ok = true;
      for (const [k, , inp] of colourIns) {
        const v = inp.value.trim(), out = colourChecks[k];
        if (!HEX_RE.test(v)) { out.textContent = "Not a colour yet: use #RRGGBB."; out.className = "help err"; ok = false; continue; }
        const p = paperOf(k), a = contrast(v, p.paper), c = contrast(v, p.card), pass = a >= 4.5 && c >= 4.5;
        out.textContent = `${a.toFixed(2)}:1 on the page, ${c.toFixed(2)}:1 on the card: ${pass ? "passes AA (4.5:1)" : "below AA (4.5:1)"}`;
        out.className = pass ? "help ok" : "help err";
        ok = ok && pass;
      }
      return ok;
    };
    for (const [, , inp] of colourIns) inp.addEventListener("input", recheck);
    const productOpts = Object.fromEntries(products.filter((p) => p.status !== "archived").map((p) => [p.id, p.name || p.id]));
    const wholeShop = h("input", { type: "checkbox", id: "org-wholeshop" }); wholeShop.checked = !o || o.partnerIds === null;
    const lineup = checks("org-lineup", "The Shop lineup", productOpts, o?.partnerIds || [], {});
    const syncLineup = () => { for (const c of lineup.querySelectorAll("input")) c.disabled = wholeShop.checked; };
    wholeShop.addEventListener("change", syncLineup);
    const form = h("form", { class: "panel", novalidate: true },
      field("org-name", "Name", name),
      field("org-slug", "Slug", slugIn, isNew ? "3 to 32 lowercase letters, digits or hyphens. It is in the join link and can't be changed later." : "The slug can't be changed."),
      h("fieldset", {}, h("legend", {}, "Brand colours"),
        h("p", { class: "help" }, "Only the app's primary and accent colours, for light and dark. The page, card and text colours stay Solia Health's, and charts keep their own colours. Each must reach 4.5:1 on the page and on the card of its scheme (WCAG AA)."),
        h("div", { class: "grid2" }, colourIns.map(([k, label, inp]) => h("div", { class: "field" }, h("label", { for: `org-${k}` }, label), inp, colourChecks[k])))),
      checks("org-stages", "Life stages it offers (each person still gets exactly one)", STAGE_LABEL, o ? o.stages : Object.keys(STAGE_LABEL)),
      h("fieldset", {}, h("legend", {}, "Shop"), h("label", { class: "check", for: "org-wholeshop" }, wholeShop, "Show the whole Shop"), lineup),
      field("org-code", "Invite code", code, isNew ? "6 to 12 letters or digits. Leave it empty and one is made for you." : "6 to 12 letters or digits. Changing it stops the old code from working."),
      field("org-admins", "Admin emails, one per line", admins, "They sign in to this portal and see only this organization's totals."),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, isNew ? "Create organization" : "Save changes")));
    syncLineup();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!recheck()) { tell(box, "Fix the colours marked below first: each needs 4.5:1 on the page and the card.", "err"); return; }
      const [p, a, dp, da] = colourIns.map(([, , inp]) => inp.value.trim());
      const body = { name: name.value, theme: { primary: p, accent: a, dark: { primary: dp, accent: da } }, stages: checked(form, "org-stages"), partnerIds: wholeShop.checked ? null : checked(form, "org-lineup"),
        admins: admins.value.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean) };
      if (code.value.trim() || !isNew) body.inviteCode = code.value.trim();
      if (isNew) body.slug = slugIn.value.trim();
      try {
        const res = isNew ? await api("POST", "/api/orgs", body) : await api("PATCH", `/api/orgs/${encodeURIComponent(o.slug)}`, body);
        if (!isNew) await renderOrg(res.org.slug, "Saved.");
        else { pending = `Created ${res.org.name}. Its invite code is ${res.org.inviteCode}.`; location.hash = `#/org/${encodeURIComponent(res.org.slug)}`; }
      } catch (err) { fail(err); }
    });

    let logoPart = null;
    if (o) {
      const file = h("input", { type: "file", id: "org-logo", accept: "image/png,image/jpeg,image/webp" });
      const up = h("button", { type: "button", class: "btn" }, "Upload logo");
      up.addEventListener("click", async () => {
        const f = file.files && file.files[0];
        if (!f) { tell(box, "Choose a PNG, JPEG or WebP file first.", "err"); return; }
        if (f.size > LOGO_MAX) { tell(box, "The logo is larger than 64 KB.", "err"); return; }
        try { await api("POST", `/api/orgs/${encodeURIComponent(o.slug)}/logo`, f, { raw: true, type: f.type || "application/octet-stream" }); await renderOrg(o.slug, "Logo uploaded."); } catch (err) { fail(err); }
      });
      const rm = o.logo ? h("button", { type: "button", class: "btn" }, "Remove logo") : null;
      rm?.addEventListener("click", async () => { try { await api("DELETE", `/api/orgs/${encodeURIComponent(o.slug)}/logo`); await renderOrg(o.slug, "Logo removed."); } catch (err) { fail(err); } });
      const link = `${location.origin.replace(/\/$/, "")}`;
      logoPart = h("div", { class: "panel" },
        h("h2", {}, "Logo"),
        o.logo ? h("p", {}, h("img", { class: "imgprev", src: o.logo.data, alt: `${o.name} logo`, width: "64", height: "64" })) : h("p", { class: "note" }, "No logo yet: the app shows the name only."),
        field("org-logo", "Logo file (PNG, JPEG or WebP, at most 64 KB; square works best)", file),
        h("div", { class: "acts" }, up, rm),
        h("h2", {}, "How people join"),
        h("p", {}, "With the invite code ", h("b", {}, o.inviteCode), " on registration or in You → Your profile, or with a link to the web app that ends in ", h("code", {}, `/app/?org=${o.slug}`), ". The web app lives under /app/ on the Solia Health website; the same ending on the website's front page (", h("code", {}, `/?org=${o.slug}`), ") is passed on to the app."),
        h("p", { class: "note" }, `The app shows each person this, where she joins: "Your organization sees how many people joined, never what you log." (This portal is at ${link}.)`));
    }
    show(isNew ? "New organization" : o.name, h("p", {}, h("a", { href: "#/orgs" }, "All organizations")), box, form, logoPart);
    recheck();
    const line = note || pending; pending = null;
    if (line) tell(document.querySelector(".msgbox"), line);
  }
  return { renderOrgs, renderOrg };
}
