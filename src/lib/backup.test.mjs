// Local-first L4: the encrypted backup and its transports (lib/backup.js). The file transport is today's
// export and restore, moved out of App.jsx unchanged; the cloud transport is a fail-closed scaffold.
// Run: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { encryptBackup, decryptBackup, isEnvelope, backupFileName, fileTransport, cloudTransport, CLOUD_MAX_BYTES, ITERATIONS } from "./backup.js";

const PASS = "correct horse battery";
let ENV = null;
const env = async () => (ENV ||= await encryptBackup({ v: 1, phase: "app", stage: "periods", days: [{ date: "2026-10-01", sym: { crm: 2 } }] }, PASS));
const ID = "AbCdEfGhIjKlMnOpQrStUv", TOKEN = "a".repeat(43);

test("backup: round trip; the envelope carries only the format and what decrypting needs", async () => {
  const e = await env();
  assert.deepEqual(Object.keys(e), ["format", "v", "kdf", "iter", "cipher", "salt", "iv", "ct"]);
  assert.equal(e.iter, ITERATIONS);
  assert.deepEqual(await decryptBackup(e, PASS), { v: 1, phase: "app", stage: "periods", days: [{ date: "2026-10-01", sym: { crm: 2 } }] });
  await assert.rejects(decryptBackup(e, "wrong passphrase"), /Wrong passphrase/);
  assert.equal(isEnvelope(e), true);
  for (const x of [null, undefined, {}, { days: [] }, { ...e, v: 2 }, { ...e, format: "x" }, { ...e, ct: "" }, { ...e, salt: 1 }, "str"]) assert.equal(isEnvelope(x), false);
  assert.equal(backupFileName("2026-10-22"), "heard-health-backup-2026-10-22.json");
});

test("backup: backup.js has no import (the POTS suites load it from Node)", () => {
  const src = readFileSync(new URL("./backup.js", import.meta.url), "utf8");
  assert.ok(!/^\s*import[\s{(]/m.test(src) && !/\bimport\(/.test(src), "no static or dynamic import");
});

/* A fetch spy: the transports must never call the network themselves. */
const noFetch = () => { const was = globalThis.fetch; let n = 0; globalThis.fetch = () => { n++; throw new Error("fetch called"); }; return { calls: () => n, restore: () => { globalThis.fetch = was; } }; };

test("backup: file transport, web — a download named by the day, the exact envelope JSON, URL revoked after 2 s", async () => {
  const e = await env();
  const spy = noFetch();
  try {
    const log = [], blobs = [];
    const anchor = { click: () => log.push("click"), remove: () => log.push("remove") };
    const doc = { createElement: (t) => { log.push(`create ${t}`); return anchor; }, body: { appendChild: (a) => log.push(a === anchor ? "append" : "?") } };
    class FakeBlob { constructor(parts, opts) { this.parts = parts; this.type = opts.type; blobs.push(this); } }
    const URL_ = { createObjectURL: (b) => { log.push("url"); return b === blobs[0] ? "blob:x" : "?"; }, revokeObjectURL: (u) => log.push(`revoke ${u}`) };
    let timer = null;
    const t = fileTransport({ isNative: () => false, doc, URL: URL_, Blob: FakeBlob, later: (fn, ms) => { timer = { fn, ms }; } });
    assert.equal(t.kind, "file"); assert.equal(t.available(), true);
    assert.equal(await t.save(e, { name: backupFileName("2026-10-22") }), true);
    assert.equal(anchor.download, "heard-health-backup-2026-10-22.json");
    assert.equal(anchor.href, "blob:x");
    assert.equal(blobs.length, 1); assert.equal(blobs[0].type, "application/json"); assert.deepEqual(blobs[0].parts, [JSON.stringify(e)]);
    assert.deepEqual(log, ["create a", "url", "append", "click", "remove"]);
    assert.equal(timer.ms, 2000); timer.fn(); assert.equal(log.at(-1), "revoke blob:x");
    assert.equal(spy.calls(), 0);
  } finally { spy.restore(); }
});

test("backup: file transport, phone — cache file, share sheet, deleted every time; errors unchanged", async () => {
  const e = await env();
  const spy = noFetch();
  try {
    const mk = ({ writeFails = false, shareError = null } = {}) => {
      const calls = [];
      const io = {
        isNative: () => true, Directory: { Cache: "CACHE" }, Encoding: { UTF8: "utf8" },
        Filesystem: {
          writeFile: async (o) => { calls.push(["write", o]); if (writeFails) throw new Error("disk full"); return { uri: "file:///cache/x" }; },
          deleteFile: async (o) => { calls.push(["delete", o]); },
        },
        Share: { share: async (o) => { calls.push(["share", o]); if (shareError) throw new Error(shareError); } },
      };
      return { t: fileTransport(io), calls };
    };
    const name = backupFileName("2026-10-22");
    let { t, calls } = mk();
    assert.equal(await t.save(e, { name }), true);
    assert.deepEqual(calls, [
      ["write", { path: name, data: JSON.stringify(e), directory: "CACHE", encoding: "utf8" }],
      ["share", { title: "Heard Health encrypted backup", files: ["file:///cache/x"] }],
      ["delete", { path: name, directory: "CACHE" }],
    ]);
    ({ t, calls } = mk({ shareError: "Share canceled" }));
    assert.equal(await t.save(e, { name }), false, "a cancel resolves false");
    assert.equal(calls.at(-1)[0], "delete");
    ({ t, calls } = mk({ shareError: "Share already in progress" }));
    await assert.rejects(t.save(e, { name }), { message: "Couldn't open the share sheet on this phone" });
    assert.equal(calls.at(-1)[0], "delete");
    ({ t, calls } = mk({ shareError: "something else" }));
    await assert.rejects(t.save(e, { name }), { message: "Sharing didn't finish — the backup may not have reached where you sent it. Anything that did is still encrypted." });
    assert.equal(calls.at(-1)[0], "delete");
    ({ t, calls } = mk({ writeFails: true }));
    await assert.rejects(t.save(e, { name }), { message: "Couldn't prepare the backup file on this phone" });
    assert.deepEqual(calls.map((c) => c[0]), ["write"], "nothing was written, so nothing to share or delete");
    assert.equal(spy.calls(), 0);
  } finally { spy.restore(); }
});

test("backup: file transport load parses a chosen file and refuses anything else", async () => {
  const t = fileTransport({ isNative: () => false });
  assert.deepEqual(await t.load({ text: async () => '{"format":"cyra-backup","v":1}' }), { format: "cyra-backup", v: 1 });
  await assert.rejects(t.load({ text: async () => "not json" }), { message: "That file isn't a Heard Health backup" });
});

test("backup: cloud transport is closed by default — every method rejects CLOUD_OFF before any request", async () => {
  const e = await env();
  let n = 0;
  const spy = () => { n++; return Promise.resolve({ status: 201, json: async () => ({}) }); };
  for (const t of [cloudTransport(), cloudTransport({ request: spy, enabled: true }), cloudTransport({ request: spy, gate: () => true }), cloudTransport({ enabled: true, gate: () => true })]) {
    assert.equal(t.kind, "cloud");
    assert.equal(t.available(), false);
    await assert.rejects(t.save(e), { code: "CLOUD_OFF", message: "Encrypted cloud backup isn't available in this version of Heard Health" });
    await assert.rejects(t.load({ id: ID, token: TOKEN }), { code: "CLOUD_OFF" });
    await assert.rejects(t.remove({ id: ID, token: TOKEN }), { code: "CLOUD_OFF" });
  }
  assert.equal(n, 0);
});

test("backup: cloud transport (opened in a test) sends only the envelope as octet-stream; maps errors", async () => {
  const e = await env();
  const reqs = [];
  let answer = null;
  const request = async (path, init, opts) => { reqs.push({ path, init, opts }); return answer(path, init); };
  const ok = (status, body) => ({ status, json: async () => body, arrayBuffer: async () => new TextEncoder().encode(typeof body === "string" ? body : JSON.stringify(body)).buffer });
  const t = cloudTransport({ request, enabled: true, gate: () => true });
  assert.equal(t.available(), true);

  answer = () => ok(201, { id: ID, token: TOKEN, expiresAt: "2027-01-20T00:00:00.000Z" });
  assert.deepEqual(await t.save(e), { id: ID, token: TOKEN, expiresAt: "2027-01-20T00:00:00.000Z" });
  let r = reqs.at(-1);
  assert.equal(r.path, "/api/backup"); assert.equal(r.init.method, "POST");
  assert.deepEqual(r.init.headers, { "content-type": "application/octet-stream" });
  assert.ok(r.init.body instanceof Uint8Array);
  assert.equal(new TextDecoder().decode(r.init.body), JSON.stringify(e));
  assert.deepEqual(r.opts, { timeoutMs: 30000 });

  answer = () => ok(200, { ok: true, expiresAt: "2027-01-21T00:00:00.000Z" });
  assert.deepEqual(await t.save(e, { ref: { id: ID, token: TOKEN } }), { id: ID, expiresAt: "2027-01-21T00:00:00.000Z" });
  r = reqs.at(-1);
  assert.equal(r.path, `/api/backup/${ID}`); assert.equal(r.init.method, "PUT");
  assert.deepEqual(r.init.headers, { "content-type": "application/octet-stream", authorization: `Bearer ${TOKEN}` });

  answer = () => ok(200, JSON.stringify(e));
  assert.deepEqual(await t.load({ id: ID, token: TOKEN }), e);
  r = reqs.at(-1);
  assert.equal(r.init.method, "GET"); assert.deepEqual(r.init.headers, { authorization: `Bearer ${TOKEN}` });
  answer = () => ok(200, '{"days":[]}');
  await assert.rejects(t.load({ id: ID, token: TOKEN }), { code: "NOT_ENCRYPTED" });

  answer = () => ok(200, { ok: true });
  assert.equal(await t.remove({ id: ID, token: TOKEN }), true);
  assert.equal(reqs.at(-1).init.method, "DELETE");

  const before = reqs.length;
  await assert.rejects(t.save({ days: [1] }), { code: "NOT_ENCRYPTED", message: "Only an encrypted backup can be uploaded" });
  await assert.rejects(t.save({ ...e, ct: "A".repeat(CLOUD_MAX_BYTES) }), { code: "TOO_LARGE", message: "This backup is too large for cloud backup" });
  await assert.rejects(t.save(e, { ref: { id: "../x", token: TOKEN } }), { code: "GONE" });
  await assert.rejects(t.load({ id: ID, token: "short" }), { code: "GONE" });
  assert.equal(reqs.length, before, "refused before any request");

  answer = () => ok(404, { error: "not found" });
  await assert.rejects(t.load({ id: ID, token: TOKEN }), { code: "GONE", message: "That cloud backup is gone or the code is wrong" });
  answer = () => ok(500, {});
  await assert.rejects(t.save(e), { code: "SERVER", status: 500, message: "Heard Health's server couldn't keep the backup (HTTP 500)" });
  answer = () => { throw Object.assign(new Error("network"), { network: true }); };
  await assert.rejects(t.remove({ id: ID, token: TOKEN }), { message: "network", network: true }, "network errors pass through as apiFetch throws them");
});

test("backup: the configured cloud instance is gated by the plan and the flag", () => {
  const src = readFileSync(new URL("./cloudBackup.js", import.meta.url), "utf8");
  assert.match(src, /cloudTransport\(\{ request: apiFetch, enabled: hasServer\(\), gate: \(\) => FEATURES\.cloudBackup && can\("cloudBackup"\) \}\)/);
});
