import type { JSX } from "react";
import type { Scenario, TerritoryId } from "../../engine/types";
import { armyLeaving } from "../../presentation/movement";
import type { PlanningSession } from "../../state/planning";
import { MoveIcon } from "./MoveIcon";

/** X5: "Army leaving <territory>": the selected units, their attack, the moves this turn and the truck rule. */
export function ArmyLeaving({ scenario, session, territoryId }: { readonly scenario: Scenario; readonly session: PlanningSession; readonly territoryId: TerritoryId }): JSX.Element | null {
  const summary = armyLeaving(scenario, session.game.state, session.factionId, territoryId, session.draft.selectedUnitIds);
  if (summary === undefined) return null;
  return (
    <div aria-label="Army leaving" className="army-leaving" role="group">
      <p className="army-leaving-heading">{summary.heading}</p>
      <p className="army-leaving-line">
        <MoveIcon kind="truck" />
        {summary.line}
      </p>
    </div>
  );
}
