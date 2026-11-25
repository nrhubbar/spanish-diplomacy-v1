import { isMoveOrder, type Scenario, type SubTerritoryId, type TerritoryId } from "../../engine/types";
import { type DestinationEstimate, destinationEstimates } from "../../presentation/odds";
import type { Draft } from "../session";
import { airDraftOrders } from "./air";
import { type PlanningSession, selectedRoutes } from "./selection";

/**
 * X3: zoomed in, a second click inside the selected territory focuses the pane on the
 * sub-territory; not while an order is being given.
 */
export function focusesOnClick(scenario: Scenario, draft: Draft, subTerritoryId: SubTerritoryId): boolean {
  const territoryId = scenario.index.subTerritories.get(subTerritoryId)?.territoryId;
  return draft.stage === undefined && territoryId !== undefined && territoryId === draft.selectedTerritoryId;
}

/** C1: a Withdraw goes to ground the faction holds, so its destinations carry no odds; nor do a mission's targets. */
export function oddsDestinations(draft: Draft, destinations: readonly TerritoryId[]): readonly TerritoryId[] {
  const { stage } = draft;
  return stage?.step === "choose-target" || stage?.orderKind === "withdraw" ? [] : destinations;
}

/** N3: the odds at each destination being chosen, by the route each would be given. */
export function selectedEstimates(scenario: Scenario, session: PlanningSession, destinations: readonly TerritoryId[]): ReadonlyMap<TerritoryId, DestinationEstimate> {
  const { draft, factionId, game } = session;
  return destinationEstimates(scenario, game.state, factionId, draft.selectedUnitIds, oddsDestinations(draft, destinations), draft.orders.filter(isMoveOrder), airDraftOrders(draft), selectedRoutes(scenario, session));
}
