import { hookedOrderVerdict, hookedValidateOrder } from "./hooks";
import type {
  FactionId,
  GameState,
  MoveOrder,
  Order,
  PlayerSubmission,
  Scenario,
  TerritoryId,
  UnitId,
  ValidationResult
} from "./types";

/**
 * M1, M9: validates any order against the start-of-turn state. Each order kind belongs to the
 * selected module that validates it (`RuleHooks.validateOrder`): Move to the movement module,
 * Recruit and Replenish to recruitment, Build to economy, Withdraw to partition, air missions and
 * Sack to air. A kind no selected module owns is not available. An order its owner accepts may
 * still be refused by another module's `orderVerdict` (C1: no move leaves contested ground).
 */
export function validateOrder(scenario: Scenario, state: GameState, order: Order): ValidationResult {
  const owned = hookedValidateOrder({ order, scenario, state }) ?? { ok: false, refusal: { code: "order-unavailable" } };
  if (!owned.ok) return owned;
  const verdict = hookedOrderVerdict({ order, scenario, state });
  return verdict === undefined || verdict.ok ? { ok: true } : verdict;
}

/** M1, M9: a Move order, as `validateOrder` judges it; planning calls this for every destination. */
export function validateMoveOrder(scenario: Scenario, state: GameState, order: MoveOrder): ValidationResult {
  return validateOrder(scenario, state, order);
}

export function validateSubmission(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  submission: PlayerSubmission
): ValidationResult {
  if (submission.factionId !== factionId) {
    return { ok: false, refusal: { code: "submission-of-another-faction" } };
  }

  const seen = new Set<UnitId>();
  for (const order of submission.orders) {
    if (order.factionId !== factionId) return { ok: false, refusal: { code: "order-of-another-faction" } };
    if ("unitId" in order) {
      if (seen.has(order.unitId)) {
        return { ok: false, refusal: { code: "one-order-per-unit" } };
      }
      seen.add(order.unitId);
    }
    const validation = validateOrder(scenario, state, order);
    if (!validation.ok) {
      return validation;
    }
  }
  return { ok: true };
}

/**
 * Territories every given unit can legally move to this turn. Units must share an origin;
 * the result is the destinations legal for all of them, in scenario order.
 */
export function legalDestinations(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  unitIds: readonly UnitId[]
): readonly TerritoryId[] {
  if (unitIds.length === 0) {
    return [];
  }
  const candidates = scenario.territories.map((territory) => territory.id);
  return candidates.filter((to) =>
    unitIds.every((unitId) => {
      const unit = state.units[unitId];
      return unit !== undefined && validateMoveOrder(scenario, state, {
        factionId,
        from: unit.territoryId,
        kind: "move",
        to,
        unitId
      }).ok;
    })
  );
}
