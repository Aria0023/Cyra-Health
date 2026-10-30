import Icon from "../Icon.jsx";

/* Design system v2 (calm R1): numbered / ticked circles joined by a dotted line, each with a label and an optional
   sub line. steps = [{ label, sub?, state: "done" | "current" | "todo" }]. A list (role="list" kept explicit, since
   list-style:none drops it in Safari); each item's state is said in words for screen readers ("done", "next"). An
   untouched step is neutral, never red, and there is no completeness bar. */
const SAY = { done: "done", current: "next", todo: "" };
export default function StepRail({ steps, label, className = "" }) {
  return (
    <ol className={`steprail${className ? " " + className : ""}`} role="list" aria-label={label}>
      {steps.map((s, i) => (
        <li key={s.label} className={`step ${s.state || "todo"}`} aria-current={s.state === "current" ? "step" : undefined}>
          <span className="stepdot" aria-hidden="true">{s.state === "done" ? <Icon name="check" size={15} /> : i + 1}</span>
          <span className="steplab">{s.label}{SAY[s.state] ? <span className="sr-only">, {SAY[s.state]}</span> : null}</span>
          {s.sub && <span className="stepsub">{s.sub}</span>}
        </li>
      ))}
    </ol>
  );
}
