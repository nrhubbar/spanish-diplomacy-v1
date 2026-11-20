import { addResources, adjustTreasury, canAfford, subtractResources } from "../resources";
import type { FactionId, GameState, ResourceId, Resources, Scenario } from "../types";

/**
 * $1: the economy's helpers over resource amounts, built on the shared `engine/resources.ts`
 * (owned with `m3r1-recruit-replenish`), which every step-1 purchase uses. A missing resource
 * is zero.
 */
export { canAfford, subtractResources, treasuryOf } from "../resources";

/** The amount of one resource, zero when missing. */
export function amountOf(amount: Resources, resource: ResourceId): number {
  return amount[resource] ?? 0;
}

/** The sum of any number of amounts. */
export function sumResources(...amounts: readonly Resources[]): Resources {
  return amounts.reduce<Resources>((total, amount) => addResources(total, amount), {});
}

/** The resources `balance` lacks to pay `cost`, empty when it can pay. */
export function shortfall(balance: Resources, cost: Resources): Resources {
  const missing: Record<ResourceId, number> = {};
  for (const [resource, value] of Object.entries(cost) as [ResourceId, number][]) {
    const lack = value - amountOf(balance, resource);
    if (lack > 0) missing[resource] = lack;
  }
  return missing;
}

/** True when every resource in the amount is zero (or the amount is empty). */
export function isEmptyAmount(amount: Resources): boolean {
  return Object.values(amount).every((value) => value === 0);
}

/** Pays `cost` from a faction's treasury when it can; undefined when it cannot. */
export function pay(treasuries: GameState["treasuries"], factionId: FactionId, cost: Resources): GameState["treasuries"] | undefined {
  return canAfford(treasuries[factionId] ?? {}, cost) ? adjustTreasury(treasuries, factionId, subtractResources({}, cost)) : undefined;
}

/** Gives `amount` to a faction (a refund, or income). */
export function credit(treasuries: GameState["treasuries"], factionId: FactionId, amount: Resources): GameState["treasuries"] {
  return adjustTreasury(treasuries, factionId, amount);
}

/** The scenario's resources in catalogue order. */
export function resourceIds(scenario: Scenario): readonly ResourceId[] {
  return scenario.resources.map((resource) => resource.id);
}
