/* Requests for Cyra's weekly write-up and chat (calm R8). Called only by App.jsx, only for a Pro plan in a build with
   the ai flag and a server, only after she turned the feature on, and (for the two POSTs) only after she tapped Send in
   "What Cyra will send". The POST body is exactly the object she was shown; nothing is added here.
   aiStatus() asks the server whether Cyra's AI is set up (GET, no body, nothing about her).
   Monthly allowance (owner decision 2026-11-15; backend ai/usage.js): when she is signed in, each request carries her
   session token (Authorization: Bearer) so the server can count it against her month: 30 evidence questions, 100 chat
   messages, 6 write-ups, 60 meal photos. The body is unchanged. A delivered answer returns { usage: { kind, used, limit, resetsOn } }. */
import { apiFetch } from "./api.js";

const authHead = (token) => (typeof token === "string" && token ? { authorization: `Bearer ${token}` } : {});
async function postAi(path, body, token, timeoutMs) {
  const r = await apiFetch(path, { method: "POST", headers: { "content-type": "application/json", ...authHead(token) }, body: JSON.stringify(body) }, { timeoutMs });
  let j = null; try { j = await r.json(); } catch { j = null; }
  if (!r.ok) throw Object.assign(new Error(j?.error || `HTTP ${r.status}`), { status: r.status, body: j });
  return j;
}
/** The server's error for a failed request → the app's reason (with the month's limit and reset date when it applies). */
function why(e, extra = {}) {
  if (e?.status === 401 && e?.body?.error === "sign-in-required") return { ok: false, why: "signin" };
  if (e?.status === 429 && e?.body?.error === "monthly-limit") return { ok: false, why: "limit", limit: Number(e.body.limit) || 0, resetsOn: String(e.body.resetsOn || "") };
  if (e?.status === 503) return { ok: false, why: "unset" };
  if (e?.status === 429) return { ok: false, why: "busy" };
  if (extra.nosources && e?.status === 502) return { ok: false, why: "nosources" };
  if (extra.photo && e?.status === 413) return { ok: false, why: "toobig" };
  if (extra.photo && (e?.status === 415 || e?.status === 400)) return { ok: false, why: "notimage" };
  if (e?.network) return { ok: false, why: "offline" };
  return { ok: false, why: "error" };
}

/** This month's allowance for the signed-in person: { evidence|chat|weekly|meal: { used, limit } , resetsOn } or null. */
export async function aiUsage(token) {
  try {
    const r = await apiFetch("/api/ai/usage", { method: "GET", headers: authHead(token) }, { timeoutMs: 8000 });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.usage && typeof j.usage === "object" ? { ...j.usage, resetsOn: String(j.resetsOn || "") } : null;
  } catch { return null; }
}

/** "ready" | "unset" (the server has no key) | "offline" | "error". */
export async function aiStatus() {
  try {
    const r = await apiFetch("/api/ai/status", { method: "GET" }, { timeoutMs: 8000 });
    if (!r.ok) return r.status === 404 ? "unset" : "error";
    const j = await r.json();
    return j && j.ready === true ? "ready" : "unset";
  } catch (e) {
    return e?.network ? "offline" : "error";
  }
}

/** POST the shown body. → { ok: true, data } | { ok: false, why: "unset" | "busy" | "offline" | "signin" | "limit" | "error" }. */
export async function aiSend(kind, body, token = null) {
  try {
    return { ok: true, data: await postAi(kind === "chat" ? "/api/ai/chat" : "/api/ai/weekly", body, token, 20000) };
  } catch (e) { return why(e); }
}

/** Task 3, Ask with evidence (Pro): POST the shown body. → { ok: true, data } | { ok: false, why: "unset" | "busy" | "offline" | "nosources" | "signin" | "limit" | "error" }.
    A web-searching answer takes longer, so this waits up to 75 seconds. */
export async function askEvidence(body, token = null) {
  try {
    return { ok: true, data: await postAi("/api/ai/evidence", body, token, 75000) };
  } catch (e) { return why(e, { nosources: true }); }
}

/** Meal photos (Pro; docs/plans/meal-photos.md): POST the shown body, { image: { media_type, data } } and nothing else.
    → { ok: true, data } | { ok: false, why: "unset" | "busy" | "offline" | "signin" | "limit" | "toobig" | "notimage" | "error" }.
    Reading a photo takes longer than a chat answer, so this waits up to 40 seconds. */
export async function mealSend(body, token = null) {
  try {
    return { ok: true, data: await postAi("/api/ai/meal", body, token, 40000) };
  } catch (e) { return why(e, { photo: true }); }
}
