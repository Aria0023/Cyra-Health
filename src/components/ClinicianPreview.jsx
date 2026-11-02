import { pageOne, sheetVars, PATIENT_DATA, TREAT_NOTE, LABS_NOTE, NO_LABS, NO_TREAT, NO_QUESTIONS, LONG_CYCLE } from "../lib/clinicianSummary.js";
import { fmtDayY } from "../lib/potsReport.js";

/* Page 1 of the clinician summary as a scaled sheet of paper (doctor report v2): the same fitted model the PDF draws
   (lib/clinicianSummary.js fitSummary), laid out like the page. Sizes are in points of the page (--pt = 1/612 of the
   sheet's width, a container unit), so the sheet scales with the card. The sheet is always the clean light page — white
   paper, near-black ink and her stage colour darkened to AA on white (pdfAccent) — whatever the app's style or scheme.
   It is one image to assistive technology (role="img" with a summary label); "The numbers behind this" and the PDF's
   own text are the readable versions. */

function Spark({ values }) {
  const w = 40, h = 9, lo = Math.min(...values), hi = Math.max(...values);
  const pts = values.map((v, i) => [(i * w) / (values.length - 1), hi === lo ? h / 2 : h - ((v - lo) / (hi - lo)) * h]);
  return (
    <svg className="csspark" viewBox={`-2 -2 ${w + 4} ${h + 4}`} aria-hidden="true" focusable="false">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--cs-acc)" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="1.6" fill="var(--cs-acc)" />
    </svg>
  );
}

export default function ClinicianPreview({ model, accent, big = false }) {
  const p = pageOne(model);
  const n = Math.max(1, model.symptoms.logged);
  const label = `Preview of page 1: ${model.header.title}, ${model.header.period}. Cycles, ${p.symptoms.length} top symptoms, ${model.treatments.length} things she is trying, ${model.labs.length} lab tests and ${p.questions.length} questions.`;
  return (
    <div className={`cspreview${big ? " big" : ""}`} data-paper={model.paper}>
      <div className="cspage" role="img" aria-label={label} style={sheetVars(accent)}>
        <div className="cshead">
          <b className="cstitle">{model.header.title}</b>
          {model.header.name && <b className="csname">{model.header.name}</b>}
        </div>
        <p className="csline">{model.header.period} · {model.header.stage}</p>
        <p className="csmade">{model.header.made}</p>
        <hr className="csrule" />

        <p className="cslab">Cycles</p>
        {model.cycles.shown && model.cycles.strip.length > 0 && (
          <div className="csstrip">
            {model.cycles.strip.map((c) => (
              <span key={c.start} className={`cscyc${c.long ? " long" : ""}`}><b>{c.len}</b><small>{c.excluded ? "excluded" : c.long ? `over ${LONG_CYCLE} d` : "days"}</small></span>
            ))}
            {model.cycles.current != null && <span className="cscur"><small>Current cycle</small><b>day {model.cycles.current}</b></span>}
          </div>
        )}
        {model.cycles.shown && !model.cycles.strip.length && model.cycles.currentLine && <p className="cstext">{model.cycles.currentLine}</p>}
        <p className={`cstext${model.cycles.shown ? "" : " soft"}`}>{model.cycles.line}</p>

        <p className="cslab">Top symptoms · days, of {model.symptoms.logged} logged</p>
        {p.symptoms.length === 0 ? <p className="cstext soft">No symptoms logged in this period.</p> : (
          <div className="cssyms">
            {p.symptoms.map((r) => (
              <div className="cssym" key={r.id}>
                <span>{r.label}</span><i className="csbar"><i style={{ width: `${Math.max(1, (r.days / n) * 100)}%` }} /></i><b>{r.days}</b><span className="soft">{r.cluster || ""}</span>
              </div>
            ))}
          </div>
        )}
        {p.symMore && <p className="csnote">{p.symMore}</p>}

        <p className="cslab">What she is trying · before and since starting</p>
        {p.treatments.length === 0 ? <p className="cstext soft">{NO_TREAT}</p> : (
          <>
            {p.treatments.map((t) => (
              <div className="cstreat" key={t.id ?? t.name}>
                <div className="cstreathead"><b>{t.name}</b><span className="soft">{t.kind} · {t.startLine}</span></div>
                <p className={`cstext ind${t.compares.length ? "" : " soft"}`}>{t.line}</p>
              </div>
            ))}
            {p.treatMore && <p className="csnote">{p.treatMore}</p>}
            <p className="csnote">{TREAT_NOTE}</p>
          </>
        )}

        <p className="cslab">Lab values over time</p>
        {p.labs.length === 0 ? <p className="cstext soft">{NO_LABS}</p> : (
          <>
            {p.labs.map((t) => (
              <div className="cslabrow" key={t.kind}>
                <b>{t.label}</b>
                <span className="cssparkcell">{t.trend && <Spark values={t.trend} />}</span>
                <span>{t.shown.map((v) => v.cell).join("   ")}{t.more ? `   ${t.more}` : ""}</span>
              </div>
            ))}
            <p className="csnote">{LABS_NOTE}</p>
          </>
        )}

        <p className="cslab">Sleep · movement · mood</p>
        <div className="csdaily">
          <b>Sleep</b><span>{model.daily.sleep}</span>
          <b>Movement</b><span>{model.daily.move}</span>
          <b>Mood</b><span>{model.daily.mood}</span>
        </div>

        <p className="cslab">Questions for my visit</p>
        {p.questions.length === 0 ? <p className="cstext soft">{NO_QUESTIONS}</p> : (
          <ol className="csqs">{p.questions.map((q, i) => <li key={i}><b>{i + 1}.</b><span>{q}</span></li>)}</ol>
        )}
        {p.qMore && <p className="csnote">{p.qMore}</p>}

        <div className="csfoot"><span>{PATIENT_DATA}</span><span>Page 1</span><span>Generated {fmtDayY(model.today)}</span></div>
      </div>
    </div>
  );
}
