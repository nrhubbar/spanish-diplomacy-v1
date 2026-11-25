import { isMoveOrder, type MoveOrder, type Scenario, type TerritoryId, type UnitId } from "../engine/types";
import type { MapView } from "../map/view";
import type { DestinationEstimate } from "../presentation/odds";
import { airDraftOrders, orderOf, type PlanningSession } from "../state/planning";

/** What the planning map shows; the screen adds the click handlers. */
export type PlanningMapView = Omit<MapView, "onSelectNothing" | "onSelectSubTerritory" | "onSelectTerritory" | "onSelectUnit">;

/**
 * The planning map: the destinations being chosen and their odds, the selection, the planned
 * moves (a Withdraw drawn as the move it makes, C1) and air missions (U2), each own unit's order,
 * and the units ticked in the Invade or Reinforce pane.
 */
export function planningMapView(
  scenario: Scenario,
  session: PlanningSession,
  destinations: readonly TerritoryId[],
  estimates: ReadonlyMap<TerritoryId, DestinationEstimate>,
  ticked: ReadonlySet<UnitId> = new Set()
): PlanningMapView {
  const { draft, factionId, game } = session;
  return {
    changedTerritoryIds: [],
    ...(estimates.size === 0 ? {} : { destinationEstimates: estimates }),
    destinationIds: destinations,
    ...(draft.focusedSubTerritoryId === undefined ? {} : { focusedSubTerritoryId: draft.focusedSubTerritoryId }),
    orderedUnitIds: new Set(draft.orders.map((order) => order.unitId)),
    outcomes: [],
    plannedAirMissions: airDraftOrders(draft).filter((order) => order.kind === "air-mission"),
    plannedOrders: draft.orders.map((order): MoveOrder => (isMoveOrder(order) ? order : { ...order, kind: "move" })),
    ...(draft.selectedAircraftId === undefined ? {} : { selectedAircraftId: draft.selectedAircraftId }),
    selectedUnitIds: new Set(draft.selectedUnitIds),
    ...(ticked.size === 0 ? {} : { tickedUnitIds: ticked }),
    ...(draft.selectedTerritoryId === undefined ? {} : { selectedTerritoryId: draft.selectedTerritoryId }),
    unitOrders: new Map(Object.values(game.state.units)
      .filter((unit) => unit.factionId === factionId)
      .map((unit) => [unit.id, orderOf(session, unit, scenario)]))
  };
}
