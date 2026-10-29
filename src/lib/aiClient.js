/* Requests for Cyra's weekly write-up and chat (calm R8). Called only by App.jsx, only for a Pro plan in a build with
   the ai flag and a server, only after she turned the feature on, and (for the two POSTs) only after she tapped Send in
   "What Cyra will send". The POST body is exactly the object she was shown; nothing is added here.
   aiStatus() asks the server whether Cyra's AI is set up (GET, no body, nothing about her). */
import { apiFetch, apiPost } from "./api.js";

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

/** POST the shown body. → { ok: true, data } | { ok: false, why: "unset" | "busy" | "offline" | "error" }. */
export async function aiSend(kind, body) {
  try {
    const data = await apiPost(kind === "chat" ? "/api/ai/chat" : "/api/ai/weekly", body, { timeoutMs: 20000 });
    return { ok: true, data };
  } catch (e) {
    if (e?.status === 503) return { ok: false, why: "unset" };
    if (e?.status === 429) return { ok: false, why: "busy" };
    if (e?.network) return { ok: false, why: "offline" };
    return { ok: false, why: "error" };
  }
}
