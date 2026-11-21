import type { UnknownAction } from "@reduxjs/toolkit";
import type { ThisTurnCancel } from "../../presentation/thisTurn";
import { cancelBuildOrder, changeRecruitQuantity, planAirMission, removePlannedOrder, toggleSackOrder } from "../../state/gameSlice";

/** U3: the action a This turn line's Cancel dispatches. */
export function cancelAction(cancel: ThisTurnCancel): UnknownAction {
  switch (cancel.kind) {
    case "order":
      return removePlannedOrder(cancel.unitId);
    case "air":
      return planAirMission({ unitId: cancel.unitId });
    case "sack":
      return toggleSackOrder(cancel.unitId);
    case "recruit":
      return changeRecruitQuantity({ quantity: 0, territoryId: cancel.territoryId, unitTypeId: cancel.unitTypeId });
    case "build":
      return cancelBuildOrder(cancel.index);
  }
}
