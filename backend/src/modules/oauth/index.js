// Social sign-in: real authorization-code OAuth for Apple, Google and Facebook.
//
//   GET  /api/oauth/providers                   which providers are configured
//   GET  /api/oauth/:provider/start?return=URL  → 302 to the provider
//   GET|POST /api/oauth/:provider/callback      provider → here → 302 return#oauth=<code>
//   POST /api/oauth/exchange {code}             → { provider, email, emailVerified, name } once
//
// What the server learns: a verified email and (if the provider sends it) a name.
// What it keeps: nothing. The identity lives in memory for at most five minutes,
// under a one-time code, until the device collects it. No account record exists
// server-side; health data never comes near this module.
//
// Security: signed, expiring state (HMAC with AUTH_SECRET) carrying the nonce,
// the PKCE verifier and the return URL; PKCE S256 for Google and Facebook;
// id_token signature + iss/aud/exp/nonce checks for Google and Apple; Facebook
// appsecret_proof; return URLs limited to the CORS_ORIGIN allowlist.
import crypto from "crypto";
import { verifyIdToken, appleClientSecret, pkceVerifier, pkceChallenge } from "./jwt.js";

export const basePath = "/api/oauth";

const env = (k) => (process.env[k] || "").trim();
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (payload, secret) => { const body = b64u(payload); return `${body}.${crypto.createHmac("sha256", secret).update(body).digest("base64url")}`; };
const verify = (token, secret) => {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const good = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString());
  return p.exp > Date.now() ? p : null;
};
const form = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null)).toString();

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

export function mount(router, ctx) {
  const { config } = ctx;
  const secret = config.authSecret;
  const publicBase = () => (env("PUBLIC_BASE_URL") || env("RENDER_EXTERNAL_URL") || config.baseUrl || "").replace(/\/$/, "");
  const allowedReturn = (url) => {
    let u; try { u = new URL(url); } catch { return false; }
    if (!/^https?:$/.test(u.protocol)) return false;
    const list = (env("CORS_ORIGIN") || "*").split(",").map((s) => s.trim()).filter(Boolean);
    return list.includes("*") || list.includes(u.origin);
  };
  const handoffs = new Map(); // code -> { identity, exp }
  const sweep = () => { const now = Date.now(); for (const [k, v] of handoffs) if (v.exp < now) handoffs.delete(k); };
  const back = (res, ret, frag) => res.redirect(302, `${ret}#${frag}`);

  router.get("/providers", (req, res) => {
    const P = providers();
    res.json(Object.fromEntries(Object.entries(P).map(([id, p]) => [id, p.configured()])));
  });

  router.get("/:provider/start", (req, res) => {
    const p = providers()[req.params.provider];
    if (!p) return res.status(404).json({ error: "unknown provider" });
    if (!p.configured()) return res.status(503).json({ error: `${p.label} sign-in is not configured on this server` });
    const ret = String(req.query.return || "");
    if (!allowedReturn(ret)) return res.status(400).json({ error: "return URL not allowed" });
    const nonce = crypto.randomBytes(16).toString("hex");
    const verifier = p.pkce ? pkceVerifier() : null;
    const state = sign({ p: req.params.provider, nonce, verifier, ret, exp: Date.now() + 10 * 60_000 }, secret);
    const params = { client_id: p.clientId, redirect_uri: `${publicBase()}/api/oauth/${req.params.provider}/callback`, response_type: "code", scope: p.scope, state, nonce, ...(p.responseMode ? { response_mode: p.responseMode } : {}), ...(verifier ? { code_challenge: pkceChallenge(verifier), code_challenge_method: "S256" } : {}) };
    res.redirect(302, `${p.authorize}?${form(params)}`);
  });

  const callback = async (req, res) => {
    const id = req.params.provider, p = providers()[id];
    if (!p) return res.status(404).json({ error: "unknown provider" });
    const q = { ...req.query, ...(req.body || {}) };
    const st = verify(q.state, secret);
    if (!st || st.p !== id) return res.status(400).send("Sign-in link expired or invalid. Please go back to the app and try again.");
    if (q.error || !q.code) return back(res, st.ret, `oauth_error=${encodeURIComponent(q.error || "no_code")}`);
    try {
      const tokenRes = await fetch(p.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: form({ grant_type: "authorization_code", code: q.code, redirect_uri: `${publicBase()}/api/oauth/${id}/callback`, client_id: p.clientId, client_secret: p.secret(), code_verifier: st.verifier }) });
      const tok = await tokenRes.json();
      if (!tokenRes.ok || tok.error) throw new Error(tok.error_description || tok.error || `token ${tokenRes.status}`);
      let identity;
      if (p.idToken) {
        const claims = await verifyIdToken(tok.id_token, { jwksUrl: p.jwks, issuer: p.issuer, audience: p.clientId, nonce: st.nonce });
        let name = [claims.given_name, claims.family_name].filter(Boolean).join(" ") || claims.name || "";
        if (id === "apple" && q.user) { try { const u = typeof q.user === "string" ? JSON.parse(q.user) : q.user; name = [u?.name?.firstName, u?.name?.lastName].filter(Boolean).join(" ") || name; } catch { /* name is optional */ } }
        identity = { provider: id, email: claims.email || "", emailVerified: claims.email_verified === true || claims.email_verified === "true", name };
      } else {
        const proof = crypto.createHmac("sha256", p.clientSecret).update(tok.access_token).digest("hex");
        const me = await (await fetch(`${p.userinfo}?${form({ fields: "id,name,email", access_token: tok.access_token, appsecret_proof: proof })}`)).json();
        if (me.error) throw new Error(me.error.message || "userinfo failed");
        identity = { provider: id, email: me.email || "", emailVerified: !!me.email, name: me.name || "" };
      }
      sweep();
      const code = crypto.randomBytes(24).toString("hex");
      handoffs.set(code, { identity, exp: Date.now() + 5 * 60_000 });
      return back(res, st.ret, `oauth=${code}`);
    } catch (e) {
      console.warn(`[cyra] oauth/${id}: ${e.message}`);
      return back(res, st.ret, "oauth_error=signin_failed");
    }
  };
  router.get("/:provider/callback", callback);
  router.post("/:provider/callback", callback);

  router.post("/exchange", (req, res) => {
    sweep();
    const code = String(req.body?.code || "");
    const h = handoffs.get(code);
    handoffs.delete(code);
    if (!h) return res.status(404).json({ error: "code unknown, used, or expired" });
    res.json(h.identity);
  });
}
