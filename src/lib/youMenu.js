/* The You tab as a short menu (owner request 2026-11-19: "the you page has too many things on it"). Pure: no React,
   storage or network. You shows her stage card and one row per page below; each row opens its own page inside the You
   tab (lib/routes.js SUBPAGES: #/you/<slug>, a "You" back link, focus returns to the row). Nothing was removed: every
   card the long page had sits on exactly one page, with the same id, controls and sentences.
   "Solia Health's AI" keeps its own row, so every sentence that says "You → Solia Health's AI" is literally the two
   taps it names; Privacy & your data is the second row.
   SECTION_PAGE maps each card's element id to its page, for everything that opens "a part of You" (a deep link, the
   header's sliders button, Home's "Turn on in You → Solia Health's AI", toasts' targets, the e2e helpers). */

export const YOU_PAGES = Object.freeze([
  { id: "profile", view: "youprofile", slug: "profile", icon: "user", tint: "you", title: "Your profile", line: "Your stage, about you and condition modules" },
  { id: "privacy", view: "youprivacy", slug: "privacy", icon: "shield", tint: "mind", title: "Privacy & your data", line: "What leaves this device, backup, app lock, delete everything" },
  { id: "ai", view: "youai", slug: "ai", icon: "sparkle", tint: "mind", title: "Solia Health's AI", line: "Its switches, and exactly what each one sends" },
  { id: "plan", view: "youplan", slug: "plan", icon: "sparkle", tint: "patterns", title: "Plan & account", line: "Your plan, restore purchases, your account" },
  { id: "devices", view: "youdevices", slug: "devices", icon: "watch", tint: "body", title: "Devices & reminders", line: "Data sources, check-ins and reminders, install the app" },
  { id: "app", view: "youapp", slug: "settings", icon: "sliders", tint: "you", title: "App settings", line: "Appearance and style, voice guide, the tour, Home cards" },
  { id: "help", view: "youhelp", slug: "help", icon: "book", tint: "you", title: "Help & about", line: "Answers, send feedback, Learn, the shop, about and legal" },
].map(Object.freeze));

export const YOU_VIEWS = Object.freeze(YOU_PAGES.map((p) => p.view));
/** Whether a view id is one of You's pages (not the menu itself). */
export const isYouPage = (view) => YOU_VIEWS.includes(view);
/** The page for a view id, or null. */
export const youPageOf = (view) => YOU_PAGES.find((p) => p.view === view) || null;
/** The menu row's element id for a page: where focus returns when she goes back. */
export const youRowId = (view) => { const p = youPageOf(view); return p ? `you-row-${p.id}` : null; };

/* Every card id on You → the page it is on. */
export const SECTION_PAGE = Object.freeze({
  "you-stage": "youprofile", "you-about": "youprofile", "you-modules": "youprofile", "you-partner": "youprofile",
  "you-privacy": "youprivacy", "you-counts": "youprivacy", "you-ai-link": "youprivacy",
  "you-ai": "youai",
  "you-plan": "youplan", "you-signin": "youplan", "you-guest": "youplan", "you-account": "youplan",
  "you-sources": "youdevices", "you-checkins": "youdevices", "you-install": "youdevices",
  "you-appearance": "youapp", "you-language": "youapp", "you-voice": "youapp", "you-tour": "youapp", "you-home-cards": "youapp",
  "you-help": "youhelp", "you-learn": "youhelp", "you-shop": "youhelp", "you-about-legal": "youhelp",
});
/** Whether You shows "Upgrade to Pro": only while she does not own Pro (a guest sees it too; the Pro sheet handles guests). */
export const upgradeShown = ({ owned = false } = {}) => owned !== true;

/** The view that holds a card id ("you-plan" → "youplan"); null for an unknown id. */
export const pageOfSection = (sectionId) => SECTION_PAGE[sectionId] || null;

/* The few new sentences the menu's pages show. Each is true of every build:
   - aiLink (Privacy & your data): the AI's switches and disclosures are on their own page, one tap from here;
   - voice*: the same device-only choice as the "Voice guide" switch inside a practice (practiceVoice); shown only where
     this device can speak (lib/voice.js voiceSupported). Nothing is recorded or sent by turning it on. */
export const YOU_COPY = Object.freeze({
  /* 2026-11-25 (docs/plans/upgrade-enterprise.md Task 1): one clear way to Pro. "Upgrade to Pro" sits above the rows while
     she does not own Pro and opens the same Pro sheet as every other Pro button (payment stays in the phone apps: on the
     web the sheet says Pro is sold in the iPhone and Android apps). "See Pro" is the short button on a locked part. */
  upgrade: "Upgrade to Pro",
  seePro: "See Pro",
  aiLink: "Solia Health's AI has its own page: its switches, and exactly what each one sends.",
  voiceTitle: "Voice guide",
  voiceName: "Voice guide in practices",
  voiceHint: "Reads each step of a Mind practice aloud. The same switch is inside every practice.",
});
