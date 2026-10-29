import { useEffect, useId, useRef } from "react";
import Icon from "../Icon.jsx";

/* Design system v2 (calm R1): a bottom sheet. A modal dialog (role="dialog", aria-modal, named by its heading) that
   rises from the bottom over a dimmed backdrop. On open focus moves to the heading; Tab and Shift+Tab stay inside;
   Escape, the Close button and a tap on the backdrop close it; on close focus returns to whatever had it before
   (usually the button that opened it). The rise is 240ms and off under reduced motion. Render it only while open:
   {open && <Sheet ...>}. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export default function Sheet({ title, onClose, children, id, closeLabel = "Close", className = "" }) {
  const auto = useId();
  const hid = `${id || "sheet" + auto.replace(/:/g, "")}-t`;
  const box = useRef(null), head = useRef(null), back = useRef(null);
  useEffect(() => {
    back.current = document.activeElement;
    head.current?.focus();
    return () => { const el = back.current; if (el && typeof el.focus === "function" && document.contains(el)) el.focus(); };
  }, []);
  const onKey = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose?.(); return; }
    if (e.key !== "Tab") return;
    const items = [...box.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || a === head.current || !box.current.contains(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !box.current.contains(a))) { e.preventDefault(); first.focus(); }
  };
  return (
    <div className="v2sheet-wrap" onKeyDown={onKey}>
      <div className="v2sheet-back" aria-hidden="true" onClick={onClose} />
      <div ref={box} id={id} className={`v2sheet${className ? " " + className : ""}`} role="dialog" aria-modal="true" aria-labelledby={hid}>
        <span className="v2sheet-grip" aria-hidden="true" />
        <div className="v2sheet-head">
          <h2 id={hid} ref={head} tabIndex={-1} className="v2sheet-title">{title}</h2>
          <button type="button" className="v2sheet-close" aria-label={closeLabel} onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="v2sheet-body">{children}</div>
      </div>
    </div>
  );
}
