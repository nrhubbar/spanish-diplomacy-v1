import type { UnknownAction } from "@reduxjs/toolkit";
import type { Scenario, TerritoryId, UnitState } from "../../engine/types";
import type { MapView } from "../../map/view";
import { clickMapTerritory, clickMapUnit, focusSubTerritory } from "../../state/gameSlice";
import { pushView, viewForMapClick } from "../../state/paneSlice";
import { focusesOnClick } from "../../state/planning";
import type { Draft } from "../../state/session";

/**
 * The planning map's clicks (U3): a territory or a counter selects as before and, outside a
 * destination choice, opens Territory Info for its place; a second click inside the selected
 * territory focuses the sub-territory under it (X3).
 */
export function planningMapHandlers(dispatch: (action: UnknownAction) => unknown, scenario: Scenario, draft: Draft): Required<Pick<MapView, "onSelectSubTerritory" | "onSelectTerritory" | "onSelectUnit">> {
  const open = (territoryId: TerritoryId): void => {
    const next = viewForMapClick(draft.stage !== undefined, territoryId);
    if (next !== undefined) dispatch(pushView(next));
  };
  return {
    onSelectSubTerritory: (subTerritoryId) => {
      if (focusesOnClick(scenario, draft, subTerritoryId)) dispatch(focusSubTerritory(subTerritoryId));
    },
    onSelectTerritory: (territoryId) => {
      dispatch(clickMapTerritory(territoryId));
      open(territoryId);
    },
    onSelectUnit: (unit: UnitState) => {
      dispatch(clickMapUnit(unit.id));
      open(unit.territoryId);
    }
  };
}
