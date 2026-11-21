import { unitTypeIn } from "../air/pieces";
import { type OrderValidationContext, unavailableOrderReason } from "../hooks";
import { isNeighbor } from "../lookup";
import type { MoveOrder, ValidationResult } from "../types";
import { validateRoute } from "./routes";

/**
 * M1-M5, M9, M23: the movement modules' Move validation (`RuleHooks.validateOrder.move`). Both
 * modules run the same checks around their own leg rule, in this order: the unit and its
 * origin, the legs (one step under `single-step`, a route under `allowance`), then the
 * demoralized rule. A module's `orderVerdict` (C1) is applied afterwards by the engine.
 */

/** M23 (C6): why a demoralized army may not enter where another faction stands. */
export const demoralizedAttackReason = "A demoralized unit cannot attack. It can move only into empty or friendly territory.";

type MoveContext = OrderValidationContext<"move">;

/** M1, M9: the unit exists, is the faction's, stands at the origin, may move, and goes somewhere else. */
function moveBasics({ order, scenario, state }: MoveContext): ValidationResult {
  const unit = state.units[order.unitId];
  if (unit === undefined) return { ok: false, reason: "Unknown unit." };
  if (unit.factionId !== order.factionId) return { ok: false, reason: "Selected unit belongs to another player." };
  if (unit.territoryId !== order.from) return { ok: false, reason: "Selected unit is no longer in that territory." };
  // W5: a unit takes only the order kinds its type allows (aircraft fly missions, they do not march).
  if (!(unitTypeIn(scenario, state.raised, unit.id)?.orders.includes("move") ?? true)) return { ok: false, reason: "This unit cannot move." };
  if (order.from === order.to) return { ok: false, reason: "Choose a different territory as the destination." };
  return { ok: true };
}

/** M23 (C6): a demoralized army cannot attack, so it may not enter where another faction stands. */
function demoralizedRule({ order, state }: MoveContext): ValidationResult {
  const unit = state.units[order.unitId];
  const blocked = unit?.morale.demoralized === true
    && Object.values(state.units).some((other) => other.territoryId === order.to && other.factionId !== unit.factionId);
  return blocked ? { ok: false, reason: demoralizedAttackReason } : { ok: true };
}

function withLegRule(legs: (context: MoveContext) => ValidationResult): (context: MoveContext) => ValidationResult {
  return (context) => {
    for (const check of [moveBasics, legs, demoralizedRule]) {
      const result = check(context);
      if (!result.ok) return result;
    }
    return { ok: true };
  };
}

/** M2: one step along a connection under `single-step`; rail and multi-leg routes are not part of it. */
export const validateSingleStepMove = withLegRule(({ order, scenario }: MoveContext): ValidationResult => {
  if (!isNeighbor(scenario, order.from, order.to)) return { ok: false, reason: "Destination is not connected to the unit's territory." };
  if (order.legs !== undefined && !(order.legs.length === 1 && order.legs[0]?.kind !== "rail" && order.legs[0]?.to === order.to)) {
    return { ok: false, reason: unavailableOrderReason };
  }
  return { ok: true };
});

/** M1-M5: multi-leg routes (rail, sea, marches) under `allowance`. */
export const validateAllowanceMove = withLegRule(({ order, scenario, state }: MoveContext): ValidationResult => {
  const route = validateRoute(scenario, state, order satisfies MoveOrder);
  return route.ok ? { ok: true } : { ok: false, reason: route.reason };
});
