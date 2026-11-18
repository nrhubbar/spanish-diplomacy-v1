import { isNeighbor } from "./lookup";
import type {
  FactionId,
  GameState,
  MoveOrder,
  PlayerSubmission,
  Scenario,
  TerritoryId,
  UnitId,
  ValidationResult
} from "./types";

export function validateMoveOrder(
  scenario: Scenario,
  state: GameState,
  order: MoveOrder
): ValidationResult {
  const unit = state.units[order.unitId];

  if (unit === undefined) {
    return { ok: false, reason: "Unknown unit." };
  }
  if (unit.factionId !== order.factionId) {
    return { ok: false, reason: "Selected unit belongs to another player." };
  }
  if (unit.territoryId !== order.from) {
    return { ok: false, reason: "Selected unit is no longer in that territory." };
  }
  if (order.from === order.to) {
    return { ok: false, reason: "Choose a different territory as the destination." };
  }
  if (!isNeighbor(scenario, order.from, order.to)) {
    return { ok: false, reason: "Destination is not connected to the unit's territory." };
  }
  return { ok: true };
}

export function validateSubmission(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  submission: PlayerSubmission
): ValidationResult {
  if (submission.factionId !== factionId) {
    return { ok: false, reason: "Submission belongs to another faction." };
  }

  const seen = new Set<UnitId>();
  for (const order of submission.orders) {
    if (seen.has(order.unitId)) {
      return { ok: false, reason: "A unit can receive only one order per turn." };
    }
    seen.add(order.unitId);
    const validation = validateMoveOrder(scenario, state, order);
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
