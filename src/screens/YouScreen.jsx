import PalettePicker from "../components/PalettePicker.jsx";
import StageArt, { stageArtKey } from "../components/StageArt.jsx";
import { Card, Chip, Switch, IBadge } from "../components/ui/index.js";
import BrandMark from "../components/BrandMark.jsx";
import Icon from "../components/Icon.jsx";
import ModuleRow from "../components/ModuleRow.jsx";
import PotsAddon from "../components/pots/PotsAddon.jsx";
import Details, { AiFacts } from "../components/Details.jsx";
import { InstallSettings } from "../components/Pwa.jsx";
import { CheckinsBody, RemindersBody, CountsBody, AppearanceBody, AboutBody, PrivacyBody, reminderModel } from "../components/settingsParts.jsx";
import { MODULE_FRAMING } from "../lib/modules.js";
import { CADENCE } from "../lib/constants.js";
import { FEATURES } from "../lib/features.js";
import { hasServer } from "../lib/api.js";
import { FERT_COPY } from "../lib/fertility.js";
import { TERMS_URL, PRIVACY_URL, openExternal } from "../lib/links.js";
import { BUILD_STAMP, MODULE_ADDS, PLAN_COPY, ACCOUNT_LINES, NOT_MEDICAL, AI_OFF_LINE, accountLine } from "../lib/about.js";
import { freeKeepsFor, untilLine } from "../components/ProSheet.jsx";
import { AI_DISCLOSURE } from "./AskScreen.jsx";
import { AI_COPY, ASK_COPY } from "../lib/aiFeatures.js";
import { MEAL_COPY } from "../lib/mealPhoto.js";
import { CalSwitch } from "../components/ai/MealPhoto.jsx";
import { FLOW_COPY } from "../lib/privacyFlows.js";
import { AccountCard, SignedInCard } from "../components/AccountParts.jsx";
import { PlanCardTiles } from "../components/PlanTiles.jsx";
import { t } from "../lib/i18n.js";
import { youAccountLine } from "../lib/signin.js";
import { YOU_PAGES, youPageOf, YOU_COPY, upgradeShown } from "../lib/youMenu.js";

/* You (calm R7, spec "You tab"; a short menu since 2026-11-19, docs/plans/visible-features.md Task 3, lib/youMenu.js).
   With no `page`: her name, the stage card (one life-stage experience: changing it replaces it, what she logged stays)
   and one row per page. Each row opens its page inside the You tab (App.jsx: a view of its own, #/you/<slug>, the "You"
   back link returns focus to the row). Every card the long page had is on exactly one page, with the same id, controls
   and sentences:
   - Your profile: her stage (the same Change control), About you, Modules (PCOS, POTS, fertility signs where the
     stage offers them, Meal notes: each a real switch with a one-line "what it adds"; the PCOS switch is this card's
     only PCOS control; POTS also has its row in the header's Settings sheet (Add-ons), which App.jsx never draws on
     the You tab, so one switch is ever on screen), Share with a partner;
   - Privacy & your data (L10): what can leave this device, an encrypted backup and restore, the app lock, delete
     everything, exactly as before; the anonymous weekly counts (builds with them); and the way to the AI's page;
   - Solia Health's AI (calm R8): "Also ask Solia Health's AI", and with Pro, the ai flag and a server the weekly
     write-up and chat switches (off by default) and "Include lab values"; without Pro, one line and "See what Pro
     adds". The switches send nothing themselves;
   - Plan & account: the plan card (Free / Pro / the free week, the plan tiles, "Restore purchases", which asks
     lib/purchase.js) and the account: Task 1's sign-in card (who is signed in, Sign out, Delete account), a guest's
     card, or "Your account" / the optional AccountCard (calm R9);
   - Devices & reminders: Data sources, Check-ins and reminders, Install (web);
   - App settings: Appearance and style, Language (only with two or more catalogues, lib/i18n.js pickerShown), the
     voice guide (the same device choice as inside a practice), "Finding your way", Home cards;
   - Help & about: Help (components/Feedback.jsx: short answers; with a server "Send feedback" / "Report a problem",
     which send only on her Send), Learn, the Shop by need entry card, About & legal (not a medical device, links,
     the build stamp).
   Calm R10 (compaction): each card is a title row, one summary line and its primary control; the longer explanations
   sit behind a Details ("How this works"), which keeps its text in the page while closed. Every sentence that moved is
   listed in docs/PRIVACY-AUDIT.md "Calm R10". Nothing on these pages sends anything anywhere; the feedback sheet Help
   opens sends one request when she presses Send. */
/* The stage card's illustration (2026-11-25, critique-fixes Task 6): one calm picture per life stage, components/StageArt.jsx
   (tokens only, decorative). It replaced the shared rings-and-blob drawing. */
export default function YouScreen({ acct, stage, stageName, onChangeStage, modules = [], pots = null, fertRow = null, planUnlocked = false, proOwned = false, storeReady = false, onPro, ai = { available: false, on: false, set: () => {} }, sp, install = null, care = null, onRestore = null, storeLine = null, trial = null, onTour = null, account = null, signedIn = null, help = null, language = null, meals = null, dataSources = null, partner = null, learn = null, signMode = "none", store = null, native = false, promo = null, onHidePromo = null, proUntil = null, guest = null, homeCards = null, page = null, onOpenPage = () => {}, onBack = () => {}, planLabel = null, planKey = null, voice = null, refs = null, orgCard = null }) {
  const offer = ai.offer || { any: false, weekly: false, chat: false, meals: false };
  const prefs = ai.prefs || { weekly: false, chat: false, labs: false };
  // Meal photos is on only while Meal notes is too (a photo is saved in a meal note); the row says what turning it on will do.
  const mealsOn = prefs.meals === true && ai.mealNotesOn !== false;
  const mealsNeed = mealsOn ? null : ai.mealWay === "signin" ? MEAL_COPY.needsSignIn : ai.mealNotesOn === false ? MEAL_COPY.needsNotes : null;
  const who = acct?.anon ? "Anonymous" : acct?.name || "You";
  const { remindersHere, unavailable: remindersOff } = reminderModel({ reminders: sp.reminders, reminderSupport: sp.reminderSupport, cadence: sp.cadence });
  const anyModule = modules.length > 0 || !!fertRow;
  const cad = CADENCE.find((c) => c.id === sp.cadence);
  const NUDGE = { morning: "mornings", midday: "midday", evening: "evenings", never: "no nudge" };
  const checkinSummary = [cad ? `Rhythm: ${cad.label.toLowerCase()}` : null, remindersHere && !remindersOff && sp.cadence !== "me" && NUDGE[sp.quietHours] ? `nudge ${NUDGE[sp.quietHours]}` : null, sp.quickMode ? "quick check-in, 3 taps" : "full-detail check-in"].filter(Boolean).join(" · ") + ".";
  const link = (url, label) => <button type="button" className="linkbtn youlegal" onClick={() => openExternal(url)}>{label}<Icon name="arrow-right" size={14} /></button>;
  const pg = youPageOf(page);
  /* The cards, written here in the order the long page had them (their lines are unchanged, so another branch's edit
     to a card merges cleanly); the menu and the pages below only place them. */
  const head = (
    <>
      <p className="eyebrow">{t("you.you")}</p>
      <h1 className="disp youname">{who}</h1>
    </>
  );
  const stageCard = (
    <>
      <Card hero tint="you" icon="user" eyebrow={t("you.yourStage")} title={stageName} level={2} className="youstage">
        <StageArt k={stageArtKey({ stage, stageName })} className="youart" />
        <p className="hint">{t("you.cyraIsShapedAroundOne")}</p>
        <button type="button" className="stagechip quiet" onClick={onChangeStage}>{t("you.change", { stageName })}</button>
        {sp.daysLogged > 0 && <p className="youfact"><Icon name="calendar" size={14} />{sp.daysLogged === 1 ? t("you.1DayLogged") : t("you.daysLogged", { daysLogged: sp.daysLogged })}</p>}
      </Card>
    </>
  );
  const privacyCard = (
    <>
      <Card id="you-privacy" tint="mind" icon="shield" eyebrow={t("you.privacyYourData")} title={t("you.youDecideWhatLeavesThis")} level={2} className="youprivacy" tabIndex={-1}>
        <PrivacyBody hideLab compact storageDriver={sp.storageDriver} onExport={sp.onExport} onImport={sp.onImport} onWipe={sp.onWipe} ping={sp.ping} keepsWeekNote={sp.keepsWeekNote} daysLogged={sp.daysLogged} lastBackupAt={sp.lastBackupAt} todayIso={sp.todayIso} offlineCopy={sp.offlineCopy} legacyWear={sp.legacyWear} onHandoff={sp.onHandoff} flows={sp.flows} flowCtx={sp.flowCtx} lock={sp.lock} potsOn={sp.potsOn} />
      </Card>
    </>
  );
  const modulesCard = (
    <>
      {anyModule && (
        <Card id="you-modules" tint="body" icon="plus-circle" eyebrow={t("you.modules")} title={t("you.extraTrackingForACondition")} level={2} className="youmodules">
          <ul className="modlist">
            {modules.map((m) => (m.id === "pots"
              ? pots && <PotsAddon key="pots" module pots={pots.pots} stageName={stageName} onOn={pots.onOn} onOff={pots.onOff} storageDriver={sp.storageDriver} />
              : [<ModuleRow key={m.id} id={m.id} icon="sparkle" name={m.name} short={m.short} adds={MODULE_ADDS[m.id] || m.adds} on={m.on} onToggle={m.onToggle} />,
                /* Meal notes: an optional switch under the PCOS module (offered where PCOS is; works whether or not PCOS is on). */
                m.id === "pcos" && meals && <ModuleRow key="meals" id="meals" icon="bowl" name={t("you.mealsName")} short={meals.photosInBuild ? t("you.mealsShortPhotos") : t("you.mealsShort")} adds={t("you.mealsAdds")} on={!!meals.on} onToggle={meals.onToggle} />]))}
            {fertRow && (
              <ModuleRow id="fert" icon="thermometer" name={FERT_COPY.settingTitle} short={t("you.fertShort")} adds={MODULE_ADDS.fert} on={!!fertRow.on} onToggle={() => fertRow.setOn(!fertRow.on)} />
            )}
          </ul>
          <Details label={t("you.whatEachOneAdds")}>
            <ul className="modaddslist">
              {modules.filter((m) => m.id !== "pots" || pots).map((m) => <li key={m.id}><b>{m.name}</b> <span className="modadds" id={`mod-${m.id}-adds`}>{MODULE_ADDS[m.id] || m.adds}</span></li>)}
              {meals && <li><b>{t("you.mealsName")}</b> <span className="modadds" id="mod-meals-adds">{t("you.mealsAdds")}</span></li>}
              {fertRow && <li><b>{FERT_COPY.settingTitle}</b> <span className="modadds" id="mod-fert-adds">{MODULE_ADDS.fert} {fertRow.privacy}</span></li>}
            </ul>
            <p className="rfoot">{t("you.yourModuleSwitchesStayOn", { MODULE_FRAMING })}</p>
          </Details>
        </Card>
      )}
    </>
  );
  const tourCard = (
    <>
      {onTour && (
        <Card id="you-tour" tint="you" icon="sparkle" eyebrow="Finding your way" title="New here, or a bit lost?" level={2}>
          <p>Bring back Getting started on Home and the short tip at the top of each screen.</p>
          <button type="button" className="ghostbtn" onClick={onTour}>Show me around again</button>
        </Card>
      )}
    </>
  );
  const homeCardsCard = (
    <>
      {/* 2026-11-19: Home cards she can hide come back here (today: Ask Solia; askCardOff, this device only). */}
      {homeCards && (
        <Card id="you-home-cards" tint="you" icon="home" eyebrow={t("you.settings")} title="Home cards" level={2} className="youset">
          <ul className="modlist">
            <li className="modrow">
              <div className="modrow-main"><div className="modinfo"><b id="home-ask-n">{ASK_COPY.showName}</b><span className="hint" id="home-ask-d">{ASK_COPY.showHint}</span></div>
                <Switch checked={!!homeCards.ask} onChange={(v) => homeCards.setAsk(v)} labelledBy="home-ask-n" describedBy="home-ask-d" /></div>
            </li>
          </ul>
        </Card>
      )}
    </>
  );
  const planCard = (
    <>
      <Card id="you-plan" tint="patterns" icon="sparkle" eyebrow={PLAN_COPY.eyebrow} title={proOwned ? PLAN_COPY.pro : planUnlocked ? PLAN_COPY.test : PLAN_COPY.free} level={2} className="youplan" badge={<Chip variant="pro" />}>
        <p>{proOwned ? PLAN_COPY.bodyOn : trial?.gateOn ? PLAN_COPY.bodyTrial : PLAN_COPY.body}</p>
        {proOwned && proUntil && <p className="prountil">{untilLine(proUntil)}</p>}
        {trial?.line && <p className="youtrial" role="status">{trial.line}</p>}
        {!proOwned && <PlanCardTiles store={store} native={native} promo={promo} onHidePromo={onHidePromo} refs={refs} />}
        <div className="youplanacts">
          <button type="button" className="ghostbtn youprobtn" aria-haspopup="dialog" onClick={onPro}>{storeReady && !proOwned ? PLAN_COPY.seePlans : PLAN_COPY.see}</button>
          {onRestore && <button type="button" className="linkbtn yourestore" aria-describedby="you-store-line" onClick={onRestore}>{PLAN_COPY.restore}</button>}
        </div>
        <Details label={t("you.howThisWorks")}>
          <p className="hint youfree">{freeKeepsFor(!!trial?.gateOn)}</p>
          <p className="rfoot">{proOwned ? PLAN_COPY.on : planUnlocked ? PLAN_COPY.testNote : trial?.gateOn ? PLAN_COPY.optionalTrial : PLAN_COPY.optional}</p>
          {storeLine && <p className="rfoot" id="you-store-line">{storeLine}</p>}
        </Details>
      </Card>
    </>
  );
  const checkinsCard = (
    <>
      <Card id="you-checkins" tint="you" icon="lightning" eyebrow={t("you.settings")} title={remindersHere ? t("you.checkInsAndReminders") : t("you.checkIns")} level={2} className="youset" tabIndex={-1}>
        <p className="hint yousum">{checkinSummary}</p>
        {remindersHere && !remindersOff && <div className="youreminders"><RemindersBody hideLab reminders={sp.reminders} reminderSupport={sp.reminderSupport} cadence={sp.cadence} onReminders={sp.onReminders} stage={sp.stage} lead /></div>}
        <Details label={remindersHere ? t("you.rhythmTimeAndStyle") : t("you.checkInStyle")}>
          {remindersHere && remindersOff && <div className="youreminders"><RemindersBody hideLab reminders={sp.reminders} reminderSupport={sp.reminderSupport} cadence={sp.cadence} onReminders={sp.onReminders} stage={sp.stage} lead /></div>}
          <CheckinsBody cadence={sp.cadence} setCadence={sp.setCadence} quietHours={sp.quietHours} setQuietHours={sp.setQuietHours} quickMode={sp.quickMode} setQuickMode={sp.setQuickMode} ping={sp.ping} reminders={sp.reminders} reminderSupport={sp.reminderSupport} />
        </Details>
      </Card>
    </>
  );
  const countsCard = (
    <>
      {FEATURES.counts && hasServer() && (
        <Card id="you-counts" tint="mind" icon="people" title={t("you.anonymousWeeklyCounts")} level={2} className="youset">
          <CountsBody hideLab lead stage={sp.stage} research={sp.research} setResearch={sp.setResearch} />
        </Card>
      )}
    </>
  );
  const appearanceCard = (
    <>
      <Card id="you-appearance" tint="body" icon="moon" title={t("you.appearance")} level={2} className="youset">
        <AppearanceBody hideLab appearance={sp.appearance} onAppearance={sp.onAppearance} uiStyle={sp.uiStyle} onStyle={sp.onStyle} />
        {sp.palette && <PalettePicker {...sp.palette} />}
      </Card>
    </>
  );
  const languageCard = (
    <>
      {language && (
        <Card id="you-language" tint="you" icon="globe" title={t("you.language")} level={2} className="youset">
          <div className="mcrow seg" role="group" aria-label={t("you.language")}>
            <button type="button" className={`mc ${language.value == null ? "on" : ""}`} aria-pressed={language.value == null} onClick={() => language.set(null)}>{t("you.languageDevice")}</button>
            {language.options.map((o) => <button key={o.code} type="button" lang={o.code} className={`mc ${language.value === o.code ? "on" : ""}`} aria-pressed={language.value === o.code} onClick={() => language.set(o.code)}>{o.name}</button>)}
          </div>
          <p className="rfoot">{t("you.languageLead")}</p>
        </Card>
      )}
    </>
  );
  const installCard = (
    <>
      {install && (
        <Card id="you-install" tint="you" icon="download" title={t("you.installCyra")} level={2} className="youset youinstall">
          <InstallSettings install={install} />
        </Card>
      )}
    </>
  );
  const aiCard = (
    <>
      <Card id="you-ai" tint="mind" icon="sparkle" title={t("you.cyrasAi")} level={2} className="youset youai" tabIndex={-1}>
        {ai.available ? (
          <>
            <button type="button" role="checkbox" aria-checked={!!ai.on} aria-describedby="you-ai-disclosure" className={`consentopt ${ai.on ? "on" : ""}`} onClick={() => ai.set(!ai.on)}>
              <span className="ckbox" aria-hidden="true">{ai.on ? "✓" : ""}</span>
              <span><b>{t("you.alsoAskCyrasAiWhen")}</b></span>
            </button>
            <p className="rfoot" id="you-ai-disclosure">{AI_DISCLOSURE}</p>
            <Details label={t("you.exactlyWhatsSent")}><AiFacts /><p className="rfoot">{t("you.offUntilYouTurnIt")}</p></Details>
            {offer.any && (offer.weekly || offer.chat || offer.meals ? (
              <div className="youaipro">
                <p className="section-lab youaipro-lab"><Chip variant="pro" /> {t("you.yourLogWithCyrasAi")}</p>
                <ul className="modlist aiswitches">
                  {offer.weekly && (
                    <li className="modrow airow" data-ai="weekly">
                      <div className="modrow-main"><div className="modinfo"><b id="ai-weekly-n">{AI_COPY.weeklyName}</b><span className="hint">{AI_COPY.weeklyShort}</span></div>
                        <Switch checked={prefs.weekly} onChange={(v) => ai.setPref("weekly", v)} labelledBy="ai-weekly-n" describedBy="ai-weekly-d" /></div>
                      <p className="modadds" id="ai-weekly-d">{AI_COPY.weeklyAdds}</p>
                    </li>
                  )}
                  {offer.chat && (
                    <li className="modrow airow" data-ai="chat">
                      <div className="modrow-main"><div className="modinfo"><b id="ai-chat-n">{AI_COPY.chatName}</b><span className="hint">{AI_COPY.chatShort}</span></div>
                        <Switch checked={prefs.chat} onChange={(v) => ai.setPref("chat", v)} labelledBy="ai-chat-n" describedBy="ai-chat-d" /></div>
                      <p className="modadds" id="ai-chat-d">{AI_COPY.chatAdds}</p>
                    </li>
                  )}
                  {/* 2026-11-26 (docs/plans/meal-photos-findable.md): the switch shows whether photos can be taken (Meal photos
                      AND Meal notes on). Turning it on opens "Turn on meal photos" (App.jsx ai.onMealsOn), which turns both
                      on, or the sign-in sheet where this server asks for an account; turning it off is one tap, as before. */}
                  {offer.meals && (
                    <li className="modrow airow" data-ai="meals">
                      <div className="modrow-main"><div className="modinfo"><b id="ai-meals-n">{MEAL_COPY.name}</b><span className="hint">{MEAL_COPY.short}</span></div>
                        <Switch checked={mealsOn} onChange={(v) => (v && ai.onMealsOn ? ai.onMealsOn() : ai.setPref("meals", v))} labelledBy="ai-meals-n" describedBy={`ai-meals-d${mealsNeed ? " ai-meals-needs" : ""}`} /></div>
                      <p className="modadds" id="ai-meals-d">{MEAL_COPY.adds}</p>
                      {mealsNeed && <p className="modadds" id="ai-meals-needs">{mealsNeed}</p>}
                    </li>
                  )}
                  {offer.meals && mealsOn && <li className="airow-cal"><CalSwitch id="ai-mealcal" shown={prefs.showCal === true} onChange={(v) => ai.setPref("showCal", v)} /></li>}
                </ul>
                {(prefs.weekly || prefs.chat) && (
                  <button type="button" role="checkbox" aria-checked={!!prefs.labs} aria-describedby="ai-labs-d" className={`consentopt ${prefs.labs ? "on" : ""}`} onClick={() => ai.setPref("labs", !prefs.labs)}>
                    <span className="ckbox" aria-hidden="true">{prefs.labs ? "✓" : ""}</span>
                    <span><b>{AI_COPY.labsName}</b></span>
                  </button>
                )}
                {(prefs.weekly || prefs.chat) && <p className="rfoot" id="ai-labs-d">{AI_COPY.labsHint}</p>}
                <Details label={t("you.exactlyWhatTheSummaryHolds")}><ul><li>{FLOW_COPY.details.summaryFields}</li><li>{FLOW_COPY.details.summaryNever}</li></ul><p className="rfoot">{AI_COPY.offLine}</p></Details>
              </div>
            ) : (
              <div className="youaipro locked">
                <p className="section-lab youaipro-lab"><Chip variant="pro" /> {t("you.yourLogWithCyrasAi")}</p>
                <p className="hint">{AI_COPY.locked}</p>
                <button type="button" className="ghostbtn" aria-haspopup="dialog" onClick={onPro}>{PLAN_COPY.see}</button>
              </div>
            ))}
          </>
        ) : (
          <p>{AI_OFF_LINE}</p>
        )}
      </Card>
    </>
  );
  const aboutCard = (
    <>
      <Card id="you-about" tint="you" icon="user" title={t("you.aboutYou")} level={2} className="youset">
        <AboutBody hideLab compact regAnswers={sp.regAnswers} onAnswer={sp.onAnswer} stage={sp.stage} stageName={sp.stageName} todayIso={sp.todayIso} />
      </Card>
    </>
  );
  const accountCards = (
    <>
      {/* Task 1: the sign-in account, when this device is signed in. Otherwise "Your account" says why there is none yet
          (2026-11-15: never "No account needed"; signinMode none / unset: sign-in isn't switched on yet). */}
      {signedIn && <SignedInCard si={signedIn} />}
      {/* The guest window (2026-11-16, lib/guest.js): a guest's account card says until when, the whole story once, and
          offers "Create account" (always here, while Home's line shows once a day). */}
      {guest && !signedIn && (
        <Card id="you-guest" tint="you" icon="user" eyebrow={t("you.account")} title={t("you.yourAccount")} level={2} className="youaccount youguest">
          <p>{guest.youLine}</p>
          <p className="hint">{guest.story}</p>
          <div className="acctacts">
            <button type="button" className="ghostbtn" aria-haspopup="dialog" onClick={guest.onCreate}>{guest.createLabel}</button>
          </div>
          {!account && <p className="rfoot">{ACCOUNT_LINES.more}</p>}
        </Card>
      )}
      {account ? <AccountCard a={account} person={acct} /> : !signedIn && !guest && (
        <Card id="you-account" tint="you" icon="user" eyebrow={t("you.account")} title={t("you.yourAccount")} level={2} className="youaccount">
          <p>{signMode === "none" ? accountLine(acct) : youAccountLine(signMode)}</p>
          <p className="rfoot">{ACCOUNT_LINES.more}</p>
        </Card>
      )}
    </>
  );
  const legalCard = (
    <>
      <Card id="you-about-legal" tint="you" icon="book" eyebrow={t("you.about")} title={t("you.aboutLegal")} level={2} className="youlegal-card">
        <p className="aboutbrand"><BrandMark size={30} /><span><b>{t("you.brandName")}</b><span className="slogan">{t("splash.slogan")}</span></span></p>
        <p>{NOT_MEDICAL}</p>
        {TERMS_URL || PRIVACY_URL
          ? <div className="youlegals">{TERMS_URL && link(TERMS_URL, "Terms")}{PRIVACY_URL && link(PRIVACY_URL, "Privacy Policy")}</div>
          : <p className="hint">{t("you.cyrasTermsAndPrivacyPolicy")}</p>}
        <p className="rfoot youbuild">{t("you.freeToUse")}<br /><b>{BUILD_STAMP}</b></p>
      </Card>
    </>
  );

  /* The menu (no page open): her name, the stage card (unchanged) and one row per page. */
  if (!pg) {
    return (
      <main className="youpage youmenu">
        {head}
        {stageCard}
        {/* 2026-11-25 (docs/plans/upgrade-enterprise.md Task 1): one clear way to Pro, above the rows, only while she does
            not own it. It opens the same Pro sheet as "See plans" on Plan & account; nothing is sold on the web. */}
        {upgradeShown({ owned: proOwned }) && (
          <div className="youupgrade">
            <button type="button" id="you-upgrade" className="cta youupgrade-btn" aria-haspopup="dialog" onClick={onPro}><Icon name="sparkle" size={16} />{YOU_COPY.upgrade}</button>
          </div>
        )}
        <nav className="youmenu-nav" aria-label="Pages in You">
          <ul className="yourows">
            {YOU_PAGES.map((r) => (
              <li key={r.id}>
                <button type="button" id={`you-row-${r.id}`} className="yourow" data-page={r.id} onClick={() => onOpenPage(r.view)}>
                  <IBadge icon={r.icon} tint={r.tint} />
                  <span className="yourow-txt">
                    <b>{r.title}</b>
                    <span className="yourow-line">{r.line}</span>
                    {r.id === "plan" && planLabel && <span className="yourow-state" data-plan={planKey || undefined}>{planLabel}</span>}
                  </span>
                  <Icon name="arrow-right" size={16} className="yourow-go" />
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    );
  }
  const on = (id) => pg.id === id;
  return (
    <main className="youpage yousub" data-page={pg.id}>
      <button type="button" id="you-back" className="linkbtn subback" onClick={onBack}><Icon name="arrow-right" size={14} className="flipx" />{t("you.you")}</button>
      <h1 className="disp youname yousub-title">{pg.title}</h1>

      {/* ---- Your profile: her stage (the same Change control), about you, condition modules, sharing with a partner ---- */}
      {on("profile") && (
        <Card id="you-stage" tint="you" icon="user" eyebrow={t("you.yourStage")} title={stageName} level={2} className="youset youstage2">
          <StageArt k={stageArtKey({ stage, stageName })} className="stageart-hero" />
          <p className="hint">{t("you.cyraIsShapedAroundOne")}</p>
          <button type="button" className="ghostbtn" onClick={onChangeStage}>{t("you.change", { stageName })}</button>
        </Card>
      )}
      {on("profile") && aboutCard}
      {on("profile") && modulesCard}
      {/* 2026-11-25 (upgrade-enterprise Task 3): the organization she joined, or an invite code (builds with a server). */}
      {on("profile") && orgCard}
      {/* Task A (2026-11-14): Share with a partner (components/PartnerShare.jsx; cycle stages only). */}
      {on("profile") && partner}

      {/* ---- Privacy & your data: the privacy card and list exactly as before, the anonymous counts, the way to the AI's page ---- */}
      {on("privacy") && privacyCard}
      {on("privacy") && countsCard}
      {on("privacy") && (
        <div id="you-ai-link" className="plaincard youailink">
          <p className="hint">{YOU_COPY.aiLink}</p>
          <button type="button" className="linkbtn" onClick={() => onOpenPage("youai")}>{t("you.cyrasAi")}<Icon name="arrow-right" size={14} /></button>
        </div>
      )}

      {/* ---- Solia Health's AI: its own page, so "You → Solia Health's AI" is the two taps it says ---- */}
      {on("ai") && aiCard}

      {/* ---- Plan & account ---- */}
      {on("plan") && planCard}
      {on("plan") && accountCards}

      {/* ---- Devices & reminders. Passive tracking S3: Data sources (components/DataSourcesCard.jsx), where she manages
          every source and reads the spike's numbers. ---- */}
      {on("devices") && dataSources}
      {on("devices") && checkinsCard}
      {on("devices") && installCard}

      {/* ---- App settings: appearance and style, language, the voice guide, the tour, Home cards ---- */}
      {on("app") && appearanceCard}
      {on("app") && languageCard}
      {on("app") && voice && (
        <Card id="you-voice" tint="mind" icon="breath" eyebrow={t("you.settings")} title={YOU_COPY.voiceTitle} level={2} className="youset">
          <ul className="modlist">
            <li className="modrow">
              <div className="modrow-main"><div className="modinfo"><b id="you-voice-n">{YOU_COPY.voiceName}</b><span className="hint" id="you-voice-d">{YOU_COPY.voiceHint}</span></div>
                <Switch checked={!!voice.on} onChange={(v) => voice.set(v)} labelledBy="you-voice-n" describedBy="you-voice-d" /></div>
            </li>
          </ul>
        </Card>
      )}
      {on("app") && tourCard}
      {on("app") && homeCardsCard}

      {/* ---- Help & about. 2026-11-19: Help (components/Feedback.jsx): short answers, and in a build with a server the
          feedback sheet; Learn (components/Learn.jsx); the Shop by need entry; About & legal with the build stamp. ---- */}
      {on("help") && help}
      {on("help") && learn}
      {on("help") && care}
      {on("help") && legalCard}
    </main>
  );
}
