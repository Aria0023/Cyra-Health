/* Chip rows shared by registration (L11) and Settings → About you. Defined at module level, so a tap re-renders a
   row in place and never remounts it. Markup is what RegisterScreen's lab/chips helpers produced before L11:
   p.lab (+ .labErr and "· needed" while required and missing) and a role=group of .mc[aria-pressed] buttons.
   Error ink --bad (.labErr, .need) is >= 4.6:1 on every light paper and >= 8.4:1 on every dark paper. */

/** One answer: tapping the chosen chip again clears it (onPick(null)). */
export function ChipRow({ id, label, options, value, onPick, bad = false }) {
  return (
    <>
      <p id={id} className={`lab ${bad ? "labErr" : ""}`}>{label}{bad && <span className="need"> · needed</span>}</p>
      <div role="group" aria-labelledby={id} className={`mcrow ${bad ? "err" : ""}`}>
        {options.map((o) => <button key={o} aria-pressed={value === o} className={`mc ${value === o ? "on" : ""}`} onClick={() => onPick(value === o ? null : o)}>{o}</button>)}
      </div>
    </>
  );
}

/** Several answers: onToggle(o) decides the new list (lib/onboarding.js toggleMulti keeps "None" exclusive). */
export function MultiRow({ id, label, options, values, onToggle, bad = false }) {
  const v = Array.isArray(values) ? values : [];
  return (
    <>
      <p id={id} className={`lab ${bad ? "labErr" : ""}`}>{label}{bad && <span className="need"> · needed</span>}</p>
      <div role="group" aria-labelledby={id} className={`mcrow ${bad ? "err" : ""}`}>
        {options.map((o) => <button key={o} aria-pressed={v.includes(o)} className={`mc ${v.includes(o) ? "on" : ""}`} onClick={() => onToggle(o)}>{o}</button>)}
      </div>
    </>
  );
}
