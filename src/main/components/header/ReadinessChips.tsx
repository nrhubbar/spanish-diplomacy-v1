import type { JSX } from "react";
import type { SubmissionStatus } from "../../state/selectors";

/** Header slot: each faction's readiness this turn (T6). */
export function ReadinessChips({ status }: { readonly status: readonly SubmissionStatus[] }): JSX.Element | null {
  if (status.length === 0) return null;
  return (
    <ul aria-label="Order status" className="status-chips">
      {status.map((entry) => (
        <li data-ready={entry.ready} key={entry.factionId}>
          <span className="visually-hidden">{entry.ready ? "Ready: " : "Planning: "}</span>
          <span className="chip-name">{entry.name}</span>
          <abbr className="chip-abbreviation" title={entry.name}>{entry.abbreviation}</abbr>
        </li>
      ))}
    </ul>
  );
}
