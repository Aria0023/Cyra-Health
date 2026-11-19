// AI spend totals (docs/plans/launch-tools.md Task 2): what the Anthropic API reported using, per UTC day and per kind,
// so the portal can show an ESTIMATE of the cost. Anthropic's console is the bill of record.
//
// What is kept: one row per day per kind in the "ai_spend" collection,
//   { day: "YYYY-MM-DD", kind, requests, input, output, cacheWrite, cacheRead, searches }
// TOTALS ONLY, summed from each API response's `usage` object (input_tokens, output_tokens,
// cache_creation_input_tokens, cache_read_input_tokens, server_tool_use.web_search_requests). No account id, no
// address, no question, no answer, no summary, no time of day: nothing in a row is about one person or one request.
// Rows older than 400 days are deleted (once a day, on the first write of the day).
//
// Kinds: ask (the free Ask fallback), evidence (Ask with evidence; each turn of a long search is one request), chat,
// weekly (her weekly write-up) and report (the owners' weekly report). Every answered request is counted, also a
// refusal or a truncated answer: the API bills those too. A request that got no answer (network error, 5xx) has no
// usage and is not counted.
//
// The estimate: tokens x the prices in config.ai.prices (USD), which an owner can edit in the portal because prices
// change (insights/spend.js keeps the edit). The defaults below are Claude Opus 5.5's list prices on 2026-11-03, the
// model config/app.json names; a different AI_MODEL needs its own prices. The estimate always uses these prices, also
// for a request the API's refusal fallback moved to another model.
export const SPEND_KINDS = Object.freeze(["ask", "evidence", "chat", "weekly", "report"]);
export const SPEND_KEEP_DAYS = 400;
export const PRICE_FIELDS = Object.freeze(["inputPerMTok", "outputPerMTok", "cacheWritePerMTok", "cacheReadPerMTok", "webSearchPer1000"]);
export const DEFAULT_PRICES = Object.freeze({ model: "claude-opus-5-5", inputPerMTok: 4, outputPerMTok: 20, cacheWritePerMTok: 5, cacheReadPerMTok: 0.2, webSearchPer1000: 10 });
const DAY = 86_400_000;
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const int = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : 0);

/** An API response's usage → the five totals this module keeps. Anything else in it is ignored. */
export function usageTotals(usage) {
  const u = usage && typeof usage === "object" ? usage : {};
  return { input: int(u.input_tokens), output: int(u.output_tokens), cacheWrite: int(u.cache_creation_input_tokens), cacheRead: int(u.cache_read_input_tokens), searches: int(u.server_tool_use?.web_search_requests) };
}

/** Prices from config (or an owner's edit): every field a number from 0 to 100000, else the default. */
export function cleanPrices(p, base = DEFAULT_PRICES) {
  const out = { model: typeof p?.model === "string" && /^[a-z0-9][a-z0-9.-]{0,60}$/.test(p.model) ? p.model : base.model };
  for (const k of PRICE_FIELDS) { const v = Number(p?.[k]); out[k] = p?.[k] !== "" && p?.[k] != null && Number.isFinite(v) && v >= 0 && v <= 100_000 ? v : base[k]; }
  return out;
}

/** The estimated cost in USD of a row (or a sum of rows) of totals. Not rounded. */
export function costOf(t, prices = DEFAULT_PRICES) {
  const p = prices;
  return (int(t?.input) * p.inputPerMTok + int(t?.output) * p.outputPerMTok + int(t?.cacheWrite) * p.cacheWritePerMTok + int(t?.cacheRead) * p.cacheReadPerMTok) / 1_000_000 + (int(t?.searches) * p.webSearchPer1000) / 1000;
}

/** recorder.record(kind, usage) adds one answered request's totals to today's row. Never throws, never logs the usage. */
export function spendRecorder({ store, clock = Date.now, onRecord = null } = {}) {
  let prunedDay = null, chain = Promise.resolve();
  const record = (kind, usage) => {
    if (!SPEND_KINDS.includes(kind) || !usage || typeof usage !== "object") return chain;
    const t = usageTotals(usage), day = dayOf(clock());
    chain = chain.then(async () => {
      await store.apply("ai_spend", (rows) => {
        if (prunedDay !== day) { // once a day: drop what is older than the retention
          const cut = dayOf(clock() - SPEND_KEEP_DAYS * DAY);
          for (let i = rows.length - 1; i >= 0; i--) if (!(typeof rows[i].day === "string" && rows[i].day >= cut)) rows.splice(i, 1);
        }
        let r = rows.find((x) => x.day === day && x.kind === kind);
        if (!r) { r = { day, kind, requests: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, searches: 0 }; rows.push(r); }
        r.requests += 1; for (const k of Object.keys(t)) r[k] = int(r[k]) + t[k];
      });
      prunedDay = day;
      try { onRecord?.(); } catch { /* a listener never fails a count */ }
    }).catch(() => { console.warn("[cyra] ai: a spend total could not be saved"); });
    return chain;
  };
  return { record, idle: () => chain };
}
