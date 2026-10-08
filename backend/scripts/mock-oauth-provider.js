// Local mock identity provider for tests: OIDC-style authorize/token/jwks for
// google and apple (apple uses response_mode=form_post), token + /me for facebook.
// Never used in production — the backend only points here when OAUTH_MOCK_BASE is set.
import http from "http";
import crypto from "crypto";

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

export function startMockProvider(port = 3998) {
  const base = `http://127.0.0.1:${port}`;
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", use: "sig", alg: "RS256" };
  const pending = new Map();
  const idToken = (claims) => { const h = b64u({ alg: "RS256", kid: "k1", typ: "JWT" }), p = b64u(claims); const s = crypto.sign("RSA-SHA256", Buffer.from(`${h}.${p}`), privateKey); return `${h}.${p}.${s.toString("base64url")}`; };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, base); let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
      const body = Object.fromEntries(new URLSearchParams(raw));
      const json = (o, s = 200) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
      if (u.pathname === "/jwks") return json({ keys: [jwk] });
      const [, provider, action] = u.pathname.split("/");
      if (action === "authorize") {
        const code = crypto.randomBytes(8).toString("hex");
        pending.set(code, { nonce: u.searchParams.get("nonce"), challenge: u.searchParams.get("code_challenge") });
        const redirect = u.searchParams.get("redirect_uri"), state = u.searchParams.get("state");
        if (u.searchParams.get("response_mode") === "form_post") { res.writeHead(200, { "content-type": "text/html" }); return res.end(`<form id="f" method="post" action="${redirect}"><input name="code" value="${code}"><input name="state" value="${state}"><input name="user" value='{"name":{"firstName":"Ada","lastName":"L"}}'></form><script>document.getElementById("f").submit()</script>`); }
        res.writeHead(302, { location: `${redirect}?code=${code}&state=${encodeURIComponent(state)}` }); return res.end();
      }
      if (action === "token") {
        const p = pending.get(body.code); pending.delete(body.code);
        if (!p) return json({ error: "invalid_grant" }, 400);
        if (p.challenge && crypto.createHash("sha256").update(body.code_verifier || "").digest("base64url") !== p.challenge) return json({ error: "invalid_grant", error_description: "pkce" }, 400);
        if (provider === "facebook") return json({ access_token: "fb-token-" + body.code, token_type: "bearer" });
        const now = Math.floor(Date.now() / 1000);
        return json({ access_token: "x", id_token: idToken({ iss: base, aud: body.client_id, sub: "sub-1", email: `ada@${provider}.example`, email_verified: provider === "apple" ? "true" : true, given_name: "Ada", family_name: "Lovelace", nonce: p.nonce, iat: now, exp: now + 600 }) });
      }
      if (action === "me") { const proof = crypto.createHmac("sha256", "test-secret").update(u.searchParams.get("access_token") || "").digest("hex"); if (u.searchParams.get("appsecret_proof") !== proof) return json({ error: { message: "bad proof" } }, 400); return json({ id: "fb1", name: "Ada Lovelace", email: "ada@facebook.example" }); }
      json({ error: "not found" }, 404);
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ base, close: () => server.close() })));
}

if (process.argv[1] && process.argv[1].endsWith("mock-oauth-provider.js")) {
  const { base } = await startMockProvider(Number(process.argv[2]) || 3998);
  console.log(`[mock-oauth] listening at ${base}`);
}
