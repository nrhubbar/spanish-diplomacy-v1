import { subtractResources } from "./resources";
import type { FactionId, GameState, ResourceId, Resources } from "./types";

/**
 * Treasuries hold whole points, and everything else counts in thousandths of a point. Each
 * faction has one carry per resource (`GameState.carry`): the thousandths it owes on top of its
 * treasury, or, below zero, the thousandths it has in hand. Income, upkeep and Replenish all use
 * it, so nothing is lost or rounded twice: what a faction really has is always its treasury
 * times `carryScale`, less its carry.
 *
 * Income and upkeep bank the whole points (`deposit`), which leaves the treasury at the whole
 * part of what the faction has and the fraction in the carry. A Replenish order takes a whole
 * point only once the carry owes one (`chargeReplenish`).
 */
export const carryScale = 1000;

/** An amount of points as a whole number of thousandths. */
function thousandths(points: number): number {
  return Math.round(points * carryScale);
}

/** Each amount of points as thousandths. */
export function inThousandths(amount: Resources): Resources {
  return mapAmounts(amount, thousandths);
}

/** Each amount of thousandths as points. */
export function inPoints(amount: Resources): Resources {
  return mapAmounts(amount, (value) => value / carryScale);
}

function mapAmounts(amount: Resources, change: (value: number) => number): Resources {
  return Object.fromEntries(Object.entries(amount).map(([id, value]) => [id, change(value)]));
}

/** The faction's carry, in thousandths of a point owed (empty: nothing owed). */
export function carryOf(state: Pick<GameState, "carry">, factionId: FactionId): Resources {
  return state.carry?.[factionId] ?? {};
}

/** What a faction really has, in thousandths: its whole points less its carry. Below zero: a debt larger than its points. */
export function holdings(state: Pick<GameState, "carry" | "treasuries">, factionId: FactionId): Resources {
  return subtractResources(inThousandths(state.treasuries[factionId] ?? {}), carryOf(state, factionId));
}

/** The treasuries and carries after a faction gains `change` thousandths (or loses them, below zero): whole points in the treasury, the rest in the carry. */
export function deposit(state: Pick<GameState, "carry" | "treasuries">, factionId: FactionId, change: Resources): Pick<GameState, "carry" | "treasuries"> {
  const before = holdings(state, factionId);
  const treasury: Record<ResourceId, number> = { ...state.treasuries[factionId] };
  const carry: Record<ResourceId, number> = { ...carryOf(state, factionId) };
  for (const id of Object.keys({ ...before, ...change }) as ResourceId[]) {
    const after = (before[id] ?? 0) + (change[id] ?? 0);
    const whole = Math.max(0, Math.floor(after / carryScale));
    treasury[id] = whole;
    carry[id] = whole * carryScale - after;
  }
  return { ...withCarry(state.carry, factionId, carry), treasuries: { ...state.treasuries, [factionId]: treasury } };
}

/** The carries with one faction's replaced, ready to spread into a state; no entry for a carry of nothing. */
export function withCarry(carries: GameState["carry"], factionId: FactionId, carry: Resources): Pick<GameState, "carry"> {
  const kept = Object.fromEntries(Object.entries(carry).filter(([, value]) => value !== 0));
  const others = Object.fromEntries(Object.entries(carries ?? {}).filter(([id]) => id !== factionId));
  const all = Object.keys(kept).length === 0 ? others : { ...others, [factionId]: kept };
  return carries === undefined && Object.keys(all).length === 0 ? {} : { carry: all };
}
