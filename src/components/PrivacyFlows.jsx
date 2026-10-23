import Details, { WebReminderFacts, CountsFacts, AiFacts, WearableFacts } from "./Details.jsx";
import Icon from "./Icon.jsx";
import { FLOW_COPY, otherConnections } from "../lib/privacyFlows.js";
import { FEATURES } from "../lib/features.js";
import { filesSentence, WEAR_RESTORE_LINE } from "../lib/disclosures.js";

/* Settings → Privacy & your data → "What can leave this device" (local-first L10, brief item 6): one row per flow this
   build can use, with its real current state (rows from lib/privacyFlows.js flowRows, computed in App.jsx from the
   feature flags, plan.js, the server setting, the platform and her settings), one line saying exactly what is sent,
   an optional note, and a Details disclosure with the full text. The full texts reuse the fact lists their screens
   already show (components/Details.jsx) and lib/disclosures.js, so the words are the same everywhere. A flow this
   build cannot use is not rendered (flowRows gives it "na"; decisions D2 and D3). Rows are li.flowrow, never
   .medrow, and no row has a switch: the controls stay where each feature lives. Nothing here makes a request. */
const C = FLOW_COPY;
function RowDetails({ id, native, stage }) {
  if (id === "reminders") return native ? <ul><li>{C.details.phoneReminders1}</li><li>{C.details.phoneReminders2}</li></ul> : <WebReminderFacts />;
  if (id === "counts") return <><CountsFacts stage={stage} /><p>{C.details.countsRead}</p></>;
  if (id === "ai") return <><AiFacts /><p>{C.details.aiWhere}</p></>;
  if (id === "wearables") return <><WearableFacts native={native} /><p>{WEAR_RESTORE_LINE}</p><p>{C.details.wearWhere}</p></>;
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

export default function PrivacyFlows({ rows = [], native = false, server = false, stage = null }) {
  const shown = rows.filter((r) => r.state !== "na");
  const other = otherConnections({ native, server, flags: FEATURES });
  return (
    <>
      <p className="section-lab" id="set-flows" style={{ margin: "12px 0 6px" }}><Icon name="share" className="labico" />{C.label}</p>
      <p className="hint flowintro">{C.intro}</p>
      <ul className="flowlist" role="list">
        {shown.map((row) => (
          <li className="flowrow" key={row.id}>
            <div className="flowhead"><b id={`flow-${row.id}`}>{row.name}</b><span className={`flowstate ${row.state}`}>{C.states[row.state]}</span></div>
            <p className="flowline">{lineFor(row, native)}</p>
            {row.note && C.notes[row.note] && <p className="flownote">{C.notes[row.note]}</p>}
            <Details label={C.detailsLabel} describedBy={`flow-${row.id}`}><RowDetails id={row.id} native={native} stage={stage} /></Details>
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
