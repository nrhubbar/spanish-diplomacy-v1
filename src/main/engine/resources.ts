import type { FactionId, GameState, ResourceId, Resources } from "./types";

/**
 * $1: small arithmetic over amounts of resources, shared by every area that pays from a
 * treasury at step 1 (builds, recruits, replenishment). A missing id is zero.
 */

/** An amount kept to thousandths of a point, the finest the scenario data gives, so sums of fractions never drift. */
export function toThousandth(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function addResources(left: Resources, right: Resources): Resources {
  const total: Record<ResourceId, number> = { ...left };
  for (const [id, amount] of Object.entries(right) as [ResourceId, number][]) total[id] = toThousandth((total[id] ?? 0) + amount);
  return total;
}

export function subtractResources(left: Resources, right: Resources): Resources {
  const total: Record<ResourceId, number> = { ...left };
  for (const [id, amount] of Object.entries(right) as [ResourceId, number][]) total[id] = toThousandth((total[id] ?? 0) - amount);
  return total;
}

/** Each amount times `factor`, rounded up to whole units (a price is never a fraction). */
export function scaleResources(amount: Resources, factor: number): Resources {
  const scaled: Record<ResourceId, number> = {};
  for (const [id, value] of Object.entries(amount) as [ResourceId, number][]) scaled[id] = Math.ceil(value * factor - 1e-9);
  return scaled;
}

/** True when `balance` covers every amount in `price`. */
export function canAfford(balance: Resources, price: Resources): boolean {
  return (Object.entries(price) as [ResourceId, number][]).every(([id, amount]) => amount <= (balance[id] ?? 0));
}

/** A faction's balance in a state (zero when it has no treasury). */
export function treasuryOf(state: Pick<GameState, "treasuries">, factionId: FactionId): Resources {
  return state.treasuries[factionId] ?? {};
}

/** The treasuries with one faction's balance changed by `delta` (positive or negative). */
export function adjustTreasury(
  treasuries: GameState["treasuries"],
  factionId: FactionId,
  delta: Resources
): GameState["treasuries"] {
  return { ...treasuries, [factionId]: addResources(treasuries[factionId] ?? {}, delta) };
}
