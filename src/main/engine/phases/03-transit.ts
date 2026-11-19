import { placeAt, replaceArmies, requireArmy } from "../board";
import type { Phase } from "./draft";

/**
 * Step 3 (M11): reinforcements arrive. TODO(m3r1-movement-rail-ports): transit legs (rail, sea,
 * truck steps) and interception stops (M1-M5).
 */
export const moveInTransit: Phase = (draft) => {
  const { armies } = draft;
  return { ...draft, armies: replaceArmies(armies, draft.orders.reinforcements.map((order) => placeAt(requireArmy(armies, order.unitId), order.to))) };
};
