/* Solia Health partner portal (docs/plans/partner-portal.md Task 2). One page, no framework and no build step: it signs in
   with an emailed one-time code and talks only to this origin's /api/shop. Every element is built with the DOM API
   (textContent, never innerHTML), so nothing a partner types can become markup. The portal token lives in this tab's
   sessionStorage and is gone when the tab closes; the server ends it after 8 hours or at sign-out.
   Labels mirror the app's src/lib/shop.js (src/lib/shopSeed.test.mjs checks they agree).
   2026-11-15 (docs/plans/portal-subscriptions.md Task 2): the owner's Subscriptions, Promotions, Pro grants and Codes
   screens, and a partner's Codes, live in subs.js and talk to /api/subscriptions on this same origin. */
import { subsViews } from "./subs.js";
import { reportViews } from "./reports.js";
import { launchViews } from "./launch.js";

const CATEGORY_LABEL = { fertility: "Ovulation & fertility", pregnancy: "Pregnancy", labs: "Lab tests", glucose: "Blood sugar", wearables: "Wearables", periods: "Periods", meno: "Perimenopause & menopause", sleep: "Sleep" };
const AVAIL_LABEL = { home: "Kit sent to your home", lab: "Sample taken at a lab", visit: "Online visit", app: "In an app", online: "Sold online", stores: "Sold online and in stores", rx: "By prescription" };
const TONE_LABEL = { strong: "Strong evidence", mixed: "Mixed evidence", comfort: "Comfort", clinical: "Clinical care" };
const STAGE_LABEL = { periods: "My Cycle", ttc: "Trying to conceive", preg: "Pregnancy", peri: "Perimenopause", meno: "Menopause" };
const MODULE_LABEL = { pcos: "PCOS", pots: "POTS" };
const KIND_LABEL = { rx: "Prescription", supp: "Supplement", habit: "Habit", program: "Program", aid: "Comfort aid", care: "Care" };
const HUES = ["teal", "blue", "coral", "violet", "green", "amber", "rose", "indigo", "cyan", "plum"];
const STATUS_LABEL = { draft: "Draft", pending: "Waiting for review", published: "Published", archived: "Archived" };
const AFFILIATE_LINE = "Solia Health may earn a commission if you buy through this link. It never changes what we show you.";
const IMAGE_MAX = 1024 * 1024;

/* ---------- small helpers ---------- */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}
const $main = () => document.getElementById("main");
const say = (msg) => { const s = document.getElementById("status"); s.textContent = ""; setTimeout(() => { s.textContent = msg; }, 30); };
const store = {
  get() { try { return JSON.parse(sessionStorage.getItem("solia.portal") || "null"); } catch { return null; } },
  set(v) { try { if (v) sessionStorage.setItem("solia.portal", JSON.stringify(v)); else sessionStorage.removeItem("solia.portal"); } catch { /* private mode: this page only */ } },
};
let session = store.get(); // { token, me }
let ephemeral = null; // when sessionStorage is unavailable
const token = () => (session || ephemeral)?.token || null;
const me = () => (session || ephemeral)?.me || null;
const isOwner = () => me()?.role === "owner";
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return iso || ""; } };
const monogramOf = (b) => b?.monogram || (() => { const w = String(b?.name || "").split(/[^A-Za-z]+/).filter(Boolean); return w.length >= 2 ? (w[0][0] + w[1][0]).toUpperCase() : (w[0] || "?").slice(0, 2).toUpperCase(); })();
const hueOf = (b) => { if (b?.hue && HUES.includes(b.hue)) return b.hue; let x = 0; for (const ch of String(b?.name || "")) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return HUES[x % HUES.length]; };
const imageUrl = (id) => `/api/shop/images/${encodeURIComponent(id)}`;

class ApiError extends Error {}
async function api(method, path, body, { raw = false, type = "" } = {}) {
  const headers = {};
  if (token()) headers.authorization = `Bearer ${token()}`;
  let payload;
  if (raw) { payload = body; headers["content-type"] = type || "application/octet-stream"; }
  else if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
  let r;
  try { r = await fetch(path.startsWith("/api/") ? path : `/api/shop${path}`, { method, headers, body: payload, credentials: "omit", cache: "no-store" }); }
  catch { throw new ApiError("The server didn't answer. Check your connection and try again."); }
  if (r.status === 401 && token() && !path.startsWith("/auth/")) { endSession("Your session ended. Sign in again."); throw new ApiError("Your session ended. Sign in again."); }
  const json = (r.headers.get("content-type") || "").includes("json") ? await r.json().catch(() => null) : null;
  if (!r.ok) throw Object.assign(new ApiError(sentence(json?.error) || `The server answered ${r.status}.`), { status: r.status, why: json?.why });
  return json ?? r;
}
const sentence = (s) => (s ? `${String(s).charAt(0).toUpperCase()}${String(s).slice(1)}${/[.!?]$/.test(s) ? "" : "."}` : "");

function endSession(msg) { session = null; ephemeral = null; store.set(null); renderWho(); location.hash = "#/"; renderSignIn(msg); }

/* ---------- header ---------- */
function renderWho() {
  const who = document.getElementById("who"), nav = document.getElementById("nav");
  who.replaceChildren(); nav.replaceChildren();
  if (!me()) { nav.hidden = true; return; }
  who.append(h("span", {}, "Signed in as ", h("b", { text: me().email }), ` · ${isOwner() ? "Owner" : "Partner"}`),
    h("button", { type: "button", class: "btn small", onclick: async () => { try { await api("POST", "/auth/sign-out", {}); } catch { /* ends locally anyway */ } endSession("You're signed out."); } }, "Sign out"));
  const links = isOwner()
    ? [["#/", "Overview"], ["#/readiness", "Readiness"], ["#/products", "Products"], ["#/brands", "Brands"], ["#/applications", "Applications"], ["#/partners", "Partners"], ["#/subscriptions", "Subscriptions"], ["#/promotions", "Promotions"], ["#/grants", "Pro grants"], ["#/codes", "Codes"], ["#/clicks", "Clicks"], ["#/people", "People"], ["#/affiliates", "Affiliates"], ["#/weekly", "Weekly report"], ["#/ai-costs", "AI costs"], ["#/feedback", "Feedback"], ["#/activity", "Activity"]]
    : [["#/products", "Products"], ["#/brands", "Brands"], ["#/codes", "Codes"], ["#/clicks", "Clicks"]];
  for (const [href, label] of links) nav.append(h("a", { href, "data-nav": href }, label));
  nav.hidden = false;
  markNav();
}
function markNav() {
  const cur = location.hash.replace(/\?.*$/, "") || "#/";
  const top = cur.startsWith("#/product") ? "#/products" : cur.startsWith("#/brand") ? "#/brands" : cur.startsWith("#/promotion") ? "#/promotions" : cur;
  for (const a of document.querySelectorAll("#nav a")) { if (a.dataset.nav === top || (top === "#/" && !isOwner() && a.dataset.nav === "#/products")) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }
}

/* ---------- views ---------- */
function show(title, ...kids) {
  const h1 = h("h1", { tabindex: "-1", id: "view-h" }, title);
  $main().replaceChildren(h1, ...kids.filter(Boolean));
  document.title = `${title} · Solia Health partner portal`;
  h1.focus({ preventScroll: false });
  return h1;
}
const msgBox = () => h("div", { class: "msgbox" });
function tell(box, text, kind = "ok") {
  box.replaceChildren(h("p", { class: kind, role: kind === "err" ? "alert" : null }, text));
  if (kind !== "err") say(text);
}
const field = (id, label, input, help) => h("div", { class: "field" }, h("label", { for: id }, label), help ? h("p", { class: "help", id: `${id}-help` }, help) : null, input);
const textIn = (id, value, attrs = {}) => h("input", { id, name: id, type: "text", value: value ?? "", ...attrs });
const area = (id, value, attrs = {}) => { const t = h("textarea", { id, name: id, ...attrs }); t.value = value ?? ""; return t; };
function select(id, options, value, attrs = {}) {
  const s = h("select", { id, name: id, ...attrs });
  for (const [v, label] of options) { const o = h("option", { value: v }, label); if (v === (value ?? "")) o.selected = true; s.append(o); }
  return s;
}
function checks(name, legend, labels, picked = [], { disabled = false } = {}) {
  return h("fieldset", {}, h("legend", {}, legend), h("div", { class: "checks" }, Object.entries(labels).map(([v, l]) => {
    const c = h("input", { type: "checkbox", name, value: v, disabled });
    c.checked = picked.includes(v);
    return h("label", { class: "check" }, c, l);
  })));
}
const checked = (form, name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((c) => c.value);
const badge = (status) => h("span", { class: `badge ${status}` }, STATUS_LABEL[status] || status);

/* ----- sign in ----- */
async function renderSignIn(note = "") {
  let cfg = { email: true };
  try { cfg = await api("GET", "/auth/config"); } catch { /* shown on send */ }
  const box = msgBox();
  const email = h("input", { id: "si-email", type: "email", autocomplete: "email", required: true, "aria-describedby": "si-email-help" });
  const form = h("form", { class: "panel narrow", novalidate: true },
    field("si-email", "Work email", email, "We email you a one-time code. There is no password."),
    h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Email me a code")));
  show("Sign in to the partner portal",
    h("p", { class: "lead" }, "For Solia Health and the brands it works with: manage your brands and products, and send changes for review."),
    note ? h("p", { class: "ok", role: "status" }, note) : null,
    cfg.email === false ? h("p", { class: "err", role: "alert" }, "Email sign-in isn't set up on this server yet.") : null,
    box, form,
    h("p", { class: "note" }, "Want to list your products? ", h("a", { href: "/portal/apply" }, "Apply to partner with Solia Health"), "."));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const addr = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { tell(box, "Enter a valid email address.", "err"); email.focus(); return; }
    const btn = form.querySelector("button"); btn.disabled = true;
    try { const r = await api("POST", "/auth/start", { email: addr }); renderCode(addr, !!r.dev); }
    catch (err) { tell(box, err.message, "err"); btn.disabled = false; }
  });
}
function renderCode(addr, dev) {
  const box = msgBox();
  const code = h("input", { id: "si-code", type: "text", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "6", pattern: "[0-9]{6}", required: true });
  const form = h("form", { class: "panel narrow", novalidate: true }, field("si-code", "6-digit code", code),
    h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Sign in"), h("button", { type: "button", class: "linkbtn", onclick: () => renderSignIn() }, "Use another email")));
  show("Enter your code",
    h("p", { class: "lead" }, `If ${addr} has access to the portal, a 6-digit code is on its way to it. The code works once, for 10 minutes.`),
    dev ? h("p", { class: "note" }, "Development server: the code is written to the server's console instead of being emailed.") : null,
    box, form);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]"); btn.disabled = true;
    try {
      const r = await api("POST", "/auth/verify", { email: addr, code: code.value.trim() });
      session = { token: r.token, me: r.me };
      store.set(session);
      if (!store.get()) { ephemeral = session; session = null; }
      renderWho();
      location.hash = isOwner() ? "#/" : "#/products";
      route();
    } catch (err) {
      tell(box, err.why === "none" ? "This address has no portal access. Ask Solia Health for an invitation." : err.message, "err");
      btn.disabled = false; code.focus();
    }
  });
}

/* ----- overview (owner) ----- */
async function renderOverview() {
  const [{ products }, { applications }] = await Promise.all([api("GET", "/products"), api("GET", "/applications")]);
  const n = (s) => products.filter((p) => p.status === s).length;
  const waiting = products.filter((p) => p.status === "pending");
  const apps = applications.filter((a) => a.status === "pending");
  show("Overview",
    h("p", { class: "lead" }, "What's live in the app, what's waiting for you, and who wants to join."),
    h("ul", { class: "stats" },
      [["Published", n("published")], ["Waiting for review", waiting.length], ["Drafts", n("draft")], ["Archived", n("archived")], ["Applications waiting", apps.length]]
        .map(([l, v]) => h("li", {}, h("b", {}, String(v)), h("span", {}, l)))),
    h("h2", {}, "Waiting for review"),
    waiting.length ? productRows(waiting, await brandMap()) : h("p", { class: "note" }, "Nothing is waiting for review."),
    h("h2", {}, "Applications"),
    apps.length ? h("p", {}, `${apps.length} waiting. `, h("a", { href: "#/applications" }, "Review applications")) : h("p", { class: "note" }, "No applications are waiting."),
    await reports.peopleCard(),
    await launch.aiCostsCard(),
    await launch.feedbackCard());
}
async function brandMap() { const { brands } = await api("GET", "/brands"); return new Map(brands.map((b) => [b.id, b])); }

/* ----- products ----- */
function productRows(list, brands) {
  return h("ul", { class: "rows" }, list.map((p) => h("li", { class: "row", "data-product": p.id },
    h("span", { class: "row-main" }, h("a", { href: `#/product/${encodeURIComponent(p.id)}` }, p.name || "(no name yet)"),
      h("span", { class: "row-sub" }, `${brands.get(p.brandId)?.name || p.brandId} · updated ${fmtTime(p.updatedAt)}`)),
    badge(p.status),
    p.published && p.status !== "published" && p.status !== "archived" ? h("span", { class: "badge live" }, "Live: the last published version") : null)));
}
let productFilter = "all";
async function renderProducts() {
  const [{ products }, brands] = await Promise.all([api("GET", "/products"), brandMap()]);
  const listBox = h("div");
  const draw = () => {
    const list = productFilter === "all" ? products : products.filter((p) => p.status === productFilter);
    listBox.replaceChildren(list.length ? productRows(list, brands) : h("p", { class: "note" }, "No products here."));
  };
  const seg = h("div", { class: "seg", role: "group", "aria-label": "Show" }, [["all", "All"], ["draft", "Drafts"], ["pending", "Waiting for review"], ["published", "Published"], ["archived", "Archived"]].map(([v, l]) =>
    h("button", { type: "button", "aria-pressed": String(productFilter === v), onclick: (e) => { productFilter = v; for (const b of seg.children) b.setAttribute("aria-pressed", String(b === e.currentTarget)); draw(); } }, l)));
  const box = msgBox();
  const newForm = brands.size ? newProductForm([...brands.values()], box) : null;
  show("Products",
    h("p", { class: "lead" }, isOwner() ? "Every product, by status. Publishing makes a version live in the app; later edits wait until you publish again." : "Your brands' products. Your edits are reviewed by Solia Health before they show in the app."),
    box,
    h("div", { class: "acts" }, newForm ? h("button", { type: "button", class: "btn primary", "aria-expanded": "false", "aria-controls": "newprod", onclick: (e) => { const open = newForm.hidden; newForm.hidden = !open; e.currentTarget.setAttribute("aria-expanded", String(open)); if (open) newForm.querySelector("select,input").focus(); } }, "New product") : null,
      h("button", { type: "button", class: "btn", onclick: () => exportCsv(box) }, "Export CSV")),
    newForm, seg, listBox);
  draw();
}
function newProductForm(brands, box) {
  const form = h("form", { class: "panel narrow", id: "newprod", hidden: true, novalidate: true },
    h("h2", {}, "New product"),
    h("p", { class: "note" }, "It starts as a draft. Nothing shows in the app until Solia Health publishes it."),
    field("np-brand", "Brand", select("np-brand", brands.map((b) => [b.id, b.name]), brands[0].id)),
    field("np-name", "Product name", textIn("np-name", "", { maxlength: "90", required: true })),
    field("np-url", "Product page (https://)", h("input", { id: "np-url", type: "url", inputmode: "url", required: true, placeholder: "https://" })),
    h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Create draft")));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const { product } = await api("POST", "/products", { brandId: form.querySelector("#np-brand").value, name: form.querySelector("#np-name").value, url: form.querySelector("#np-url").value.trim() });
      location.hash = `#/product/${encodeURIComponent(product.id)}`;
    } catch (err) { tell(box, err.message, "err"); }
  });
  return form;
}
async function exportCsv(box) {
  try {
    const r = await api("GET", "/products.csv");
    const url = URL.createObjectURL(await r.blob());
    const a = h("a", { href: url, download: "shop-products.csv", class: "sr-only" }, "download");
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    tell(box, "The CSV file is downloading.");
  } catch (err) { tell(box, err.message, "err"); }
}

/* ----- product editor ----- */
async function renderProduct(id) {
  const [{ products }, brands] = await Promise.all([api("GET", "/products"), brandMap()]);
  const p = products.find((x) => x.id === id);
  if (!p) return show("Product not found", h("p", {}, h("a", { href: "#/products" }, "Back to products")));
  const brand = brands.get(p.brandId);
  const owner = isOwner();
  const box = msgBox();
  let imageId = p.imageId;
  const form = h("form", { class: "panel", novalidate: true, id: "prodform" });
  const preview = h("div", { class: "sticky" }, h("p", { class: "preview-lab", id: "prev-lab" }, "Preview: the product card in the app"), h("div", { role: "group", "aria-labelledby": "prev-lab", id: "preview" }));
  const imgBox = h("div", { class: "imgprev" });
  const drawImg = () => imgBox.replaceChildren(...[imageId ? h("img", { src: imageUrl(imageId), alt: "The product image" }) : h("p", { class: "note" }, "No image: the app shows a calm placeholder in the brand's colour."),
    imageId ? h("button", { type: "button", class: "btn small", onclick: () => { imageId = null; drawImg(); drawPreview(); } }, "Remove image") : null].filter(Boolean));
  const file = h("input", { id: "pe-image", type: "file", accept: "image/png,image/jpeg,image/webp", "aria-describedby": "pe-image-help" });
  file.addEventListener("change", async () => {
    const f = file.files?.[0]; if (!f) return;
    if (f.size > IMAGE_MAX) { tell(box, "That image is larger than 1 MB. Choose a smaller one.", "err"); file.value = ""; return; }
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { tell(box, "Only PNG, JPEG or WebP images.", "err"); file.value = ""; return; }
    try { const { image } = await api("POST", "/images", f, { raw: true, type: f.type }); imageId = image.id; drawImg(); drawPreview(); tell(box, "Image uploaded. Save changes to keep it on this product."); }
    catch (err) { tell(box, err.message, "err"); }
    file.value = "";
  });
  const v = (k) => form.querySelector(`[name="${k}"]`)?.value ?? "";
  form.append(
    h("p", {}, badge(p.status), " ", p.published ? h("span", { class: "badge live" }, p.status === "published" ? "Live in the app" : "Live: the last published version") : h("span", { class: "note" }, " Not in the app yet")),
    field("name", "Product name", textIn("name", p.name, { maxlength: "90", required: true })),
    field("covers", "What it covers (one line)", textIn("covers", p.covers, { maxlength: "140", "aria-describedby": "covers-help" }), "Plain and factual, e.g. \"LH, the hormone that surges before ovulation\"."),
    field("description", "Description", area("description", p.description, { maxlength: "400", "aria-describedby": "description-help" }), "Shown under \"Learn more\" on the card, as from your brand. No health claims: Solia Health writes the evidence note."),
    field("availability", "Where it comes from", select("availability", Object.entries(AVAIL_LABEL), p.availability)),
    field("price", "Price (optional)", textIn("price", p.price, { maxlength: "40", "aria-describedby": "price-help" }), "Copied from your own site in a plain form: $89, From $89, About $99 a year. Leave empty for none."),
    field("url", "Product page (https://)", h("input", { id: "url", name: "url", type: "url", inputmode: "url", value: p.url || "", required: true })),
    field("affiliateUrl", "Affiliate link (https://, optional)", h("input", { id: "affiliateUrl", name: "affiliateUrl", type: "url", inputmode: "url", value: p.affiliateUrl || "", "aria-describedby": "affiliateUrl-help" }), "With one, the app labels the link \"Affiliate link\" and says Solia Health may earn a commission. Never add anything about the person to a link."),
    h("div", { class: "field" }, h("label", { for: "pe-image" }, "Product image"), h("p", { class: "help", id: "pe-image-help" }, "PNG, JPEG or WebP, at most 1 MB, that you have the right to use."), file, imgBox));
  if (owner) {
    form.append(h("div", { class: "ownerbox" },
      h("h2", {}, "Set by Solia Health"),
      checks("categories", "Needs (up to 3; the first is its main one)", CATEGORY_LABEL, p.categories),
      checks("stages", "Stages it suits", STAGE_LABEL, p.stages),
      checks("modules", "Modules it suits", MODULE_LABEL, p.modules),
      field("kind", "\"Add to what I'm trying\" files it as", select("kind", [["", "Not offered"], ...Object.entries(KIND_LABEL)], p.kind || "")),
      field("why", "Why (one plain line)", area("why", p.why, { maxlength: "240" })),
      field("evTone", "Evidence", select("evTone", [["", "No evidence note"], ...Object.entries(TONE_LABEL)], p.evidence?.tone || "")),
      field("evLabel", "Evidence label", textIn("evLabel", p.evidence?.label || "", { maxlength: "80" })),
      field("sources", "Sources (one per line)", area("sources", (p.sources || []).join("\n"), { "aria-describedby": "sources-help" }), "Named sources for the why line, at most 6."),
      field("clinicianStatus", "Clinician review", select("clinicianStatus", [["awaiting", "Awaiting review"], ["signed", "Signed: shows \"Clinician reviewed\""]], p.clinicianStatus))));
  } else {
    form.append(h("div", { class: "locked" }, h("h2", {}, "Set by Solia Health"), h("p", { class: "note" }, "These are written and reviewed by Solia Health, not by brands."),
      h("dl", {},
        h("dt", {}, "Needs"), h("dd", {}, (p.categories || []).map((c) => CATEGORY_LABEL[c]).join(", ") || "Not set yet"),
        h("dt", {}, "Why"), h("dd", {}, p.why || "Not set yet"),
        h("dt", {}, "Evidence"), h("dd", {}, p.evidence ? `${TONE_LABEL[p.evidence.tone]}: ${p.evidence.label}` : "Not set yet"),
        h("dt", {}, "Clinician review"), h("dd", {}, p.clinicianStatus === "signed" ? "Signed" : "Awaiting review"))));
  }
  const acts = h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Save changes"));
  const act = (name, label, cls = "btn") => h("button", { type: "button", class: cls, onclick: () => doAction(name) }, label);
  if (p.status === "draft") acts.append(act("submit", "Submit for review"));
  if (owner && p.status !== "archived") acts.append(act("publish", p.published && p.status === "published" ? "Publish again" : "Publish"));
  if (owner && p.published) acts.append(act("unpublish", "Unpublish"));
  if (owner && p.status !== "archived") acts.append(act("archive", "Archive", "btn danger"));
  if (owner && p.status === "archived") acts.append(act("restore", "Restore as a draft"));
  form.append(acts);

  function collect() {
    const body = { name: v("name"), covers: v("covers"), description: v("description"), availability: v("availability"), price: v("price").trim(), url: v("url").trim(), affiliateUrl: v("affiliateUrl").trim(), imageId };
    if (owner) Object.assign(body, {
      categories: checked(form, "categories"), stages: checked(form, "stages"), modules: checked(form, "modules"), kind: v("kind") || null, why: v("why"),
      evidence: v("evTone") ? { tone: v("evTone"), label: v("evLabel") } : null, sources: v("sources").split("\n").map((s) => s.trim()).filter(Boolean), clinicianStatus: v("clinicianStatus"),
    });
    return body;
  }
  function drawPreview() { document.getElementById("preview")?.replaceChildren(productCard({ ...p, ...collect() }, brand)); }
  async function save() { const { product } = await api("PATCH", `/products/${encodeURIComponent(p.id)}`, collect()); return product; }
  async function doAction(name) {
    try {
      if (name !== "restore") await save();
      if (name === "archive" && !confirm("Archive this product? It leaves the app until it's restored and published again.")) return;
      await api("POST", `/products/${encodeURIComponent(p.id)}/${name}`, {});
      await renderProduct(p.id);
      tell(document.querySelector(".msgbox"), { submit: "Sent for review. Solia Health will publish it or get back to you.", publish: "Published: this version is live in the app's catalog.", unpublish: "Unpublished: it's no longer in the app's catalog.", archive: "Archived.", restore: "Restored as a draft." }[name]);
    } catch (err) { tell(box, err.message, "err"); }
  }
  form.addEventListener("input", drawPreview);
  form.addEventListener("change", drawPreview);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try { const product = await save(); await renderProduct(product.id); tell(document.querySelector(".msgbox"), product.status === "published" ? "Saved." : product.published ? "Saved. The app keeps showing the last published version until this one is published." : "Saved."); }
    catch (err) { tell(box, err.message, "err"); }
  });
  show(p.name || "Product", h("p", {}, h("a", { href: "#/products" }, "All products"), ` · ${brand?.name || p.brandId}`), box, h("div", { class: "grid2" }, form, preview));
  drawImg(); drawPreview();
}

/** The app's product card (components/Shop.jsx ProductCard), drawn from a product and its brand. */
function productCard(p, b) {
  const hue = hueOf(b), brandName = b?.name || "";
  const aff = /^https:\/\//i.test(p.affiliateUrl || "");
  return h("article", { class: "shopcard" },
    h("div", { class: "shopimg", "data-hue": hue },
      p.imageId ? h("img", { src: imageUrl(p.imageId), alt: "" }) : h("span", { class: "shopimg-ph", "aria-hidden": "true" }, monogramOf(b)),
      h("span", { class: "shopimg-brand", "aria-hidden": "true" }, h("span", { class: "shopmono", "data-hue": hue }, monogramOf(b)), brandName)),
    h("div", { class: "shopcard-body" },
      h("p", { class: "shopmeta", "data-hue": hue }, h("span", { class: "shopavail" }, h("span", { class: "shopdot", "aria-hidden": "true" }), AVAIL_LABEL[p.availability] || ""), p.price ? h("span", { class: "shopprice" }, p.price) : null),
      h("h3", { class: "sname" }, p.name || "Product name"),
      p.covers ? h("p", { class: "shopcovers" }, p.covers) : null,
      p.why ? h("p", { class: "shopwhy" }, p.why) : null,
      h("p", { class: "shopsold" }, `Sold by ${brandName}`),
      h("p", { class: "shoppills" },
        p.evidence ? h("span", { class: `ev ev-${p.evidence.tone}` }, h("span", { class: "sr-only" }, `${TONE_LABEL[p.evidence.tone]}: `), p.evidence.label) : null,
        p.clinicianStatus === "signed" ? h("span", { class: "ppill" }, "Clinician reviewed") : null,
        aff ? h("span", { class: "ppill" }, "Affiliate link") : null),
      h("span", { class: "shopgo" }, `Visit ${brandName}`),
      aff ? h("p", { class: "rfoot" }, AFFILIATE_LINE) : null));
}

/* ----- brands ----- */
async function renderBrands() {
  const { brands } = await api("GET", "/brands");
  const box = msgBox();
  let form = null;
  if (isOwner()) {
    form = h("form", { class: "panel narrow", novalidate: true },
      h("h2", {}, "New brand"),
      field("nb-name", "Brand name", textIn("nb-name", "", { maxlength: "60", required: true })),
      field("nb-web", "Website (https://)", h("input", { id: "nb-web", type: "url", inputmode: "url", required: true, placeholder: "https://" })),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Create brand")));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try { const { brand } = await api("POST", "/brands", { name: form.querySelector("#nb-name").value, website: form.querySelector("#nb-web").value.trim() }); location.hash = `#/brand/${encodeURIComponent(brand.id)}`; }
      catch (err) { tell(box, err.message, "err"); }
    });
  }
  show("Brands", h("p", { class: "lead" }, isOwner() ? "Every brand. A brand shows in the app once one of its products is published." : "The brands you manage."), box,
    h("ul", { class: "rows" }, brands.map((b) => h("li", { class: "row", "data-brand": b.id },
      h("span", { class: "shopmono", "data-hue": hueOf(b), "aria-hidden": "true" }, monogramOf(b)),
      h("span", { class: "row-main" }, h("a", { href: `#/brand/${encodeURIComponent(b.id)}` }, b.name), h("span", { class: "row-sub" }, b.website)),
      b.changed && b.published ? h("span", { class: "badge pending" }, "Changes not published") : null,
      b.published ? null : h("span", { class: "badge draft" }, "Not in the app yet")))),
    form);
}
async function renderBrand(id) {
  const [{ brands }, { products }] = await Promise.all([api("GET", "/brands"), api("GET", "/products")]);
  const b = brands.find((x) => x.id === id);
  if (!b) return show("Brand not found", h("p", {}, h("a", { href: "#/brands" }, "Back to brands")));
  const owner = isOwner(), box = msgBox();
  let imageId = b.imageId;
  const imgBox = h("div", { class: "imgprev" });
  const drawImg = () => imgBox.replaceChildren(imageId ? h("img", { src: imageUrl(imageId), alt: "The brand image" }) : h("p", { class: "note" }, "No brand image."));
  const file = h("input", { id: "be-image", type: "file", accept: "image/png,image/jpeg,image/webp", "aria-describedby": "be-image-help" });
  file.addEventListener("change", async () => {
    const f = file.files?.[0]; if (!f) return;
    if (f.size > IMAGE_MAX) { tell(box, "That image is larger than 1 MB. Choose a smaller one.", "err"); file.value = ""; return; }
    try { const { image } = await api("POST", "/images", f, { raw: true, type: f.type }); imageId = image.id; drawImg(); tell(box, "Image uploaded. Save changes to keep it."); }
    catch (err) { tell(box, err.message, "err"); }
    file.value = "";
  });
  const form = h("form", { class: "panel", novalidate: true },
    field("b-name", "Brand name", textIn("b-name", b.name, { maxlength: "60", required: true })),
    field("b-about", "About the brand (one line)", area("b-about", b.about, { maxlength: "240" })),
    field("b-web", "Website (https://)", h("input", { id: "b-web", type: "url", inputmode: "url", value: b.website || "", required: true })),
    h("div", { class: "field" }, h("label", { for: "be-image" }, "Brand image"), h("p", { class: "help", id: "be-image-help" }, "PNG, JPEG or WebP, at most 1 MB. Kept with the brand; the app's Shop shows the brand's monogram for now."), file, imgBox),
    owner ? h("div", { class: "ownerbox" }, h("h2", {}, "Set by Solia Health"),
      field("b-mono", "Monogram (1 to 3 letters)", textIn("b-mono", b.monogram, { maxlength: "3" })),
      field("b-tag", "Type (a short tag, e.g. AT-HOME TESTS)", textIn("b-tag", b.tag, { maxlength: "30" })),
      field("b-hue", "Colour", select("b-hue", [["", "Chosen from the name"], ...HUES.map((x) => [x, x[0].toUpperCase() + x.slice(1)])], b.hue || "")),
      field("b-impact", "Impact campaign ID (optional)", textIn("b-impact", b.impactCampaignId || "", { maxlength: "40", autocomplete: "off", "aria-describedby": "b-impact-help" }), "Links this brand to its campaign in the Impact affiliate network, so the Affiliates page shows its clicks, sales and commission beside its taps. The Affiliates page lists your campaigns and their IDs. Never shown in the app.")) : null,
    h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Save changes"),
      owner ? h("button", { type: "button", class: "btn", onclick: async () => { try { await api("POST", `/brands/${encodeURIComponent(b.id)}/publish`, {}); await renderBrand(b.id); tell(document.querySelector(".msgbox"), "Brand published: the app's catalog shows these details."); } catch (err) { tell(box, err.message, "err"); } } }, "Publish brand details") : null));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = { name: form.querySelector("#b-name").value, about: form.querySelector("#b-about").value, website: form.querySelector("#b-web").value.trim(), imageId };
    if (owner) Object.assign(body, { monogram: form.querySelector("#b-mono").value, tag: form.querySelector("#b-tag").value, hue: form.querySelector("#b-hue").value || null, impactCampaignId: form.querySelector("#b-impact").value.trim() || null });
    try { await api("PATCH", `/brands/${encodeURIComponent(b.id)}`, body); await renderBrand(b.id); tell(document.querySelector(".msgbox"), b.published ? "Saved. The app keeps the published details until Solia Health publishes these." : "Saved."); }
    catch (err) { tell(box, err.message, "err"); }
  });
  let invite = null;
  if (owner) {
    invite = h("form", { class: "panel narrow", novalidate: true }, h("h2", {}, "Invite a partner to this brand"),
      field("inv-email", "Their work email", h("input", { id: "inv-email", type: "email", autocomplete: "off", required: true, "aria-describedby": "inv-email-help" }), "They sign in with a one-time code sent to this address and can edit only this brand."),
      h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Send invitation")));
    invite.addEventListener("submit", async (e) => {
      e.preventDefault();
      try { const r = await api("POST", "/invites", { email: invite.querySelector("#inv-email").value.trim(), brandIds: [b.id] }); invite.reset(); tell(box, r.emailed ? `Invited ${r.partner.email}. The invitation email is on its way.` : `Invited ${r.partner.email}. The invitation email couldn't be sent: tell them to sign in at this portal's address with that email.`); }
      catch (err) { tell(box, err.message, "err"); }
    });
  }
  show(b.name, h("p", {}, h("a", { href: "#/brands" }, "All brands"), b.published ? (b.changed ? " · changes not published yet" : " · published") : " · not in the app yet"), box, form, invite,
    h("h2", {}, "Products"), (() => { const list = products.filter((p) => p.brandId === b.id); return list.length ? productRows(list, new Map([[b.id, b]])) : h("p", { class: "note" }, "No products yet."); })());
  drawImg();
}

/* ----- partners (owner) ----- */
async function renderPartners() {
  const [{ owners, partners }, brands] = await Promise.all([api("GET", "/partners"), brandMap()]);
  const box = msgBox();
  const form = h("form", { class: "panel", novalidate: true }, h("h2", {}, "Invite a partner"),
    field("ip-email", "Their work email", h("input", { id: "ip-email", type: "email", autocomplete: "off", required: true })),
    checks("ip-brands", "Brands they can edit", Object.fromEntries([...brands.values()].map((b) => [b.id, b.name]))),
    h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Send invitation")));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try { const r = await api("POST", "/invites", { email: form.querySelector("#ip-email").value.trim(), brandIds: checked(form, "ip-brands") }); await renderPartners(); tell(document.querySelector(".msgbox"), r.emailed ? `Invited ${r.partner.email}. The invitation email is on its way.` : `Invited ${r.partner.email}. The invitation email couldn't be sent: tell them to sign in at this portal's address with that email.`); }
    catch (err) { tell(box, err.message, "err"); }
  });
  show("Partners", h("p", { class: "lead" }, "People at partner companies, and the brands each one can edit."), box,
    h("h2", {}, "Owners"), h("p", { class: "note" }, "Owners are the addresses in ADMIN_EMAILS on the server; change them there."),
    h("ul", { class: "rows" }, owners.map((o) => h("li", { class: "row" }, h("span", { class: "row-main" }, h("b", {}, o))))),
    h("h2", {}, "Partners"),
    partners.length ? h("ul", { class: "rows" }, partners.map((p) => h("li", { class: "row", "data-partner": p.email },
      h("span", { class: "row-main" }, h("b", {}, p.email), h("span", { class: "row-sub" }, `${p.brandIds.map((x) => brands.get(x)?.name || x).join(", ")}${p.lastSignInAt ? ` · last signed in ${fmtTime(p.lastSignInAt)}` : ""}`)),
      h("span", { class: `badge ${p.status}` }, p.status === "active" ? "Active" : "Invited"),
      h("button", { type: "button", class: "btn small danger", "aria-label": `Remove ${p.email}`, onclick: async () => { if (!confirm(`Remove ${p.email}? They're signed out at once and can no longer edit.`)) return; try { await api("DELETE", `/partners/${encodeURIComponent(p.email)}`); await renderPartners(); tell(document.querySelector(".msgbox"), `Removed ${p.email}.`); } catch (err) { tell(box, err.message, "err"); } } }, "Remove")))) : h("p", { class: "note" }, "No partners yet."),
    form);
}

/* ----- applications (owner) ----- */
async function renderApplications() {
  const { applications } = await api("GET", "/applications");
  const box = msgBox();
  const sorted = [...applications.filter((a) => a.status === "pending"), ...applications.filter((a) => a.status !== "pending")];
  show("Applications", h("p", { class: "lead" }, "Companies that asked to join the Shop. Approving creates the brand and invites the contact; nothing is published until you publish a product."), box,
    sorted.length ? h("ul", { class: "rows" }, sorted.map((a) => {
      const nameId = `app-${a.id}-brand`;
      return h("li", { class: "row", "data-application": a.id },
        h("span", { class: "row-main" }, h("b", {}, a.company),
          h("span", { class: "row-sub" }, `${a.email} · ${CATEGORY_LABEL[a.category] || a.category} · ${fmtTime(a.at)}`),
          h("span", { class: "row-sub" }, h("a", { href: a.website, target: "_blank", rel: "noopener noreferrer" }, a.website)),
          a.note ? h("span", { class: "row-sub" }, a.note) : null),
        h("span", { class: `badge ${a.status}` }, a.status === "pending" ? "Waiting" : a.status === "approved" ? "Approved" : "Declined"),
        a.status === "pending" ? h("div", { class: "acts" },
          h("label", { for: nameId, class: "sr-only" }, `Brand name for ${a.company}`), h("input", { id: nameId, type: "text", value: a.company, maxlength: "60" }),
          h("button", { type: "button", class: "btn small primary", onclick: async () => { try { const r = await api("POST", `/applications/${encodeURIComponent(a.id)}/approve`, { brandName: document.getElementById(nameId).value }); await renderApplications(); tell(document.querySelector(".msgbox"), `Approved: ${r.brand.name} was created and ${r.partner.email} was invited.`); } catch (err) { tell(box, err.message, "err"); } } }, `Approve ${a.company}`),
          h("button", { type: "button", class: "btn small", onclick: async () => { try { await api("POST", `/applications/${encodeURIComponent(a.id)}/reject`, {}); await renderApplications(); tell(document.querySelector(".msgbox"), `Declined ${a.company}.`); } catch (err) { tell(box, err.message, "err"); } } }, `Decline ${a.company}`)) : null);
    })) : h("p", { class: "note" }, "No applications yet."));
}

/* ----- activity (owner) ----- */
async function renderActivity() {
  const { audit } = await api("GET", "/audit?limit=300");
  show("Activity", h("p", { class: "lead" }, "Every change in the portal: who, what and when. Newest first."),
    h("ul", { class: "rows audit" }, audit.map((a) => h("li", { class: "row" },
      h("time", { datetime: a.at }, fmtTime(a.at)),
      h("span", { class: "row-main" }, h("b", {}, a.by), ` ${a.action} `, h("code", {}, a.target),
        Object.keys(a.fields || {}).length ? h("span", { class: "row-sub" }, Object.entries(a.fields).map(([k, v]) => `${k}: ${v}`).join(" · ")) : null)))));
}

/* ----- apply (public) ----- */
function renderApply() {
  document.getElementById("nav").hidden = true;
  const box = msgBox();
  const form = h("form", { class: "panel narrow", novalidate: true },
    field("ap-company", "Company", textIn("ap-company", "", { maxlength: "100", required: true, autocomplete: "organization" })),
    field("ap-email", "Contact email", h("input", { id: "ap-email", type: "email", required: true, autocomplete: "email", "aria-describedby": "ap-email-help" }), "If you're approved, this address is invited to this portal."),
    field("ap-category", "Category", select("ap-category", Object.entries(CATEGORY_LABEL), "fertility")),
    field("ap-web", "Website (https://)", h("input", { id: "ap-web", type: "url", inputmode: "url", required: true, placeholder: "https://", autocomplete: "url" })),
    field("ap-note", "Anything else (optional)", area("ap-note", "", { maxlength: "600" })),
    h("div", { class: "honey", "aria-hidden": "true" }, h("label", { for: "ap-nick" }, "Leave this empty"), h("input", { id: "ap-nick", name: "nickname", type: "text", tabindex: "-1", autocomplete: "off" })),
    h("div", { class: "acts" }, h("button", { type: "submit", class: "btn primary" }, "Send application")));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = (s) => form.querySelector(s).value;
    try {
      await api("POST", "/apply", { company: q("#ap-company"), email: q("#ap-email").trim(), category: q("#ap-category"), website: q("#ap-web").trim(), note: q("#ap-note"), nickname: q("#ap-nick") });
      show("Thanks: your application was received", h("p", { class: "lead" }, `Solia Health reviews each one. If it's approved, ${q("#ap-email").trim()} is invited to this portal.`), h("p", {}, h("a", { href: "/portal/" }, "Partner sign-in")));
    } catch (err) { tell(box, err.message, "err"); }
  });
  show("Apply to partner with Solia Health",
    h("p", { class: "lead" }, "Solia Health's Shop lists real products and services by need, with an honest note on the evidence written by Solia Health. Tell us about your company."),
    box, form, h("p", { class: "note" }, "Already a partner? ", h("a", { href: "/portal/" }, "Sign in"), "."));
}

/* ----- subscriptions, promotions, Pro grants and codes (subs.js) ----- */
const subs = subsViews({ h, api, show, field, textIn, area, select, checks, checked, msgBox, tell, fmtTime, isOwner, brandList: async () => [...(await brandMap()).values()] });

/* ----- clicks, people, affiliates and the weekly report (reports.js) ----- */
const reports = reportViews({ h, api, show, field, textIn, area, select, msgBox, tell, fmtTime, isOwner, brandList: async () => [...(await brandMap()).values()] });

/* ----- readiness, AI costs and feedback (launch.js) ----- */
const launch = launchViews({ h, api, show, field, textIn, area, select, msgBox, tell, fmtTime, isOwner, table: reports.table, td: reports.td, num: reports.num, download: reports.download });

/* ---------- router ---------- */
async function route() {
  if (/\/apply\/?$/.test(location.pathname)) return renderApply();
  if (!me()) return renderSignIn();
  markNav();
  const hash = location.hash || "#/";
  const m = /^#\/(product|brand)\/(.+)$/.exec(hash);
  try {
    if (m) return await (m[1] === "product" ? renderProduct(decodeURIComponent(m[2])) : renderBrand(decodeURIComponent(m[2])));
    if (hash === "#/brands") return await renderBrands();
    if (hash === "#/codes") return await subs.renderCodes();
    if (hash === "#/clicks") return await reports.renderClicks();
    if (isOwner() && hash === "#/subscriptions") return await subs.renderSubscriptions();
    if (isOwner() && hash === "#/promotions") return await subs.renderPromotions();
    if (isOwner() && hash.startsWith("#/promotion/")) return await subs.renderPromotion(decodeURIComponent(hash.slice("#/promotion/".length)));
    if (isOwner() && hash === "#/grants") return await subs.renderGrants();
    if (isOwner() && hash === "#/readiness") return await launch.renderReadiness();
    if (isOwner() && hash === "#/feedback") return await launch.renderFeedback();
    if (isOwner() && hash === "#/ai-costs") return await launch.renderAiCosts();
    if (isOwner() && hash === "#/people") return await reports.renderPeople();
    if (isOwner() && hash === "#/affiliates") return await reports.renderAffiliates();
    if (isOwner() && hash === "#/weekly") return await reports.renderWeekly();
    if (isOwner() && hash === "#/partners") return await renderPartners();
    if (isOwner() && hash === "#/applications") return await renderApplications();
    if (isOwner() && hash === "#/activity") return await renderActivity();
    if (isOwner() && (hash === "#/" || hash === "#")) return await renderOverview();
    return await renderProducts();
  } catch (err) {
    if (me()) show("Something went wrong", h("p", { class: "err", role: "alert" }, err.message));
  }
}
window.addEventListener("hashchange", route);
renderWho();
route();
