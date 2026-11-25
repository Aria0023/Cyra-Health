/* The portal's App settings (docs/plans/upgrade-enterprise.md Task 2), OWNER ONLY: change parts of the app without a code
   change. Talks only to this origin's /api/settings (backend settings module); the app reads the result from the public
   GET /api/app-config when it starts. Built with the DOM helpers portal.js hands over (textContent only, never innerHTML). */

const STYLE_LABEL = { soft: "Soft", mono: "Mono", clear: "Clear", journal: "Journal", aura: "Aura", sky: "Sky", blush: "Blush", mint: "Mint", sunset: "Sunset" };
const PALETTE_LABEL = ["The first palette of her stage (built-in)", "The second palette of her stage", "The third palette of her stage"];
const FIELD_LABEL = { featuresOff: "Features turned off", defaultStyle: "Default style", defaultPalette: "Default palette", announcement: "Home announcement", helpLines: "Help lines", prices: "Web reference prices" };

export function settingsViews(L) {
  const { h, api, show, field, textIn, area, select, msgBox, tell, fmtTime } = L;

  async function renderSettings(note = null) {
    const s = await api("GET", "/api/settings");
    const v = s.values, o = s.options;
    const box = msgBox();
    const fail = (err) => tell(box, err.message, "err");

    /* features */
    const featBoxes = o.features.map((f) => {
      const c = h("input", { type: "checkbox", name: "featOff", value: f.id, id: `set-off-${f.id}` });
      c.checked = v.featuresOff.includes(f.id);
      return h("label", { class: "check", for: `set-off-${f.id}` }, c, `Turn off ${f.label}`);
    });
    const featForm = h("form", { class: "panel", novalidate: true, "aria-labelledby": "set-feat-h" },
      h("h2", { id: "set-feat-h" }, "Features"),
      h("p", { class: "help" }, "Turn off a feature this build of the app offers. You can't turn on one the build doesn't offer. It is off from the next time each person opens the app after it has downloaded these settings. Sign-in, the phone's own health sources and the encrypted backup can't be turned off here, so nobody is cut off from her account or her backup."),
      h("fieldset", {}, h("legend", {}, "Turned off"), h("div", { class: "checks" }, featBoxes)),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Save features")));
    featForm.addEventListener("submit", (e) => { e.preventDefault(); save({ featuresOff: [...featForm.querySelectorAll("input[name=featOff]:checked")].map((c) => c.value) }, "Features saved."); });

    /* defaults for new people */
    const styleSel = select("set-style", [["", "Soft (built-in)"], ...o.styles.map((k) => [k, STYLE_LABEL[k] || k])], v.defaultStyle || "");
    const palSel = select("set-palette", PALETTE_LABEL.slice(0, o.palettes).map((l, i) => [String(i), l]), v.defaultPalette == null ? "0" : String(v.defaultPalette));
    const defForm = h("form", { class: "panel", novalidate: true, "aria-labelledby": "set-def-h" },
      h("h2", { id: "set-def-h" }, "Defaults for new people"),
      h("p", { class: "help" }, "What someone starts with before she picks her own. Nobody's own choice is changed."),
      field("set-style", "Default style", styleSel),
      field("set-palette", "Default palette", palSel),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Save defaults")));
    defForm.addEventListener("submit", (e) => { e.preventDefault(); save({ defaultStyle: styleSel.value || null, defaultPalette: palSel.value === "0" && v.defaultPalette == null ? null : Number(palSel.value) }, "Defaults saved."); });

    /* Home announcement */
    const annOn = h("input", { type: "checkbox", id: "set-ann-on" }); annOn.checked = !!v.announcement.on;
    const annText = textIn("set-ann", v.announcement.text, { maxlength: String(o.announceMax), "aria-describedby": "set-ann-help" });
    const annForm = h("form", { class: "panel", novalidate: true, "aria-labelledby": "set-ann-h" },
      h("h2", { id: "set-ann-h" }, "Home announcement"),
      field("set-ann", "Announcement", annText, `One line of plain text at the top of Home, at most ${o.announceMax} characters. Off by default.`),
      h("label", { class: "check", for: "set-ann-on" }, annOn, "Show it on Home"),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Save announcement")));
    annForm.addEventListener("submit", (e) => { e.preventDefault(); save({ announcement: { on: annOn.checked, text: annText.value } }, annOn.checked ? "Announcement saved and on." : "Announcement saved; it isn't shown."); });

    /* Help lines */
    const helpIns = Array.from({ length: o.helpLinesMax }, (_, i) => textIn(`set-help-${i}`, v.helpLines[i] || "", { maxlength: String(o.helpLineMax) }));
    const helpForm = h("form", { class: "panel", novalidate: true, "aria-labelledby": "set-help-h" },
      h("h2", { id: "set-help-h" }, "Help page lines"),
      h("p", { class: "help" }, `Up to ${o.helpLinesMax} lines of plain text under the answers on You → Help & about, each at most ${o.helpLineMax} characters. Leave a box empty to drop a line.`),
      helpIns.map((inp, i) => field(`set-help-${i}`, `Line ${i + 1}`, inp)),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Save Help lines")));
    helpForm.addEventListener("submit", (e) => { e.preventDefault(); save({ helpLines: helpIns.map((x) => x.value).filter((x) => x.trim()) }, "Help lines saved."); });

    /* web reference prices */
    const pm = textIn("set-price-m", v.prices.monthly || "", { placeholder: "$9.95", inputmode: "decimal", "aria-describedby": "set-price-warn" });
    const pa = textIn("set-price-a", v.prices.annual || "", { placeholder: "$100", inputmode: "decimal", "aria-describedby": "set-price-warn" });
    const priceForm = h("form", { class: "panel", novalidate: true, "aria-labelledby": "set-price-h" },
      h("h2", { id: "set-price-h" }, "Web reference prices"),
      h("p", { class: "err", id: "set-price-warn" }, "These must match the prices in App Store Connect and Play Console. The web only names them (\"in the iPhone and Android apps\"); nothing is sold on the web, and phones always show the store's own price. Leave a box empty for the built-in price."),
      h("p", { class: "note" }, "The free trial's length is set in App Store Connect and Play Console, not here."),
      field("set-price-m", "Monthly (for example $9.95)", pm),
      field("set-price-a", "Yearly (for example $100)", pa),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Save prices")));
    priceForm.addEventListener("submit", (e) => { e.preventDefault(); save({ prices: { monthly: pm.value.trim() || null, annual: pa.value.trim() || null } }, "Prices saved."); });

    async function save(body, line) {
      try { const r = await api("PUT", "/api/settings", body); await renderSettings(r.changed.length ? line : "Nothing changed."); }
      catch (err) { fail(err); }
    }

    show("App settings",
      h("p", { class: "lead" }, "Change parts of the app without a code change. The app downloads these settings when it starts, with a request that carries nothing about the person using it."),
      box,
      h("p", { class: "note", "data-updated": s.updatedAt || "" }, s.updatedAt ? `Last changed ${fmtTime(s.updatedAt)} by ${s.updatedBy}.` : "Nothing has been changed yet: the app uses its built-in settings."),
      h("div", { class: "panel ownerbox", role: "group", "aria-labelledby": "set-not-h" },
        h("h2", { id: "set-not-h" }, "Not editable here"),
        h("ul", {}, s.notEditable.map((x) => h("li", {}, x))),
        h("p", { class: "note" }, "These stay in the code, where they are reviewed before each release.")),
      featForm, defForm, annForm, helpForm, priceForm,
      h("h2", {}, "Change log"),
      s.log.length ? L.table("Change log", ["When", "Who", "Setting", "Was", "Now"], s.log.map((r) => h("tr", {}, h("td", {}, fmtTime(r.at)), h("td", {}, r.by), h("th", { scope: "row" }, FIELD_LABEL[r.field] || r.field), h("td", {}, h("code", {}, r.from)), h("td", {}, h("code", {}, r.to)))))
        : h("p", { class: "note" }, "No changes yet."));
    if (note) tell(document.querySelector(".msgbox"), note);
  }
  return { renderSettings };
}
