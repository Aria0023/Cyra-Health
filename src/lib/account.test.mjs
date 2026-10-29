// Calm R9: the optional account (lib/account.js) and the key-based envelope helpers (lib/backup.js). Run: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac, pbkdf2Sync } from "node:crypto";
import { readFileSync } from "node:fs";
import { normEmail, isEmail, lookupFor, tokenFor, credentialsFor, okCred, accountTransport, cleanCloudAccount, mergeCloudAccount, nextCloudAccount, contentSum, NO_ACCOUNT, ACCOUNT_COPY, ACCOUNT_ERRORS, LOOKUP_TAG, SALT_TAG, TOKEN_TAG } from "./account.js";
import { backupKey, encryptWithKey, openBackup, decryptWithKey, decryptBackup, encryptBackup, ITERATIONS } from "./backup.js";
import { accountsInBuild, serverSees, wipeConfirm, storeCopyLine, startOverText, potsTodayFoot, potsTodayFootUnsaved, potsNeverSent, splashAccountLine, consentBackupFact, ACCOUNT_EXCEPT } from "./disclosures.js";
import { parseFeatures } from "./features.js";
import { flowRows, otherConnections } from "./privacyFlows.js";

const b64url = (b) => b.toString("base64url");
const ALL = parseFeatures("all"), DEF = parseFeatures(undefined);

test("account: email normalising and checks", () => {
  assert.equal(normEmail("  Aria@Example.COM "), "aria@example.com");
  assert.ok(isEmail("a@b.co")); assert.ok(!isEmail("a@b")); assert.ok(!isEmail("a b@c.de")); assert.ok(!isEmail("")); assert.ok(!isEmail(null));
  assert.ok(!isEmail(`${"a".repeat(250)}@b.co`));
});

test("account: lookup = SHA-256 of the tagged email, token = HMAC under PBKDF2 600k, matching an independent Node implementation", async () => {
  const email = "Aria@Example.com", pass = "correct horse battery";
  const lookup = await lookupFor(email);
  assert.equal(lookup, b64url(createHash("sha256").update(LOOKUP_TAG + "aria@example.com").digest()));
  assert.equal(lookup.length, 43);
  const salt = createHash("sha256").update(SALT_TAG + "aria@example.com").digest();
  const bits = pbkdf2Sync(pass, salt, ITERATIONS, 32, "sha256");
  const want = b64url(createHmac("sha256", bits).update(TOKEN_TAG).digest());
  assert.equal(await tokenFor(email, pass), want);
  assert.equal(ITERATIONS, 600000);
  const c = await credentialsFor(" ARIA@example.com", pass);
  assert.deepEqual(c, { lookup, token: want });
  assert.ok(okCred(c)); assert.ok(!okCred({ lookup, token: "x" }));
  assert.notEqual(await tokenFor(email, "another passphrase"), want, "another passphrase, another token");
  assert.notEqual(await tokenFor("other@example.com", pass, { iterations: 1000 }), await tokenFor(email, pass, { iterations: 1000 }), "the email salts the token");
});

test("account: the write token is not the backup key, and the backup key opens the envelope like a passphrase does", async () => {
  const pass = "correct horse battery";
  const k = await backupKey(pass);
  const state = { v: 1, stage: "periods", days: [{ date: "2026-10-01" }] };
  const env = await encryptWithKey(state, k);
  assert.deepEqual(Object.keys(env), ["format", "v", "kdf", "iter", "cipher", "salt", "iv", "ct"]);
  assert.equal(env.salt, k.salt); assert.equal(env.iter, 600000);
  assert.deepEqual(await decryptBackup(env, pass), state, "a passphrase opens it (same format as a backup file)");
  assert.deepEqual(await decryptWithKey(env, k), state, "the kept key opens it");
  const env2 = await encryptWithKey(state, k);
  assert.notEqual(env2.iv, env.iv, "a fresh IV each time");
  const o = await openBackup(env, pass);
  assert.deepEqual(o, { state, salt: k.salt, key: k.key });
  await assert.rejects(openBackup(env, "wrong passphrase"), /Wrong passphrase/);
  await assert.rejects(decryptWithKey(env, { salt: k.salt, key: (await backupKey("another one!")).key }), /Wrong passphrase/);
  const other = await encryptBackup(state, pass); // its own random salt
  await assert.rejects(decryptWithKey(other, k), /Wrong passphrase/, "an envelope under another salt needs the passphrase");
  await assert.rejects(backupKey("short"), /at least 8/);
  const token = await tokenFor("a@b.co", pass);
  assert.notEqual(Buffer.from(token, "base64url").toString("base64"), k.key, "the token is never the key");
});

test("account: the transport is fail-closed and sends only the two keys and the envelope", async () => {
  const reqs = [];
  let answer = () => new Response(JSON.stringify({ version: 1, updatedAt: "2026-10-29T10:00:00.000Z", expiresAt: "x" }), { status: 201 });
  const request = async (path, init) => { reqs.push({ path, init }); return answer(); };
  const cred = { lookup: "L".repeat(43), token: "T".repeat(43) };
  const env = await encryptBackup({ v: 1 }, "correct horse battery");
  for (const t of [accountTransport(), accountTransport({ request, enabled: true }), accountTransport({ request, gate: () => true }), accountTransport({ enabled: true, gate: () => true })]) {
    assert.equal(t.available(), false);
    for (const p of [t.meta(cred), t.load(cred), t.save(env, cred, "new"), t.remove(cred)]) await assert.rejects(p, { code: "CLOUD_OFF" });
  }
  assert.equal(reqs.length, 0, "no request while closed");
  const t = accountTransport({ request, enabled: true, gate: () => true });
  await assert.rejects(t.save({ format: "x" }, cred, "new"), { code: "NOT_ENCRYPTED" });
  await assert.rejects(t.save({ plain: "days" }, cred, "new"), { code: "NOT_ENCRYPTED" });
  await assert.rejects(t.meta({ lookup: "short", token: "T".repeat(43) }), { code: "NO_ACCOUNT" });
  assert.equal(reqs.length, 0, "refused before any request");
  const r = await t.save(env, cred, "new");
  assert.equal(r.version, 1);
  const q = reqs[0];
  assert.equal(q.path, "/api/backup/account"); assert.equal(q.init.method, "PUT");
  assert.deepEqual(Object.keys(q.init.headers).sort(), ["authorization", "content-type", "x-cyra-account", "x-cyra-base"]);
  assert.equal(q.init.headers["x-cyra-account"], cred.lookup); assert.equal(q.init.headers.authorization, `Bearer ${cred.token}`);
  assert.equal(q.init.headers["content-type"], "application/octet-stream"); assert.equal(q.init.headers["x-cyra-base"], "new");
  assert.deepEqual(JSON.parse(new TextDecoder().decode(q.init.body)), env, "the body is the envelope, nothing else");
  answer = () => new Response(JSON.stringify({ version: 4, updatedAt: "2026-10-29T11:00:00.000Z" }), { status: 409 });
  await assert.rejects(t.save(env, cred, 3), { code: "CONFLICT", version: 4, updatedAt: "2026-10-29T11:00:00.000Z" });
  answer = () => new Response("{}", { status: 404 });
  await assert.rejects(t.load(cred), { code: "NO_ACCOUNT", message: ACCOUNT_ERRORS.NO_ACCOUNT });
  await assert.rejects(t.save(env, cred, 3), { code: "GONE" });
  await assert.rejects(t.remove(cred), { code: "GONE" });
  answer = () => new Response("{}", { status: 429 }); await assert.rejects(t.meta(cred), { code: "BUSY" });
  answer = () => new Response("{}", { status: 507 }); await assert.rejects(t.save(env, cred, "new"), { code: "FULL" });
  answer = () => new Response("{}", { status: 500 }); await assert.rejects(t.meta(cred), { code: "SERVER", status: 500 });
  answer = () => { throw Object.assign(new Error("network"), { network: true }); }; await assert.rejects(t.meta(cred), { code: "OFFLINE" });
  answer = () => new Response("not json", { status: 200, headers: { "x-cyra-version": "2" } }); await assert.rejects(t.load(cred), { code: "NOT_ENCRYPTED" });
  answer = () => new Response(JSON.stringify(env), { status: 200, headers: { "x-cyra-version": "2", "x-cyra-updated": "2026-10-29T11:00:00.000Z" } });
  assert.deepEqual(await t.load(cred), { envelope: env, version: 2, updatedAt: "2026-10-29T11:00:00.000Z" });
  assert.equal(reqs.at(-1).init.body, undefined, "a load sends no body");
});

test("account: cloudAccount is cleaned, merged by rev and never resurrected", () => {
  assert.equal(cleanCloudAccount(null), NO_ACCOUNT); assert.equal(cleanCloudAccount([]), NO_ACCOUNT);
  const acct = { email: "A@B.co", lookup: "L".repeat(43), token: "T".repeat(43), salt: "c2FsdA==", key: "a2V5", version: 3, at: "2026-10-29T10:00:00.000Z", since: "2026-10-28T10:00:00.000Z", sum: "0a1b2c3d", extra: 1 };
  const c = cleanCloudAccount({ rev: 2, acct });
  assert.deepEqual(c, { rev: 2, acct: { email: "a@b.co", lookup: acct.lookup, token: acct.token, salt: acct.salt, key: acct.key, version: 3, at: acct.at, since: acct.since, sum: "0a1b2c3d" } });
  assert.deepEqual(cleanCloudAccount({ rev: 2, acct: { ...acct, token: "short" } }), { rev: 2, acct: null }, "a damaged account is a guest");
  assert.deepEqual(cleanCloudAccount({ rev: 2, acct: { ...acct, version: 0, at: "yesterday", sum: "x" } }).acct.version, null);
  const out = nextCloudAccount(c, null);
  assert.deepEqual(out, { rev: 3, acct: null });
  assert.deepEqual(mergeCloudAccount(c, out), out, "a newer sign-out in another tab wins");
  assert.deepEqual(mergeCloudAccount(out, c), out, "an older signed-in state never comes back");
  assert.deepEqual(mergeCloudAccount(c, { rev: 2, acct: null }), c, "a tie keeps this tab's");
  assert.equal(contentSum("abc"), contentSum("abc")); assert.notEqual(contentSum("abc"), contentSum("abd")); assert.match(contentSum(""), /^[0-9a-f]{8}$/);
});

test("account: every sentence is calm and honest (no streaks, grades, or claims Cyra can recover a passphrase)", () => {
  const all = Object.values(ACCOUNT_COPY).flatMap((v) => (typeof v === "function" ? [v("a@b.co")] : Array.isArray(v) ? v : [v])).join(" ");
  assert.match(ACCOUNT_COPY.lost, /nobody can recover it/);
  assert.ok(ACCOUNT_COPY.holds.some((t) => /hash of your email/.test(t) && /Never your email/.test(t)));
  assert.ok(!/streak|score|perfect|fail(ed|ure) you|recover your passphrase|reset your passphrase|magic link/i.test(all));
  assert.ok(/No account needed/.test(ACCOUNT_COPY.guestTitle));
});

test("disclosures (calm R9): accounts builds name the encrypted account backup; every other build is unchanged", () => {
  assert.equal(accountsInBuild(ALL, true), true); assert.equal(accountsInBuild(ALL, false), false); assert.equal(accountsInBuild(DEF, true), false);
  assert.deepEqual(serverSees(ALL, true), serverSees(ALL, true, false));
  const s = serverSees(ALL, true, true);
  assert.ok(!s.some((t) => /keep no account/.test(t)) && s.some((t) => /optional account, they keep only your encrypted backup/.test(t)));
  assert.deepEqual(serverSees(ALL, false, true), serverSees(ALL, false), "no server, no account");
  assert.match(wipeConfirm(ALL, false, true), /keep no readable copy/); assert.match(wipeConfirm(ALL, false, true), /until you delete the account or it expires/);
  assert.equal(wipeConfirm(ALL, false), wipeConfirm(ALL, false, false));
  assert.equal(storeCopyLine(false), "Cyra's servers don't keep a copy."); assert.match(storeCopyLine(true), /only your encrypted account backup/);
  assert.match(startOverText(ALL, true), /no readable copy/);
  for (const f of [ALL, DEF, parseFeatures("none"), parseFeatures("counts")]) {
    assert.ok(potsTodayFoot(f, true).includes(ACCOUNT_EXCEPT) && !potsTodayFoot(f).includes("account"));
    assert.ok(Object.values(potsTodayFootUnsaved(f, true)).every((t) => t.includes(ACCOUNT_EXCEPT)));
    assert.ok(potsNeverSent(f, true).endsWith(`${ACCOUNT_EXCEPT}.`) && !potsNeverSent(f).includes("account"));
  }
  assert.equal(splashAccountLine(), "No account needed. There's no Cyra account to make, and your name and email are optional.");
  assert.match(splashAccountLine(true), /^No account needed\. An account is optional/);
  assert.match(consentBackupFact(true), /optional account keeps the same kind of encrypted backup/);
  assert.equal(consentBackupFact(), "A backup is a file you keep, locked with a passphrase only you know. Cyra never receives the file or the passphrase, so we can't read it or recover a lost passphrase.");
});

test("privacy flows (calm R9): the Cloud backup row needs the flag, a server and the plan, and is On while signed in", () => {
  const base = { native: false, server: true, flags: ALL, planCloud: true, reminderSupport: "web", reminders: {}, wearLive: 0, terraOff: 0 };
  const cloud = (c) => flowRows(c).find((r) => r.id === "cloud").state;
  assert.equal(cloud(base), "off"); assert.equal(cloud({ ...base, cloudOn: true }), "on");
  assert.equal(cloud({ ...base, server: false, cloudOn: true }), "na"); assert.equal(cloud({ ...base, planCloud: false }), "na");
  assert.ok(otherConnections({ server: true, flags: { cloudBackup: true } }).includes("server"));
});

test("account: wiring — the account key is device-only and never in a backup; the default build has no account", () => {
  const rec = readFileSync(new URL("./record.js", import.meta.url), "utf8");
  assert.match(rec, /NOT_IN_BACKUP = Object\.freeze\(\[[^\]]*"cloudAccount"/);
  assert.match(rec, /DEVICE_ONLY = Object\.freeze\(\[[^\]]*"cloudAccount"/);
  const cb = readFileSync(new URL("./cloudBackup.js", import.meta.url), "utf8");
  assert.match(cb, /export const ACCOUNTS_HERE = accountsInBuild\(FEATURES, hasServer\(\)\);/);
  assert.match(cb, /gate: \(\) => FEATURES\.cloudBackup && can\("cloudBackup", plan\)/);
  assert.equal(DEF.cloudBackup, false, "the default build has no cloudBackup flag");
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.ok(app.includes("encryptWithKey(snap, acct)") && app.includes("const snap = backupCopy(cloudRef.current.snap());"), "the automatic back-up encrypts backupCopy(snapshot()) like a file backup");
  const prod = JSON.parse(readFileSync(new URL("../../backend/config/app.json", import.meta.url), "utf8"));
  assert.ok(!prod.modules.includes("backup"), "production backend config keeps the backup module unmounted");
});
