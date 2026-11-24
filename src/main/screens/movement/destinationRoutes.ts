import { railPlaces } from "../../engine/movement/network";
import { armyMovement, plannedRoutes, usageOf } from "../../engine/movement/routes";
import { isMoveOrder, type Scenario } from "../../engine/types";
import { type PlanningSession, selectedRoutes } from "../../state/planning";
import type { DestinationRoutes } from "../DestinationChoices";

/** X5: what the destination list needs to show each route, or undefined under `single-step`. */
export function destinationRoutes(scenario: Scenario, session: PlanningSession): DestinationRoutes | undefined {
  const routes = selectedRoutes(scenario, session);
  const from = session.draft.selectedTerritoryId;
  if (routes === undefined || from === undefined) return undefined;
  const { state } = session.game;
  const { selectedUnitIds } = session.draft;
  const others = session.draft.orders.filter(isMoveOrder).filter((order) => !selectedUnitIds.includes(order.unitId));
  const { departures } = usageOf(plannedRoutes(scenario, state, others));
  const places = railPlaces(scenario, state, selectedUnitIds);
  return {
    allowance: armyMovement(scenario, state, session.factionId, from, selectedUnitIds).allowance,
    placesUsed: (route) => (route.rail === undefined ? 0 : (departures.get(route.rail.boarding) ?? 0) + places),
    routes,
    state,
    units: selectedUnitIds.flatMap((id) => state.units[id] ?? [])
  };
}
