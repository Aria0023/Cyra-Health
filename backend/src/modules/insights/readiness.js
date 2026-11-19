// Launch readiness for the portal's owners (docs/plans/launch-tools.md Task 1). OWNER ONLY.
// One row per thing the server depends on, each Ready / Not set up / Problem, a plain sentence on what it is for, and
// the NAMES of the variables to set in Render when it is not ready.
//
//   GET  /api/insights/readiness                 the rows, the summary, the mounted modules, the app's side
//   POST /api/insights/readiness/test-email      sends one test email to the signed-in owner (the existing Resend sender)
//   POST /api/insights/readiness/storage-check   writes a temp file in the data directory, reads it back, deletes it
//
// Secrets: this file only ever asks WHETHER a variable is set and whether its shape is plausible. A value is never put
// in an answer, a log line or an error, not even partly: rows carry variable names and fixed sentences only
// (backend/test/insights-readiness.test.mjs sets recognisable values and checks none appears in any answer).
// No outbound calls: GET reads the environment and the store. The two POSTs are the only live checks, each started by
// an owner's button; nothing here calls Anthropic, RevenueCat, Impact, Oura or a sign-in provider.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { PRODUCTION_MODULES, DEMO_VALUES, secretProblem } from "../../core/registry.js";
import { isEmail, normEmail } from "../accounts/index.js";

export const STATUS = Object.freeze({ ready: "ready", off: "not-set-up", problem: "problem" });
const EMAIL_IN = /[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/;

/** What the static site is built with (public, build-time, set on the STATIC SITE in Render, not on this server). */
export const APP_SIDE = Object.freeze([
  { name: "VITE_API_BASE", required: true, line: "This server's address. Without it the app makes no server calls at all: no sign-in, no AI, no live Shop, no feedback." },
  { name: "VITE_TERMS_URL", required: true, line: "The published Terms of Use, linked from the consent step. Set before any public release." },
  { name: "VITE_PRIVACY_URL", required: true, line: "The published Privacy Policy, linked from the consent step. Set before any public release." },
  { name: "VITE_REVENUECAT_IOS_KEY", required: false, line: "RevenueCat's PUBLIC App Store key (starts appl_), for Pro on iPhone. Never the secret key." },
  { name: "VITE_REVENUECAT_ANDROID_KEY", required: false, line: "RevenueCat's PUBLIC Google Play key (starts goog_), for Pro on Android." },
  { name: "VITE_APP_STORE_URL", required: false, line: "The app's App Store page, for the web's \"Get Solia Health Pro in the app\" button." },
  { name: "VITE_PLAY_STORE_URL", required: false, line: "The app's Google Play page, for the same button." },
  { name: "VITE_APP_STORE_ID", required: false, line: "The app's numeric Apple id, for \"Have a code?\" on iPhone." },
  { name: "VITE_SUPPORT_EMAIL", required: false, line: "The support address shown in You → Help. Unset = no support link." },
  { name: "VITE_FEATURES", required: false, line: "Which optional features the build offers. Unset = the shipping defaults." },
  { name: "VITE_REQUIRE_SIGNIN", required: false, line: "\"true\" (default) requires sign-in where the server offers one; \"false\" offers it with a skip." },
  { name: "VITE_GUEST_HOURS", required: false, line: "Hours of \"Try it first\" before sign-in is asked. Unset = 48." },
  { name: "VITE_TIP_URL", required: false, line: "Web only: an https tip page. Unset = no tip link." },
]);

/**
 * The rows. Pure: everything it reads is passed in, and it returns names and fixed sentences only.
 *   env        the environment (values are only tested, never copied)
 *   config     { production, modules }
 *   rc, impact { configured, missing } from the existing clients
 *   storage    { dirSet, writable, before: true | false | null (unknown) }
 *   extra      more rows from other parts (the AI budget)
 */
export function readinessRows({ env = {}, config = {}, rc = null, impact = null, storage = {}, extra = [] } = {}) {
  const get = (k) => String(env[k] || "").trim();
  const vars = (names) => names.map((name) => ({ name, set: !!get(name) }));
  const group = (names) => { const n = names.filter((k) => get(k)).length; return n === names.length ? STATUS.ready : n === 0 ? STATUS.off : STATUS.problem; };
  const partial = (names) => `Set, but not complete: ${names.filter((k) => !get(k)).join(", ")} ${names.filter((k) => !get(k)).length === 1 ? "is" : "are"} missing.`;
  const rows = [];
  const add = (r) => rows.push({ detail: "", required: false, ...r });

  // the two start-up secrets: production refuses to start without real ones, development falls back to demo values
  for (const [id, name, label, what] of [
    ["auth-secret", "AUTH_SECRET", "Sign-in secret", "Signs the app's and the portal's session tokens and seals sign-in redirects. Changing it signs everyone out."],
    ["admin-key", "ADMIN_KEY", "Admin key", "Guards the server's admin-only maintenance routes."]]) {
    const v = get(name), why = secretProblem(name, v, [...DEMO_VALUES]);
    add({ id, label, what, required: true, vars: vars([name]), status: !v ? STATUS.off : why ? STATUS.problem : STATUS.ready,
      detail: !v ? (config.production ? "" : "Not set: this development server is using a demo value. A production server refuses to start without a real one.") : why ? `${why}.` : "" });
  }
  if (get("ADMIN_KEY") && get("ADMIN_KEY") === get("AUTH_SECRET")) { const r = rows.find((x) => x.id === "admin-key"); r.status = STATUS.problem; r.detail = "ADMIN_KEY and AUTH_SECRET must be different values."; }

  const rawOwners = get("ADMIN_EMAILS").split(",").map((s) => s.trim()).filter(Boolean), okOwners = rawOwners.filter((e) => isEmail(normEmail(e)));
  add({ id: "owners", label: "Owners", what: "The addresses that can sign in to this portal as an owner, and who gets the weekly report.", required: true, vars: vars(["ADMIN_EMAILS"]),
    status: !rawOwners.length ? STATUS.off : okOwners.length < rawOwners.length ? STATUS.problem : STATUS.ready,
    detail: !rawOwners.length ? "" : okOwners.length < rawOwners.length ? `${rawOwners.length - okOwners.length} of ${rawOwners.length} entries ${rawOwners.length - okOwners.length === 1 ? "isn't a valid email address and is" : "aren't valid email addresses and are"} ignored.` : `${okOwners.length} ${okOwners.length === 1 ? "owner" : "owners"}.` });

  const mailNames = ["RESEND_API_KEY", "EMAIL_FROM"], mailSt = group(mailNames), fromOk = !get("EMAIL_FROM") || EMAIL_IN.test(get("EMAIL_FROM"));
  add({ id: "email", label: "Email", what: "Sends sign-in codes to the app's users and to this portal, the weekly report and the AI budget alerts, through Resend.", required: true, vars: vars(mailNames),
    status: mailSt === STATUS.ready && !fromOk ? STATUS.problem : mailSt,
    detail: mailSt === STATUS.problem ? partial(mailNames) : !fromOk ? "EMAIL_FROM doesn't hold an email address. It should look like: Solia Health <signin@yourdomain>." : mailSt === STATUS.off && !config.production ? "Not set: this development server writes each code to its console instead of emailing it." : mailSt === STATUS.ready ? "Shape only: \"Send me a test email\" below checks that Resend accepts it." : "" });

  const appleNames = ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"], appleSt = group(appleNames), p8 = !get("APPLE_PRIVATE_KEY") || /BEGIN [A-Z ]*PRIVATE KEY/.test(get("APPLE_PRIVATE_KEY"));
  add({ id: "signin-apple", label: "Sign in with Apple", what: "\"Continue with Apple\", first in the app's sign-in list. The App Store requires it when other sign-ins are offered.", required: true, vars: vars(appleNames),
    status: appleSt === STATUS.ready && !p8 ? STATUS.problem : appleSt,
    detail: appleSt === STATUS.problem ? partial(appleNames) : !p8 ? "APPLE_PRIVATE_KEY doesn't look like the contents of a .p8 key file (it should start with -----BEGIN PRIVATE KEY-----)." : "" });
  for (const [id, label, names] of [["signin-google", "Sign in with Google", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]], ["signin-facebook", "Sign in with Facebook", ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"]]]) {
    const st = group(names);
    add({ id, label, what: `"Continue with ${label.split(" ").pop()}" in the app. Without it the app offers the other sign-ins.`, vars: vars(names), status: st, detail: st === STATUS.problem ? partial(names) : "" });
  }

  add({ id: "ai", label: "AI", what: "Ask Solia Health's AI, Ask with evidence, the Pro weekly write-up and chat, and the summary on the weekly report. Without it the app says AI isn't set up.", required: true, vars: vars(["ANTHROPIC_API_KEY"]),
    status: get("ANTHROPIC_API_KEY") ? STATUS.ready : STATUS.off, detail: get("ANTHROPIC_API_KEY") ? "Presence only: nothing is sent to Anthropic to check it. A wrong key shows as \"bad API key\" in the server log on the first question." : "" });

  const rcNames = ["REVENUECAT_SECRET_KEY", "REVENUECAT_PROJECT_ID"], rcSt = group(rcNames), rcKeyOk = !get("REVENUECAT_SECRET_KEY") || get("REVENUECAT_SECRET_KEY").startsWith("sk_");
  add({ id: "subscriptions", label: "Subscriptions", what: "The portal's Subscriptions numbers and free Pro grants, read from RevenueCat. Purchases in the app use the public VITE_REVENUECAT_* keys instead.", vars: vars(rcNames),
    status: rcSt === STATUS.ready && (!rcKeyOk || (rc && !rc.configured)) ? STATUS.problem : rcSt,
    detail: rcSt === STATUS.problem ? partial(rcNames) : !rcKeyOk ? "REVENUECAT_SECRET_KEY should be a secret key (it starts sk_); a public SDK key can't read these numbers." : rcSt === STATUS.ready && rc && !rc.configured ? "REVENUECAT_PROJECT_ID or REVENUECAT_ENTITLEMENT isn't in the expected form." : "" });

  const imNames = ["IMPACT_ACCOUNT_SID", "IMPACT_AUTH_TOKEN"], imSt = group(imNames);
  add({ id: "impact", label: "Impact", what: "Clicks, sales and commission on the portal's Affiliates page.", vars: vars(imNames),
    status: imSt === STATUS.ready && impact && !impact.configured ? STATUS.problem : imSt,
    detail: imSt === STATUS.problem ? partial(imNames) : imSt === STATUS.ready && impact && !impact.configured ? "IMPACT_ACCOUNT_SID or IMPACT_REPORT_ID isn't in the expected form." : "" });

  const ouraNames = ["OURA_CLIENT_ID", "OURA_CLIENT_SECRET"], ouraSt = group(ouraNames);
  add({ id: "oura", label: "Oura", what: "Connecting an Oura ring in the app. Without it the app shows Oura as \"Not set up yet\".", vars: vars(ouraNames), status: ouraSt, detail: ouraSt === STATUS.problem ? partial(ouraNames) : "" });

  const st = storage || {};
  add({ id: "storage", label: "Storage", what: "Where accounts, the portal's catalog, the totals and the report stamps are kept. Without a persistent disk every deploy starts empty.", required: true, vars: vars(["DATA_DIR"]),
    status: st.writable === false ? STATUS.problem : !st.dirSet ? STATUS.off : st.before === true ? STATUS.ready : STATUS.off,
    detail: st.writable === false ? "The data directory can't be written to."
      : !st.dirSet ? `DATA_DIR isn't set, so data is kept in the server's own folder, which Render wipes on every deploy and restart.${st.before === true ? " (Data from before this server start is still here, as on a development machine.)" : ""}`
        : st.before === true ? "DATA_DIR is set and writable, and data written before this server start is still there."
          : "Not confirmed yet: DATA_DIR is set and writable, but nothing written before this server start was found. Either this is the first start with this folder, or it isn't a persistent disk. Look again after the next deploy." });

  const mounted = Array.isArray(config.modules) ? config.modules : [], missing = PRODUCTION_MODULES.filter((m) => !mounted.includes(m));
  add({ id: "modules", label: "Modules", what: "The parts of the server the shipped app and this portal call.", required: true, vars: [],
    status: missing.length ? STATUS.problem : STATUS.ready,
    detail: missing.length ? `Not mounted: ${missing.join(", ")}. List ${missing.length === 1 ? "it" : "them"} under "modules" in backend/config/app.json.` : `All ${PRODUCTION_MODULES.length} production modules are mounted${config.production ? "" : " (a development server mounts more)"}.` });

  for (const r of extra || []) if (r && r.id) add(r);
  return rows;
}

/** "N of M ready. Needed for launch: ..." from the rows. */
export function readinessSummary(rows) {
  const ready = rows.filter((r) => r.status === STATUS.ready).length;
  const needed = rows.filter((r) => r.required && r.status !== STATUS.ready).map((r) => r.label);
  return { ready, total: rows.length, needed, line: `${ready} of ${rows.length} ready. ${needed.length ? `Needed for launch: ${needed.join(", ")}.` : "Nothing needed for launch is missing."}` };
}

/** Writes a temp file in the data directory, reads it back and deletes it. → { ok, wrote, read, deleted, error }. Never throws. */
export async function storageRoundTrip(store) {
  const out = { ok: false, wrote: false, read: false, deleted: false, error: null };
  const token = crypto.randomBytes(12).toString("hex");
  try {
    if (store?.dir) {
      const file = path.join(store.dir, `.readiness-check-${token}.tmp`);
      fs.writeFileSync(file, token); out.wrote = true;
      out.read = fs.readFileSync(file, "utf8") === token;
      fs.unlinkSync(file); out.deleted = !fs.existsSync(file);
    } else {
      await store.insert("readiness_check", { id: token }); out.wrote = true;
      out.read = !!(await store.findOne("readiness_check", (r) => r.id === token));
      out.deleted = (await store.remove("readiness_check", (r) => r.id === token)) === 1;
    }
    out.ok = out.wrote && out.read && out.deleted;
    if (!out.ok) out.error = !out.read ? "what was read back didn't match what was written" : "the temp file couldn't be deleted";
  } catch (e) { out.error = `the data directory couldn't be ${out.wrote ? "read or cleaned up" : "written to"} (${String(e?.code || "error").slice(0, 20)})`; }
  return out;
}

export function mountReadiness(router, { ctx, store, clock, reading, sending, owner, rc, impact, mailer, production, env = process.env, extraRows = null }) {
  const { audit } = ctx.portal;
  const now = () => new Date(clock()).toISOString();
  const startedAt = now();
  // Is data from before this start still here? One small row, read once at mount and then rewritten: found = the store
  // outlived a restart (a persistent disk, or a development machine); not found = first start here, or an ephemeral disk.
  const boot = (async () => {
    try {
      const row = await store.findOne("server_starts", (r) => r.key === "starts");
      await store.apply("server_starts", (rows) => { const r = rows.find((x) => x.key === "starts"); if (r) Object.assign(r, { lastAt: startedAt, count: (Number(r.count) || 0) + 1 }); else rows.push({ key: "starts", firstAt: startedAt, lastAt: startedAt, count: 1 }); });
      return { before: !!row, firstAt: row?.firstAt || null, writable: true };
    } catch { return { before: null, firstAt: null, writable: false }; }
  })();
  ctx.readinessBoot = boot; // tests

  async function view() {
    const b = await boot;
    const rows = readinessRows({ env, config: ctx.config, rc, impact, storage: { dirSet: !!String(env.DATA_DIR || "").trim(), writable: b.writable, before: b.before }, extra: extraRows ? await extraRows() : [] });
    return {
      asOf: now(), production: !!production, startedAt, summary: readinessSummary(rows), rows,
      modules: { mounted: [...(ctx.config.modules || [])], production: [...PRODUCTION_MODULES] },
      storage: { firstWrittenAt: b.firstAt },
      email: mailer ? "ready" : production ? "not set up" : "development",
      app: { lastSeenAt: typeof ctx.appLastSeen === "function" ? ctx.appLastSeen() : null, tracked: typeof ctx.appLastSeen === "function", vars: APP_SIDE },
    };
  }
  router.get("/readiness", reading, owner, async (req, res) => { res.set("cache-control", "no-store"); res.json(await view()); });

  router.post("/readiness/test-email", sending, owner, async (req, res) => {
    res.set("cache-control", "no-store");
    const to = req.portal.email;
    if (!mailer) {
      if (production) return res.status(503).json({ error: "email isn't set up on this server: set RESEND_API_KEY and EMAIL_FROM" });
      console.log("[cyra] insights (development, RESEND_API_KEY not set): the readiness test email was not sent");
      return res.json({ sent: false, dev: true });
    }
    try {
      await mailer.send(to, "Solia Health: test email from the portal", `This is the test email you asked for on the Solia Health partner portal's Readiness page, at ${now()} (UTC).\n\nIf you are reading it, RESEND_API_KEY and EMAIL_FROM work: sign-in codes, the weekly report and the AI budget alerts can be delivered.\n\nNothing else was sent, and you don't need to do anything.`);
    } catch (e) {
      const cat = String(e?.cat || "the email provider could not be reached").slice(0, 80);
      console.warn(`[cyra] insights: readiness test email not sent (${cat})`);
      await audit(req.portal.email, "readiness test email", "readiness:email", { sent: false });
      return res.status(502).json({ error: `the test email was not sent: ${cat}` });
    }
    await audit(req.portal.email, "readiness test email", "readiness:email", { sent: true });
    res.json({ sent: true });
  });

  router.post("/readiness/storage-check", sending, owner, async (req, res) => {
    res.set("cache-control", "no-store");
    const r = await storageRoundTrip(store);
    await audit(req.portal.email, "readiness storage check", "readiness:storage", { ok: r.ok });
    res.json({ ...r, at: now(), dirSet: !!String(env.DATA_DIR || "").trim(), before: (await boot).before });
  });

  return { view };
}
