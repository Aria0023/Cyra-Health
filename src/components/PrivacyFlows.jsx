import Details, { WebReminderFacts, CountsFacts, AiFacts, WearableFacts } from "./Details.jsx";
import Icon from "./Icon.jsx";
import { FLOW_COPY, otherConnections } from "../lib/privacyFlows.js";
import { FEATURES } from "../lib/features.js";
import { filesSentence, WEAR_RESTORE_LINE } from "../lib/disclosures.js";
import { TAP_COPY } from "../lib/shopTaps.js";
import { FEEDBACK_COPY } from "../lib/feedback.js";
import { Switch } from "./ui/index.js";

/* Settings → Privacy & your data → "What can leave this device" (local-first L10, brief item 6): one row per flow this
   build can use, with its real current state (rows from lib/privacyFlows.js flowRows, computed in App.jsx from the
   feature flags, plan.js, the server setting, the platform and her settings), one line saying exactly what is sent,
   an optional note, and a Details disclosure with the full text. The full texts reuse the fact lists their screens
   already show (components/Details.jsx) and lib/disclosures.js, so the words are the same everywhere. A flow this
   build cannot use is not rendered (flowRows gives it "na"; decisions D2 and D3). Rows are li.flowrow, never
   .medrow, and no row has a switch: the controls stay where each feature lives. The one exception (2026-11-19) is
   "Count my shop taps anonymously" (lib/shopTaps.js), whose only home is this list: its row carries the switch
   (onShopTaps(on), a device-only setting) in place of the state chip. Nothing here makes a request. */
const C = FLOW_COPY;
function RowDetails({ id, native, stage }) {
  if (id === "reminders") return native ? <ul><li>{C.details.phoneReminders1}</li><li>{C.details.phoneReminders2}</li></ul> : <WebReminderFacts />;
  if (id === "counts") return <><CountsFacts stage={stage} /><p>{C.details.countsRead}</p></>;
  if (id === "ai") return <><AiFacts /><p>{C.details.aiWhere}</p></>;
  if (id === "aiMeals") return <ul><li>{C.details.mealsKept}</li><li>{C.details.mealsWhere}</li></ul>;
  if (id === "aiWeekly" || id === "aiChat") return <ul><li>{C.details.summaryFields}</li><li>{C.details.summaryNever}</li><li>{C.details.aiTwoWhere}</li></ul>;
  if (id === "wearables") return <><WearableFacts native={native} /><p>{WEAR_RESTORE_LINE}</p><p>{C.details.wearWhere}</p></>;
  if (id === "shopTaps") return <ul><li>{TAP_COPY.detail1}</li><li>{TAP_COPY.detail2}</li><li>{TAP_COPY.detail3}</li></ul>;
  if (id === "feedback") return <ul><li>{FEEDBACK_COPY.flowDetail1}</li><li>{FEEDBACK_COPY.flowDetail2}</li><li>{FEEDBACK_COPY.flowDetail3}</li></ul>;
  if (id === "cloud") return <ul><li>{C.details.cloudHolds}</li><li>{C.details.cloudLost}</li><li>{C.details.cloudWhere}</li></ul>;
  if (id === "files") return (
    <ul>
      <li>{C.details.backupLocked}</li>
      <li>{filesSentence(FEATURES)}</li>
      {stage && stage !== "preg" && <li>{C.details.summary}</li>}
    </ul>
  );
  return null;
}
const lineFor = (row, native) => (row.id === "reminders" ? (native ? C.lines.remindersPhone : C.lines.remindersWeb) : C.lines[row.id] || "");
// 2026-11-25 (critique-fixes Task 4): a row with a short line shows it; its full line leads the row's Details, word for word.
const shortFor = (row) => C.short[row.id] || null;

export default function PrivacyFlows({ rows = [], native = false, server = false, stage = null, onShopTaps = null }) {
  const shown = rows.filter((r) => r.state !== "na");
  const other = otherConnections({ native, server, flags: FEATURES });
  return (
    <>
      <p className="section-lab" id="set-flows" style={{ margin: "12px 0 6px" }}><Icon name="share" className="labico" />{C.label}</p>
      <p className="hint flowintro">{C.intro}</p>
      <ul className="flowlist" role="list">
        {shown.map((row) => (
          <li className="flowrow" key={row.id}>
            <div className="flowhead"><b id={`flow-${row.id}`}>{row.name}</b>
              {row.id === "shopTaps" && onShopTaps
                ? <Switch checked={row.state === "on"} onChange={onShopTaps} labelledBy={`flow-${row.id}`} describedBy={`flow-${row.id}-line`} className="flowswt" />
                : <span className={`flowstate ${row.state}`}>{C.states[row.state]}</span>}
            </div>
            <p className="flowline" id={`flow-${row.id}-line`}>{shortFor(row) || lineFor(row, native)}</p>
            {row.note && C.notes[row.note] && <p className="flownote">{C.notes[row.note]}</p>}
            <Details label={C.detailsLabel} describedBy={`flow-${row.id}`}>{shortFor(row) && <p className="flowfull">{lineFor(row, native)}</p>}<RowDetails id={row.id} native={native} stage={stage} /></Details>
          </li>
        ))}
      </ul>
      {other.length > 0 && (
        <Details label={C.otherLabel}>
          <ul>{other.map((k) => <li key={k}>{C.other[k]}</li>)}</ul>
        </Details>
      )}
    </>
  );
}
