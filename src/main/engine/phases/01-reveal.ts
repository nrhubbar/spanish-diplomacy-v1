import { removeArmies } from "../board";
import { classifyMoves, partitionOrders } from "../orders";
import type { Phase } from "./draft";

/**
 * Step 1 (M1, M2, M9, M11): every order validates against the start-of-turn state. Impossible
 * moves disband their army; other failed orders are rejected. Valid moves are sorted into
 * reinforcements and advances. Purchases are paid, and failures refunded, by the economy and
 * recruitment modules' step-1 parts, which run after this.
 */
export const revealOrders: Phase = (draft) => {
  const { scenario, start, submissions } = draft.input;
  const { invalid, rejected, valid } = partitionOrders(scenario, start, submissions.flatMap((submission) => submission.orders));
  const armies = removeArmies(start.units, invalid.map((outcome) => outcome.order.unitId));
  const { advances, reinforcements } = classifyMoves(start.control, armies, valid);
  const origins = new Map(valid.map((order) => [order.unitId, order.from]));
  return { ...draft, armies, orders: { advances, invalid, origins, reinforcements, rejected, valid } };
};
