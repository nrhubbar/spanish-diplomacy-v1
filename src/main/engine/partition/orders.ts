import type { OrderHookContext, OrderValidationContext, RetreatContext } from "../hooks";
import { isNeighbor } from "../lookup";
import type { GameState, Scenario, TerritoryId, UnitId, ValidationResult, WithdrawOrder } from "../types";
import { isSeaRouteClosed } from "../weather";
import { holdsWhole, isContested, isPartitioned } from "./holders";
import { hasPath, pathThrough } from "./paths";

/**
 * C1 (Q-PART-2 rules 1-3, Q-MR-03, Q-UX-14): in a contested territory, units attack by default
 * (the M27 standing battle) or withdraw. They cannot move elsewhere, entrench, rest, replenish or
 * recruit. Contested status is judged at the start of the turn, against which every order
 * validates (M1).
 */

/** W5: whether the unit's type takes Withdraw orders (aircraft do not); a type without a list allows it. */
export function canWithdraw(scenario: Scenario, state: GameState, unitId: UnitId): boolean {
  const definition = scenario.index.units.get(unitId) ?? state.raised[unitId];
  const type = definition === undefined ? undefined : scenario.index.unitTypes.get(definition.type);
  return type === undefined || type.orders.includes("withdraw");
}

/** C1, P6: a Withdraw order, against the start-of-turn state. */
export function validateWithdrawOrder(scenario: Scenario, state: GameState, order: WithdrawOrder): ValidationResult {
  const unit = state.units[order.unitId];
  if (unit === undefined) return { ok: false, refusal: { code: "unknown-unit" } };
  if (unit.factionId !== order.factionId) return { ok: false, refusal: { code: "unit-of-another-faction" } };
  if (unit.territoryId !== order.from) return { ok: false, refusal: { code: "unit-elsewhere" } };
  if (!canWithdraw(scenario, state, order.unitId)) return { ok: false, refusal: { code: "unit-cannot-withdraw" } };
  if (!isContested(scenario, state, order.from)) return { ok: false, refusal: { code: "withdraw-not-contested" } };
  if (!isNeighbor(scenario, order.from, order.to) || !holdsWhole(scenario, state, order.to, order.factionId)) {
    return { ok: false, refusal: { code: "withdraw-target" } };
  }
  if (pathThrough(scenario, state, order.factionId, order.from, order.to, [order.unitId]).length === 0) {
    return { ok: false, refusal: { code: isSeaRouteClosed(scenario, state, order.from, order.to) ? "sea-closed" : "withdraw-no-way-out" } };
  }
  return { ok: true };
}

/** The partition module's `validateOrder.withdraw` hook: Withdraw is its order, in a scenario with sub-territories. */
export function partitionValidateWithdraw({ order, scenario, state }: OrderValidationContext<"withdraw">): ValidationResult {
  return isPartitioned(scenario) ? validateWithdrawOrder(scenario, state, order) : { ok: false, refusal: { code: "order-unavailable" } };
}

/** The partition module's `orderVerdict` hook: moves out of contested ground are refused (C1). */
export function partitionOrderVerdict({ order, scenario, state }: OrderHookContext): ValidationResult | undefined {
  if (!isPartitioned(scenario)) return undefined;
  if (order.kind === "move" && isContested(scenario, state, order.from)) return { ok: false, refusal: { code: "move-in-contested-ground" } };
  return undefined;
}

/** The partition module's `retreatAllowed` hook (P6, R1: out of the army's pocket), on the start-of-turn holders. */
export function partitionRetreatAllowed({ factionId, from, scenario, state, to, unitId }: RetreatContext): boolean {
  return !isPartitioned(scenario) || hasPath(scenario, state, factionId, from, to, unitId === undefined ? [] : [unitId]);
}

/** The partition module's `canDigIn` hook: no works grow in contested ground (C1). */
export function partitionCanDigIn(scenario: Scenario, state: GameState, territoryId: TerritoryId): boolean {
  return !isPartitioned(scenario) || !isContested(scenario, state, territoryId);
}
