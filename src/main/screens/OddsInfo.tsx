import { type JSX, type ReactNode, useId, useState } from "react";
import { oddsCaveat } from "../presentation/odds";

interface OddsInfoProps {
  /** The heading or line the "i" sits beside. */
  readonly children: ReactNode;
  /** The button's accessible name, which says which odds it explains. */
  readonly label: string;
}

/**
 * A2: a small circled "i" beside a set of odds that opens one sentence on why they are only
 * approximate. A plain disclosure: a real button with `aria-expanded`, so a click, a tap,
 * Enter, and Space all toggle it.
 */
export function OddsInfo({ children, label }: OddsInfoProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const noteId = useId();
  return (
    <div className="odds-info">
      <div className="odds-info-row">
        {children}
        <button aria-controls={noteId} aria-expanded={open} aria-label={label} className="odds-info-button" onClick={() => setOpen(!open)} type="button">
          <span aria-hidden="true">i</span>
        </button>
      </div>
      <p className="odds-info-note" hidden={!open} id={noteId}>{oddsCaveat}</p>
    </div>
  );
}
