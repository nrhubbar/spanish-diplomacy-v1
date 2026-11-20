import { replenishQuote } from "../../engine/recruitment/rules";
import { addResources, subtractResources, treasuryOf } from "../../engine/resources";
import type { Order, Resources } from "../../engine/types";
import type { PlanningContext } from "./planner";

/**
 * H5: what the orders planned so far this turn will cost at reveal, so a later planner spends
 * only what is left. Recruit and Replenish orders are priced here; TODO(m3r1-economy-builds):
 * add Build orders' prices when that planner spends.
 */
export function orderPrice(context: Pick<PlanningContext, "scenario" | "state">, order: Order): Resources {
  if (order.kind === "recruit") return context.scenario.index.unitTypes.get(order.unitTypeId)?.recruit?.cost ?? {};
  if (order.kind === "replenish") {
    const unit = context.state.units[order.unitId];
    return unit === undefined ? {} : replenishQuote(context.scenario, context.state, unit)?.cost ?? {};
  }
  return {};
}

/** The faction's balance less every planned order's price. */
export function balanceLeft(context: PlanningContext): Resources {
  const spent = context.planned.reduce<Resources>((sum, order) => addResources(sum, orderPrice(context, order)), {});
  return subtractResources(treasuryOf(context.state, context.factionId), spent);
}
