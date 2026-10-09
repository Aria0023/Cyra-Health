// Short-lived, in-memory state whose expiry is enforced by timers — never by the
// next request happening to arrive. Nothing here is ever written to disk.
//
//   rateLimiter  per-client and global request limits. The client address is never
//                kept as is: it is hashed with a random salt that changes every UTC
//                day, and an entry is dropped about a minute after its last request
//                (60-65 s: entries older than 60 s are pruned every 5 s).
//   expiringMap  values that must be gone after `ttlMs` (one-time handoff codes):
//                each entry has its own timer, plus a sweep() for a periodic backstop.
//                onExpire(value) runs for an entry nobody took before it expired,
//                for an entry the caller refuses (refuse()), and for every entry
//                still waiting when drain() runs (server shutdown).
import crypto from "crypto";

const utcDay = () => new Date().toISOString().slice(0, 10);

/** allow(ip) → true while under `perMinute` for that client and `globalPerMinute` overall. */
export function rateLimiter({ perMinute, globalPerMinute = Infinity, pruneMs = 5_000 } = {}) {
  let salt = crypto.randomBytes(16), saltDay = utcDay();
  const hits = new Map(); // sha256(salt + address) → timestamps within the last minute
  let all = [];           // timestamps of every allowed request within the last minute
  const keyOf = (ip) => {
    const d = utcDay();
    if (d !== saltDay) { salt = crypto.randomBytes(16); saltDay = d; hits.clear(); }
    return crypto.createHash("sha256").update(salt).update(String(ip || "anon")).digest("base64url");
  };
  const prune = () => {
    const from = Date.now() - 60_000;
    for (const [k, arr] of hits) { const keep = arr.filter((t) => t > from); if (keep.length) hits.set(k, keep); else hits.delete(k); }
    all = all.filter((t) => t > from);
  };
  const timer = setInterval(prune, pruneMs);
  timer.unref?.();
  const allow = (ip) => {
    const now = Date.now(), from = now - 60_000, key = keyOf(ip);
    const arr = (hits.get(key) || []).filter((t) => t > from);
    all = all.filter((t) => t > from);
    if (arr.length >= perMinute || all.length >= globalPerMinute) { if (arr.length) hits.set(key, arr); else hits.delete(key); return false; }
    arr.push(now); hits.set(key, arr); all.push(now);
    return true;
  };
  allow.prune = prune;
  allow.size = () => hits.size;
  allow.keys = () => [...hits.keys()]; // tests: proves no raw address is held
  allow.stop = () => clearInterval(timer);
  return allow;
}

/** A Map whose entries delete themselves `ttlMs` after set(). take() reads once and deletes.
    onExpire(value), if given, runs (best effort, never throwing) for an entry that expired
    without being taken in time — from its timer, from sweep(), or from a take() that came
    too late; for a value the caller hands back with refuse() (taken, but never delivered);
    and for every entry still waiting when drain() runs. Never for an entry taken and kept. */
export function expiringMap(ttlMs, { onExpire } = {}) {
  const m = new Map(); // key → { value, exp, timer }
  const drop = (k) => { const e = m.get(k); if (e) { clearTimeout(e.timer); m.delete(k); } return e; };
  const run = (value) => (onExpire ? Promise.resolve().then(() => onExpire(value)).catch(() => { /* best effort */ }) : Promise.resolve());
  const expire = (k) => { const e = drop(k); return e ? run(e.value) : Promise.resolve(); };
  return {
    set(k, value) {
      drop(k);
      const timer = setTimeout(() => expire(k), ttlMs);
      timer.unref?.();
      m.set(k, { value, exp: Date.now() + ttlMs, timer });
    },
    take(k) {
      const e = m.get(k);
      if (e && e.exp <= Date.now()) { expire(k); return undefined; } // too late: it counts as expired
      drop(k);
      return e ? e.value : undefined;
    },
    /** A value that was taken but must count as never delivered (e.g. a refused redemption). */
    refuse(value) { return value === undefined ? Promise.resolve() : run(value); },
    sweep() { const now = Date.now(); for (const [k, e] of m) if (e.exp <= now) expire(k); },
    /** Expire every entry now (server shutdown); resolves once each onExpire has run. */
    drain() { return Promise.all([...m.keys()].map((k) => expire(k))); },
    get size() { return m.size; },
  };
}
