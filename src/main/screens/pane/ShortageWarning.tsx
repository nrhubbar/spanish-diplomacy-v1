import type { JSX } from "react";
import type { Scenario } from "../../engine/types";
import { shortageWarning } from "../../presentation/recruitment";
import { plannedShortfall, type PlanningSession } from "../../state/planning";

/** D1: at the top of the pane while the orders so far leave next turn's stock short of the upkeep. */
export function ShortageWarning({ scenario, session }: { readonly scenario: Scenario; readonly session: PlanningSession }): JSX.Element | null {
  const warning = scenario.upkeep === undefined ? undefined : shortageWarning(scenario, scenario.upkeep, plannedShortfall(scenario, session));
  return warning === undefined ? null : (
    <div className="shortage-warning" role="status">
      <strong>{warning.heading}</strong>
      <p>{warning.body}</p>
    </div>
  );
}
