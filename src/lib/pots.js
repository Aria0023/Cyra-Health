/* POTS add-on: data model, sanitizer, cross-tab merge, actions and the standing-test
   maths (docs/CYRA-BUILD-SPEC.md A13). Pure functions only: no React, no state, no
   network, no storage. Everything here runs on the device and in `node --test`.

   One persisted key, `pots`, holds the whole POTS log inside the on-device record. It is
   never written into days[] / pregLog, never part of weekly counts and never sent to
   Cyra's server or AI.

   Rules every function keeps:
   - Day keys are local "YYYY-MM-DD" (engine.js localDay), times local "HH:MM".
   - Every action returns a NEW pots object and never mutates its input.
   - A `pots` whose `v` isn't 1 (written by a newer build) is "locked": cleanPots returns
     it untouched by reference, every action returns it unchanged and mergePots keeps the
     stored copy, so an older build never overwrites data it can't read.
   - Missing is not zero: a day with no drinks has fluidMl null, never 0.
   - Derived values (rise, threshold met, totals) are computed, never stored.
   - No platform structured-clone call (it is missing on iOS 15.0-15.3 WKWebView and the
     deployment target is 15.0): freshEmpty() is a factory that builds a new object
     literal on every call. */
import { localDay } from "./engine.js";
import { THRESH, SAFETY_COPY, FEEL_STOP, POTS_SYM } from "./potsConstants.js";

/* ---------- formats and small helpers ---------- */
export const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const ID_RE = /^[a-z0-9_-]{1,32}$/;
export const TAG_RE = /^(p|t|c|x)_[a-z0-9]{1,16}$/;
const ENUM_RE = /^[a-z0-9_]{1,24}$/;
const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const matches = (re, v) => typeof v === "string" && re.test(v);
/** `def` overlaid with the fields of `x` that are defined (an explicit undefined keeps the default). */
const fill = (def, x) => ({ ...def, ...Object.fromEntries(Object.entries(isObj(x) ? x : {}).filter(([, v]) => v !== undefined)) });
const isId = (v) => matches(ID_RE, v);
const isTag = (v) => matches(TAG_RE, v);
const isIso = (v) => matches(ISO_RE, v);
const iso = (v) => (isIso(v) ? v : null);
const hhmm = (v) => (matches(HHMM_RE, v) ? v : null);
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
/** A whole number in [lo, hi] (fractions rounded), else null. */
const int = (v, lo, hi) => { if (!fin(v)) return null; const n = Math.round(v); return n >= lo && n <= hi ? n : null; };
const num = (v, lo, hi) => (fin(v) && v >= lo && v <= hi ? v : null);
const boolN = (v) => (typeof v === "boolean" ? v : null);
const boolD = (v, d) => (typeof v === "boolean" ? v : d);
const pick = (v, known, d) => (known.includes(v) ? v : d);
/** Enum values from a newer build survive: any short lowercase token is kept and renders
    as "Other"; known-value logic never branches on it. */
const en = (v) => (matches(ENUM_RE, v) ? v : null);
/** The same for schedule tokens, which may contain "-" ("1-3-5-10"). */
const sch = (v) => (matches(/^[a-z0-9_-]{1,24}$/, v) ? v : null);
const enList = (a, max = 20) => uniq((Array.isArray(a) ? a : []).filter((x) => matches(ENUM_RE, x))).slice(0, max);
const tags = (a, max) => uniq((Array.isArray(a) ? a : []).filter(isTag)).slice(0, max);
const uniq = (a) => [...new Set(a)];
const updN = (v) => (fin(v) && v >= 0 ? v : undefined);
const pad = (n) => String(n).padStart(2, "0");
/** Local "HH:MM" for a ms timestamp. */
export const nowHHMM = (ms = Date.now()) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
/** Minutes since midnight for "HH:MM". */
export const toMin = (t) => (matches(HHMM_RE, t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);

/** Copy `src` (so unknown fields from a newer build pass through), then set each listed
    field; a field whose value is undefined is removed. */
function shape(src, fields) {
  const o = isObj(src) ? { ...src } : {};
  for (const [k, v] of Object.entries(fields)) { if (v === undefined) delete o[k]; else o[k] = v; }
  return o;
}
/** Clean every entry, drop the invalid ones, keep the newest `cap` (array order). */
const list = (a, clean, cap) => (Array.isArray(a) ? a.map(clean).filter(Boolean) : []).slice(-cap);

/** Structural equality that ignores key order and undefined-valued keys. */
const canon = (v) => JSON.stringify(v, (k, x) => (isObj(x) ? Object.fromEntries(Object.keys(x).sort().filter((key) => x[key] !== undefined).map((key) => [key, x[key]])) : x));
const eq = (a, b) => canon(a) === canon(b);

/* ---------- ids ---------- */
function rand36(n) {
  const a = new Uint8Array(n);
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") globalThis.crypto.getRandomValues(a);
  else for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
  let s = "";
  for (const b of a) s += (b % 36).toString(36);
  return s;
}
/** Record id: base36 time + "-" + 4 random base36 characters. */
export const newId = () => `${Date.now().toString(36)}-${rand36(4)}`;
/** Id for her own symptom ("c_") or trigger ("x_"). */
export const newCustomId = (kind) => `${kind === "trig" ? "x" : "c"}_${rand36(8)}`;

/* ---------- the empty record ---------- */
const DEFAULT_PRESETS = () => [
  { id: "glass", label: "Glass", kind: "water", ml: 250, naMg: null },
  { id: "bottle", label: "Bottle", kind: "water", ml: 500, naMg: null },
  { id: "lyte", label: "Electrolyte drink", kind: "electrolyte", ml: 500, naMg: null },
  { id: "broth", label: "Cup of broth", kind: "broth", ml: 250, naMg: null },
  { id: "tab", label: "Salt tablet", kind: "tablet", ml: null, naMg: null },
  { id: "snack", label: "Salty snack", kind: "food", ml: null, naMg: null },
  // USDA FoodData Central: 1 tsp table salt ~ 2,325 mg sodium, so 1/4 tsp ~ 581, rounded. A conversion, not a recommendation.
  { id: "qtsp", label: "¼ tsp table salt", kind: "salt", ml: null, naMg: 580 },
];
/* The first chips default to the first 8 rows of the normative POTS_SYM table. */
const DEFAULT_SYM_TOP = () => POTS_SYM.slice(0, 8).map((x) => x.id);
const freshSettings = () => ({
  simple: false,
  teen: false,
  units: { fluid: "ml", salt: "mgNa" },
  paper: null,
  show: { test: true, fluid: true, sym: true, meds: true, move: false },
  goals: { fluidMl: null, naMg: null, by: null, set: null },
  presets: DEFAULT_PRESETS(),
  defaultFluid: "glass", defaultSalt: "tab",
  symTop: DEFAULT_SYM_TOP(),
  symHidden: [],
  customSym: [],
  customTrig: [],
  test: { method: "stand", restMin: 5, sched: "1-3-5-10", bp: false, device: null, cue: true, safetySeen: null },
  plan: [],
  testPlan: null,
  context: { status: null, onset: { ym: null, after: [] }, conditions: [] },
  questions: [],
  reportNotes: false,
  reportCycle: true,
});
/** A new, empty, switched-off POTS record (a new object every call). */
export function freshEmpty() {
  return {
    v: 1,
    epoch: null, epochAt: 0,
    on: false, since: null, offered: null, setupDone: false,
    settings: freshSettings(),
    days: {},
    tests: [],
    tilt: [],
    meds: [],
    move: { program: null, faintPause: null },
    gone: [],
  };
}
const deepFreeze = (o) => { Object.values(o).forEach((v) => { if (v && typeof v === "object") deepFreeze(v); }); return Object.freeze(o); };
/** The default value for App state: frozen, so nothing can mutate the shared default. */
export const POTS_EMPTY = deepFreeze(freshEmpty());

/** True for a `pots` this build can't read (written by a newer build): shown read-only. */
export const isLockedPots = (p) => isObj(p) && p.v !== 1;

/* ---------- sanitizer ---------- */
const [HR_LO, HR_HI] = THRESH.range.hr, [SYS_LO, SYS_HI] = THRESH.range.sys, [DIA_LO, DIA_HI] = THRESH.range.dia;
const vitals = (r) => ({ hr: int(r.hr, HR_LO, HR_HI), sys: int(r.sys, SYS_LO, SYS_HI), dia: int(r.dia, DIA_LO, DIA_HI) });

/** An intake needs an amount, or else a kind or label: a salty snack whose sodium she
    doesn't know is still logged (amount unknown, never counted as 0 in a total). */
function cleanIntake(x) {
  if (!isObj(x) || !isId(x.id) || !hhmm(x.t)) return null;
  const ml = int(x.ml, 1, 5000), naMg = int(x.naMg, 1, 20000), kind = en(x.kind), label = str(x.label, 30);
  if (ml == null && naMg == null && !kind && !label) return null;
  return shape(x, { upd: updN(x.upd), kind: kind || "other", label, ml, naMg, presetId: isId(x.presetId) ? x.presetId : undefined });
}
function cleanDose(x) {
  if (!isObj(x) || !isId(x.id) || !hhmm(x.t) || !isId(x.medId) || !en(x.state)) return null;
  return shape(x, { upd: updN(x.upd), slot: hhmm(x.slot) });
}
function cleanEp(x) {
  if (!isObj(x) || !isId(x.id) || !hhmm(x.t)) return null;
  return shape(x, {
    upd: updN(x.upd), sym: tags(x.sym, 40), sev: int(x.sev, 1, 3), pos: en(x.pos), faint: en(x.faint), injured: x.injured === true,
    mins: int(x.mins, 1, 1440), trig: tags(x.trig, 40), helped: enList(x.helped), note: str(x.note, 300), src: isId(x.src) ? x.src : undefined,
  });
}
function cleanVit(x) {
  if (!isObj(x) || !isId(x.id) || !hhmm(x.t)) return null;
  return shape(x, { upd: updN(x.upd), pos: en(x.pos), ...vitals(x) });
}
function cleanSession(x) {
  if (!isObj(x) || !isId(x.id) || !hhmm(x.t)) return null;
  return shape(x, {
    upd: updN(x.upd), mode: en(x.mode) || "other", step: int(x.step, 1, 4) || 1,
    warm: int(x.warm, 0, 30) ?? 0, main: int(x.main, 0, 120) ?? 0, cool: int(x.cool, 0, 30) ?? 0,
    guided: x.guided === true, stopped: x.stopped === true, effort: int(x.effort, 0, 10), after: int(x.after, 0, 3),
    worse: tags(x.worse, 20), faint: en(x.faint), next: en(x.next),
  });
}
/** One logged day. Sparse: a field that isn't set is absent (that is how a cleared rating,
    symptom or trigger is stored), so "missing" never reads as zero. */
function cleanDay(d) {
  if (!isObj(d)) return null;
  const o = { ...d };
  const set = (k, v, empty) => { if (v == null || (empty && empty(v))) delete o[k]; else o[k] = v; };
  const noKeys = (m) => !Object.keys(m).length, noItems = (a) => !a.length;
  set("rating", int(d.rating, 1, 4));
  set("up", int(d.up, 0, 10));
  set("quick", d.quick === true ? true : null);
  set("sym", Object.fromEntries(Object.entries(isObj(d.sym) ? d.sym : {}).filter(([k]) => isTag(k)).map(([k, v]) => [k, int(v, 1, 3)]).filter(([, v]) => v != null)), noKeys);
  set("trig", tags(d.trig, 60), noItems);
  set("intake", list(d.intake, cleanIntake, 120), noItems);
  set("iv", isObj(d.iv) ? shape(d.iv, { ml: int(d.iv.ml, 1, 5000), note: str(d.iv.note, 200) }) : null);
  set("doses", list(d.doses, cleanDose, 40), noItems);
  set("aids", Object.fromEntries(Object.entries(isObj(d.aids) ? d.aids : {}).filter(([k, v]) => isId(k) && typeof v === "boolean")), noKeys);
  set("eps", list(d.eps, cleanEp, 30), noItems);
  set("vit", list(d.vit, cleanVit, 30), noItems);
  set("move", list(d.move, cleanSession, 4), noItems);
  set("sleep", en(d.sleep));
  set("plan", Object.fromEntries(Object.entries(isObj(d.plan) ? d.plan : {}).filter(([k, v]) => isId(k) && v === true)), noKeys);
  set("note", str(d.note, 500), (s) => !s);
  return o;
}

function cleanRest(r) {
  if (!isObj(r) || num(r.min, 0, 20) == null) return null;
  return shape(r, { ...vitals(r), how: r.how === "counted" ? "counted" : undefined });
}
function cleanUpReading(r) {
  if (!isObj(r) || num(r.min, 0, 15) == null) return null;
  return shape(r, { atSec: int(r.atSec, 0, 3600), ...vitals(r), feel: tags(r.feel, 20), how: r.how === "counted" ? "counted" : undefined });
}
const byDateTime = (a, b) => (a.date === b.date ? (a.t < b.t ? -1 : a.t > b.t ? 1 : 0) : a.date < b.date ? -1 : 1);
function cleanTest(x) {
  if (!isObj(x) || !isId(x.id) || !isIso(x.date) || !hhmm(x.t)) return null;
  const c = isObj(x.ctx) ? x.ctx : {};
  return shape(x, {
    upd: updN(x.upd) ?? 0, edited: x.edited === true,
    // Values from a newer build pass through (shown as "Other"); only an unreadable one falls back.
    method: en(x.method) || "stand", restPos: en(x.restPos) || "back", restMin: int(x.restMin, 1, 30) ?? 5,
    sched: sch(x.sched) || "1-3-5-10", bp: x.bp === true, device: en(x.device),
    ctx: shape(c, { meds: en(c.meds), rateMed: en(c.rateMed), comp: boolN(c.comp), ate2h: boolN(c.ate2h), mlBefore: int(c.mlBefore, 0, 20000) }),
    rest: list(x.rest, cleanRest, 10), up: list(x.up, cleanUpReading, 30), feel: tags(x.feel, 20), pooling: en(x.pooling),
    // Status is kept as stored (never re-derived here); only hydrate marks a stale "running"
    // test interrupted (markStaleRunning). An unreadable status can't claim "done".
    status: en(x.status) || "interrupted",
    stoppedAt: fin(x.stoppedAt) && x.stoppedAt >= 0 && x.stoppedAt <= 15 ? Math.round(x.stoppedAt * 10) / 10 : null,
    why: en(x.why), fainted: en(x.fainted), after: en(x.after), note: str(x.note, 500),
  });
}
function cleanTilt(x) {
  if (!isObj(x) || !isId(x.id) || !isIso(x.date)) return null;
  return shape(x, { upd: updN(x.upd), where: str(x.where, 80), told: str(x.told, 1000), hrRise: int(x.hrRise, 0, 200), bpNote: str(x.bpNote, 200), fainted: en(x.fainted) });
}
function cleanMed(x) {
  if (!isObj(x) || !isId(x.id)) return null;
  const name = str(x.name, 40);
  if (!name) return null;
  return shape(x, {
    upd: updN(x.upd), lib: isId(x.lib) ? x.lib : null, name, kind: en(x.kind) || "rx",
    times: uniq((Array.isArray(x.times) ? x.times : []).filter((t) => hhmm(t))).sort().slice(0, 6),
    note: str(x.note, 120), started: iso(x.started), stopped: iso(x.stopped),
  });
}
function cleanProgram(x) {
  if (!isObj(x)) return null;
  return shape(x, {
    cleared: en(x.cleared), clearedOn: iso(x.clearedOn), clearedPreg: en(x.clearedPreg), clearedPregOn: iso(x.clearedPregOn),
    pem: en(x.pem), step: int(x.step, 1, 4) || 1, start: iso(x.start),
    days: uniq((Array.isArray(x.days) ? x.days : []).map((d) => int(d, 0, 6)).filter((d) => d != null)).sort(),
    mainMin: int(x.mainMin, 5, 60), hrNote: str(x.hrNote, 120),
  });
}
const cleanCustom = (prefix) => (x) => {
  if (!isObj(x) || !matches(new RegExp(`^${prefix}_[a-z0-9]{1,16}$`), x.id)) return null;
  const label = str(x.label, 30);
  return label ? shape(x, { label, archived: x.archived === true ? true : undefined }) : null;
};
function cleanPreset(x) {
  if (!isObj(x) || !isId(x.id)) return null;
  const label = str(x.label, 30);
  return label ? shape(x, { upd: updN(x.upd), label, kind: en(x.kind) || "other", ml: int(x.ml, 1, 5000), naMg: int(x.naMg, 1, 20000) }) : null;
}
const cleanPlanItem = (x) => { if (!isObj(x) || !isId(x.id)) return null; const label = str(x.label, 40); return label ? shape(x, { label }) : null; };
const cleanQuestion = (x) => { if (!isObj(x) || !isId(x.id)) return null; const text = str(x.text, 200); return text ? shape(x, { text }) : null; };

function cleanSettings(s) {
  const d = freshSettings();
  if (!isObj(s)) return d;
  const u = isObj(s.units) ? s.units : {}, sh = isObj(s.show) ? s.show : {}, g = isObj(s.goals) ? s.goals : {}, t = isObj(s.test) ? s.test : {};
  const cx = isObj(s.context) ? s.context : {}, on = isObj(cx.onset) ? cx.onset : {};
  return shape(s, {
    simple: s.simple === true,
    teen: s.teen === true,
    // Enum settings keep a newer build's value (display falls back to the default); only an
    // unreadable value is reset. "mgNa" / "gSalt" are the two salt-unit spellings.
    units: shape(u, { fluid: en(u.fluid) || "ml", salt: matches(/^[a-zA-Z0-9_]{1,24}$/, u.salt) ? u.salt : "mgNa" }),
    paper: en(s.paper),
    show: shape(sh, Object.fromEntries(Object.entries(d.show).map(([k, v]) => [k, boolD(sh[k], v)]))),
    goals: shape(g, { fluidMl: int(g.fluidMl, 1, 5000), naMg: int(g.naMg, 1, 20000), by: en(g.by), set: iso(g.set) }),
    presets: Array.isArray(s.presets) ? list(s.presets, cleanPreset, 16) : d.presets,
    defaultFluid: isId(s.defaultFluid) ? s.defaultFluid : d.defaultFluid,
    defaultSalt: isId(s.defaultSalt) ? s.defaultSalt : d.defaultSalt,
    symTop: Array.isArray(s.symTop) ? tags(s.symTop, 8) : d.symTop,
    symHidden: tags(s.symHidden, 200),
    // Her own symptoms and triggers are archived, never deleted, so past days keep their names.
    customSym: list(s.customSym, cleanCustom("c"), 100),
    customTrig: list(s.customTrig, cleanCustom("x"), 100),
    test: shape(t, {
      method: en(t.method) || "stand", restMin: int(t.restMin, 1, 30) ?? 5, sched: sch(t.sched) || "1-3-5-10",
      bp: t.bp === true, device: en(t.device), cue: boolD(t.cue, true), safetySeen: iso(t.safetySeen),
    }),
    plan: list(s.plan, cleanPlanItem, 12),
    testPlan: en(s.testPlan),
    context: shape(cx, { status: en(cx.status), onset: shape(on, { ym: matches(YM_RE, on.ym) ? on.ym : null, after: enList(on.after) }), conditions: enList(cx.conditions) }),
    questions: list(s.questions, cleanQuestion, 10),
    reportNotes: s.reportNotes === true,
    reportCycle: boolD(s.reportCycle, true),
  });
}

/** Sanitizer for every path that sets `pots` (hydrate, restore, cross-tab adopt). Drops
    what is invalid (never throws), keeps unknown fields and newer ids / enum values, caps
    lists (keeping the newest) and sorts tests. Idempotent. Never changes a test's status.
    null / non-object / array -> a fresh empty record. v !== 1 -> returned untouched. */
export function cleanPots(raw) {
  if (!isObj(raw)) return freshEmpty();
  if (raw.v !== 1) return raw;
  const days = {};
  if (isObj(raw.days)) for (const [k, v] of Object.entries(raw.days)) { if (!isIso(k)) continue; const d = cleanDay(v); if (d) days[k] = d; }
  const m = isObj(raw.move) ? raw.move : {};
  return shape(raw, {
    v: 1,
    epoch: isId(raw.epoch) ? raw.epoch : null,
    epochAt: fin(raw.epochAt) && raw.epochAt >= 0 ? raw.epochAt : 0,
    on: raw.on === true,
    since: iso(raw.since),
    offered: iso(raw.offered),
    setupDone: raw.setupDone === true,
    settings: cleanSettings(raw.settings),
    days,
    tests: (Array.isArray(raw.tests) ? raw.tests.map(cleanTest).filter(Boolean) : []).sort(byDateTime).slice(-500),
    tilt: list(raw.tilt, cleanTilt, 50),
    meds: list(raw.meds, cleanMed, 30),
    move: shape(m, { program: cleanProgram(m.program), faintPause: iso(m.faintPause) }),
    // Tombstones are never capped within an epoch; a new epoch empties them.
    gone: uniq((Array.isArray(raw.gone) ? raw.gone : []).filter(isId)),
  });
}

/* ---------- epochs, erase, stale tests ---------- */
/** `p` with a new epoch (restore, first turn-on): a fresh epoch id, epochAt = nowMs and no
    tombstones. Another open tab then adopts it wholesale instead of merging its stale log
    back in. A locked record is returned untouched. */
export function newEpoch(p, nowMs = Date.now()) {
  if (isLockedPots(p)) return p;
  return { ...cleanPots(p), epoch: newId(), epochAt: nowMs, gone: [] };
}

/** "Delete POTS log": everything she logged or typed goes, in a new epoch so no other tab
    can merge it back. Kept: on, since, offered, setupDone and display choices only (units,
    paper size, Simple view, which cards show, top symptom order, stand-test setup, the teen
    threshold and whether notes / cycle details go in reports). */
export function eraseLog(p, nowMs = Date.now()) {
  if (isLockedPots(p)) return p;
  const c = cleanPots(p), f = freshEmpty(), s = c.settings, t = s.test;
  return {
    ...f,
    epoch: newId(), epochAt: nowMs,
    on: c.on, since: c.since, offered: c.offered, setupDone: c.setupDone,
    settings: {
      ...f.settings,
      simple: s.simple, teen: s.teen, paper: s.paper,
      units: { fluid: s.units.fluid, salt: s.units.salt },
      show: Object.fromEntries(Object.keys(f.settings.show).map((k) => [k, s.show[k]])),
      // Her own symptom ids go with their names.
      symTop: s.symTop.filter((id) => !id.startsWith("c_")),
      reportNotes: s.reportNotes, reportCycle: s.reportCycle,
      test: { ...f.settings.test, method: t.method, restMin: t.restMin, sched: t.sched, bp: t.bp, device: t.device, cue: t.cue },
    },
  };
}

/** At launch only: a "running" test untouched for more than 30 minutes is marked
    "interrupted" (it keeps every reading it saved). Returns `p` itself when nothing changed. */
export function markStaleRunning(p, nowMs = Date.now()) {
  if (!isObj(p) || isLockedPots(p) || !Array.isArray(p.tests)) return p;
  const stale = (x) => x.status === "running" && nowMs - (x.upd || 0) > THRESH.staleMin * 60000;
  if (!p.tests.some(stale)) return p;
  return { ...p, tests: p.tests.map((x) => (stale(x) ? { ...x, status: "interrupted", upd: nowMs } : x)) };
}

/* ---------- the Settings switch (design 1.2) ---------- */
/** Display units for a first turn-on, from the device language: US English shows fluid
    ounces, everything else millilitres; sodium in mg. Display only (stored ml / mg sodium). */
export const localeUnits = (lang = globalThis.navigator?.language) => ({ fluid: lang === "en-US" ? "oz" : "ml", salt: "mgNa" });
/** Settings → Add-ons → "Turn on". The first time (no `since` yet): a new epoch if there is
    none, `since` = `day`, Simple view following her check-in style (`simple`) and `units`.
    Turning on again later keeps all of those, and the log, exactly as they were. It never
    touches the life stage. A locked record comes back unchanged. */
export function turnOn(p, { day, simple = false, units = localeUnits(), nowMs = Date.now() } = {}) {
  if (isLockedPots(p)) return p;
  const c = cleanPots(p), first = !c.since;
  return {
    ...c, on: true,
    epoch: c.epoch || newId(), epochAt: c.epoch ? c.epochAt : nowMs,
    since: c.since || (isIso(day) ? day : localDay()),
    settings: first ? cleanSettings({ ...c.settings, simple: simple === true, units: { ...c.settings.units, ...(isObj(units) ? units : {}) } }) : c.settings,
  };
}
/** First-run setup finished or skipped (design 4.1): it isn't shown again. */
export const finishSetup = (p) => (isObj(p) && !isLockedPots(p) && p.setupDone !== true ? { ...p, setupDone: true } : p);
/** "Hide the POTS tab (keep my POTS log)": only the switch changes. */
export const turnOff = (p) => (isObj(p) && !isLockedPots(p) && p.on ? { ...p, on: false } : p);
/** Every change of stage INTO Pregnancy: the prenatal-team exercise answer is asked again, so
    a "yes" given before this pregnancy never carries over (design 4.10). `p` itself when there
    is nothing to clear. */
export function resetPregClearance(p) {
  const pr = isObj(p) && !isLockedPots(p) && isObj(p.move) ? p.move.program : null;
  if (!isObj(pr) || (pr.clearedPreg == null && pr.clearedPregOn == null)) return p;
  return { ...p, move: { ...p.move, program: { ...pr, clearedPreg: null, clearedPregOn: null } } };
}
/** Same content, ignoring key order and undefined-valued keys (App.jsx keeps the stored copy
    when a merge changed nothing, so two tabs never re-save the same log back and forth). */
export const samePots = (a, b) => a === b || eq(a, b);

/* ---------- cross-tab merge ---------- */
const ids = (a) => a.map((x) => x.id);
/** Did the relative order of the ids both lists share change? (Keeps a reorder of presets,
    plan items or questions through a merge.) */
function orderChanged(x, b) {
  const inX = new Set(ids(x)), inB = new Set(ids(b));
  return ids(x).filter((i) => inB.has(i)).join("\n") !== ids(b).filter((i) => inX.has(i)).join("\n");
}
/** Arrays by id: union minus tombstones. Same id, different content: if one side still
    equals the base copy take the other, else the larger `upd` (missing = 0), tie = local. */
function mergeArr(sA, lA, bA, gone) {
  const s = Array.isArray(sA) ? sA : [], l = Array.isArray(lA) ? lA : [], b = Array.isArray(bA) ? bA : [];
  const S = new Map(s.map((x) => [x.id, x])), L = new Map(l.map((x) => [x.id, x])), B = new Map(b.map((x) => [x.id, x]));
  const first = orderChanged(l, b) && !orderChanged(s, b) ? l : s;
  const order = uniq([...ids(first), ...ids(first === l ? s : l)]);
  return order.filter((id) => !gone.has(id)).map((id) => {
    const x = S.get(id), y = L.get(id), z = B.get(id);
    if (!x) return y;
    if (!y || eq(x, y)) return x;
    if (z && eq(y, z)) return x;
    if (z && eq(x, z)) return y;
    return (x.upd || 0) > (y.upd || 0) ? x : y;
  });
}
/** Per-key 3-way: local wins where local changed since the base (including "absent"). */
const leaf = (s, l, b) => (eq(l, b) ? s : l);
function mergeKeys(s, l, b, special = {}) {
  const S = isObj(s) ? s : {}, L = isObj(l) ? l : {}, B = isObj(b) ? b : {};
  const out = {};
  for (const k of uniq([...Object.keys(S), ...Object.keys(L), ...Object.keys(B)])) {
    const v = special[k] ? special[k](S[k], L[k], B[k]) : leaf(S[k], L[k], B[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}
const mergeMap = (s, l, b) => mergeKeys(s, l, b);
/** A list of ids treated as a set ({id: true}), e.g. the day's triggers. */
function mergeSet(s, l, b) {
  const asMap = (a) => Object.fromEntries((Array.isArray(a) ? a : []).map((k) => [k, true]));
  const m = mergeKeys(asMap(s), asMap(l), asMap(b));
  return uniq([...(Array.isArray(s) ? s : []), ...(Array.isArray(l) ? l : [])]).filter((k) => m[k]);
}
const DAY_ARRAYS = ["intake", "doses", "eps", "vit", "move"];
const SETTINGS_ARRAYS = ["customSym", "customTrig", "presets", "plan", "questions"];

/** Merge this tab's `local` pots into the `stored` copy another tab may have written,
    against `base` (the copy this tab last saved or adopted; potsBase in App.jsx).
    - Different epochs: the side with the larger epochAt wins wholesale (an erase or a
      restore beats a stale tab); a tie keeps stored.
    - Same epoch: a true 3-way merge (arrays by id with tombstones, per-key day scalars and
      maps, settings leaves). With no usable base, base = stored: local wins every
      difference and arrays union.
    - A locked record on either side keeps the stored copy untouched.
    Converges: mergePots(a, mergePots(a, b, base), base) equals mergePots(a, b, base). */
export function mergePots(stored, local, base) {
  if (stored == null) return local;
  if (isLockedPots(stored)) return stored;
  const s = cleanPots(stored);
  if (local == null || isLockedPots(local)) return s;
  const l = cleanPots(local);
  if (s.epoch !== l.epoch) return l.epochAt > s.epochAt ? l : s;
  const b0 = isObj(base) && !isLockedPots(base) ? cleanPots(base) : null;
  const b = b0 && b0.epoch === s.epoch ? b0 : s;
  const gone = new Set([...s.gone, ...l.gone]);
  const arr = (x, y, z) => mergeArr(x, y, z, gone);
  const dayKeys = uniq([...Object.keys(s.days), ...Object.keys(l.days)]);
  const days = {};
  for (const k of dayKeys) {
    const bd = b.days[k] || {};
    days[k] = mergeKeys(s.days[k] || bd, l.days[k] || bd, bd, { sym: mergeMap, aids: mergeMap, plan: mergeMap, trig: mergeSet, ...Object.fromEntries(DAY_ARRAYS.map((a) => [a, arr])) });
  }
  const merged = mergeKeys(s, l, b, {
    v: () => 1, epoch: () => s.epoch, epochAt: () => s.epochAt,
    settings: (x, y, z) => mergeKeys(x, y, z, Object.fromEntries(SETTINGS_ARRAYS.map((a) => [a, arr]))),
    days: () => days,
    tests: arr, tilt: arr, meds: arr,
    move: (x, y, z) => mergeKeys(x, y, z),
    gone: () => uniq([...s.gone, ...l.gone]),
  });
  return cleanPots(merged);
}

/* ---------- actions (each returns a new pots; a locked record comes back unchanged) ---------- */
const guard = (fn) => (p, ...a) => (!isObj(p) || isLockedPots(p) ? p : fn(p, ...a));
/** Apply `fn` to one day (created empty if new) and re-clean it. */
function withDay(p, day, fn) {
  if (!isIso(day)) return p;
  const cur = (p.days || {})[day] || {};
  const next = fn(cur);
  if (next == null || next === cur) return p;
  const nd = cleanDay(next);
  // Clearing something on a day that was never logged creates no empty day.
  if (!nd || (!(p.days || {})[day] && !Object.keys(nd).length)) return p;
  return { ...p, days: { ...p.days, [day]: nd } };
}
/** Add a cleaned item to a capped list, keeping the newest `cap` (as cleanPots does), so
    a new entry is never silently refused; null when invalid, a duplicate or tombstoned. */
function appendItem(p, arr, item, clean, cap) {
  const it = clean(item);
  if (!it || (p.gone || []).includes(it.id) || (arr || []).some((x) => x.id === it.id)) return null;
  return [...(arr || []), it].slice(-cap);
}
const withNewId = (x) => ({ ...x, id: isId(x && x.id) ? x.id : newId() });

/** Log a drink, broth, tablet, snack or salt. Pass `id` (from newId) to undo it later. */
export const addIntake = guard((p, day, item) => withDay(p, day, (d) => {
  const intake = appendItem(p, d.intake, withNewId(fill({ t: nowHHMM() }, item)), cleanIntake, 120);
  return intake ? { ...d, intake } : d;
}));
/** IV fluids given by a clinic: { ml, note } or null to clear. Never added to the oral total. */
export const setIv = guard((p, day, iv) => withDay(p, day, (d) => {
  const o = { ...d };
  if (iv == null) delete o.iv; else o.iv = { ml: int(iv.ml, 1, 5000), note: str(iv.note, 200) };
  return o;
}));
/** Remove an intake, dose, episode, reading or session by id, and tombstone it. */
export const removeItem = guard((p, day, id) => {
  const d = (p.days || {})[day];
  if (!d || !isId(id)) return p;
  const key = DAY_ARRAYS.find((k) => (d[k] || []).some((x) => x.id === id));
  if (!key) return p;
  const q = withDay(p, day, (x) => ({ ...x, [key]: x[key].filter((i) => i.id !== id) }));
  return { ...q, gone: uniq([...q.gone, id]) };
});
/** "How's today?": 1 Good, 2 Okay, 3 Rough, 4 Bad; null clears. */
export const setRating = guard((p, day, r) => withDay(p, day, (d) => ({ ...d, rating: int(r, 1, 4) })));
/** "How much did being upright bother you today?" 0-10; null clears. */
export const setUp = guard((p, day, n) => withDay(p, day, (d) => ({ ...d, up: int(n, 0, 10) })));
/** The day's worst severity for one symptom, 0-3; 0 removes it. */
export const setSym = guard((p, day, id, v) => {
  if (!isTag(id)) return p;
  return withDay(p, day, (d) => {
    const sym = { ...(d.sym || {}) }, n = int(v, 0, 3) || 0;
    if (n) sym[id] = n; else delete sym[id];
    return { ...d, sym };
  });
});
/** Chip tap: 0 -> 1 -> 2 -> 3 -> 0. */
export const cycleSym = guard((p, day, id) => setSym(p, day, id, (((((p.days || {})[day] || {}).sym || {})[id] || 0) + 1) % 4));
export const toggleTrig = guard((p, day, id) => {
  if (!isTag(id)) return p;
  return withDay(p, day, (d) => { const t = d.trig || []; return { ...d, trig: t.includes(id) ? t.filter((x) => x !== id) : [...t, id] }; });
});
/** Log an episode. Needs at least one symptom or a faint. An episode with `src` (made from
    a stand test or session faint answer) replaces the day's earlier one with the same src,
    keeping her own edits to it. */
export const addEpisode = guard((p, day, ep) => {
  if (!isObj(ep)) return p;
  const hasSym = tags(ep.sym, 40).length > 0;
  if (!hasSym && ep.faint !== "yes" && ep.faint !== "almost") return p;
  return withDay(p, day, (d) => {
    const eps = d.eps || [];
    const ex = isId(ep.src) ? eps.find((e) => e.src === ep.src) : null;
    if (ex) {
      const it = cleanEp({ ...ex, ...ep, id: ex.id, upd: Date.now() });
      return it ? { ...d, eps: eps.map((e) => (e.id === ex.id ? it : e)) } : d;
    }
    const next = appendItem(p, eps, withNewId(fill({ t: nowHHMM(), sym: [], sev: null, pos: null, faint: null, injured: false, mins: null, trig: [], helped: [], note: "" }, ep)), cleanEp, 30);
    return next ? { ...d, eps: next } : d;
  });
});
/** Took it / Skipped. A dose for a planned slot replaces that slot's earlier entry. */
export const logDose = guard((p, day, dose) => {
  if (!isObj(dose) || !isId(dose.medId)) return p;
  return withDay(p, day, (d) => {
    const doses = d.doses || [];
    const slot = hhmm(dose.slot);
    const ex = slot ? doses.find((x) => x.medId === dose.medId && x.slot === slot) : null;
    if (ex) {
      const it = cleanDose({ ...ex, state: dose.state, t: dose.t || ex.t, upd: Date.now() });
      return it ? { ...d, doses: doses.map((x) => (x.id === ex.id ? it : x)) } : d;
    }
    const next = appendItem(p, doses, withNewId({ ...fill({ t: nowHHMM(), state: "taken" }, dose), slot }), cleanDose, 40);
    return next ? { ...d, doses: next } : d;
  });
});
/** A support (compression etc.) worn today: true / false, or null for "not answered". */
export const setAid = guard((p, day, medId, v) => {
  if (!isId(medId)) return p;
  return withDay(p, day, (d) => { const aids = { ...(d.aids || {}) }; if (typeof v === "boolean") aids[medId] = v; else delete aids[medId]; return { ...d, aids }; });
});
/** A single heart-rate / blood-pressure reading by position. */
export const addVitals = guard((p, day, v) => {
  if (!isObj(v)) return p;
  const r = vitals(v);
  if (r.hr == null && r.sys == null && r.dia == null) return p;
  return withDay(p, day, (d) => { const vit = appendItem(p, d.vit, withNewId({ ...fill({ t: nowHHMM(), pos: null }, v), ...r }), cleanVit, 30); return vit ? { ...d, vit } : d; });
});
export const addSession = guard((p, day, s) => withDay(p, day, (d) => {
  const move = appendItem(p, d.move, withNewId(fill({ t: nowHHMM() }, s)), cleanSession, 4);
  return move ? { ...d, move } : d;
}));
export const updateSession = guard((p, day, id, patch) => withDay(p, day, (d) => {
  const move = d.move || [], ex = move.find((x) => x.id === id);
  if (!ex || !isObj(patch)) return d;
  const it = cleanSession({ ...ex, ...patch, id: ex.id, upd: Date.now() });
  return it ? { ...d, move: move.map((x) => (x.id === id ? it : x)) } : d;
}));
/** "Sleep last night": good / fair / poor, or null to clear. */
export const setSleep = guard((p, day, q) => withDay(p, day, (d) => ({ ...d, sleep: q == null ? null : en(q) })));
/** "Note for your clinician" (500 characters). */
export const setNote = guard((p, day, s) => withDay(p, day, (d) => ({ ...d, note: str(s, 500) })));
/** Tick or un-tick one of her own plan items for the day. */
export const tickPlan = guard((p, day, planId) => {
  if (!isId(planId)) return p;
  return withDay(p, day, (d) => { const plan = { ...(d.plan || {}) }; if (plan[planId]) delete plan[planId]; else plan[planId] = true; return { ...d, plan }; });
});

/** Save a stand test (new or updated): auto-save while running and on every reading. At
    500 tests the oldest goes (as in cleanPots), so a new test is always saved. */
export const upsertTest = guard((p, t) => {
  const it = cleanTest({ ...(isObj(t) ? t : {}), upd: Date.now() });
  if (!it || p.gone.includes(it.id)) return p;
  const has = p.tests.some((x) => x.id === it.id);
  return { ...p, tests: (has ? p.tests.map((x) => (x.id === it.id ? it : x)) : [...p.tests, it]).sort(byDateTime).slice(-500) };
});
/** "Edit readings" on a finished test. `patch` = { rest?: [...], up?: [...] }, aligned by
    index with the test's readings; each entry is { hr, sys, dia } (or null = unchanged).
    Planned minute and actual time stay. Sets `edited` and a new `upd`. A changed heart
    rate is no longer a counted pulse. */
export const editTestReadings = guard((p, id, patch) => {
  const t = p.tests.find((x) => x.id === id);
  if (!t || t.status === "running" || !isObj(patch)) return p;
  let changed = false;
  const apply = (rs, ps) => rs.map((r, i) => {
    const e = Array.isArray(ps) ? ps[i] : null;
    if (!isObj(e)) return r;
    const n = { ...r };
    for (const k of ["hr", "sys", "dia"]) if (k in e) n[k] = e[k] == null ? null : vitals({ [k]: e[k] })[k];
    if (n.hr !== r.hr) delete n.how;
    if (!eq(n, r)) changed = true;
    return n;
  });
  const rest = apply(t.rest, patch.rest), up = apply(t.up, patch.up);
  if (!changed) return p;
  return upsertTest(p, { ...t, rest, up, edited: true });
});
/** Link (or unlink) the episode for a faint answer on a test or session. */
function linkFaint(p, day, src, faint, pos, t) {
  const ex = (((p.days || {})[day] || {}).eps || []).find((e) => e.src === src);
  if (faint === "yes" || faint === "almost") {
    return addEpisode(p, day, ex ? { faint, sev: faint === "yes" ? 3 : 2, src } : { t, pos, faint, sym: ["p_psy"], sev: faint === "yes" ? 3 : 2, src });
  }
  return ex ? removeItem(p, day, ex.id) : p;
}
/** Delete a test (tombstoned). Its linked faint episode stays unless keepFaint is false. */
export const deleteTest = guard((p, id, { keepFaint = true } = {}) => {
  const t = p.tests.find((x) => x.id === id);
  if (!t) return p;
  let q = { ...p, tests: p.tests.filter((x) => x.id !== id), gone: uniq([...p.gone, id]) };
  if (!keepFaint) { const ex = ((q.days[t.date] || {}).eps || []).find((e) => e.src === id); if (ex) q = removeItem(q, t.date, ex.id); }
  return q;
});
/** "Did you faint?" on a test: stores the answer; Yes / Almost also logs (or updates) one
    linked episode (stood up, "Nearly fainting", src = test id); No / null removes it.
    Counts come from episodes only, so nothing is counted twice. */
export const setTestFaint = guard((p, id, faint, t) => {
  const test0 = p.tests.find((x) => x.id === id);
  if (!test0) return p;
  const f = pick(faint, ["no", "almost", "yes"], null);
  const q = upsertTest(p, { ...test0, fainted: f });
  return linkFaint(q, test0.date, test0.id, f, "stoodup", hhmm(t) || test0.t);
});
/** The same for a movement session; Yes / Almost also pauses step-up options
    (move.faintPause) until she reports being checked. */
export const setSessionFaint = guard((p, day, id, faint, t) => {
  const s = (((p.days || {})[day] || {}).move || []).find((x) => x.id === id);
  if (!s) return p;
  const f = pick(faint, ["no", "almost", "yes"], null);
  let q = updateSession(p, day, id, { faint: f });
  q = linkFaint(q, day, id, f, "exercise", hhmm(t) || s.t);
  if (f === "yes" || f === "almost") q = { ...q, move: { ...q.move, faintPause: day } };
  return q;
});
/** A tilt-table result, kept as she was told it. */
export const addTilt = guard((p, t) => {
  const tilt = appendItem(p, p.tilt, withNewId(t), cleanTilt, 50);
  return tilt ? { ...p, tilt } : p;
});
/** Add or change a medicine or support (names, kind, planned times, her note). */
export const upsertMed = guard((p, m) => {
  const it = cleanMed(withNewId(m));
  if (!it || p.gone.includes(it.id)) return p;
  const has = p.meds.some((x) => x.id === it.id);
  if (!has && p.meds.length >= 30) return p;
  return { ...p, meds: has ? p.meds.map((x) => (x.id === it.id ? { ...it, upd: Date.now() } : x)) : [...p.meds, it] };
});
/** "I've stopped this": nothing is deleted, so before/after views still work. */
export const stopMed = guard((p, id, day) => {
  if (!isIso(day) || !p.meds.some((x) => x.id === id)) return p;
  return { ...p, meds: p.meds.map((x) => (x.id === id ? { ...x, stopped: day, upd: Date.now() } : x)) };
});
/** "Remove completely" (after a confirm): the medicine goes and is tombstoned. */
export const removeMed = guard((p, id) => (p.meds.some((x) => x.id === id) ? { ...p, meds: p.meds.filter((x) => x.id !== id), gone: uniq([...p.gone, id]) } : p));
/** Change settings. Nested objects (units, show, goals, test, context) merge one level.
    An item that leaves one of the id lists (presets, plan, questions, her own symptoms and
    triggers) is tombstoned, as removeItem does, so the next save's merge against the stored
    copy, or a stale tab, can't bring it back. A reorder keeps every id, so tombstones nothing. */
export const setSettings = guard((p, patch) => {
  if (!isObj(patch)) return p;
  const cur = p.settings, next = { ...cur };
  for (const [k, v] of Object.entries(patch)) next[k] = isObj(v) && isObj(cur[k]) ? { ...cur[k], ...v } : v;
  const settings = cleanSettings(next);
  const dropped = SETTINGS_ARRAYS.filter((k) => k in patch).flatMap((k) => { const keep = new Set(ids(settings[k])); return ids(cur[k]).filter((id) => !keep.has(id)); });
  return dropped.length ? { ...p, settings, gone: uniq([...p.gone, ...dropped]) } : { ...p, settings };
});
/** "Remove" one of her plan items: it goes and is tombstoned (a stale tab can't merge it back).
    Ticks on past days stay with their days. */
export const removePlanItem = guard((p, id) => (p.settings.plan.some((x) => x.id === id) ? setSettings(p, { plan: p.settings.plan.filter((x) => x.id !== id) }) : p));
const CUSTOM_KEY = { sym: "customSym", trig: "customTrig" };
/** Add her own symptom ("sym") or trigger ("trig"), at most 20 in use (100 with archived).
    Re-adding an archived name brings it back. */
export const addCustom = guard((p, kind, label, id) => {
  const key = CUSTOM_KEY[kind], lab = str(label, 30);
  if (!key || !lab) return p;
  const cur = p.settings[key], active = cur.filter((x) => !x.archived).length;
  const same = cur.find((x) => x.label.toLowerCase() === lab.toLowerCase());
  if (same) return same.archived && active < 20 ? { ...p, settings: { ...p.settings, [key]: cur.map((x) => (x.id === same.id ? shape(x, { archived: undefined }) : x)) } } : p;
  if (active >= 20 || cur.length >= 100) return p;
  const re = kind === "trig" ? /^x_[a-z0-9]{1,16}$/ : /^c_[a-z0-9]{1,16}$/;
  const nid = matches(re, id) ? id : newCustomId(kind);
  if (cur.some((x) => x.id === nid)) return p;
  return { ...p, settings: { ...p.settings, [key]: [...cur, { id: nid, label: lab }] } };
});
/** "Remove" her own symptom or trigger: archived, so history and reports keep its name. */
export const archiveCustom = guard((p, kind, id) => {
  const key = CUSTOM_KEY[kind];
  if (!key || !p.settings[key].some((x) => x.id === id && !x.archived)) return p;
  return { ...p, settings: { ...p.settings, [key]: p.settings[key].map((x) => (x.id === id ? { ...x, archived: true } : x)) } };
});
/** Add or change a drink / salt button (at most 16). */
export const upsertPreset = guard((p, preset) => {
  const it = cleanPreset(withNewId(preset));
  if (!it) return p;
  const cur = p.settings.presets, has = cur.some((x) => x.id === it.id);
  if (!has && cur.length >= 16) return p;
  return { ...p, settings: { ...p.settings, presets: has ? cur.map((x) => (x.id === it.id ? { ...it, upd: Date.now() } : x)) : [...cur, it] } };
});

/** "Remove" a drink / salt button: it goes and is tombstoned, so a stale tab can't merge it
    back. A default that pointed at it moves to the first remaining button of its kind. */
export const removePreset = guard((p, id) => {
  const cur = p.settings.presets;
  if (!cur.some((x) => x.id === id)) return p;
  const presets = cur.filter((x) => x.id !== id), s = { ...p.settings, presets };
  const firstOf = (fluid) => (presets.find((x) => (fluid ? x.ml != null : x.ml == null)) || {}).id;
  if (s.defaultFluid === id && firstOf(true)) s.defaultFluid = firstOf(true);
  if (s.defaultSalt === id && firstOf(false)) s.defaultSalt = firstOf(false);
  return { ...p, settings: s, gone: uniq([...p.gone, id]) };
});
/** Today's log → Edit: merge `patch` into the logged intake, dose, episode, reading or
    session with this id (sets `upd`, re-cleans it). An invalid result leaves it as it was. */
const CLEAN_ITEM = { intake: cleanIntake, doses: cleanDose, eps: cleanEp, vit: cleanVit, move: cleanSession };
export const updateItem = guard((p, day, id, patch) => {
  const d = (p.days || {})[day];
  if (!d || !isId(id) || !isObj(patch)) return p;
  const key = DAY_ARRAYS.find((k) => (d[k] || []).some((x) => x.id === id));
  if (!key) return p;
  return withDay(p, day, (x) => {
    const it = CLEAN_ITEM[key]({ ...x[key].find((i) => i.id === id), ...patch, id, upd: Date.now() });
    return it ? { ...x, [key]: x[key].map((i) => (i.id === id ? it : i)) } : x;
  });
});
/** A symptom's day severity raised to at least `sev` (Simple view "I feel bad now"); never lowered. */
export const raiseSym = guard((p, day, id, sev) => {
  const cur = ((((p.days || {})[day] || {}).sym || {})[id]) || 0, n = int(sev, 1, 3);
  return n && n > cur ? setSym(p, day, id, n) : p;
});
/** Something was logged from Simple view that day (`quick`). */
export const markQuick = guard((p, day) => withDay(p, day, (d) => (d.quick === true ? d : { ...d, quick: true })));
/** Fainting or nearly fainting during exercise: step-up options pause until she reports being
    checked (design 4.4 / 4.10; the Move section reads it). */
export const setFaintPause = guard((p, day) => (isIso(day) ? { ...p, move: { ...p.move, faintPause: day } } : p));
/** The one-time registration offer card (owner decision D2) was answered: it never returns. */
export const markOffered = guard((p, day) => (isIso(day) && p.offered !== day ? { ...p, offered: day } : p));
/** Days in the 7 ending on `day` (that day included) with at least one "almost" fainted
    episode, from every source (her episodes and test or session faint answers alike). */
export function nearFaintDays(p, day) {
  if (!isObj(p) || isLockedPots(p) || !isIso(day)) return 0;
  let n = 0, d = day;
  for (let i = 0; i < 7; i++, d = prevDay(d)) if ((((p.days || {})[d] || {}).eps || []).some((e) => e.faint === "almost")) n++;
  return n;
}

/* ---------- medicines: what's due ---------- */
/** The time a dose for planned `slot` is logged at when she taps "Took it" for it: on an
    earlier day, the slot's own time; today, the slot's time only when it is more than 3 hours
    past (she is catching up), otherwise now. Never a time that hasn't happened yet. */
export function doseTime(slot, isToday, nowMs = Date.now()) {
  const now = nowHHMM(nowMs), s = toMin(slot);
  if (s == null) return now;
  if (!isToday) return slot;
  return s < toMin(now) - 180 ? slot : now;
}
/** Medicines and supports active on `day` (started on or before it, not stopped before it). */
export const activeMeds = (p, day) => (isObj(p) && Array.isArray(p.meds) ? p.meds.filter((m) => (!m.started || m.started <= day) && (!m.stopped || m.stopped >= day)) : []);
/** Planned slots not logged yet, from `back` minutes ago to `ahead` minutes from now
    (both ends included): [{ med, slot }] in time order. Supports have no doses. */
export function dueDoses(p, day, now, { back = 180, ahead = 60 } = {}) {
  const n = toMin(now);
  if (n == null || isLockedPots(p)) return [];
  const doses = ((((p && p.days) || {})[day] || {}).doses) || [];
  const out = [];
  for (const med of activeMeds(p, day)) {
    if (med.kind === "aid") continue;
    for (const slot of med.times) {
      const m = toMin(slot);
      if (m >= n - back && m <= n + ahead && !doses.some((d) => d.medId === med.id && d.slot === slot)) out.push({ med, slot });
    }
  }
  return out.sort((a, b) => toMin(a.slot) - toMin(b.slot));
}
/** The day before an ISO day key, as a local day key. */
const prevDay = (day) => { const [y, m, d] = day.split("-").map(Number); return localDay(new Date(y, m - 1, d - 1)); };
/** What one Simple-view "Took my meds" tap would log now, and what the 30-minute repeat
    guard holds back (design §4.3):
    - If any active medicine has planned times, only those log: at most ONE dose per
      medicine per tap, for its latest unlogged slot at or before now within the last 3 h
      (else its nearest slot in the next hour). Earlier unlogged slots, and slots before one
      already logged, stay "Planned 8:00 · Took it?"; one tap never writes two doses of the
      same medicine. Medicines without times are not logged then (a once-a-day supplement
      would otherwise gain a dose on every tap).
    - If no medicine has times, each active rx / otc / supplement logs one dose.
    - A medicine with a dose logged taken in the last 30 minutes (across midnight too) is
      skipped, so a foggy double tap never records two doses.
    -> { logged: [{ medId, slot, name }], guarded: [{ medId, name, t }] } */
export function medsNowPlan(p, day, nowMs = Date.now()) {
  const out = { logged: [], guarded: [] };
  if (!isObj(p) || isLockedPots(p) || !isIso(day)) return out;
  const now = nowHHMM(nowMs), n = toMin(now);
  const days = p.days || {};
  const doses = (days[day] || {}).doses || [];
  const before = n < THRESH.repeatMin ? ((days[prevDay(day)] || {}).doses || []) : [];
  const due = dueDoses(p, day, now);
  const meds = activeMeds(p, day).filter((m) => m.kind !== "aid");
  const anyTimed = meds.some((m) => m.times.length > 0);
  for (const med of meds) {
    if (anyTimed && !med.times.length) continue;
    const taken = (a, shift) => a.filter((d) => d.medId === med.id && d.state === "taken" && Math.abs(n - (toMin(d.t) - shift)) <= THRESH.repeatMin);
    const recent = [...taken(before, 1440), ...taken(doses, 0)];
    if (recent.length) { out.guarded.push({ medId: med.id, name: med.name, t: recent[recent.length - 1].t }); continue; }
    if (!med.times.length) { out.logged.push({ medId: med.id, slot: null, name: med.name }); continue; }
    const lastLogged = Math.max(-1, ...doses.filter((d) => d.medId === med.id && d.slot).map((d) => toMin(d.slot)));
    const open = due.filter((x) => x.med.id === med.id && toMin(x.slot) > lastLogged);
    const past = open.filter((x) => toMin(x.slot) <= n);
    const pick1 = past.length ? past[past.length - 1] : open[0];
    if (pick1) out.logged.push({ medId: med.id, slot: pick1.slot, name: med.name });
  }
  return out;
}
/** Simple-view "Took my meds": logs exactly what medsNowPlan promises, all at the current
    time. -> { p, logged, guarded } (logged ids for the single Undo are in p's doses). */
export function logMedsNow(p, day, nowMs = Date.now()) {
  const plan = medsNowPlan(p, day, nowMs);
  if (!isObj(p) || isLockedPots(p)) return { p, ...plan };
  const t = nowHHMM(nowMs);
  let q = p;
  const logged = plan.logged.map((x) => { const id = newId(); q = logDose(q, day, { id, medId: x.medId, slot: x.slot, state: "taken", t }); return { ...x, id }; });
  return { p: q, logged, guarded: plan.guarded };
}

/* ---------- day totals ---------- */
/** Oral fluid and sodium for a day (null when nothing of that kind was logged: missing is
    not zero), IV kept separate, her goals, doses taken and planned slot count. */
export function dayTotals(p, day) {
  const goals = isObj(p) && !isLockedPots(p) && p.settings ? p.settings.goals : { fluidMl: null, naMg: null, by: null, set: null };
  const d = (isObj(p) && !isLockedPots(p) && p.days && p.days[day]) || {};
  let fl = 0, na = 0, hasFluid = false, hasSodium = false;
  for (const x of d.intake || []) {
    if (fin(x.ml)) { fl += x.ml; hasFluid = true; }
    if (fin(x.naMg)) { na += x.naMg; hasSodium = true; }
  }
  const meds = isLockedPots(p) ? [] : activeMeds(p, day).filter((m) => m.kind !== "aid");
  return {
    fluidMl: hasFluid ? fl : null, naMg: hasSodium ? na : null,
    iv: !!d.iv, ivMl: d.iv && fin(d.iv.ml) ? d.iv.ml : null,
    nIntake: (d.intake || []).length, hasFluid, hasSodium, goals,
    doneDoses: (d.doses || []).filter((x) => x.state === "taken").length,
    dueDoses: meds.reduce((a, m) => a + m.times.length, 0),
  };
}

/* ---------- units (stored in ml and mg sodium; rounded only for display) ---------- */
export const OZ_ML = 29.5735;
export const NA_PER_G_SALT = 393;
export const mlToOz = (ml) => ml / OZ_ML;
export const ozToMl = (oz) => oz * OZ_ML;
export const saltGToNaMg = (g) => g * NA_PER_G_SALT;
export const naMgToSaltG = (mg) => mg / NA_PER_G_SALT;
const trimZeros = (s) => s.replace(/\.?0+$/, "");
/** "1.25 L" (litres to 2 decimals) or "42 oz" (whole ounces); null when nothing logged. */
export function fmtFluid(ml, units) {
  if (!fin(ml)) return null;
  return units && units.fluid === "oz" ? `${Math.round(mlToOz(ml))} oz` : `${trimZeros((ml / 1000).toFixed(2))} L`;
}
/** "1,800 mg" (whole tens) or "4.6 g salt"; null when nothing logged. */
export function fmtSodium(mg, units) {
  if (!fin(mg)) return null;
  if (units && units.salt === "gSalt") return `${trimZeros(naMgToSaltG(mg).toFixed(1))} g salt`;
  return `${(mg >= 10 ? Math.round(mg / 10) * 10 : Math.round(mg)).toLocaleString("en-US")} mg`;
}

/* ---------- standing test: live safety interrupts ---------- */
/** The last two lying readings (by minute) that have `keys`, or null. */
function restBaseline(rest, keys) {
  const rs = (rest || []).filter((r) => fin(r.min) && keys.every((k) => fin(r[k]))).sort((a, b) => a.min - b.min).slice(-2);
  return rs.length ? rs : null;
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
/** Unrounded mean of `key` over the baseline readings that have `keys` (null when none). The
    result and the live cards compare against this same value; only the display rounds. */
const baseMean = (rest, key, keys = [key]) => { const rs = restBaseline(rest, keys); return rs ? mean(rs.map((r) => r[key])) : null; };
/** A typed value for the safety checks: any finite number within the plausibility cap. It
    may be outside the input-sanity range (so not stored), but a real extreme reading must
    still raise its card. */
const plaus = (v, [lo, hi]) => (fin(v) && v >= lo && v <= hi ? v : null);
/** The live interrupt (if any) for something that just happened during a test. `test` is
    the test as saved so far; `event` is { type: "feel", id, pos } (a feel chip just turned
    on) or { type: "reading", reading, pos } (a reading just entered); pos is "rest" or
    "up". Works with blood pressure off. -> null | { kind, copy, stop, buttons, urgent? }.
    stop: true means go straight to Stopped (Chest pain, with the chest urgent card first);
    otherwise show the card with buttons [Stop, continue] (Stop first). The reading is
    checked as typed, even outside the input-sanity range (which only decides what is
    stored and when "That looks unusual" shows); only values past THRESH.plaus are ignored
    as impossible. */
export function interruptFor(test, event) {
  if (!isObj(event)) return null;
  const C = SAFETY_COPY.interrupt;
  const card = (kind) => ({ kind, copy: C[kind].copy, stop: false, buttons: [C[kind].stop, C[kind].go] });
  if (event.type === "feel") {
    // Chest pain stops the test in any position (safety first; the lie-down card is upright only).
    if (event.id === "p_chest") return { kind: "chest", copy: SAFETY_COPY.urgent.chest, stop: true, urgent: "chest", buttons: [] };
    return event.pos === "up" && FEEL_STOP.includes(event.id) ? card("feel") : null;
  }
  if (event.type !== "reading" || !isObj(event.reading)) return null;
  const r = event.reading, up = event.pos === "up";
  const P = THRESH.plaus, hr = plaus(r.hr, P.hr), sys = plaus(r.sys, P.sys), dia = plaus(r.dia, P.dia);
  const t = isObj(test) ? test : {};
  if (hr != null && hr >= THRESH.hrHigh) return card("hrHigh");
  if ((sys != null && sys >= THRESH.crisisSys) || (dia != null && dia >= THRESH.crisisDia)) return card("bpCrisis");
  if (up && sys != null && sys <= THRESH.lowSys) return card("bpLow");
  if (up && (sys != null || dia != null) && fin(r.min) && r.min <= THRESH.ohMin) {
    // Each number on its own: a drop in either one counts, even if she typed only one.
    const bSys = baseMean(t.rest, "sys"), bDia = baseMean(t.rest, "dia");
    const symptomatic = (t.feel || []).length > 0 || (r.feel || []).length > 0 || (t.up || []).some((u) => (u.feel || []).length > 0);
    const dropped = (sys != null && bSys != null && bSys - sys >= THRESH.ohSys) || (dia != null && bDia != null && bDia - dia >= THRESH.ohDia);
    if (symptomatic && dropped) return card("bpLow");
  }
  if (up && hr != null) {
    // "Previous" = the latest earlier upright reading that was taken (a skipped one doesn't count).
    const prev = (t.up || []).filter((u) => fin(u.hr) && fin(u.min) && (!fin(r.min) || u.min < r.min) && u !== r).sort((a, b) => a.min - b.min).pop();
    if (prev && prev.hr - hr >= THRESH.hrFall) return card("hrFall");
  }
  return null;
}

/* ---------- standing test: the result (computed at render, never stored) ---------- */
const fmtMin = (m) => (Number.isInteger(m) ? String(m) : String(Math.round(m * 10) / 10));
/** A shown number: whole, or to one decimal (a two-reading baseline can end in .5). The
    thresholds are always checked on the unrounded value, so text and finding agree. */
const fmtN = (x) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 10) / 10));
/** The result of a stand test against published thresholds (A13.4). `opts`:
    teen (40-bpm threshold), stage / stageName, daySym (that day's POTS symptoms, for the
    "below" advice), supineCount (tests with a high lying BP, this one included),
    firstFinding (first met / single / drop result, for the midlife line), cycle
    ({ day, weekBefore } when known). Returns the numbers plus `headline` and `lines`:
    [{ kind, text, urgency: "now"|"visit"|"self"|null, urgent: UrgentCard variant|null }],
    each the exact copy of the design, stage-aware. It never diagnoses. */
export function standResult(test, opts = {}) {
  const { teen = false, stage = null, daySym = null, supineCount = 0, firstFinding = false, cycle = null } = opts;
  const T = THRESH, thr = teen ? T.hrTeen : T.hr, t = isObj(test) ? test : {};
  const byMin = (a, b) => a.min - b.min;
  // Baselines are plain (unrounded) means, as in interruptFor; only the display rounds.
  const baseReads = restBaseline(t.rest, ["hr"]) || [];
  const baseHr = baseMean(t.rest, "hr");
  const baseSys = baseMean(t.rest, "sys", ["sys", "dia"]), baseDia = baseMean(t.rest, "dia", ["sys", "dia"]);
  const up = (t.up || []).filter((r) => fin(r.min)).sort(byMin);
  const upHr = up.filter((r) => fin(r.hr) && r.min <= T.upMaxMin);
  const insufficient = baseHr == null || upHr.length < 2;
  const rises = baseHr == null ? [] : upHr.map((r) => r.hr - baseHr);
  let peakI = -1;
  rises.forEach((x, i) => { if (peakI < 0 || x > rises[peakI]) peakI = i; });
  const peakRise = peakI >= 0 ? rises[peakI] : null, peakMin = peakI >= 0 ? upHr[peakI].min : null, peakHr = upHr.length ? Math.max(...upHr.map((r) => r.hr)) : null;
  let pair = null;
  if (!insufficient) {
    for (let i = 0; i + 1 < upHr.length; i++) {
      if (rises[i] >= thr && rises[i + 1] >= thr && upHr[i + 1].min >= T.pairMinMin && upHr[i + 1].min - upHr[i].min <= T.pairGapMax) { pair = [upHr[i], upHr[i + 1]]; break; }
    }
  }
  const hrStatus = insufficient ? "insufficient" : pair ? "met" : peakRise >= thr ? (rises[rises.length - 1] >= thr ? "single_last" : "single_mid") : "below";
  const restHigh = baseHr != null && baseHr >= T.restHigh;
  const counted = !insufficient && Math.abs(peakRise - thr) <= T.countedBand && [...baseReads, upHr[peakI], ...(pair || [])].some((r) => r && r.how === "counted");
  const hr120 = upHr.some((r) => r.hr >= T.hr120);
  // Blood pressure (only when BP was on). "no_drop" needs a lying BP and at least one
  // standing BP in the first 3 minutes; otherwise the status is "none" and bpMissing says
  // what wasn't taken ("all", "lying", "standing" or "early"), so the result never says
  // the blood pressure held steady when it wasn't measured.
  let bpStatus = "none", drop = null, bpMissing = null;
  const bpUp = up.filter((r) => fin(r.sys) && fin(r.dia));
  if (t.bp === true && baseSys == null) bpMissing = bpUp.length ? "lying" : "all";
  else if (t.bp === true && !bpUp.length) bpMissing = "standing";
  else if (t.bp === true) {
    const meets = (r) => baseSys - r.sys >= T.ohSys || baseDia - r.dia >= T.ohDia;
    const early = bpUp.filter((r) => r.min <= T.ohMin), lastE = early[early.length - 1];
    const ohEarly = early.filter(meets).length >= 2 || (!!lastE && meets(lastE) && lastE.min >= T.ohMin);
    const ohSingle = !ohEarly && early.some(meets);
    const late = bpUp.filter((r) => r.min > T.ohMin && meets(r));
    bpStatus = ohEarly ? "drop" : ohSingle ? "single_drop" : late.length ? "late_drop" : early.length ? "no_drop" : "none";
    if (bpStatus === "none") bpMissing = "early";
    const cands = ohEarly || ohSingle ? early.filter(meets) : late;
    if (cands.length) {
      const size = (r) => Math.max((baseSys - r.sys) / T.ohSys, (baseDia - r.dia) / T.ohDia);
      const r = cands.reduce((a, b) => (size(b) > size(a) ? b : a));
      drop = { s: baseSys - r.sys, d: baseDia - r.dia, min: r.min };
    }
  }
  const supineHigh = baseSys != null && (baseSys >= T.supineSys || baseDia >= T.supineDia);
  const crisis = [...(t.rest || []), ...up].some((r) => (fin(r.sys) && r.sys >= T.crisisSys) || (fin(r.dia) && r.dia >= T.crisisDia));
  const complete = t.status === "done" && upHr.some((r) => r.min >= T.completeMin);
  const minutesUp = t.status === "stopped" && fin(t.stoppedAt) ? t.stoppedAt : up.length ? up[up.length - 1].min : 0;
  const preg = stage === "preg";
  const feelAny = (t.feel || []).length > 0 || up.some((r) => (r.feel || []).length > 0);
  const symHeavy = isObj(daySym) && Object.values(daySym).some((v) => v >= 2);

  const lines = [];
  const L = (kind, text, urgency = null, urgent = null) => lines.push({ kind, text, urgency, urgent });
  const headline = insufficient ? null
    : `${t.restPos === "left" ? "Lying on left side" : "Lying"}: ${fmtN(baseHr)}. Highest standing: ${peakHr} at minute ${fmtMin(peakMin)}. ${peakRise > 0 ? `That's a rise of ${fmtN(peakRise)} beats a minute.` : "That's no rise above lying."}`;
  if (t.edited === true) L("edited", "Some readings were corrected after the test.");
  if (isObj(cycle) && fin(cycle.day)) L("cycle", `Cycle day ${cycle.day}${cycle.weekBefore ? " (week before your period)" : ""}`);

  const teenClause = teen ? "" : " (40 or more for ages 12–19)";
  const share = "Share this test, and ask whether an in-clinic standing test or a tilt test would help.";
  if (hrStatus === "met") {
    // In pregnancy only the met sentence is replaced (§4.8.6); the Advice line still follows.
    if (preg) L("hr", `That's a rise of ${fmtN(peakRise)}. Outside pregnancy, clinicians use ${thr}.`);
    else L("hr", `Your heart rate went up by ${fmtN(peakRise)} beats a minute and stayed up at minutes ${fmtMin(pair[0].min)} and ${fmtMin(pair[1].min)}. That's at or above the ${thr}-beat rise clinicians look for in a standing test${teenClause}. It isn't a diagnosis: dehydration, illness, some medicines and time spent in bed can do this too. But it's exactly the kind of result to show your clinician.`);
    L("advice", share, "visit");
  } else if (hrStatus === "single_mid") {
    // Built from the data: the first taken reading after the peak that is back under thr.
    // Readings at or above thr before it (say minutes 1 and 2, too early for a pair) are
    // covered by "as much as"; the sentence never claims the very next reading fell.
    const back = upHr.find((r, i) => i > peakI && rises[i] < thr);
    L("hr", `Your heart rate went up by as much as ${fmtN(peakRise)} (minute ${fmtMin(peakMin)}), but by minute ${fmtMin(back.min)} it had come back under the ${thr}-beat rise. Clinicians look for a rise that lasts, so this one is borderline. Worth sharing with the rest of your log, especially if you felt unwell.`, "visit");
  } else if (hrStatus === "single_last") {
    const last = upHr[upHr.length - 1];
    L("hr", `Your last reading, at minute ${fmtMin(last.min)}, was ${fmtN(rises[rises.length - 1])} above lying, at or above the ${thr}-beat rise clinicians look for. There was no later reading to show whether it lasted. Worth sharing; a clinician may repeat the test for longer.`, "visit");
  } else if (hrStatus === "below") {
    const lead = peakRise > 0 ? `Your heart rate went up by ${fmtN(peakRise)} beats a minute at most, under the ${thr}-beat rise clinicians look for in this test.` : `Your heart rate didn't rise above your lying rate, so it stayed under the ${thr}-beat rise clinicians look for in this test.`;
    L("hr", `${lead} One test is one snapshot, and results change with time of day, fluids, medicines and your cycle. If standing makes you feel unwell, share this anyway. How you feel matters as much as the number.`, feelAny || symHeavy ? "visit" : "self");
  } else {
    L("hr", "There aren't enough readings to work out a rise. Cyra needs a lying heart rate and at least two upright readings. What you entered is saved.");
  }
  if (counted) L("counted", `Counted pulses can be off by a few beats, so a result this close to ${thr} is worth repeating with a device.`);
  if (restHigh) L("restHigh", "A lying heart rate of 100 or more is something clinicians check separately. Mention it.", "visit");
  if (hr120) L("hr120", `Your standing heart rate reached ${peakHr}. Clinicians note readings of 120 or more.`);
  if (t.bp === true) {
    const s = drop ? Math.max(0, drop.s) : 0, d = drop ? Math.max(0, drop.d) : 0, S = fmtN(s), Dd = fmtN(d);
    const NONE = {
      all: "No blood pressure was taken, so this test can't show whether your blood pressure dropped. Clinicians usually want both.",
      lying: "No lying-down blood pressure was taken, so this test can't show whether your blood pressure dropped on standing. Clinicians usually want both.",
      standing: "No standing blood pressure was taken, so this test can't show whether your blood pressure dropped. Clinicians usually want both.",
      early: "No standing blood pressure was taken in the first 3 minutes, when clinicians check for a drop, so this test can't show one. The later readings held steady.",
    };
    if (bpStatus === "drop") {
      const by = s > 0 ? `by ${S} (top number)${d >= T.ohDia ? ` and ${Dd} (bottom number)` : ""}` : `by ${Dd} (bottom number)`;
      L("bp", `Your blood pressure dropped ${by} within 3 minutes of standing. That's the size of drop clinicians check for separately from POTS, and they read it together with your heart rate. Please share this result soon.`, "now", t.fainted === "yes" ? "faint" : null);
    } else if (bpStatus === "single_drop") L("bp", `One reading in the first 3 minutes showed a drop of ${S}/${Dd}. Worth sharing; a repeat test can show whether it lasts.`, "visit");
    else if (bpStatus === "late_drop") L("bp", `Your blood pressure dropped after minute 3 (by ${S}/${Dd} at minute ${fmtMin(drop.min)}). Mention it. Clinicians look at later drops too.`, "visit");
    else if (bpStatus === "none") L("bp", NONE[bpMissing]);
    else L("bp", "Your blood pressure held steady while you were upright.");
  }
  if (supineHigh && supineCount >= T.supineTests) L("supineHigh", `Your lying-down blood pressure was ${T.supineSys}/${T.supineDia} or higher on ${supineCount} tests. That's something clinicians track, especially with some POTS medicines. Mention it.`, "visit");
  if (isObj(t.ctx) && t.ctx.rateMed === "yes") L("rateMed", "You took a heart-rate medicine today, which can make the rise smaller.");
  if (t.status === "stopped") {
    const when = fin(t.stoppedAt) && t.stoppedAt > 0 ? `at minute ${fmtMin(t.stoppedAt)}` : "before standing up";
    L("stopped", `You stopped ${when}${t.why === "faint" ? " because you felt faint" : ""}. That's okay. The readings you have still count, and how long you could stay upright is useful to your clinician.`);
  }
  if (preg) L("preg", "Heart rate normally rises during pregnancy, and these thresholds come from studies of people who weren't pregnant. Share the numbers with your prenatal team rather than reading too much into them.");
  if (stage === "peri" && firstFinding && (["met", "single_mid", "single_last"].includes(hrStatus) || bpStatus === "drop")) {
    L("midlife", "Palpitations and dizziness have other causes too, such as thyroid problems, anaemia, heart-rhythm problems and medicines, and these become more common from midlife. Ask about them alongside this result.");
  }
  return {
    thr, baseHr, baseSys, baseDia, peakRise, peakMin, peakHr, sustainedAt: pair ? [pair[0].min, pair[1].min] : null,
    hrStatus, restHigh, counted, edited: t.edited === true, hr120, bpStatus, bpMissing, drop, supineHigh, crisis, complete, minutesUp,
    headline, lines,
  };
}
/** The fixed ending under every result. */
export const RESULT_FOOT = "Cyra compares your numbers with published thresholds (Heart Rhythm Society 2015). It doesn't diagnose. One home test is one snapshot.";

/* ---------- standing test: the schedule, the trend, tilt notes ---------- */
/** Lying readings are taken at rest minutes restMin - 1 and restMin (A13.4). */
export const restChecks = (restMin) => { const m = int(restMin, 2, 30) ?? 5; return [m - 1, m]; };
/** Upright checkpoints: every minute 1-10, or minutes 1, 3, 5 and 10 (the default). */
export const standChecks = (sched) => (sched === "every" ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [1, 3, 5, 10]);
/** Blood pressure is asked only at minutes 1, 3, 5 and 10, in every-minute mode too. */
export const bpAsked = (min) => [1, 3, 5, 10].includes(min);
/** The last upright minute a test saved a reading for (0 when it never got past the rest):
    "Your Oct 9 test was saved up to minute 5." */
export const savedUpTo = (test) => Math.max(0, ...((isObj(test) && Array.isArray(test.up) ? test.up : []).filter((r) => fin(r.min) && (fin(r.hr) || fin(r.sys) || fin(r.dia))).map((r) => r.min)));
/** Stand tests over time (design 5.8): every test that isn't still running and has a rise to
    show (a lying heart rate and at least two upright readings), oldest first:
    [{ id, date, t, method, rise, complete }]. `complete` = done and reached minute 9.5; the
    "Your tests over time" chart and the median use complete tests of one method only. The rise
    is the same number the result shows (standResult); nothing is stored. */
export function testTrend(p) {
  if (!isObj(p) || isLockedPots(p) || !Array.isArray(p.tests)) return [];
  return p.tests.filter((x) => x.status !== "running").map((x) => {
    const r = standResult(x);
    return r.hrStatus === "insufficient" ? null : { id: x.id, date: x.date, t: x.t, method: x.method, rise: r.peakRise, complete: r.complete };
  }).filter(Boolean).sort(byDateTime);
}
/** The middle value (the mean of the two middle values for an even count); null when empty. */
export function median(a) {
  const s = (Array.isArray(a) ? a : []).filter(fin).sort((x, y) => x - y);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
/** Remove a tilt-table note she added by mistake: it goes and is tombstoned, so a stale tab
    can't merge it back. */
export const removeTilt = guard((p, id) => (p.tilt.some((x) => x.id === id) ? { ...p, tilt: p.tilt.filter((x) => x.id !== id), gone: uniq([...p.gone, id]) } : p));

/** This device's local day; re-exported so POTS screens key days the same way. */
export { localDay };
