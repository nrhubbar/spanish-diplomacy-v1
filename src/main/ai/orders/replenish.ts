import { requireUnitDefinition } from "../../engine/lookup";
import { replenishProblem, replenishQuote } from "../../engine/recruitment/rules";
import { canAfford, subtractResources } from "../../engine/resources";
import type { ReplenishOrder, UnitId } from "../../engine/types";
import { balanceLeft } from "./spending";
import type { OrderPlanner } from "./planner";

/** Replenish only units missing at least this share of their men, or demoralized (design note: keeps small top-ups from eating the Recruit budget). */
const minimumMissingShare = 0.2;

/**
 * H5, R5: the computer player's Replenish orders. Every own unit with no other order that may
 * replenish where it stands and is demoralized or missing a fifth of its men or more is
 * replenished, the worst off first, while the balance lasts. A battle cancels the order with a
 * refund, so units near the front are not skipped. No random draws (CT-36).
 */
export const planReplenishment: OrderPlanner<ReplenishOrder> = ({ factionId, memory, planned, random, scenario, state }) => {
  if (scenario.recruitment === undefined || scenario.rules.recruitment === "none") return [];
  const ordered = new Set<UnitId>(planned.flatMap((order) => ("unitId" in order ? [order.unitId] : [])));
  const candidates = Object.values(state.units)
    .filter((unit) => unit.factionId === factionId && !ordered.has(unit.id) && replenishProblem(scenario, state, unit) === undefined)
    .flatMap((unit) => {
      const quote = replenishQuote(scenario, state, unit);
      if (quote === undefined) return [];
      const full = requireUnitDefinition(scenario, unit.id).fullStrength;
      const missing = (full - unit.strength) / full;
      return unit.morale.demoralized || missing >= minimumMissingShare ? [{ missing, quote, unit }] : [];
    })
    .sort((left, right) => Number(right.unit.morale.demoralized) - Number(left.unit.morale.demoralized) || right.missing - left.missing || left.unit.id.localeCompare(right.unit.id));
  let balance = balanceLeft({ factionId, memory, planned, random, scenario, state });
  const orders: ReplenishOrder[] = [];
  for (const { quote, unit } of candidates) {
    if (!canAfford(balance, quote.cost)) continue;
    balance = subtractResources(balance, quote.cost);
    orders.push({ factionId, kind: "replenish", unitId: unit.id });
  }
  return orders;
};
