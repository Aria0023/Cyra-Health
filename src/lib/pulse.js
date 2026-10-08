/* "You're not alone": anonymous weekly aggregates.
   What leaves the device, and only if the user opted in to contribute: the stage,
   a handful of allowlisted event flags for this week, and a random weekly token
   the server uses just to avoid counting the same device twice (it never stores
   the token). What comes back: counts, shown only once at least k people share
   them. See backend/src/modules/pulse. */
import { API_BASE, apiPost } from "./api.js";

export const PULSE_EVENTS = {
  peri: [["hf", "logged hot flashes"], ["rough_night", "had a rough night's sleep"], ["report", "opened their doctor report"]],
  periods: [["crm", "logged cramps"], ["mood_dip", "tracked a mood dip before their period"], ["heavy_day", "logged a heavy day"]],
  preg: [["nau", "logged nausea"], ["kicks", "counted kicks"], ["swl", "logged swelling"]],
};

export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  return `${y}-W${String(Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)).padStart(2, "0")}`;
}
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
/** A fresh random token each week; unlinkable across weeks. */
export function weeklyToken(current) {
  const week = weekKey();
  return current && current.week === week ? current : { week, token: randomToken() };
}

/** Events worth tallying from one saved cycle/peri day (sym severities, sleep, flow, phase). */
export function eventsForDay(stage, { sym = {}, sleepQ, flow, phase } = {}) {
  const out = [];
  if (stage === "peri") { if ((sym.hf || 0) > 0 || (sym.ns || 0) > 0) out.push("hf"); if (sleepQ === "poor") out.push("rough_night"); }
  if (stage === "periods") { if ((sym.crm || 0) > 0) out.push("crm"); if ((sym.mood || 0) > 0 && phase === "luteal") out.push("mood_dip"); if (flow === "heavy" || flow === "flood") out.push("heavy_day"); }
  if (stage === "preg") { if ((sym.nau || 0) > 0) out.push("nau"); if ((sym.swl || 0) > 0) out.push("swl"); }
  return out;
}

export async function fetchPulse(stage) {
  const r = await fetch(`${API_BASE}/api/pulse?stage=${encodeURIComponent(stage)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (!Array.isArray(j.items)) throw new Error("bad pulse payload");
  return j;
}
export const sendTally = (stage, token, events) => apiPost("/api/pulse/tally", { stage, token, events });
