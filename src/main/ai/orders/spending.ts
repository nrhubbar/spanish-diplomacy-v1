import { projectCost } from "../../engine/economy/catalogue";
import { upkeepShortfall } from "../../engine/economy/upkeep";
import { requireAiProfile } from "../../engine/lookup";
import { priceReplenishments, replenishQuote } from "../../engine/recruitment/rules";
import { addResources, subtractResources, treasuryOf } from "../../engine/resources";
import type { Order, ResourceId, Resources, UnitState } from "../../engine/types";
import type { PlanningContext } from "./planner";

/**
 * H5: what the orders planned so far this turn will cost at reveal, so a later planner spends
 * only what is left. Recruit, Replenish and Build orders are priced here.
 */
export function orderPrice(context: Pick<PlanningContext, "scenario" | "state">, order: Order): Resources {
  if (order.kind === "build") return projectCost(context.scenario, order.project)?.cost ?? {};
  if (order.kind === "recruit") return context.scenario.index.unitTypes.get(order.unitTypeId)?.recruit?.cost ?? {};
  if (order.kind === "replenish") {
    const unit = context.state.units[order.unitId];
    return unit === undefined ? {} : replenishQuote(context.scenario, context.state, unit)?.cost ?? {};
  }
  return {};
}

/**
 * The faction's balance less every planned order's price. Replenish orders are priced together,
 * in turn against the faction's carry (B2), as reveal pays them.
 */
export function balanceLeft(context: PlanningContext): Resources {
  const spent = context.planned.reduce<Resources>((sum, order) => (order.kind === "replenish" ? sum : addResources(sum, orderPrice(context, order))), {});
  const replenishing = context.planned.flatMap((order): UnitState[] => {
    const unit = order.kind === "replenish" ? context.state.units[order.unitId] : undefined;
    return unit === undefined ? [] : [unit];
  });
  const replenished = priceReplenishments(context.scenario, context.state, context.factionId, replenishing).total;
  return subtractResources(treasuryOf(context.state, context.factionId), addResources(spent, replenished));
}

/**
 * D1: whether an order would leave the faction further short of what its army needs to eat, next
 * turn or over the profile's `upkeepTurns` at today's income. A faction whose upkeep outruns its
 * income so keeps its stock for the units it has; one that earns its upkeep holds nothing back.
 */
export function starves(context: Pick<PlanningContext, "factionId" | "scenario" | "state">, planned: readonly Order[], order: Order): boolean {
  const { factionId, scenario, state } = context;
  return [1, requireAiProfile(scenario, factionId).recruits.upkeepTurns].some((turns) => {
    const before = upkeepShortfall(scenario, state, factionId, planned, turns);
    const after = upkeepShortfall(scenario, state, factionId, [...planned, order], turns);
    return (Object.entries(after) as [ResourceId, number][]).some(([id, short]) => short > (before[id] ?? 0));
  });
}
