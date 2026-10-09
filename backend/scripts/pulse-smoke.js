// Pulse smoke test: the stage-less read of the last closed week, the k threshold, and a
// tally that is exactly {stage, events} — no token, nothing identifying, counts only on
// disk — plus the hashed, self-pruning rate limits. Usage: node scripts/pulse-smoke.js
import { spawn } from "child_process";
import fs from "fs";
import { isoWeek, lastClosedWeek, EVENTS } from "../src/modules/pulse/index.js";
import { rateLimiter } from "../src/core/memory.js";
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  ", m); };
const waitFor = async (url) => { for (let i = 0; i < 50; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } throw new Error("backend did not start"); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DIR = "./data-pulse-test";
fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true });
// seed the store: last closed week has hf=50 (shows), ns=49 (suppressed); this week has hf=999 (never shown yet)
const PREV = lastClosedWeek(), NOW = isoWeek();
fs.writeFileSync(`${DIR}/pulse.json`, JSON.stringify([{ week: PREV, stage: "peri", event: "hf", count: 50 }, { week: PREV, stage: "peri", event: "ns", count: 49 }, { week: PREV, stage: "preg", event: "nau", count: 120 }, { week: NOW, stage: "peri", event: "hf", count: 999 }]));
const cfg = JSON.parse(fs.readFileSync("config/app.json")); cfg.storage.dir = DIR; fs.writeFileSync("config/app.pulse-test.json", JSON.stringify(cfg));
const be = spawn("node", ["server.js"], { env: { ...process.env, PORT: "3108", CYRA_CONFIG: "config/app.pulse-test.json", NODE_ENV: "" }, stdio: ["ignore", "ignore", "inherit"] });
const B = "http://127.0.0.1:3108";
const IPS = new Set();
const randIp = () => { const ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`; IPS.add(ip); return ip; };
const post = (b, ip) => fetch(`${B}/api/pulse/tally`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip || randIp() }, body: JSON.stringify(b) });
try {
  await waitFor(`${B}/health`);
  // read: no stage in the request, every stage back, last closed week
  const g = await fetch(`${B}/api/pulse`);
  const p = await g.json();
  assert(g.status === 200 && p.week === PREV && p.k === 50, `pulse: GET /api/pulse answers for the last closed ISO week (${p.week})`);
  assert(Object.keys(p.stages).sort().join() === "peri,periods,preg" && Object.entries(p.stages).every(([s, items]) => items.length === EVENTS[s].length), "pulse: every stage in one response, so the request reveals nothing about the reader");
  const peri = Object.fromEntries(p.stages.peri.map((i) => [i.id, i.count]));
  assert(peri.hf === 50 && peri.ns === null && peri.rough_night === null, "pulse: hf shows at exactly k=50 contributions; ns (49) and empty events stay null");
  assert(p.stages.preg.find((i) => i.id === "nau").count === 120 && p.stages.periods.every((i) => i.count === null), "pulse: other stages counted the same way");
  assert(!JSON.stringify(p).includes("999"), "pulse: the live week (999) is never published — no single contribution can be watched arriving");
  assert(p.stages.peri.map((i) => i.id).join() === "hf,ns,rough_night" && !JSON.stringify(p).includes("report"), "pulse: peri events are hf, ns, rough_night (no 'report')");
  assert(p.stages.peri.find((i) => i.id === "ns").what === "logged night sweats", "pulse: ns is labelled 'logged night sweats'");
  const old = await fetch(`${B}/api/pulse?stage=peri`);
  assert(old.status === 400, `pulse: a stage in the query is refused (old clients fail closed) → ${old.status}`);

  // tally: exactly {stage, events}
  assert((await post({ stage: "nope", events: ["hf"] })).status === 400, "tally: bad stage → 400");
  assert((await post({ stage: "constructor", events: ["hf"] })).status === 400, "tally: prototype key as stage → 400");
  assert((await post({ stage: "peri", token: "tok-" + "x".repeat(20), events: ["hf"] })).status === 400, "tally: a token is refused — tallies carry none");
  assert((await post({ stage: "peri", events: ["hf"], day: "2026-10-07" })).status === 400, "tally: any extra field (a date) is refused");
  assert((await post({ stage: "peri", events: ["report"] })).status === 400, "tally: 'report' is no longer an event → 400");
  assert((await post({ stage: "peri", events: ["hf", "bogus"] })).status === 400, "tally: an event outside the stage's allowlist → 400");
  assert((await post({ stage: "peri", events: ["nau"] })).status === 400, "tally: another stage's event → 400");
  assert((await post({ stage: "peri", events: [] })).status === 400 && (await post({ stage: "peri" })).status === 400, "tally: no events → 400");
  assert((await post({ stage: "peri", events: [{ date: "2026-01-01" }] })).status === 400, "tally: non-string events → 400");
  let r = await (await post({ stage: "peri", events: ["hf", "ns", "hf"] })).json();
  assert(r.ok && r.counted === 2 && r.week === NOW, "tally: hf + ns counted once each into this week");
  r = await (await post({ stage: "periods", events: ["crm", "heavy_day"] })).json();
  assert(r.counted === 2, "tally: periods events counted");
  const disk = JSON.parse(fs.readFileSync(`${DIR}/pulse.json`));
  const row = (w, s, e) => disk.find((x) => x.week === w && x.stage === s && x.event === e)?.count;
  assert(row(NOW, "peri", "hf") === 1000 && row(NOW, "peri", "ns") === 1 && row(NOW, "periods", "crm") === 1 && row(PREV, "peri", "hf") === 50, "store: aggregate counts incremented per (week, stage, event)");
  assert(disk.every((x) => Object.keys(x).sort().join() === "count,event,stage,week" && /^\d{4}-W\d{2}$/.test(x.week) && Object.hasOwn(EVENTS, x.stage) && EVENTS[x.stage].some(([id]) => id === x.event) && Number.isInteger(x.count)), "store: rows hold only {week, stage, event, count}");
  const files = fs.readdirSync(DIR);
  const everything = files.map((f) => fs.readFileSync(`${DIR}/${f}`, "utf8")).join("\n");
  assert(files.join() === "pulse.json" && ![...IPS].some((ip) => everything.includes(ip)) && !/tok-|token|10\.0\.|\bip\b|[A-Za-z0-9_-]{40,}/.test(everything), `store: no token, no address and nothing address-derived on disk (files: ${files.join(", ")})`);
  let limited = 0; for (let i = 0; i < 35; i++) if ((await post({ stage: "preg", events: ["nau"] }, "9.9.9.9")).status === 429) limited++;
  assert(limited === 5, `tally: per-address rate limit, 30 a minute (${limited} of 35 refused)`);
} finally { be.kill(); fs.rmSync(DIR, { recursive: true, force: true }); fs.rmSync("config/app.pulse-test.json", { force: true }); }

// the limiter itself: hashed keys, global cap, entries pruned by a timer
{
  const allow = rateLimiter({ perMinute: 3, globalPerMinute: 5, pruneMs: 50 });
  const a = [1, 2, 3, 4].map(() => allow("203.0.113.7"));
  assert(a.join() === "true,true,true,false", "limiter: per-address cap");
  assert(allow("198.51.100.1") && allow("198.51.100.2") && !allow("198.51.100.3"), "limiter: global cap across addresses");
  assert(allow.keys().length === 3 && !allow.keys().some((k) => k.includes("203.0.113") || k.includes("198.51")), "limiter: keys are salted hashes, never the address");
  const realNow = Date.now; Date.now = () => realNow() + 61_000; await sleep(120); Date.now = realNow;
  assert(allow.size() === 0, "limiter: entries dropped by the timer about a minute after the last request");
  allow.stop();
}
console.log(process.exitCode ? "PULSE SMOKE: FAILURES" : "PULSE SMOKE: all passed");
