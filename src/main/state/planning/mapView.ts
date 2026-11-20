import { isMoveOrder, type MoveOrder, type Scenario, type SubTerritoryId, type TerritoryId } from "../../engine/types";
import type { MapView } from "../../map/view";
import type { DestinationEstimate } from "../../presentation/odds";
import type { Draft } from "../session";
import { orderOf, type PlanningSession } from "./selection";

/** What the planning map shows; the screen adds the click handlers. */
export type PlanningMapView = Omit<MapView, "onSelectNothing" | "onSelectSubTerritory" | "onSelectTerritory" | "onSelectUnit">;

/**
 * The planning map: the destinations being chosen and their odds, the selection, the planned
 * moves (a Withdraw drawn as the move it makes, C1) and air missions (U2), and each own unit's order.
 */
export function planningMapView(
  scenario: Scenario,
  session: PlanningSession,
  destinations: readonly TerritoryId[],
  estimates: ReadonlyMap<TerritoryId, DestinationEstimate>
): PlanningMapView {
  const { draft, factionId, game } = session;
  return {
    changedTerritoryIds: [],
    ...(estimates.size === 0 ? {} : { destinationEstimates: estimates }),
    destinationIds: destinations,
    ...(draft.focusedSubTerritoryId === undefined ? {} : { focusedSubTerritoryId: draft.focusedSubTerritoryId }),
    orderedUnitIds: new Set(draft.orders.map((order) => order.unitId)),
    outcomes: [],
    plannedAirMissions: (draft.airOrders ?? []).filter((order) => order.kind === "air-mission"),
    plannedOrders: draft.orders.map((order): MoveOrder => (isMoveOrder(order) ? order : { ...order, kind: "move" })),
    ...(draft.selectedAircraftId === undefined ? {} : { selectedAircraftId: draft.selectedAircraftId }),
    selectedUnitIds: new Set(draft.selectedUnitIds),
    ...(draft.selectedTerritoryId === undefined ? {} : { selectedTerritoryId: draft.selectedTerritoryId }),
    unitOrders: new Map(Object.values(game.state.units)
      .filter((unit) => unit.factionId === factionId)
      .map((unit) => [unit.id, orderOf(session, unit, scenario)]))
  };
}

/**
 * X3: zoomed in, a second click inside the selected territory focuses the pane on the
 * sub-territory; not while an order is being given.
 */
export function focusesOnClick(scenario: Scenario, draft: Draft, subTerritoryId: SubTerritoryId): boolean {
  const territoryId = scenario.index.subTerritories.get(subTerritoryId)?.territoryId;
  return draft.stage === undefined && territoryId !== undefined && territoryId === draft.selectedTerritoryId;
}

/** C1: a Withdraw goes to ground the faction holds, so its destinations carry no odds. */
export function oddsDestinations(draft: Draft, destinations: readonly TerritoryId[]): readonly TerritoryId[] {
  return draft.stage?.step === "choose-destination" && draft.stage.orderKind === "withdraw" ? [] : destinations;
}
