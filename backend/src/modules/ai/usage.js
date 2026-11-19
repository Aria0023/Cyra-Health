// Monthly AI allowance (owner decision 2026-11-15): each person gets at most `limits[kind]` answers per calendar month
// (UTC), so one heavy user can't cost more than a subscription brings in. Defaults: 30 "Ask with evidence" questions,
// 100 chat messages, 6 weekly write-ups and 60 meal photos a month; config.ai.monthly overrides any of them.
//
// Who is counted:
//   - signed in (a valid Solia Health session token in Authorization: Bearer, checked by the accounts module): her
//     account id. Stored: one row per account per month in the "ai_usage" collection, { id: "<account>:<YYYY-MM>",
//     evidence, chat, weekly, meal } — counts only, never a question, an answer, a photo or anything she logged.
//     Deleted with the account.
//   - not signed in, on a server where sign-in is set up: refused with 401 "sign-in-required" (Pro AI needs an account).
//   - not signed in, on a server with no sign-in at all (demo), or with config.ai.signinRequired false (the smoke
//     tests only): counted in memory only, by the request
//     address hashed with a random salt that changes every month; nothing is written to disk and a restart clears it.
// Only a delivered answer counts: a refusal, an error, a safety answer or a request over the limit does not.
import crypto from "crypto";

export const DEFAULT_MONTHLY = Object.freeze({ evidence: 30, chat: 100, weekly: 6, meal: 60 });

export const monthOf = (ms) => new Date(ms).toISOString().slice(0, 7);
/** The first day of the next UTC month, YYYY-MM-DD. */
export function resetsOn(ms) {
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

export function limitsFrom(cfg = {}) {
  const out = { ...DEFAULT_MONTHLY };
  for (const k of Object.keys(out)) {
    const v = Number(cfg?.[k]);
    if (Number.isInteger(v) && v >= 0 && v <= 100_000) out[k] = v;
  }
  return out;
}

/**
 * meter.check(req, kind) → { ok: true, usage, commit() } | { ok: false, status, body }.
 * commit() adds one to the count after an answer was delivered and returns the new usage.
 * meter.usage(req) → { ok: true, usage: { evidence: {used, limit}, ... }, resetsOn } | { ok: false, status, body }.
 */
export function usageMeter({ store, who = null, signinReady = () => false, requireSignin = true, limits = DEFAULT_MONTHLY, clock = Date.now } = {}) {
  let salt = crypto.randomBytes(16), saltMonth = monthOf(clock());
  const guests = new Map(); // sha256(salt + address) → { evidence, chat, weekly }
  const guestKey = (ip) => {
    const m = monthOf(clock());
    if (m !== saltMonth) { salt = crypto.randomBytes(16); saltMonth = m; guests.clear(); }
    return crypto.createHash("sha256").update(salt).update(String(ip || "anon")).digest("base64url");
  };

  async function identify(req) {
    const w = who ? await who(req) : null;
    if (w) return { kind: "account", id: `${w.acct.id}:${monthOf(clock())}` };
    if (who && requireSignin && signinReady()) return null;
    return { kind: "guest", id: guestKey(req.ip) };
  }
  async function countsFor(ident) {
    if (ident.kind === "guest") return guests.get(ident.id) || {};
    return (await store.findOne("ai_usage", (r) => r.id === ident.id)) || {};
  }
  const view = (counts) => Object.fromEntries(Object.keys(limits).map((k) => [k, { used: Number(counts[k]) || 0, limit: limits[k] }]));
  const signInRequired = { ok: false, status: 401, body: { error: "sign-in-required" } };

  return {
    limits,
    async check(req, kind) {
      const ident = await identify(req);
      if (!ident) return signInRequired;
      const counts = await countsFor(ident);
      const used = Number(counts[kind]) || 0, limit = limits[kind];
      const reset = resetsOn(clock());
      if (used >= limit) return { ok: false, status: 429, body: { error: "monthly-limit", kind, used, limit, resetsOn: reset } };
      return {
        ok: true,
        async commit() {
          const now = await countsFor(ident);
          const next = (Number(now[kind]) || 0) + 1;
          if (ident.kind === "guest") guests.set(ident.id, { ...now, [kind]: next });
          else if (now.id) await store.update("ai_usage", (r) => r.id === ident.id, { [kind]: next });
          else await store.insert("ai_usage", { id: ident.id, [kind]: next });
          return { kind, used: next, limit, resetsOn: reset };
        },
      };
    },
    async usage(req) {
      const ident = await identify(req);
      if (!ident) return signInRequired;
      return { ok: true, usage: view(await countsFor(ident)), resetsOn: resetsOn(clock()) };
    },
  };
}
