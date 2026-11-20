import type { OrderHookContext, RetreatContext } from "../hooks";
import { isNeighbor } from "../lookup";
import type { GameState, Scenario, TerritoryId, UnitId, ValidationResult, WithdrawOrder } from "../types";
import { holdsWhole, isContested, isPartitioned } from "./holders";
import { hasPath, pathThrough } from "./paths";

/**
 * C1 (Q-PART-2 rules 1-3, Q-MR-03, Q-UX-14): in a contested territory, units attack by default
 * (the M27 standing battle) or withdraw. They cannot move elsewhere, entrench, rest, replenish or
 * recruit. Contested status is judged at the start of the turn, against which every order
 * validates (M1).
 */

/** Player-facing reasons, shared with the order menu. */
export const contestedReasons = {
  move: "Not in contested ground: units here attack or withdraw.",
  replenish: "Not in contested ground.",
  withdrawNoPath: "No way out through your own sub-territories.",
  withdrawNotContested: "Withdraw is only for contested ground. Use Move.",
  withdrawTarget: "Withdraw to a neighbouring territory you hold whole."
} as const;

/** True when the unit stands in contested ground at the start of the turn. */
export function inContestedGround(scenario: Scenario, state: GameState, unitId: UnitId): boolean {
  const unit = state.units[unitId];
  return unit !== undefined && isPartitioned(scenario) && isContested(scenario, state, unit.territoryId);
}

/** W5: whether the unit's type takes Withdraw orders (aircraft do not); a type without a list allows it. */
export function canWithdraw(scenario: Scenario, state: GameState, unitId: UnitId): boolean {
  const definition = scenario.index.units.get(unitId) ?? state.raised[unitId];
  const type = definition === undefined ? undefined : scenario.index.unitTypes.get(definition.type);
  return type === undefined || type.orders.includes("withdraw");
}

/** C1, P6: a Withdraw order, against the start-of-turn state. */
export function validateWithdrawOrder(scenario: Scenario, state: GameState, order: WithdrawOrder): ValidationResult {
  const unit = state.units[order.unitId];
  if (unit === undefined) return { ok: false, reason: "Unknown unit." };
  if (unit.factionId !== order.factionId) return { ok: false, reason: "Selected unit belongs to another player." };
  if (unit.territoryId !== order.from) return { ok: false, reason: "Selected unit is no longer in that territory." };
  if (!canWithdraw(scenario, state, order.unitId)) return { ok: false, reason: "This unit cannot withdraw." };
  if (!isContested(scenario, state, order.from)) return { ok: false, reason: contestedReasons.withdrawNotContested };
  if (!isNeighbor(scenario, order.from, order.to) || !holdsWhole(scenario, state, order.to, order.factionId)) {
    return { ok: false, reason: contestedReasons.withdrawTarget };
  }
  if (pathThrough(scenario, state.subTerritories, order.factionId, order.from, order.to).length === 0) {
    return { ok: false, reason: contestedReasons.withdrawNoPath };
  }
  return { ok: true };
}

/** The partition module's `orderVerdict` hook: Withdraw is its order, and moves out of contested ground are refused. */
export function partitionOrderVerdict({ order, scenario, state }: OrderHookContext): ValidationResult | undefined {
  if (!isPartitioned(scenario)) return undefined;
  if (order.kind === "withdraw") return validateWithdrawOrder(scenario, state, order);
  if (order.kind === "move" && isContested(scenario, state, order.from)) return { ok: false, reason: contestedReasons.move };
  return undefined;
}

/** The partition module's `retreatAllowed` hook (P6), on the start-of-turn holders. */
export function partitionRetreatAllowed({ factionId, from, scenario, state, to }: RetreatContext): boolean {
  return !isPartitioned(scenario) || hasPath(scenario, state.subTerritories, factionId, from, to);
}

/** The partition module's `canDigIn` hook: no works grow in contested ground (C1). */
export function partitionCanDigIn(scenario: Scenario, state: GameState, territoryId: TerritoryId): boolean {
  return !isPartitioned(scenario) || !isContested(scenario, state, territoryId);
}
