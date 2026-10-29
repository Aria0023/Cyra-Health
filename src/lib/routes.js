/* Navigation (calm R2, spec §3): the five top-level tabs, the sub-views each one hosts, and the deep links. Pure: no
   React, storage, network or feature-flag import.
   The app keeps one "view" per experience (App.jsx appTab / pregTab, the ids every screen already routes with:
   goTab("report"), setAppTab("cal"), …). A view belongs to exactly one tab; a tab shows a segmented control when it
   hosts more than one view. Home · Body · Mind · Patterns · You, the same five in every stage (pregnancy hosts its own
   content in them). The "+" in the nav opens the log sheet (LOG_ITEMS), never a view. */

export const TABS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "body", label: "Body", icon: "body" },
  { id: "mind", label: "Mind", icon: "mind" },
  { id: "patterns", label: "Patterns", icon: "patterns" },
  { id: "you", label: "You", icon: "user" },
];
export const TAB_IDS = TABS.map((t) => t.id);

/* Sub-views per tab: [viewId, segment label]. Mind's Practices joins in R5 (no placeholder until it exists).
   Cycles is left out in menopause (no cycles to list); pregnancy has no Cycles, Patterns or Report views and keeps its
   care roadmap (Milestones) under Patterns. */
const CYCLE_VIEWS = {
  home: [["home", "Home"]],
  body: [["today", "Logs"], ["cal", "Calendar"], ["cycles", "Cycles"]],
  mind: [["connect", "Today"], ["ask", "Journey"]],
  patterns: [["patterns", "Patterns"], ["report", "Report"]],
  you: [["you", "You"]],
};
const PREG_VIEWS = {
  home: [["home", "Home"]],
  body: [["today", "Logs"], ["cal", "Calendar"]],
  mind: [["connect", "Today"], ["ask", "Journey"]],
  patterns: [["mile", "Roadmap"]],
  you: [["you", "You"]],
};

/** The [viewId, label] list a tab hosts for this experience ({ preg, meno }). */
export function viewsOf(tab, { preg = false, meno = false } = {}) {
  const v = (preg ? PREG_VIEWS : CYCLE_VIEWS)[tab] || [];
  return meno ? v.filter(([id]) => id !== "cycles") : v;
}

/** The tab a view lives under (null for an unknown view). */
export function tabOf(view, opts = {}) {
  for (const t of TAB_IDS) if (viewsOf(t, opts).some(([id]) => id === view)) return t;
  return null;
}

/** The view a tab opens on: the one she last had open there (lastByTab[tab]) when it still belongs to it, else its first. */
export function viewForTab(tab, lastByTab = {}, opts = {}) {
  const views = viewsOf(tab, opts);
  if (!views.length) return null;
  const last = lastByTab?.[tab];
  return views.some(([id]) => id === last) ? last : views[0][0];
}

/* Deep links: #/<tab>[/<segment>] in the new scheme, and the old tab names, which redirect to their new home
   (spec §3 R2 table). Segment words are the lower-case labels. */
const OLD = {
  today: "today", log: "today", calendar: "cal", cal: "cal", cycles: "cycles", report: "report", connect: "connect",
  ask: "ask", care: "you", shelf: "you", milestones: "mile", roadmap: "mile", settings: "you",
};
/* Old links that land on a part of a page: the care shelf is the "Support & care" section of You. */
const SECTION = { care: "care", shelf: "care" };

/** A location hash → the view it names ({ view, tab, section? }) or null when it is not a navigation link (#restored, #oauth=…,
    #/dev/ui, empty, unknown words). A view the experience doesn't have falls back to its tab's first view. */
export function parseRoute(hash, opts = {}) {
  const m = /^#\/([a-z]+)(?:\/([a-z-]+))?\/?$/.exec(String(hash || "").toLowerCase());
  if (!m) return null;
  const [, a, b] = m;
  if (TAB_IDS.includes(a)) {
    const views = viewsOf(a, opts);
    const hit = b ? views.find(([id, l]) => l.toLowerCase() === b || id === b) : null;
    if (b && !hit) return { tab: a, view: views[0][0] };
    return { tab: a, view: hit ? hit[0] : views[0][0] };
  }
  if (b || !(a in OLD)) return null;
  const view = OLD[a];
  const tab = tabOf(view, opts);
  if (!tab) return null; // e.g. #/report in pregnancy: there is no Report there
  const out = { tab, view: viewsOf(tab, opts).some(([id]) => id === view) ? view : viewsOf(tab, opts)[0][0] };
  return SECTION[a] ? { ...out, section: SECTION[a] } : out;
}

/** The canonical hash for a view: "#/body/calendar", "#/home". */
export function routeOf(view, opts = {}) {
  const tab = tabOf(view, opts);
  if (!tab) return "#/home";
  const views = viewsOf(tab, opts);
  if (views.length < 2 || views[0][0] === view) return `#/${tab}`;
  const hit = views.find(([id]) => id === view);
  return `#/${tab}/${hit[1].toLowerCase()}`;
}

/* The "+" sheet: one tap each into the right logger. Each item is offered only where its logger exists in this
   experience (App.jsx decides `has`): Move only with the POTS movement plan, Period not in pregnancy. */
export const LOG_ITEMS = [
  { id: "symptoms", label: "Symptoms", icon: "pulse", tint: "body" },
  { id: "period", label: "Period", icon: "drop", tint: "body" },
  { id: "sleep", label: "Sleep", icon: "moon", tint: "mind" },
  { id: "mood", label: "Mood", icon: "smile", tint: "mind" },
  { id: "move", label: "Move", icon: "move", tint: "body" },
  { id: "meds", label: "Meds", icon: "pill", tint: "patterns" },
  { id: "note", label: "Note", icon: "note", tint: "you" },
];

/** The log items to show, in order, given which loggers exist ({ period, move, … } booleans; a missing key = present). */
export function logItemsFor(has = {}) {
  return LOG_ITEMS.filter((i) => has[i.id] !== false);
}
