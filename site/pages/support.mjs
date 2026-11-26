/* /support/ — the App Store "Support URL" (docs/plans/website.md Task 3): how to get help, how to cancel on each store,
   how to restore purchases. The answers are the app's own Help answers (src/lib/feedback.js helpItems) wherever it has one. */
import { LABEL, esc } from "./copy.mjs";
import { head, header, footer, hrefFor } from "./layout.mjs";
import { headSeo } from "../build/seo.mjs";

const HELP = "src/lib/feedback.js helpItems";
export const SUPPORT_TITLE = "Support · Solia Health";
export const SUPPORT_DESCRIPTION = { text: "How to get help with Solia Health, cancel a subscription in the App Store or Google Play, and restore purchases.", source: "site/pages/support.mjs (what the page holds)" };

export function supportPage(ctx, c) {
  const { d } = ctx;
  const mail = d.links.supportEmail;
  const del = hrefFor(ctx, "delete-account", "/?site=1#q-delete");
  const p = (html, src) => `<p>${c.h(html, src)}</p>`;
  const answer = (id) => d.help[id].a.map((a) => p(esc(a), `${HELP} (${d.help[id].q})`)).join("\n");
  return `${head(ctx, c, { title: SUPPORT_TITLE, description: SUPPORT_DESCRIPTION, extra: headSeo(ctx, c, { path: "/support/", title: SUPPORT_TITLE, description: SUPPORT_DESCRIPTION.text }) })}
<body>
${header(ctx, c)}
<main id="content">
<article class="doc">
<div class="wrap narrow">
<h1>${c.t("Support", LABEL)}</h1>
<p class="lead">${c.t("How to get help with Solia Health, cancel a subscription, and restore purchases.", SUPPORT_DESCRIPTION.source)}</p>

<h2 id="help">${c.t("Get help", LABEL)}</h2>
${mail
    ? p(`<strong>Write to us.</strong> Send your question to <a href="${d.links.supportHref}">${esc(mail)}</a>.`, "src/lib/feedback.js SUPPORT_EMAIL (VITE_SUPPORT_EMAIL at build time), supportHref")
    : p("<strong>In the app.</strong> Open You → Help &amp; about. It has short answers to common questions.", "src/lib/youMenu.js (the page name); src/components/Feedback.jsx (HelpCard); src/lib/feedback.js helpItems")}
${p(`<strong>${esc(d.feedback.send)} and ${esc(d.feedback.problem)}.</strong> Where the app is connected to Solia Health's server, You → Help &amp; about also has these two buttons. You see exactly what will be sent before you send it. ${esc(d.feedback.warn)}`, "src/lib/feedback.js FEEDBACK_COPY (sendFeedback, reportProblem, warn), previewRows; src/components/Feedback.jsx (offered only in a build with a server)")}
<div class="note">
${p("<strong>Solia Health can't help in an emergency.</strong> If you think you may have a medical emergency, call your local emergency number (911 in the United States) or go to the nearest emergency room. If you are thinking about harming yourself, in the United States call or text 988.", "public/legal/medical-disclaimer.html (the emergency notice); public/legal/terms.html")}
</div>

<h2 id="cancel">${c.t("Cancel a subscription", LABEL)}</h2>
${answer("cancel")}
${p(`<strong>On iPhone.</strong> ${esc(d.pricing.cancel["app-store"])}`, "src/lib/pricing.js CANCEL_LINES.app-store")}
${p(`<strong>On Android.</strong> ${esc(d.pricing.cancel.play)}`, "src/lib/pricing.js CANCEL_LINES.play")}
${p(`<strong>What happens to your log.</strong> ${esc(d.pricing.keep)}`, "src/lib/pricing.js KEEP_LINE; src/lib/trial.js")}

<h2 id="restore">${c.t("Restore purchases", "src/locales/en-ui.js pro.restorePurchases")}</h2>
${p("<strong>On a new phone, or after reinstalling.</strong> Open You → Plan &amp; account and tap Restore purchases. The same button sits under the two plans on the plans screen. Use the Apple or Google account you subscribed with, and Pro turns on.", "src/lib/purchase.js restorePurchases; src/screens/YouScreen.jsx; docs/STORE-SETUP.md section 5a; e2e/store-checks.spec.mjs")}
${p(`<strong>If nothing is found.</strong> The app says “${esc(d.store.restoredNone)}” Check which account the phone's store is signed in to.`, "src/lib/purchase.js STORE_LINES.restoredNone")}
${p(`<strong>On the web.</strong> ${esc(d.store.restoreWeb)}`, "src/lib/purchase.js STORE_LINES.restoreWeb")}

<h2 id="answers">${c.t("Common questions", LABEL)}</h2>
<h3>${c.t(d.help["free-week"].q, HELP)}</h3>
${p(esc(d.pricing.freeWeekHelp[1]), `${HELP} (How does the free week work?); src/lib/trial.js`)}
<h3>${c.t(d.help.data.q, HELP)}</h3>
${p(`What you log is kept on the device you use Solia Health on. ${esc(d.privacy.storeCopy)}`, `${HELP} (Where does my data live?); src/lib/storage.js; src/lib/disclosures.js storeCopyLine`)}
${p(esc(d.help.data.a[1]), `${HELP} (Where does my data live?); src/lib/backup.js`)}
<h3>${c.t(d.help.watch.q, HELP)}</h3>
${p(esc(d.help.watch.a[0]), `${HELP} (How do I connect a watch or ring?); src/lib/wearables.js; src/lib/devices.js`)}
${p(esc(d.help.watch.a[d.help.watch.a.length - 1]), `${HELP} (How do I connect a watch or ring?); src/lib/devices.js DEVICE_COPY.lead`)}
<h3>${c.t("How do I delete my account or my data?", LABEL)}</h3>
<p><a href="${del}">${c.t("Delete your account and data", LABEL)}</a></p>
</div>
</article>
</main>
${footer(ctx, c)}
</body>
</html>
`;
}
