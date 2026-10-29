import { Card, Chip, Switch } from "../components/ui/index.js";
import Icon from "../components/Icon.jsx";
import ModuleRow from "../components/ModuleRow.jsx";
import PotsAddon from "../components/pots/PotsAddon.jsx";
import Details, { AiFacts } from "../components/Details.jsx";
import { InstallSettings } from "../components/Pwa.jsx";
import { CheckinsBody, RemindersBody, CountsBody, AppearanceBody, AboutBody, PrivacyBody, reminderModel } from "../components/settingsParts.jsx";
import { MODULE_FRAMING } from "../lib/modules.js";
import { FEATURES } from "../lib/features.js";
import { hasServer } from "../lib/api.js";
import { FERT_COPY } from "../lib/fertility.js";
import { TERMS_URL, PRIVACY_URL, openExternal } from "../lib/links.js";
import { BUILD_STAMP, MODULE_ADDS, PLAN_COPY, ACCOUNT_LINES, NOT_MEDICAL, AI_OFF_LINE, accountLine } from "../lib/about.js";
import { FREE_KEEPS } from "../components/ProSheet.jsx";
import { AI_DISCLOSURE } from "./AskScreen.jsx";
import { AI_COPY } from "../lib/aiFeatures.js";
import { FLOW_COPY } from "../lib/privacyFlows.js";
import { AccountCard } from "../components/AccountParts.jsx";

/* You (calm R7, spec "You tab"): one calm scrolling page of v2 Cards. It is where she controls her data, so the
   privacy dashboard is the first thing under her stage. Top to bottom:
   - her name and stage (one life-stage experience: changing it replaces it, what she logged stays);
   - Privacy & your data (L10): what can leave this device, an encrypted backup and restore, the app lock, delete everything;
   - Modules: PCOS, POTS (and fertility signs where the stage offers them), each a real switch with a one-line
     "what it adds". The PCOS switch is this card's only PCOS control; POTS also has its row in the header's Settings
     sheet (Add-ons), which App.jsx closes whenever the You tab is open, so one switch is ever on screen;
   - Plan: Cyra Free, and a "See what Pro adds" sheet. Calm R8: "Restore purchases" asks lib/purchase.js, which in this
     version has no store connected and says so (nothing is checked or sent); no price, no nagging;
   - Check-ins, Reminders, (weekly counts where the build has them), Appearance, (Install), Cyra's AI, About you:
     the same controls, ids and sentences the Settings sheet has (components/settingsParts.jsx);
   - Account: R7's "No account needed" card, unchanged, in a build without the optional account; calm R9: where the
     build offers it (`account`, lib/cloudBackup.js ACCOUNTS_HERE) the AccountCard (guest by default; create, sign in,
     back up now, sign out, delete, and the "backup is newer" choice); Support & care (the care shelf), About & legal (not a medical device, links, build).
   - Cyra's AI (calm R8): with Pro, the ai flag and a server, the weekly write-up and chat switches (off by default) and
     "Include lab values"; without Pro, one line and "See what Pro adds". The switches send nothing themselves.
   A Language card is not shown until the picker exists (R10). Nothing on this page sends anything anywhere. */
/* A quiet illustration for the stage card: soft rings and a blob in the stage accent (tokens only, decorative). */
const StageArt = () => (
  <svg className="youart" viewBox="0 0 200 150" aria-hidden="true" focusable="false">
    <path className="youart-blob" d="M128 8c26-6 56 10 62 38s-8 54-32 66-54 8-72-12-18-48-2-70S110 12 128 8z" />
    <circle className="youart-ring r1" cx="150" cy="62" r="46" />
    <circle className="youart-ring r2" cx="150" cy="62" r="30" />
    <circle className="youart-dot" cx="150" cy="16" r="5" />
    <path className="youart-arc" d="M150 62m-46 0a46 46 0 0 1 46-46" />
  </svg>
);
export default function YouScreen({ acct, stage, stageName, onChangeStage, modules = [], pots = null, fertRow = null, planUnlocked = false, onPro, ai = { available: false, on: false, set: () => {} }, sp, install = null, care = null, onRestore = null, storeLine = null, account = null }) {
  const offer = ai.offer || { any: false, weekly: false, chat: false };
  const prefs = ai.prefs || { weekly: false, chat: false, labs: false };
  const who = acct?.anon ? "Anonymous" : acct?.name || "You";
  const { remindersHere } = reminderModel({ reminders: sp.reminders, reminderSupport: sp.reminderSupport, cadence: sp.cadence });
  const anyModule = modules.length > 0 || !!fertRow;
  const link = (url, label) => <button type="button" className="linkbtn youlegal" onClick={() => openExternal(url)}>{label}<Icon name="arrow-right" size={14} /></button>;
  return (
    <main className="youpage">
      <p className="eyebrow">You</p>
      <h1 className="disp youname">{who}</h1>
      <Card hero tint="you" icon="user" eyebrow="Your stage" title={stageName} level={2} className="youstage">
        <StageArt />
        <p className="hint">Cyra is shaped around one stage at a time. Changing it keeps everything you've logged.</p>
        <button type="button" className="stagechip quiet" onClick={onChangeStage}>{stageName} · change</button>
        {sp.daysLogged > 0 && <p className="youfact"><Icon name="calendar" size={14} />{sp.daysLogged === 1 ? "1 day logged" : `${sp.daysLogged} days logged`}</p>}
      </Card>

      <Card id="you-privacy" tint="mind" icon="shield" eyebrow="Privacy & your data" title="You decide what leaves this device" level={2} className="youprivacy" tabIndex={-1}>
        <p className="hint youlead">Your log is yours. Below is everything Cyra can send, and the tools to back it up, lock it and delete it.</p>
        <PrivacyBody hideLab storageDriver={sp.storageDriver} onExport={sp.onExport} onImport={sp.onImport} onWipe={sp.onWipe} ping={sp.ping} keepsWeekNote={sp.keepsWeekNote} daysLogged={sp.daysLogged} lastBackupAt={sp.lastBackupAt} todayIso={sp.todayIso} offlineCopy={sp.offlineCopy} legacyWear={sp.legacyWear} onHandoff={sp.onHandoff} flows={sp.flows} flowCtx={sp.flowCtx} lock={sp.lock} potsOn={sp.potsOn} />
      </Card>

      {anyModule && (
        <Card id="you-modules" tint="body" icon="plus-circle" eyebrow="Modules" title="Extra tracking for a condition" level={2} className="youmodules">
          <ul className="modlist">
            {modules.map((m) => (m.id === "pots"
              ? pots && <PotsAddon key="pots" module pots={pots.pots} stageName={stageName} onOn={pots.onOn} onOff={pots.onOff} storageDriver={sp.storageDriver} />
              : <ModuleRow key={m.id} id={m.id} icon="sparkle" name={m.name} short={m.short} adds={MODULE_ADDS[m.id] || m.adds} on={m.on} onToggle={m.onToggle} />))}
            {fertRow && (
              <ModuleRow id="fert" icon="thermometer" name={FERT_COPY.settingTitle} short="Cervical mucus, ovulation tests, temperature" adds={MODULE_ADDS.fert} on={!!fertRow.on} onToggle={() => fertRow.setOn(!fertRow.on)}>
                <p className="rfoot modnote">{fertRow.privacy}</p>
              </ModuleRow>
            )}
          </ul>
          <p className="rfoot">{MODULE_FRAMING} Your module switches stay on this device, and go into an encrypted backup only if you save one.</p>
        </Card>
      )}

      <Card id="you-plan" tint="patterns" icon="sparkle" eyebrow={PLAN_COPY.eyebrow} title={planUnlocked ? PLAN_COPY.test : PLAN_COPY.free} level={2} className="youplan" badge={<Chip variant="pro" />}>
        <p>{PLAN_COPY.body}</p>
        <p className="hint youfree">{FREE_KEEPS}</p>
        <div className="youplanacts">
          <button type="button" className="ghostbtn youprobtn" aria-haspopup="dialog" onClick={onPro}>{PLAN_COPY.see}</button>
          {onRestore && <button type="button" className="linkbtn yourestore" aria-describedby="you-store-line" onClick={onRestore}>{PLAN_COPY.restore}</button>}
        </div>
        <p className="rfoot">{planUnlocked ? PLAN_COPY.testNote : PLAN_COPY.none}</p>
        {storeLine && <p className="rfoot" id="you-store-line">{storeLine}</p>}
      </Card>

      <Card id="you-checkins" tint="you" icon="lightning" eyebrow="Settings" title={remindersHere ? "Check-ins and reminders" : "Check-ins"} level={2} className="youset" tabIndex={-1}>
        <CheckinsBody cadence={sp.cadence} setCadence={sp.setCadence} quietHours={sp.quietHours} setQuietHours={sp.setQuietHours} quickMode={sp.quickMode} setQuickMode={sp.setQuickMode} ping={sp.ping} reminders={sp.reminders} reminderSupport={sp.reminderSupport} />
        {remindersHere && <div className="youreminders"><RemindersBody reminders={sp.reminders} reminderSupport={sp.reminderSupport} cadence={sp.cadence} onReminders={sp.onReminders} stage={sp.stage} /></div>}
      </Card>

      {FEATURES.counts && hasServer() && (
        <Card id="you-counts" tint="mind" icon="people" title="Anonymous weekly counts" level={2} className="youset">
          <CountsBody hideLab lead stage={sp.stage} research={sp.research} setResearch={sp.setResearch} />
        </Card>
      )}

      <Card id="you-appearance" tint="body" icon="moon" title="Appearance" level={2} className="youset">
        <AppearanceBody hideLab appearance={sp.appearance} onAppearance={sp.onAppearance} />
      </Card>

      {install && (
        <Card id="you-install" tint="you" icon="download" title="Install Cyra" level={2} className="youset youinstall">
          <InstallSettings install={install} />
        </Card>
      )}

      <Card id="you-ai" tint="mind" icon="sparkle" title="Cyra's AI" level={2} className="youset youai">
        {ai.available ? (
          <>
            <button type="button" role="checkbox" aria-checked={!!ai.on} aria-describedby="you-ai-disclosure" className={`consentopt ${ai.on ? "on" : ""}`} onClick={() => ai.set(!ai.on)}>
              <span className="ckbox" aria-hidden="true">{ai.on ? "✓" : ""}</span>
              <span><b>Also ask Cyra's AI when the library has no answer</b></span>
            </button>
            <p className="rfoot" id="you-ai-disclosure">{AI_DISCLOSURE}</p>
            <Details label="Exactly what's sent"><AiFacts /></Details>
            <p className="rfoot">Off until you turn it on. It is the same choice as on Ask Cyra in Mind → Journey.</p>
            {offer.any && (offer.weekly || offer.chat ? (
              <div className="youaipro">
                <p className="section-lab youaipro-lab"><Chip variant="pro" /> Your log, with Cyra's AI</p>
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
                </ul>
                {(prefs.weekly || prefs.chat) && (
                  <button type="button" role="checkbox" aria-checked={!!prefs.labs} aria-describedby="ai-labs-d" className={`consentopt ${prefs.labs ? "on" : ""}`} onClick={() => ai.setPref("labs", !prefs.labs)}>
                    <span className="ckbox" aria-hidden="true">{prefs.labs ? "✓" : ""}</span>
                    <span><b>{AI_COPY.labsName}</b></span>
                  </button>
                )}
                {(prefs.weekly || prefs.chat) && <p className="rfoot" id="ai-labs-d">{AI_COPY.labsHint}</p>}
                <Details label="Exactly what the summary holds"><ul><li>{FLOW_COPY.details.summaryFields}</li><li>{FLOW_COPY.details.summaryNever}</li></ul></Details>
                <p className="rfoot">{AI_COPY.offLine}</p>
              </div>
            ) : (
              <div className="youaipro locked">
                <p className="section-lab youaipro-lab"><Chip variant="pro" /> Your log, with Cyra's AI</p>
                <p className="hint">{AI_COPY.locked}</p>
                <button type="button" className="ghostbtn" aria-haspopup="dialog" onClick={onPro}>{PLAN_COPY.see}</button>
              </div>
            ))}
          </>
        ) : (
          <p>{AI_OFF_LINE}</p>
        )}
      </Card>

      <Card id="you-about" tint="you" icon="user" title="About you" level={2} className="youset">
        <AboutBody hideLab regAnswers={sp.regAnswers} onAnswer={sp.onAnswer} stage={sp.stage} stageName={sp.stageName} todayIso={sp.todayIso} />
      </Card>

      {account ? <AccountCard a={account} person={acct} /> : (
        <Card id="you-account" tint="you" icon="user" eyebrow="Account" title="No account needed" level={2} className="youaccount">
          <p>{accountLine(acct)}</p>
          <p className="rfoot">{ACCOUNT_LINES.more}</p>
        </Card>
      )}

      {care}

      <Card id="you-about-legal" tint="you" icon="book" eyebrow="About" title="About & legal" level={2} className="youlegal-card">
        <p>{NOT_MEDICAL}</p>
        {TERMS_URL || PRIVACY_URL
          ? <div className="youlegals">{TERMS_URL && link(TERMS_URL, "Terms")}{PRIVACY_URL && link(PRIVACY_URL, "Privacy Policy")}</div>
          : <p className="hint">Cyra's Terms and Privacy Policy aren't published yet; a later version will link them here.</p>}
        <p className="rfoot youbuild">Free to use<br /><b>{BUILD_STAMP}</b></p>
      </Card>
    </main>
  );
}
