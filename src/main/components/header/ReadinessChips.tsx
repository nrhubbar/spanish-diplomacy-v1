import type { JSX } from "react";
import type { SubmissionStatus } from "../../state/selectors";

/**
 * Header slot: each faction's readiness this turn (T6): a hollow dot and "planning", or a
 * filled dot and "ready", by the faction's abbreviation (its name on hover and for screen
 * readers). Local computer players are always ready.
 */
export function ReadinessChips({ status }: { readonly status: readonly SubmissionStatus[] }): JSX.Element | null {
  if (status.length === 0) return null;
  return (
    <ul aria-label="Order status" className="status-chips">
      {status.map((entry) => (
        <li data-ready={entry.ready} key={entry.factionId}>
          <span className="chip-name visually-hidden">{entry.name}</span>
          <abbr aria-hidden="true" className="chip-abbreviation" title={entry.name}>{entry.abbreviation}</abbr>
          <span className="chip-state">{entry.ready ? "ready" : "planning"}</span>
        </li>
      ))}
    </ul>
  );
}
