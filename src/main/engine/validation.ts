import { unitTypeIn } from "./air/pieces";
import { validateAirMission, validateSack } from "./air/validation";
import { hookedOrderVerdict } from "./hooks";
import { validateBuildOrder } from "./economy/catalogue";
import { isNeighbor } from "./lookup";
import { validateRoute } from "./movement/routes";
import { validateRecruitOrder, validateReplenishOrder } from "./recruitment/rules";
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

/** M9: an order kind no module of the scenario's ruleset handles yet. */
export const unavailableOrderReason = "This order is not available in this scenario.";

/**
 * M1, M9: validates any order against the start-of-turn state. Only moves are handled so far;
 * every other kind is impossible until its module lands (TODO(m3r1-recruit-replenish),
 * TODO(m3r1-economy-builds), TODO(m3r1-sub-territories), TODO(m3r1-air-generals)).
 */
export function validateOrder(scenario: Scenario, state: GameState, order: Order): ValidationResult {
  switch (order.kind) {
    case "move":
      return validateMoveOrder(scenario, state, order);
    // R2, R5: the recruitment module's orders (m3r1-recruit-replenish).
    case "recruit":
      return scenario.rules.recruitment === "none" ? { ok: false, reason: unavailableOrderReason } : validateRecruitOrder(scenario, state, order);
    case "replenish":
      return scenario.rules.recruitment === "none" ? { ok: false, reason: unavailableOrderReason } : validateReplenishOrder(scenario, state, order);
    // U2, U5: air missions and sackings (m3r1-air-generals).
    case "air-mission":
      return validateAirMission(scenario, state, order);
    case "sack":
      return validateSack(scenario, state, order);
    // $5: the economy module's Build orders (m3r1-economy-builds).
    case "build":
      return validateBuildOrder(scenario, state, order);
    default:
      // Other kinds (Withdraw, C1) are valid only when a selected module accepts them (`RuleHooks.orderVerdict`).
      return hookedOrderVerdict({ order, scenario, state }) ?? { ok: false, reason: unavailableOrderReason };
  }
}

/** M23 (C6): why a demoralized army may not enter where another faction stands. */
export const demoralizedAttackReason = "A demoralized army cannot attack. It can move only into empty or friendly territory.";

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
  // W5: a unit takes only the order kinds its type allows (aircraft fly missions, they do not march).
  if (!(unitTypeIn(scenario, state.raised, unit.id)?.orders.includes("move") ?? true)) {
    return { ok: false, reason: "This unit cannot move." };
  }
  if (order.from === order.to) {
    return { ok: false, reason: "Choose a different territory as the destination." };
  }
  if (scenario.rules.movement === "allowance") {
    // M1-M5: multi-leg routes (rail, sea, marches), checked by the movement module.
    const route = validateRoute(scenario, state, order);
    if (!route.ok) return route;
  } else {
    if (!isNeighbor(scenario, order.from, order.to)) {
      return { ok: false, reason: "Destination is not connected to the unit's territory." };
    }
    // M2: one step along a connection under `single-step`.
    if (order.legs !== undefined && !(order.legs.length === 1 && order.legs[0]?.kind !== "rail" && order.legs[0]?.to === order.to)) {
      return { ok: false, reason: unavailableOrderReason };
    }
  }
  // M23 (C6): a demoralized army cannot attack, so it may not enter where another faction stands.
  if (unit.morale.demoralized && Object.values(state.units).some((other) => other.territoryId === order.to && other.factionId !== unit.factionId)) {
    return { ok: false, reason: demoralizedAttackReason };
  }
  // C1 and the like: a selected module may refuse a move the base rules allow.
  const verdict = hookedOrderVerdict({ order, scenario, state });
  return verdict === undefined || verdict.ok ? { ok: true } : verdict;
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
    if ("unitId" in order) {
      if (seen.has(order.unitId)) {
        return { ok: false, reason: "A unit can receive only one order per turn." };
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
