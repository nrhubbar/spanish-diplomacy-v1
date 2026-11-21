import { type JSX, useEffect, useId, useRef } from "react";
import type { ReachNote } from "../../presentation/reachNote";
import type { MapPoint } from "../../scenarios/loader";
import { cssVariables } from "../../presentation/style";
import { ActionIcon } from "./ActionIcon";

function Reasons({ note }: { readonly note: ReachNote }): JSX.Element {
  return (
    <ul className="reach-reasons">
      {note.lines.map((line) => (
        <li key={line.text}>
          {line.mode === undefined ? null : <ActionIcon name={line.mode} />}
          <span>{line.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** U7 on a desktop: why the territory under the mouse is out of reach, beside the cursor. */
export function ReachHoverCard({ at, note }: { readonly at: MapPoint; readonly note: ReachNote }): JSX.Element {
  return (
    <div className="reach-card reach-hover" role="tooltip" style={cssVariables({ "--at-x": `${String(at.x)}px`, "--at-y": `${String(at.y)}px` })}>
      <div className="reach-card-head">
        <span className="reach-card-title">{note.title}</span>
        <span className="reach-card-status">{note.status}</span>
      </div>
      <Reasons note={note} />
    </div>
  );
}

/** U7 on a phone: the same reasons in a card from the bottom, after tapping the territory. */
export function ReachModal({ note, onClose }: { readonly note: ReachNote; readonly onClose: () => void }): JSX.Element {
  const titleId = useId();
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => { ok.current?.focus(); }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("keydown", close); };
  }, [onClose]);
  return (
    <div className="reach-modal-layer" onClick={onClose} role="presentation">
      <div aria-labelledby={titleId} aria-modal="true" className="reach-card reach-modal" onClick={(event) => { event.stopPropagation(); }} role="dialog">
        <div className="reach-card-head">
          <h2 className="reach-card-title" id={titleId}>{note.title}</h2>
          <span className="reach-card-status">{note.status}</span>
        </div>
        <Reasons note={note} />
        <button className="primary-action" onClick={onClose} ref={ok} type="button">OK</button>
      </div>
    </div>
  );
}
