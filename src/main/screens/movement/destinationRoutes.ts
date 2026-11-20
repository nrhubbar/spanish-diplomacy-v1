import { armyKey, armyMovement, plannedRoutes, routeClaims } from "../../engine/movement/routes";
import { isMoveOrder, type Scenario } from "../../engine/types";
import { type PlanningSession, selectedRoutes } from "../../state/planning";
import type { DestinationRoutes } from "../DestinationChoices";

/** X5: what the destination list needs to show each route, or undefined under `single-step`. */
export function destinationRoutes(scenario: Scenario, session: PlanningSession): DestinationRoutes | undefined {
  const routes = selectedRoutes(scenario, session);
  const from = session.draft.selectedTerritoryId;
  if (routes === undefined || from === undefined) return undefined;
  const { state } = session.game;
  const selected = new Set(session.draft.selectedUnitIds);
  const others = session.draft.orders.filter(isMoveOrder).filter((order) => !selected.has(order.unitId));
  const boarding = new Map<string, Set<string>>();
  for (const order of others) {
    const route = plannedRoutes(scenario, state, [order])[0]?.route;
    const departure = route === undefined ? undefined : routeClaims(route).departure;
    if (departure !== undefined) boarding.set(departure, (boarding.get(departure) ?? new Set()).add(armyKey(scenario, order)));
  }
  return {
    allowance: armyMovement(scenario, state, session.factionId, from, session.draft.selectedUnitIds).allowance,
    departuresUsed: (route) => (route.rail === undefined ? 0 : boarding.get(route.rail.boarding)?.size ?? 0),
    routes,
    state,
    units: session.draft.selectedUnitIds.flatMap((id) => state.units[id] ?? [])
  };
}
