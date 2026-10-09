// Social sign-in: real authorization-code OAuth for Apple, Google and Facebook. It only
// fills in the registration form on the device — Cyra has no accounts.
//
//   GET  /api/oauth/providers                   which providers are configured
//   GET  /api/oauth/:provider/start?return=URL[&app_challenge=C]  → 302 to the provider
//   GET|POST /api/oauth/:provider/callback      provider → here → 302 return#oauth=<code>
//   POST /api/oauth/exchange {code[, verifier]} → { provider, email, emailVerified, name } once
//
// What the server receives from the provider: Google and Apple send a signed id_token
// (account id, name, email and whether the provider verified it); Facebook is asked
// for fields=name,email (its answer always includes the account id). What goes on to
// the device: only {provider, email, emailVerified, name}. The email is passed on only
// when the provider says it is verified (Google/Apple email_verified); Facebook gives
// no such signal, so its email is never passed on. Account ids, access tokens and every
// other claim are dropped as soon as the callback has read them. A failed sign-in logs
// only the provider and a fixed category, never text the provider sent.
// What it keeps: no account record. The identity waits in memory under a one-time code
// until the device collects it, and a timer deletes it 5 minutes after the callback
// whether or not anyone collects it (plus a sweep every 30 seconds as a backstop).
// Health data never comes near this module.
//
// Security: sealed, expiring state (AES-256-GCM, key derived from AUTH_SECRET — see
// state.js) that carries the nonce, the PKCE verifier, the return URL and the app
// challenge, so no one can read the verifier or change any of them in transit (the
// nonce is also sent to the provider, as OpenID Connect requires, and the return URL
// and app challenge are also in the /start request's own query, so request logs can
// record them; none of the three is a secret: the app challenge is useless without the
// app's own verifier, which stays on the device until its /exchange call. The PKCE
// verifier is a different value: it lives only inside the sealed state and is sent only
// server-to-server, to the provider's token endpoint); PKCE S256 for Google and
// Facebook; id_token signature + iss/aud/exp/nonce checks for Google and Apple; Facebook
// appsecret_proof; return URLs limited to the RETURN_ORIGINS / CORS_ORIGIN allowlist,
// or to exactly <scheme>://auth/oauth[?a=<attempt>] for the iOS/Android app
// (APP_RETURN_SCHEMES, default "cyrahealth"; lowercase, no '#') — which must bind an
// app_challenge whose verifier the exchange then demands, so another app that claims
// the scheme can't redeem the code; and a web code is never redeemed with a verifier
// (see returns.js).
import crypto from "crypto";
import { verifyIdToken, appleClientSecret, pkceVerifier, pkceChallenge } from "./jwt.js";
import { checkReturn, startChallenge, codeRedeemable } from "./returns.js";
import { stateKey, sealState, openState } from "./state.js";
import { expiringMap } from "../../core/memory.js";

export const basePath = "/api/oauth";

const env = (k) => (process.env[k] || "").trim();
const form = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null)).toString();
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function providers() {
  const mock = env("OAUTH_MOCK_BASE"); // test-only: points every endpoint at a local mock provider
  const P = {
    apple: {
      label: "Apple", clientId: env("APPLE_CLIENT_ID"), teamId: env("APPLE_TEAM_ID"), keyId: env("APPLE_KEY_ID"), privateKey: env("APPLE_PRIVATE_KEY"),
      authorize: "https://appleid.apple.com/auth/authorize", token: "https://appleid.apple.com/auth/token", jwks: "https://appleid.apple.com/auth/keys", issuer: "https://appleid.apple.com",
      scope: "name email", responseMode: "form_post", pkce: false, idToken: true,
      configured() { return !!(this.clientId && this.teamId && this.keyId && this.privateKey); },
      secret() { return appleClientSecret(this); },
    },
    google: {
      label: "Google", clientId: env("GOOGLE_CLIENT_ID"), clientSecret: env("GOOGLE_CLIENT_SECRET"),
      authorize: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token", jwks: "https://www.googleapis.com/oauth2/v3/certs", issuer: ["https://accounts.google.com", "accounts.google.com"],
      scope: "openid email profile", pkce: true, idToken: true,
      configured() { return !!(this.clientId && this.clientSecret); },
      secret() { return this.clientSecret; },
    },
    facebook: {
      label: "Facebook", clientId: env("FACEBOOK_APP_ID"), clientSecret: env("FACEBOOK_APP_SECRET"),
      authorize: "https://www.facebook.com/v19.0/dialog/oauth", token: "https://graph.facebook.com/v19.0/oauth/access_token", userinfo: "https://graph.facebook.com/v19.0/me",
      scope: "email public_profile", pkce: true, idToken: false,
      configured() { return !!(this.clientId && this.clientSecret); },
      secret() { return this.clientSecret; },
    },
  };
  if (mock) for (const [id, p] of Object.entries(P)) Object.assign(p, { authorize: `${mock}/${id}/authorize`, token: `${mock}/${id}/token`, jwks: `${mock}/jwks`, issuer: mock, userinfo: `${mock}/${id}/me`, clientId: p.clientId || "test-client", clientSecret: p.clientSecret || "test-secret", configured: () => true, secret: () => "test-secret" });
  return P;
}

/* What a failed sign-in may log: a fixed category. jwt.js throws fixed strings (its one
   variable part, the token's alg, is left out), and token/userinfo errors are tagged. */
const JWT_FIXED = /^(id_token (malformed|key not found|signature invalid|issuer mismatch|audience mismatch|expired|nonce mismatch)|jwks fetch failed)/;
const failCategory = (e) => e?.cat || (JWT_FIXED.exec(String(e?.message || ""))?.[0]) || (/^id_token alg /.test(String(e?.message || "")) ? "id_token alg not supported" : "error");

/** Google/Apple id_token claims → the identity the device receives. Email only when verified. */
export function identityFromClaims(provider, claims, appleUser) {
  const verified = claims.email_verified === true || claims.email_verified === "true"; // Apple sends the string "true"
  const email = verified ? text(claims.email, 320) : "";
  let name = [claims.given_name, claims.family_name].filter((x) => typeof x === "string" && x).join(" ") || text(claims.name, 200);
  if (appleUser) { try { const u = typeof appleUser === "string" ? JSON.parse(appleUser) : appleUser; name = [u?.name?.firstName, u?.name?.lastName].filter((x) => typeof x === "string" && x).join(" ") || name; } catch { /* name is optional */ } }
  return { provider, email, emailVerified: !!email, name: text(name, 200) };
}

export function mount(router, ctx, { handoffTtlMs = 5 * 60_000, sweepMs = 30_000 } = {}) {
  const { config } = ctx;
  const key = stateKey(config.authSecret);
  const publicBase = () => (env("PUBLIC_BASE_URL") || env("RENDER_EXTERNAL_URL") || config.baseUrl || "").replace(/\/$/, "");
  const handoffs = expiringMap(handoffTtlMs); // code → { identity, ac (app challenge or null) }; each entry deleted by its own timer
  const sweeper = setInterval(() => handoffs.sweep(), sweepMs);
  sweeper.unref?.();
  ctx.oauthHandoffCount = () => handoffs.size; // tests: proves uncollected identities are gone on time
  const back = (res, ret, frag) => res.redirect(302, `${ret}#${frag}`);

  router.get("/providers", (req, res) => {
    const P = providers();
    res.json(Object.fromEntries(Object.entries(P).map(([id, p]) => [id, p.configured()])));
  });

  router.get("/:provider/start", (req, res) => {
    const p = providers()[req.params.provider];
    if (!p) return res.status(404).json({ error: "unknown provider" });
    if (!p.configured()) return res.status(503).json({ error: `${p.label} sign-in is not configured on this server` });
    const ret = checkReturn(req.query.return, { flows: ["oauth"] });
    if (!ret) return res.status(400).json({ error: "return URL not allowed" });
    const app = startChallenge(ret, req.query.app_challenge);
    if (app.error) return res.status(400).json({ error: app.error });
    const nonce = crypto.randomBytes(16).toString("hex");
    const verifier = p.pkce ? pkceVerifier() : null;
    const state = sealState({ p: req.params.provider, nonce, verifier, ret: ret.href, ac: app.challenge, exp: Date.now() + 10 * 60_000 }, key, "oauth");
    const params = { client_id: p.clientId, redirect_uri: `${publicBase()}/api/oauth/${req.params.provider}/callback`, response_type: "code", scope: p.scope, state, nonce, ...(p.responseMode ? { response_mode: p.responseMode } : {}), ...(verifier ? { code_challenge: pkceChallenge(verifier), code_challenge_method: "S256" } : {}) };
    res.redirect(302, `${p.authorize}?${form(params)}`);
  });

  const callback = async (req, res) => {
    const id = req.params.provider, p = providers()[id];
    if (!p) return res.status(404).json({ error: "unknown provider" });
    const q = { ...req.query, ...(req.body || {}) };
    const st = openState(q.state, key, "oauth");
    if (!st || st.p !== id) return res.status(400).send("Sign-in link expired or invalid. Please go back to the app and try again.");
    if (q.error || !q.code) return back(res, st.ret, `oauth_error=${encodeURIComponent(String(q.error || "no_code").slice(0, 64))}`);
    try {
      const tokenRes = await fetch(p.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: form({ grant_type: "authorization_code", code: q.code, redirect_uri: `${publicBase()}/api/oauth/${id}/callback`, client_id: p.clientId, client_secret: p.secret(), code_verifier: st.verifier }) });
      const tok = await tokenRes.json();
      if (!tokenRes.ok || tok.error) throw Object.assign(new Error("token"), { cat: "token exchange failed" });
      let identity;
      if (p.idToken) {
        const claims = await verifyIdToken(tok.id_token, { jwksUrl: p.jwks, issuer: p.issuer, audience: p.clientId, nonce: st.nonce });
        identity = identityFromClaims(id, claims, id === "apple" ? q.user : null);
      } else {
        // Facebook: ask for name and email only. Facebook gives no "verified" signal, so the
        // email is read but never passed on; the account id it always adds is dropped here too.
        const proof = crypto.createHmac("sha256", p.clientSecret).update(tok.access_token).digest("hex");
        const me = await (await fetch(`${p.userinfo}?${form({ fields: "name,email", access_token: tok.access_token, appsecret_proof: proof })}`)).json();
        if (me.error) throw Object.assign(new Error("userinfo"), { cat: "userinfo failed" });
        identity = { provider: id, email: "", emailVerified: false, name: text(me.name, 200) };
      }
      // Only `identity` (provider, name, and the email if the provider verified it) is kept, in
      // memory under the one-time code below, until /exchange or 5 minutes. tok (access token,
      // id_token, Apple's refresh token), the raw claims, Apple's user JSON and Facebook's /me
      // answer (with its account id) are not stored or logged.
      const code = crypto.randomBytes(24).toString("hex");
      handoffs.set(code, { identity, ac: st.ac || null });
      return back(res, st.ret, `oauth=${code}`);
    } catch (e) {
      console.warn(`[cyra] oauth/${id}: sign-in failed (${failCategory(e)})`); // a fixed category, never provider text
      return back(res, st.ret, "oauth_error=signin_failed");
    }
  };
  router.get("/:provider/callback", callback);
  router.post("/:provider/callback", callback);

  router.post("/exchange", (req, res) => {
    const h = handoffs.take(String(req.body?.code || "")); // single use, also when the verifier is missing or wrong
    // Both or neither: an app-bound code needs its verifier; a web code is refused when one is sent.
    if (!codeRedeemable(h, req.body?.verifier)) return res.status(404).json({ error: "code unknown, used, or expired" });
    res.json(h.identity);
  });
}
