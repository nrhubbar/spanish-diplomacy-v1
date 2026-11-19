import { placeAt, replaceArmies, requireArmy } from "../board";
import type { Phase } from "./draft";

/** Step 3 (M11): reinforcements arrive. The movement presets' part (`modules/movement.ts`). */
export const moveInTransit: Phase = (draft) => {
  const { armies } = draft;
  return { ...draft, armies: replaceArmies(armies, draft.orders.reinforcements.map((order) => placeAt(requireArmy(armies, order.unitId), order.to))) };
};
