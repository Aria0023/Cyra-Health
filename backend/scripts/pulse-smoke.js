import { spawn } from "child_process";
import fs from "fs";
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  ", m); };
const waitFor = async (url) => { for (let i = 0; i < 50; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } throw new Error("backend did not start"); };
fs.rmSync("./data-pulse-test", { recursive: true, force: true });
const cfg = JSON.parse(fs.readFileSync("config/app.json")); cfg.storage.dir = "./data-pulse-test"; fs.writeFileSync("config/app.pulse-test.json", JSON.stringify(cfg));
const be = spawn("node", ["server.js"], { env: { ...process.env, PORT: "3108", CYRA_CONFIG: "config/app.pulse-test.json" }, stdio: ["ignore", "ignore", "inherit"] });
const B = "http://127.0.0.1:3108";
const post = (b, ip) => fetch(`${B}/api/pulse/tally`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip || `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify(b) });
const get = (s) => fetch(`${B}/api/pulse?stage=${s}`).then((r) => r.json());
try {
  await waitFor(`${B}/health`);
  let p = await get("peri");
  assert(p.k === 50 && p.items.length === 3 && p.items.every((i) => i.count === null), "pulse: empty week → every count suppressed (null)");
  assert((await post({ stage: "nope", token: "a".repeat(20), events: ["hf"] })).status === 400, "tally: bad stage → 400");
  assert((await post({ stage: "peri", token: "short", events: ["hf"] })).status === 400, "tally: bad token → 400");
  let r = await (await post({ stage: "peri", token: "tok-" + "x".repeat(20), events: ["hf", "report", "bogus", { date: "2026-01-01" }] })).json();
  assert(r.ok && r.counted === 2, "tally: unknown events ignored, valid ones counted once");
  r = await (await post({ stage: "peri", token: "tok-" + "x".repeat(20), events: ["hf", "report"] })).json();
  assert(r.counted === 0, "tally: same token this week is de-duplicated");
  for (let i = 0; i < 49; i++) await post({ stage: "peri", token: `tok-${i}-${"y".repeat(16)}`, events: ["hf"] });
  p = await get("peri");
  assert(p.items.find((i) => i.id === "hf").count === 50 && p.items.find((i) => i.id === "report").count === null, "pulse: hf shows at exactly 50 contributors; report (1) stays suppressed");
  const disk = JSON.parse(fs.readFileSync("data-pulse-test/pulse.json"));
  assert(disk.every((row) => Object.keys(row).sort().join() === "count,event,stage,week"), "store: counts only on disk — no tokens, no ips");
  let limited = 0; for (let i = 0; i < 35; i++) if ((await post({ stage: "preg", token: `z${i}-${"q".repeat(18)}`, events: ["nau"] }, "9.9.9.9")).status === 429) limited++;
  assert(limited > 0, "tally: per-ip rate limit");
} finally { be.kill(); fs.rmSync("./data-pulse-test", { recursive: true, force: true }); fs.rmSync("config/app.pulse-test.json", { force: true }); }
console.log(process.exitCode ? "PULSE SMOKE: FAILURES" : "PULSE SMOKE: all passed");
