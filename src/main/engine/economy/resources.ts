import type { FactionId, GameState, ResourceId, Resources, Scenario } from "../types";

/**
 * $1: arithmetic on resource amounts, shared by every purchase at step 1 (builds here, Recruit
 * and Replenish in `m3r1-recruit-replenish`). An amount is `{ [resourceId]: whole number }`; a
 * missing resource is zero.
 */

/** The amount of one resource, zero when missing. */
export function amountOf(amount: Resources, resource: ResourceId): number {
  return amount[resource] ?? 0;
}

/** The sum of several amounts. */
export function addResources(...amounts: readonly Resources[]): Resources {
  const total: Record<ResourceId, number> = {};
  for (const amount of amounts) {
    for (const [resource, value] of Object.entries(amount) as [ResourceId, number][]) total[resource] = (total[resource] ?? 0) + value;
  }
  return total;
}

/** `amount` minus `cost`, resource by resource. May go negative; check `canAfford` first. */
export function subtractResources(amount: Resources, cost: Resources): Resources {
  const total: Record<ResourceId, number> = { ...amount };
  for (const [resource, value] of Object.entries(cost) as [ResourceId, number][]) total[resource] = (total[resource] ?? 0) - value;
  return total;
}

/** Every resource of `cost` is covered by `balance`. */
export function canAfford(balance: Resources, cost: Resources): boolean {
  return (Object.entries(cost) as [ResourceId, number][]).every(([resource, value]) => amountOf(balance, resource) >= value);
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

/** A faction's balance in a state, empty when the faction has no treasury (or it is hidden). */
export function treasuryOf(state: Pick<GameState, "treasuries">, factionId: FactionId): Resources {
  return state.treasuries[factionId] ?? {};
}

/**
 * Pays `cost` from a faction's treasury when it can, and returns the new treasuries; undefined
 * when the faction cannot pay. The one way a step-1 purchase spends (R2, R5, $5).
 */
export function pay(
  treasuries: GameState["treasuries"],
  factionId: FactionId,
  cost: Resources
): GameState["treasuries"] | undefined {
  const balance = treasuries[factionId] ?? {};
  return canAfford(balance, cost) ? { ...treasuries, [factionId]: subtractResources(balance, cost) } : undefined;
}

/** Gives `amount` back to a faction (a refund, or income). */
export function credit(treasuries: GameState["treasuries"], factionId: FactionId, amount: Resources): GameState["treasuries"] {
  return { ...treasuries, [factionId]: addResources(treasuries[factionId] ?? {}, amount) };
}

/** The scenario's resources in catalogue order, for display. */
export function resourceIds(scenario: Scenario): readonly ResourceId[] {
  return scenario.resources.map((resource) => resource.id);
}
