import type { JSX } from "react";
import type { Scenario, TerritoryId } from "../../engine/types";
import { useAppDispatch } from "../../hooks";
import type { DestinationEstimate } from "../../presentation/odds";
import { destinationCallout } from "../../presentation/text";
import { cancelOrderStage } from "../../state/gameSlice";
import type { PlanningSession } from "../../state/planning";
import { DestinationChoices } from "../DestinationChoices";
import { ArmyLeaving } from "../movement/ArmyLeaving";
import { destinationRoutes } from "../movement/destinationRoutes";
import { focusWhenShown } from "./focus";

interface DestinationPanelProps {
  readonly estimates: ReadonlyMap<TerritoryId, DestinationEstimate>;
  readonly scenario: Scenario;
  readonly session: PlanningSession;
}

/**
 * O1, C15: while a destination is chosen, above whichever view the pane shows: what is moving
 * from where (with Cancel), the army leaving, and the odds at each destination.
 */
export function DestinationPanel({ estimates, scenario, session }: DestinationPanelProps): JSX.Element | null {
  const dispatch = useAppDispatch();
  const { draft } = session;
  const territoryId = draft.selectedTerritoryId;
  if (draft.stage === undefined || territoryId === undefined) return null;
  const { orderKind } = draft.stage;
  const callout = destinationCallout(scenario, orderKind, draft.selectedUnitIds.length, territoryId);
  return (
    <section aria-label="Choosing a destination" className="pane-section">
      <div className="pane-callout" role="status">
        <p>{callout.text}</p>
        <button className="text-button" onClick={() => dispatch(cancelOrderStage())} ref={focusWhenShown} type="button">{callout.cancel}</button>
      </div>
      {orderKind === "withdraw" ? null : (
        <>
          <ArmyLeaving scenario={scenario} session={session} territoryId={territoryId} />
          {/* A Withdraw goes to ground the player holds, so it has no odds to list (C1). */}
          {estimates.size > 0 ? <DestinationChoices estimates={estimates} moves={destinationRoutes(scenario, session)} scenario={scenario} /> : null}
        </>
      )}
    </section>
  );
}
