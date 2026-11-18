import type { MoveOrder, TerritoryId, TurnOutcome, UnitId, UnitState } from "../engine/types";

/** What a screen asks the map to show and how map input flows back to it. */
export interface MapView {
  readonly changedTerritoryIds: readonly TerritoryId[];
  readonly destinationIds: readonly TerritoryId[];
  readonly onSelectTerritory?: (territoryId: TerritoryId) => void;
  readonly onSelectUnit?: (unit: UnitState) => void;
  readonly orderedUnitIds: ReadonlySet<UnitId>;
  readonly outcomes: readonly TurnOutcome[];
  readonly plannedOrders: readonly MoveOrder[];
  readonly selectedTerritoryId?: TerritoryId;
  readonly selectedUnitIds: ReadonlySet<UnitId>;
}

export const staticMapView: MapView = {
  changedTerritoryIds: [],
  destinationIds: [],
  orderedUnitIds: new Set(),
  outcomes: [],
  plannedOrders: [],
  selectedUnitIds: new Set()
};
