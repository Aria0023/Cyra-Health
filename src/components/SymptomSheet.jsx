import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import Details from "./Details.jsx";
import { ALL_SYM, GSYM, OTHER_LIST } from "../lib/constants.js";
import { chipLayout, borrowable, prefsFor, canRemove, moveSym, hideSym, showSym, addSym, removeSym, resetSyms } from "../lib/daylog.js";

/* "Your symptoms" (L6, decision D8): her symptom list for this stage, edited in place of the chip grid on Today.
   Shown first (Move up / Move down icon buttons, never drag-only, and Hide), Under More symptoms (Show, and Remove
   for a symptom she added and never logged), "Add from the … list" (the other stage's library; not in pregnancy)
   and "Put back Cyra's order". Every action writes symPrefs through setSymPrefs(editor), which the record's autosave
   keeps; there are no toasts, a visually hidden live region says what happened. Focus follows the symptom (set by
   element id after the next render, since React's keyed reorder can drop focus). UI chrome only: no family colours.
   days: what counts as "logged" for Remove (App's day log, plus the unsaved form so a chip with a value can't be removed). */
export default function SymptomSheet({ stage, symPrefs, setSymPrefs, days = [], onClose }) {
  const titleRef = useRef(null);
  const focusTo = useRef(null); // element id to focus after the next render, or "title"
  const [said, setSaid] = useState({ text: "", n: 0 });
  const labels = stage === "preg" ? GSYM : ALL_SYM;
  const label = (id) => labels[id] || id;
  const { first, more } = chipLayout(stage, symPrefs);
  const p = prefsFor(symPrefs, stage);
  const toAdd = borrowable(stage).filter((id) => !p.added.includes(id));
  const other = OTHER_LIST[stage];

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    const id = focusTo.current;
    if (!id) return;
    focusTo.current = null;
    (id === "title" ? titleRef.current : document.getElementById(id))?.focus();
  }, [said]);

  // Apply one editor to her list, then say what happened and where focus goes.
  const act = (edit, text, focus) => {
    setSymPrefs((cur) => edit(cur));
    focusTo.current = focus;
    setSaid((s) => ({ text, n: s.n + 1 }));
  };
  const move = (id, dir) => {
    const next = chipLayout(stage, moveSym(symPrefs, stage, id, dir)).first;
    const k = next.indexOf(id), n = next.length;
    // the same arrow, or the row's other arrow when the pressed one is now disabled (top or bottom)
    const focus = dir < 0 ? (k === 0 ? `sym-down-${id}` : `sym-up-${id}`) : (k === n - 1 ? `sym-up-${id}` : `sym-down-${id}`);
    act((cur) => moveSym(cur, stage, id, dir), `${label(id)} moved to ${k + 1} of ${n}.`, focus);
  };
  const hide = (id) => act((cur) => hideSym(cur, stage, id), `${label(id)} hidden. It's under More symptoms now.`, `sym-show-${id}`);
  const show = (id) => act((cur) => showSym(cur, stage, id), `${label(id)} shows first again, at the end.`, `sym-up-${id}`);
  const add = (id) => act((cur) => addSym(cur, stage, id), `${label(id)} added at the end.`, `sym-up-${id}`);
  const remove = (id) => act((cur) => removeSym(cur, stage, id, days), `${label(id)} removed from your list.`, "title");
  const reset = () => act((cur) => resetSyms(cur, stage), "Back to Heard Health's order. Symptoms you added stay at the end.", "title");
  const from = (id) => (p.added.includes(id) && other ? <span>From the {other}</span> : null);

  return (
    <section className="symsheet" id="sym-sheet" aria-labelledby="sym-sheet-title" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
      <div className="sheethead">
        <h2 className="sheettitle" id="sym-sheet-title" tabIndex={-1} ref={titleRef}>Your symptoms</h2>
        <button type="button" className="sheetclose" aria-label="Close symptom list" onClick={onClose}><Icon name="close" /></button>
      </div>
      <p className="hint">{stage === "preg"
        ? "Pick what shows first and in what order. Hide moves a symptom under More symptoms. Everything you log stays in your calendar, wherever it sits. Changes save as you go."
        : "Pick what shows first and in what order. Hide moves a symptom under More symptoms. Everything you log stays in your patterns, calendar and report, wherever it sits. Changes save as you go."}</p>
      <p className="section-lab" id="sym-first-lab">Shown first</p>
      <ul className="symlist" aria-labelledby="sym-first-lab">
        {first.map((id, i) => (
          <li key={id} className="medrow">
            <div className="medinfo"><b>{label(id)}</b>{from(id)}</div>
            <div className="wearbtns">
              <button type="button" id={`sym-up-${id}`} className="sbtn symmove" aria-label={`Move ${label(id)} up`} disabled={i === 0} onClick={() => move(id, -1)}><Icon name="arrow-up" /></button>
              <button type="button" id={`sym-down-${id}`} className="sbtn symmove" aria-label={`Move ${label(id)} down`} disabled={i === first.length - 1} onClick={() => move(id, 1)}><Icon name="arrow-down" /></button>
              <button type="button" id={`sym-hide-${id}`} className="sbtn" aria-label={`Hide ${label(id)}`} disabled={first.length <= 1} onClick={() => hide(id)}>Hide</button>
            </div>
          </li>
        ))}
      </ul>
      {more.length > 0 && (
        <>
          <p className="section-lab" id="sym-more-lab">Under More symptoms</p>
          <ul className="symlist" aria-labelledby="sym-more-lab">
            {more.map((id) => (
              <li key={id} className="medrow">
                <div className="medinfo"><b>{label(id)}</b>{from(id)}</div>
                <div className="wearbtns">
                  <button type="button" id={`sym-show-${id}`} className="sbtn" aria-label={`Show ${label(id)} first`} onClick={() => show(id)}>Show</button>
                  {canRemove(symPrefs, stage, id, days) && <button type="button" id={`sym-remove-${id}`} className="sbtn" aria-label={`Remove ${label(id)}`} onClick={() => remove(id)}>Remove</button>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {toAdd.length > 0 && other && (
        <Details label={`Add from the ${other}`}>
          <p>These show up in your patterns, calendar and report like the rest. Once you've logged one, you can hide it but not remove it, so your history stays whole.</p>
          <ul className="symlist">
            {toAdd.map((id) => (
              <li key={id} className="medrow">
                <div className="medinfo"><b>{label(id)}</b></div>
                <div className="wearbtns"><button type="button" id={`sym-add-${id}`} className="sbtn" aria-label={`Add ${label(id)}`} onClick={() => add(id)}>Add</button></div>
              </li>
            ))}
          </ul>
        </Details>
      )}
      {(p.order.length > 0 || p.hidden.length > 0) && <button type="button" className="linkbtn symreset" onClick={reset}>Put back Heard Health's order</button>}
      <button type="button" className="ghostbtn" onClick={onClose}>Done</button>
      <p className="sr-only" aria-live="polite">{said.text}</p>
    </section>
  );
}
