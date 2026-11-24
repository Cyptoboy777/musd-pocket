import { useId, useState, type ReactNode } from "react";

/**
 * A small "?" that explains a term in plain English.
 * Works with hover, keyboard focus and tap. Escape closes it. The text is always in the page
 * (hidden by CSS), so screen readers get it through aria-describedby.
 */
export function Hint({ term, children }: { term: string; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="hint" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="hint-btn"
        aria-label={`What is ${term}?`}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
      >
        ?
      </button>
      <span role="tooltip" id={id} className={`hint-pop${open ? " is-open" : ""}`}>
        {children}
      </span>
    </span>
  );
}
