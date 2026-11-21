import type { AirMissionOrder, MoveOrder, SubTerritoryId, TerritoryId, TurnOutcome, UnitId, UnitState } from "../engine/types";
import type { ArmyOrder } from "../presentation/army";
import type { DestinationEstimate } from "../presentation/odds";
import type { MapPoint } from "../scenarios/loader";

/** How a press was made: a mouse (or pen) or a finger (U5, U7). */
export type PointerInput = "mouse" | "touch";

/** What a screen asks the map to show and how map input flows back to it. */
export interface MapView {
  readonly changedTerritoryIds: readonly TerritoryId[];
  /** C15: what a move into each highlighted destination would meet, shown on the map. */
  readonly destinationEstimates?: ReadonlyMap<TerritoryId, DestinationEstimate>;
  readonly destinationIds: readonly TerritoryId[];
  /**
   * F1: the place the turn report is focused on. The map highlights it like a selection and
   * shows its armies one by one (Z2).
   */
  readonly focusedTerritoryId?: TerritoryId;
  /** X3: the sub-territory the pane is focused on, outlined on the map. */
  readonly focusedSubTerritoryId?: SubTerritoryId;
  /** A click or Enter on the map that hit no territory or counter. */
  readonly onSelectNothing?: () => void;
  /** `input` says how the click was made, when the map knows (U7: a tap on a phone). */
  readonly onSelectTerritory?: (territoryId: TerritoryId, input?: PointerInput) => void;
  /** U7: the mouse moved onto a territory (undefined: off every territory), at a viewport point. */
  readonly onTerritoryHover?: (territoryId: TerritoryId | undefined, at: MapPoint) => void;
  /** U5: a right-click, or a long-press on a phone, on a territory, at a viewport point. */
  readonly onTerritoryMenu?: (territoryId: TerritoryId, at: MapPoint, input: PointerInput) => void;
  /** X3: zoomed in, a click also names the sub-territory under it (after `onSelectTerritory`). */
  readonly onSelectSubTerritory?: (subTerritoryId: SubTerritoryId) => void;
  readonly onSelectUnit?: (unit: UnitState) => void;
  readonly orderedUnitIds: ReadonlySet<UnitId>;
  readonly outcomes: readonly TurnOutcome[];
  /** U2: the planning player's air missions, drawn from base to target (m3r1-air-generals). */
  readonly plannedAirMissions?: readonly AirMissionOrder[];
  readonly plannedOrders: readonly MoveOrder[];
  /** U2: the aircraft whose range ring the air layer draws. */
  readonly selectedAircraftId?: UnitId;
  readonly selectedTerritoryId?: TerritoryId;
  readonly selectedUnitIds: ReadonlySet<UnitId>;
  /** O1: the order of each of the planning player's armies, named on its counter. Absent elsewhere. */
  readonly unitOrders?: ReadonlyMap<UnitId, ArmyOrder>;
}

export const staticMapView: MapView = {
  changedTerritoryIds: [],
  destinationIds: [],
  orderedUnitIds: new Set(),
  outcomes: [],
  plannedOrders: [],
  selectedUnitIds: new Set()
};

/** The territory the map outlines as chosen and opens into single armies: the selection or the focus. */
export function highlightedTerritoryId(view: MapView): TerritoryId | undefined {
  return view.selectedTerritoryId ?? view.focusedTerritoryId;
}
