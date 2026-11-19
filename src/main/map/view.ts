import type { MoveOrder, TerritoryId, TurnOutcome, UnitId, UnitState } from "../engine/types";
import type { DestinationEstimate } from "../presentation/odds";

/** What a screen asks the map to show and how map input flows back to it. */
export interface MapView {
  readonly changedTerritoryIds: readonly TerritoryId[];
  /** C15: what a move into each highlighted destination would meet, shown on the map. */
  readonly destinationEstimates?: ReadonlyMap<TerritoryId, DestinationEstimate>;
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
