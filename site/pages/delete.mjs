/* /delete-account/ — the web page Google Play asks for (docs/plans/website.md Task 3): how to delete the account and the
   data from inside the app, what is deleted on the device and on the server and how fast, what is kept and why, and how
   to ask without the app. Read from the backend, not from memory:
     backend/src/modules/accounts/index.js   DELETE /api/accounts/me: every session, the account row, the delete hooks, the AI use counts
     backend/src/modules/feedback/index.js   feedback linked to the account goes with it; other feedback is kept 365 days
     backend/src/modules/subscriptions/index.js  the account number is dropped from a free Pro grant; the grant row stays
     backend/src/modules/shop/index.js (taps, 400 days), ai/spend.js (400 days), orgs/index.js (join totals): totals that name no one */
import { LABEL, esc } from "./copy.mjs";
import { head, header, footer, hrefFor } from "./layout.mjs";
import { headSeo } from "../build/seo.mjs";

const ACCOUNTS = "backend/src/modules/accounts/index.js";
export const DELETE_TITLE = "Delete your account and data · Solia Health";
export const DELETE_DESCRIPTION = { text: "How to delete your Solia Health account and your data: the steps in the app, what is deleted, what is kept and for how long.", source: "site/pages/delete.mjs (what the page holds)" };

export function deleteAccountPage(ctx, c) {
  const { d } = ctx;
  const mail = d.links.supportEmail;
  const support = hrefFor(ctx, "support", "/?site=1#q-cancel");
  const p = (html, src) => `<p>${c.h(html, src)}</p>`;
  const li = (html, src) => `<li>${c.h(html, src)}</li>`;
  return `${head(ctx, c, { title: DELETE_TITLE, description: DELETE_DESCRIPTION, extra: headSeo(ctx, c, { path: "/delete-account/", title: DELETE_TITLE, description: DELETE_DESCRIPTION.text }) })}
<body>
${header(ctx, c)}
<main id="content">
<article class="doc">
<div class="wrap narrow">
<h1>${c.t("Delete your Solia Health account and data", LABEL)}</h1>
<p class="lead">${c.t("You can delete your account and your data yourself, in the Solia Health app, at any time. This page says how, what is deleted, what is kept and for how long, and how to ask without the app.", `${ACCOUNTS}; src/components/DataControls.jsx; src/components/AccountParts.jsx; e2e/store-checks.spec.mjs`)}</p>

<h2 id="account">${c.t("Delete your account", LABEL)}</h2>
<ol class="num">
${li("Open Solia Health and tap <strong>You</strong>.", "src/lib/routes.js TABS; e2e/lib/nav.mjs")}
${li("Open <strong>Plan &amp; account</strong>.", "src/lib/youMenu.js; e2e/store-checks.spec.mjs")}
${li(`Tap <strong>${esc(d.deletion.accountButton)}</strong>, then <strong>${esc(d.deletion.accountConfirm)}</strong>.`, "src/lib/signin.js SIGNIN_COPY.deleteAcct, deleteGo; src/components/AccountParts.jsx; e2e/store-checks.spec.mjs")}
</ol>
${p(esc(d.deletion.account), "src/lib/signin.js SIGNIN_COPY.deleteBody (what the app says between the two taps); backend/src/modules/accounts/index.js")}
${p("<strong>How fast.</strong> At once. When you confirm, Solia Health's server removes the account and every signed-in session in the same request; nothing waits for a review.", `${ACCOUNTS} (DELETE /api/accounts/me removes account_sessions, accounts and ai_usage before it answers)`)}

<h2 id="everything">${c.t("Delete everything on your device", LABEL)}</h2>
<ol class="num">
${li("Open Solia Health and tap <strong>You</strong>.", "src/lib/routes.js TABS; e2e/lib/nav.mjs")}
${li("Open <strong>Privacy &amp; your data</strong>.", "src/lib/youMenu.js; e2e/lib/nav.mjs YOU_PAGES")}
${li("Tap <strong>Delete everything</strong> and confirm.", "src/components/DataControls.jsx (WipeConfirm)")}
</ol>
${p(esc(d.deletion.wipePhone), "src/lib/disclosures.js wipeConfirm (what the app says before the confirm); src/App.jsx (wipe)")}
<ul class="bul">
${d.deletion.morePhone.map((line) => li(esc(line), "src/lib/disclosures.js wipeMore; src/components/DataControls.jsx")).join("\n")}
</ul>
${p("<strong>How fast.</strong> At once, on that device; if a server step in the list above can't be confirmed, the app tells you and waits for your choice. The web app and each phone keep their own log, so use Delete everything on each device you used.", "src/lib/storage.js (clear and delete the database, or the app's files); src/App.jsx (wipe); src/lib/disclosures.js wipeMore")}

<h2 id="deleted">${c.t("What is deleted from Solia Health's server", LABEL)}</h2>
<ul class="bul">
${li("<strong>Your account:</strong> how you signed in, your sign-in email, your name if the sign-in service sent one, when you made the account, the last day you used it, and which organization you joined, if you joined one while signed in.", `${ACCOUNTS} (the accounts row: provider, email, name, createdAt, lastSeenDay, orgSlug); backend/src/modules/orgs/index.js`)}
${li("<strong>Every signed-in session,</strong> so no device stays signed in.", `${ACCOUNTS} (account_sessions)`)}
${li("<strong>Your monthly AI use counts.</strong>", `${ACCOUNTS} (ai_usage rows of the account); backend/src/modules/ai/usage.js`)}
${li("<strong>Feedback you sent with “It's OK to reply to me” on,</strong> because that feedback is linked to your account.", "backend/src/modules/feedback/index.js (the account-delete hook)")}
${li("<strong>Delete everything also</strong> erases this browser's reminder address from the server, and disconnects Oura and Fitbit, Garmin or Whoop.", "src/lib/disclosures.js deleteAlso; backend/src/modules/push/index.js (DELETE /api/push/subscribe); backend/src/modules/integrations/index.js")}
</ul>
${p(`<strong>Your health log was never there.</strong> ${esc(d.privacy.storeCopy)} It is on your device, and Delete everything erases it.`, "src/lib/disclosures.js storeCopyLine; src/lib/storage.js; docs/PRIVACY-AUDIT.md")}

<h2 id="kept">${c.t("What is kept, and why", LABEL)}</h2>
<ul class="bul">
${li("<strong>Feedback sent without “It's OK to reply to me”.</strong> It is not linked to an account, so Solia Health cannot find it for one person. It is deleted 365 days after it arrived.", "backend/src/modules/feedback/index.js (FEEDBACK_KEEP_DAYS = 365; without reply nothing links the message to an account)")}
${li("<strong>Totals that name no one.</strong> How often each Shop product was opened per day (kept 400 days, and only counted if you turned that on), how much the AI features were used per day by everyone together (kept 400 days), and how many people joined each organization per day. None of them holds an account, a device or anything you logged, so there is nothing of yours to remove.", "backend/src/modules/shop/index.js (TAP_KEEP_DAYS = 400); backend/src/modules/ai/spend.js (SPEND_KEEP_DAYS = 400); backend/src/modules/orgs/index.js (org_joins: day, slug, joins)")}
${li("<strong>A free Pro grant made for your email.</strong> If Solia Health gave your email free Pro (for example through a clinic or partner), your account number is removed from that record, and the record itself, with the email it was made for, stays visible to Solia Health's owners until the grant is revoked.", "backend/src/modules/subscriptions/index.js (subs_grants: email, accountIds; the account-delete hook drops the id and sets accountDeleted); public/legal/privacy.html (Pro and tips)")}
${li("<strong>Your subscription.</strong> Deleting your account does not cancel Pro. Apple or Google, and RevenueCat, which handles Pro for the stores, keep their own purchase records under their own policies.", "src/lib/signin.js SIGNIN_COPY.deleteBody; src/lib/purchase.js STORE_LINES.whoKnows; public/legal/privacy.html (Pro and tips)")}
${d.deletion.cantPullBack ? li(`<strong>What already left.</strong> ${esc(d.deletion.cantPullBack)}`, "src/lib/disclosures.js consentDetails") : ""}
${li("<strong>Other services you used with it.</strong> Apple, Google or Facebook, if you signed in with one, and Resend, which delivers email sign-in codes for Solia Health, keep their own records under their own policies.", "backend/src/modules/accounts/index.js (email codes are sent through Resend); backend/src/modules/oauth/index.js; public/legal/privacy.html section 5")}
${li("<strong>Hosting logs.</strong> Like any web host, our hosting provider (Render) keeps its own request logs, which include internet addresses, under its own policy.", "render.yaml (both services run on Render); public/legal/privacy.html (Every connection to our server)")}
</ul>

<h2 id="request">${c.t("Ask without the app", LABEL)}</h2>
${mail
    ? p(`<strong>By email.</strong> Write to <a href="mailto:${esc(mail)}?subject=${encodeURIComponent("Delete my Solia Health account")}">${esc(mail)}</a> from the email address you signed in with, and ask for your Solia Health account to be deleted.`, "src/lib/feedback.js SUPPORT_EMAIL (VITE_SUPPORT_EMAIL at build time)")
    : p("<strong>By email.</strong> An email address for deletion requests has not been set up yet. Until it is, use the steps above in the app.", "src/lib/feedback.js SUPPORT_EMAIL (VITE_SUPPORT_EMAIL is not set in this build)")}
${p("<strong>What an email can and can't delete.</strong> It can delete what is on Solia Health's server. It can't erase the log on your device: only Delete everything on that device does, because Solia Health has no copy of it and no way to reach it.", "src/lib/storage.js; src/lib/disclosures.js storeCopyLine; backend/src/modules/accounts/index.js")}
<p><a href="/legal/privacy.html">${c.t("Read the Privacy Policy", "public/legal/privacy.html")}</a></p>
<p><a href="${support}">${c.t("Get help on the Support page", LABEL)}</a></p>
</div>
</article>
</main>
${footer(ctx, c)}
</body>
</html>
`;
}
