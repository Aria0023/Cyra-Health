import { dayScore, fmt, localDay, isRoughNight, sleepLink, SLEEP_LINK, addDays as engineAddDays } from "./engine.js";
import { SYM_FAMILY } from "./constants.js";

/* On-device summaries and links (L8). Pure functions over the check-in record: no React, no state, no storage, no
   network. Nothing here is saved or sent; App and the screens call them on render. An AI pattern report
   (plan.aiPatternReports, false in src/lib/plan.js) is not built and has no UI.
   Every function reads only a day's date, symptom severities (sym), its "Last night" answer (sleepQ) and the
   score scales (through dayScore). A day note and fertility signs are never read, so they can't reach any output. */

/* ---------- small helpers ---------- */
/** The local day n days after iso (n may be negative), YYYY-MM-DD (engine.js addDays). */
export const addDays = (iso, n) => engineAddDays(iso, n);
/** A whole-day number for an ISO day (days since 1970-01-01, UTC), for the daily rotation. */
export const dayNumber = (iso) => Math.round(Date.parse(iso + "T00:00:00Z") / 86400000);
/** First letter lower-cased: "Brain fog" → "brain fog". */
export const lc1 = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
/** A label that reads as plural: Hot flashes / Headaches / Cravings yes; Breast tenderness / Vaginal dryness /
    Anxiety / Low energy no. */
export const isPlural = (label) => /[^s]s$/i.test(label || "");
/** "were" for a plural label, "was" otherwise. */
export const be = (label) => (isPlural(label) ? "were" : "was");
/** The verb agreeing with the label: verbS("Headaches", "cluster") → "cluster"; verbS("Low energy", "cluster") → "clusters". */
export const verbS = (label, base) => (isPlural(label) ? base : base + "s");
const DAYW = (k) => (k === 1 ? "day" : "days");
const NIGHTW = (k) => (k === 1 ? "night" : "nights");
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const inRange = (e, from, to) => !!e && typeof e.date === "string" && e.date >= from && e.date <= to;
const sev = (e, id) => (e && e.sym ? e.sym[id] || 0 : 0);

/* ---------- weekly and monthly summary ---------- */
/** Wording and the compare minimum (logged days needed on BOTH sides before a change is named) per window length. */
export const SUMMARY = Object.freeze({
  7: Object.freeze({ cur: "the last 7 days", prev: "the week before", compareMin: 3 }),
  30: Object.freeze({ cur: "the last 30 days", prev: "the 30 days before", compareMin: 10 }),
});

/** The last n calendar days (today and the n − 1 before) against the n before them.
    scale is the day-score divisor (App passes SCORE_SCALE[stage], so these scores equal the Calendar's and Home's).
    Returns { n, from, to, prevFrom, prevTo, logged, prevLogged, compare, score, prevScore, diff, calm, prevCalm,
    rough, prevRough, top: [{ id, label, days, prevDays }] (≤ 3), cells: [{ iso, score|null }] (oldest first) }.
    Works for pregnancy entries too (GSYM ids, no sleepQ: rough is 0). */
export function periodSummary(sorted, ids, labels, todayIso, n, scale = ids.length) {
  const from = addDays(todayIso, -(n - 1)), to = todayIso;
  const prevFrom = addDays(from, -n), prevTo = addDays(from, -1);
  const list = Array.isArray(sorted) ? sorted : [];
  const cur = list.filter((e) => inRange(e, from, to)), prev = list.filter((e) => inRange(e, prevFrom, prevTo));
  const compareMin = (SUMMARY[n] || { compareMin: Math.max(1, Math.ceil(n / 3)) }).compareMin;
  const scoreOf = (e) => dayScore(e, ids, scale);
  const avg = (rows) => (rows.length ? Math.round(mean(rows.map(scoreOf)) * 100) : null);
  const score = avg(cur), prevScore = avg(prev);
  const calmOf = (rows) => rows.filter((e) => scoreOf(e) > 0.64).length;
  const daysOf = (rows, id) => rows.filter((e) => sev(e, id) > 0).length;
  const top = ids
    .map((id, i) => ({ id, i, days: daysOf(cur, id), total: cur.reduce((a, e) => a + sev(e, id), 0) }))
    .filter((o) => o.days > 0)
    .sort((a, b) => b.days - a.days || b.total - a.total || a.i - b.i)
    .slice(0, 3)
    .map((o) => ({ id: o.id, label: (labels && labels[o.id]) || o.id, days: o.days, prevDays: daysOf(prev, o.id) }));
  const by = new Map(cur.map((e) => [e.date, e]));
  const cells = Array.from({ length: n }, (_, i) => {
    const iso = addDays(from, i), e = by.get(iso);
    return { iso, score: e ? scoreOf(e) : null };
  });
  return {
    n, from, to, prevFrom, prevTo,
    logged: cur.length, prevLogged: prev.length,
    compare: cur.length >= compareMin && prev.length >= compareMin,
    score, prevScore, diff: score != null && prevScore != null ? score - prevScore : null,
    calm: calmOf(cur), prevCalm: calmOf(prev),
    rough: cur.filter(isRoughNight).length, prevRough: prev.filter(isRoughNight).length,
    top, cells,
  };
}

/** Two or three plain sentences for a periodSummary result (an observation, never a cause). */
export function summarySentences(s) {
  const { cur, prev } = SUMMARY[s.n] || { cur: `the last ${s.n} days`, prev: `the ${s.n} days before` };
  if (s.logged === 0) {
    const out = [`No check-ins in ${cur} yet.`];
    if (s.prevLogged > 0) out.push(`You logged ${s.prevLogged} ${DAYW(s.prevLogged)} ${prev}.`);
    return out;
  }
  const s1 = `You checked in on ${s.logged} of ${cur}`
    + (s.prevLogged > 0 ? (s.logged > s.prevLogged ? `, up from ${s.prevLogged}` : s.logged < s.prevLogged ? `, down from ${s.prevLogged}` : `, the same as ${prev}`) : "") + ".";
  const s2 = s.logged === 1 ? `That day's score was ${s.score}.`
    : `Your average day score was ${s.score}`
      + (s.compare ? (s.diff >= 3 ? `, ${s.diff} points better than ${prev}` : s.diff <= -3 ? `, ${-s.diff} points lower than ${prev}` : `, about the same as ${prev}`) : "") + ".";
  const roughCmp = s.compare ? (s.rough > s.prevRough ? `, up from ${s.prevRough}` : s.rough < s.prevRough ? `, down from ${s.prevRough}` : `, the same as ${prev}`) : "";
  const roughPart = s.rough > 0 ? `${s.rough} rough ${NIGHTW(s.rough)}${roughCmp}` : `no rough nights${s.compare && s.prevRough > 0 ? `, down from ${s.prevRough}` : ""}`;
  const t0 = s.top[0], t1 = s.top[1];
  const symPart = t0 ? `${t0.label} showed up most (${t0.days} ${DAYW(t0.days)})` + (t1 ? `, then ${lc1(t1.label)} (${t1.days})` : "") : null;
  const s3 = symPart ? `${symPart}, with ${roughPart}.` : `You logged no symptoms and ${roughPart}.`;
  return [s1, s2, s3];
}

/** "Oct 16–Oct 22", plus " · compared with Oct 9–Oct 15" when the window before has a check-in. */
export const summaryMeta = (s) => `${fmt(s.from)}–${fmt(s.to)}` + (s.prevLogged > 0 ? ` · compared with ${fmt(s.prevFrom)}–${fmt(s.prevTo)}` : "");

/** Home's "Month vs last month" recap from the 30-day periodSummary: the same numbers as Patterns "This month",
    or null until both 30-calendar-day windows have compareMin (10) logged days. Shape { score, calm, poor, top }, each
    as [before, now] (top: { label, prev, now } or null). */
export const recapFrom = (m) => (m && m.compare ? {
  score: [m.prevScore, m.score], calm: [m.prevCalm, m.calm], poor: [m.prevRough, m.rough],
  top: m.top[0] ? { label: m.top[0].label, prev: m.top[0].prevDays, now: m.top[0].days } : null,
} : null);

/* ---------- symptom by cycle day ---------- */
/** maxCycles: the last N logged starts; win: the window's length in cycle days; maxDay: cycle days counted; minTotal:
    days the symptom was logged in all; minIn: of them inside the window; minLoggedIn: logged days inside the window;
    minCycles: distinct cycles among the window's hits; minRatio / minDiff: how much likelier than the other cycle days. */
export const CLUSTER = Object.freeze({ maxCycles: 4, win: 4, maxDay: 45, minTotal: 6, minIn: 4, minLoggedIn: 5, minCycles: 2, minRatio: 2, minDiff: 0.25 });

/** Where in the cycle a symptom shows up most. Every logged start counts, including cycles she left out of
    predictions (D5: outliers change predictions only). Returns { id, ok, why, ... }: why "starts" (fewer than two
    starts), "few" (fewer than minTotal days), "nowin" (no window meets the minimums), "no-cluster" (not likely enough
    against the other cycle days) or null; with a window: from, to, inWin, loggedIn, restHits, restLogged, cycles,
    nCycles, total, rate, restRate, strength (ranking only, never shown). */
export function cycleDayCluster(sorted, starts, id, { todayIso = localDay(), ...over } = {}) {
  const c = { ...CLUSTER, ...over };
  const st = (Array.isArray(starts) ? starts : []).slice(-c.maxCycles);
  if (st.length < 2) return { id, ok: false, why: "starts", nCycles: st.length, total: 0 };
  const rows = [];
  for (const e of Array.isArray(sorted) ? sorted : []) {
    if (!inRange(e, st[0], todayIso) || !e.sym || !(id in e.sym)) continue;
    let ci = 0;
    for (let i = 0; i < st.length; i++) if (st[i] <= e.date) ci = i;
    const cd = Math.round((Date.parse(e.date + "T00:00:00Z") - Date.parse(st[ci] + "T00:00:00Z")) / 86400000) + 1;
    if (cd > c.maxDay) continue;
    rows.push({ ci, cd, hit: (e.sym[id] || 0) > 0 });
  }
  const total = rows.filter((r) => r.hit).length, logged = rows.length;
  const base = { id, nCycles: st.length, total };
  if (total < c.minTotal) return { ...base, ok: false, why: "few" };
  let best = null;
  for (let s = 1; s <= c.maxDay - c.win + 1; s++) {
    const inside = rows.filter((r) => r.cd >= s && r.cd <= s + c.win - 1);
    const hits = inside.filter((r) => r.hit);
    const cycles = new Set(hits.map((r) => r.ci)).size;
    const restLogged = logged - inside.length;
    if (hits.length < c.minIn || inside.length < c.minLoggedIn || cycles < c.minCycles || restLogged <= 0) continue;
    const rate = hits.length / inside.length;
    if (!best || rate > best.rate || (rate === best.rate && hits.length > best.inWin)) best = { s, rate, inWin: hits.length, loggedIn: inside.length, cycles, restLogged };
  }
  if (!best) return { ...base, ok: false, why: "nowin" };
  const restHits = total - best.inWin;
  const restRate = restHits / best.restLogged;
  const ok = best.rate >= c.minRatio * restRate - 1e-9 && best.rate - restRate >= c.minDiff - 1e-9;
  return {
    ...base, ok, why: ok ? null : "no-cluster",
    from: best.s, to: best.s + c.win - 1, inWin: best.inWin, loggedIn: best.loggedIn, restHits, restLogged: best.restLogged,
    cycles: best.cycles, rate: best.rate, restRate, strength: best.rate / Math.max(restRate, 0.5 / (best.restLogged + 1)),
  };
}

/* ---------- findings: sleep links and cycle-day clusters, with their copy ---------- */
const ADVICE_HF = "Hot flashes are treatable: ask about hormone-therapy eligibility — and if that's not for you, SSRIs or the newer NK3-antagonist class are options to discuss.";
const ADVICE_ENERGY = "A link in your log, not proof that one causes the other. If low energy lasts for weeks even after good nights, thyroid, iron and vitamin D are simple blood tests worth asking about.";
const ADVICE_SLEEP = "A link in your log, not proof that one causes the other. Sleep is worth treating in its own right: CBT-I is the first-line, drug-free option, and better nights often ease other symptoms.";
const ADVICE_CYCLE = "Knowing when it tends to come lets you plan around it — lighter days, and what helps you within reach. Cycles shift, so treat this as a likely window, not a date.";
const fmtRatio = (r) => (r >= 10 ? String(Math.round(r)) : r.toFixed(1));

function sleepFinding(l, label, energyId) {
  const L = label, lc = lc1(L), a = l.rough.hits, n = l.rough.n, b = l.good.hits, m = l.good.n;
  const R = l.ratio != null ? fmtRatio(l.ratio) : null;
  const advice = l.id === "hf" ? { urgency: "visit", text: ADVICE_HF } : l.id === energyId ? { urgency: "self", text: ADVICE_ENERGY } : { urgency: "self", text: ADVICE_SLEEP };
  return {
    key: `sleep:${l.id}`, kind: "sleep", id: l.id, label: L, fam: SYM_FAMILY[l.id] || "body", tier: 1, strength: l.strength,
    num: R != null ? `${R}×` : `${a}/${n}`,
    text: R != null
      ? `In your log, ${lc} ${be(L)} moderate or strong ${R}× as often after a rough night: on ${a} of ${n} days after a rough night, and ${b} of ${m} after a night you slept well.`
      : `In your log, ${lc} ${be(L)} moderate or strong on ${a} of ${n} days after a rough night, and on none of the ${m} days after a night you slept well.`,
    // Home's two-line card (measured at 390px): "flared up" stands for moderate or strong; the Patterns card says it in full.
    homeNum: R != null ? `${R}×` : `${a}/${n}`,
    homeText: R != null
      ? `In your log, ${lc} flared up ${R}× as often after a rough night.`
      : `In your log, ${lc} flared up after ${a} of ${n} rough nights.`,
    advice, askId: l.id === "hf" ? "hf" : l.id === energyId ? energyId : "slp",
  };
}
function sleepChecked(l, L) {
  const a = l.rough.hits, n = l.rough.n, b = l.good.hits, m = l.good.n;
  if (l.why === "few-nights") return `${L} and sleep: ${n} ${DAYW(n)} after a rough night and ${m} after a night you slept well so far — not enough to compare yet.`;
  if (l.why === "few-hits") { const h = a + b; return `${L} and sleep: moderate or strong on ${h} ${DAYW(h)} so far — not enough to compare yet.`; }
  return `${L} and sleep: ${a} of ${n} days after a rough night, ${b} of ${m} after a night you slept well — ${l.ok ? "a link" : "no clear link"}.`;
}
function cycleFinding(k, label) {
  const L = label, lc = lc1(L);
  return {
    key: `cycle:${k.id}`, kind: "cycle", id: k.id, label: L, fam: SYM_FAMILY[k.id] || "body", tier: 1, strength: k.strength,
    num: `Days ${k.from}–${k.to}`,
    // Home's .num column is narrower than "Days 38–41" allows on two lines; the text names the cycle days.
    homeNum: `${k.from}–${k.to}`,
    text: `In your log, ${lc} showed up most on cycle days ${k.from}–${k.to}: ${k.inWin} of the ${k.loggedIn} days you logged there, against ${k.restHits} of ${k.restLogged} on your other cycle days. Seen in ${k.cycles} of your last ${k.nCycles} cycles.`,
    homeText: `In your log, ${lc} ${verbS(L, "cluster")} on cycle days ${k.from}–${k.to}.`,
    advice: { urgency: "self", text: ADVICE_CYCLE }, askId: k.id,
  };
}
function cycleChecked(k, L) {
  if (k.ok) return `${L} by cycle day: ${k.inWin} of ${k.loggedIn} logged days on cycle days ${k.from}–${k.to}, ${k.restHits} of ${k.restLogged} on your other cycle days — a cluster.`;
  if (k.why === "few") return `${L} by cycle day: logged on ${k.total} ${DAYW(k.total)} in these cycles so far — not enough to compare yet.`;
  return `${L} by cycle day — no clear cluster.`;
}
export const NEED_STARTS_LINE = "By cycle day: Cyra needs two logged period starts to compare cycle days.";

/** Every check Cyra runs on Patterns, over the last `days` calendar days (sleep) and the last 4 logged cycles.
    Sleep candidates: the 3 symptoms logged on the most days in the window (never Sleep disruption itself: at ≥ 2 it already
    marks the night rough), plus
    energyId when it is tracked, logged at least once and not already among them. Cycle candidates (only when
    `cycles`; menopause passes false): the 4 symptoms logged on the most days since the oldest of the last 4 starts.
    Returns { sleep: Finding[], cycle: Finding[] (qualified, strongest first), checked: string[] (one line per
    candidate, in candidate order), cyclesUsed, links } — links (calm R6): every candidate checked, qualified or not,
    as { kind: "sleep", id, label, fam, l (engine sleepLink), advice, askId } | { kind: "cycle", id, label, fam, k
    (cycleDayCluster), advice, askId }, in candidate order, for the Patterns cards (lib/patterns.js). */
export function patternFindings({ sorted, ids, labels, starts, todayIso, energyId = null, cycles = true, days = 60 }) {
  const list = Array.isArray(sorted) ? sorted : [];
  const labelOf = (id) => (labels && labels[id]) || id;
  const from = addDays(todayIso, -(days - 1));
  const rank = (rows, pool) => pool
    .map((id, i) => ({ id, i, c: rows.filter((e) => sev(e, id) > 0).length }))
    .filter((o) => o.c > 0)
    .sort((a, b) => b.c - a.c || a.i - b.i)
    .map((o) => o.id);
  const win = list.filter((e) => inRange(e, from, todayIso));
  const sleepIds = rank(win, ids.filter((id) => id !== "slp")).slice(0, 3);
  if (energyId && energyId !== "slp" && ids.includes(energyId) && !sleepIds.includes(energyId) && win.some((e) => sev(e, energyId) > 0)) sleepIds.push(energyId);
  const checked = [], sleep = [], cycle = [], links = [];
  for (const id of sleepIds) {
    const l = sleepLink(list, id, { from, to: todayIso });
    checked.push(sleepChecked(l, labelOf(id)));
    const f = sleepFinding(l, labelOf(id), energyId);
    links.push({ kind: "sleep", id, label: labelOf(id), fam: f.fam, l, advice: f.advice, askId: f.askId });
    if (l.ok) sleep.push(f);
  }
  let cyclesUsed = 0;
  if (cycles) {
    const st = (Array.isArray(starts) ? starts : []).slice(-CLUSTER.maxCycles);
    cyclesUsed = st.length;
    if (st.length < 2) checked.push(NEED_STARTS_LINE);
    else {
      const since = list.filter((e) => inRange(e, st[0], todayIso));
      for (const id of rank(since, ids).slice(0, 4)) {
        const k = cycleDayCluster(list, st, id, { todayIso });
        checked.push(cycleChecked(k, labelOf(id)));
        links.push({ kind: "cycle", id, label: labelOf(id), fam: SYM_FAMILY[id] || "body", k, advice: { urgency: "self", text: ADVICE_CYCLE }, askId: id });
        if (k.ok) cycle.push(cycleFinding(k, labelOf(id)));
      }
    }
  }
  const byStrength = (a, b) => b.strength - a.strength;
  return { sleep: sleep.sort(byStrength), cycle: cycle.sort(byStrength), checked, cyclesUsed, links };
}

/** Home's Today's insight: the strongest finding that is new (not in earlierKeys, the keys that qualified 7 days ago),
    else a daily rotation through the three strongest. Ranked by tier (0 first: the perimenopause variability marker),
    then strength. null for an empty list. */
export function homePick(cands, earlierKeys, todayIso) {
  if (!Array.isArray(cands) || !cands.length) return null;
  const ranked = [...cands].sort((a, b) => a.tier - b.tier || b.strength - a.strength);
  const before = earlierKeys instanceof Set ? earlierKeys : new Set(earlierKeys || []);
  const fresh = ranked.filter((c) => !before.has(c.key));
  if (fresh.length) return fresh[0];
  const k = Math.min(3, ranked.length);
  return ranked[((dayNumber(todayIso) % k) + k) % k];
}

/* The thresholds, for the "How Cyra finds these" copy and its test. */
export { SLEEP_LINK };
