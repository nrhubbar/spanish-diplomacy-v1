import type { Armies } from "./board";
import type { GameState, InvalidOrderOutcome, MoveOrder, Scenario, UnitId } from "./types";
import { validateMoveOrder } from "./validation";

/** M1, M9, M23: orders validate against the start-of-turn state; every order of a unit ordered twice is invalid. */
export function partitionOrders(
  scenario: Scenario,
  state: GameState,
  orders: readonly MoveOrder[]
): { readonly invalid: readonly InvalidOrderOutcome[]; readonly valid: readonly MoveOrder[] } {
  const orderCount = new Map<UnitId, number>();
  for (const order of orders) orderCount.set(order.unitId, (orderCount.get(order.unitId) ?? 0) + 1);

  const invalid: InvalidOrderOutcome[] = [];
  const valid: MoveOrder[] = [];
  for (const order of orders) {
    if ((orderCount.get(order.unitId) ?? 0) > 1) {
      invalid.push({ kind: "invalid-order", order, reason: "A unit can receive only one order per turn." });
      continue;
    }
    const validation = validateMoveOrder(scenario, state, order);
    if (validation.ok) {
      valid.push(order);
    } else {
      invalid.push({ kind: "invalid-order", order, reason: validation.reason });
    }
  }
  return { invalid, valid };
}

/**
 * M11 (C10): a move is a reinforcement when its faction controls the destination at the start
 * of the turn, or an army of its faction stays there: it has no move order, and was not
 * disbanded for an impossible one (`armies` no longer holds those). Every other move is an
 * advance.
 */
export function classifyMoves(
  control: GameState["control"],
  armies: Armies,
  valid: readonly MoveOrder[]
): { readonly advances: readonly MoveOrder[]; readonly reinforcements: readonly MoveOrder[] } {
  const moving = new Set(valid.map((order) => order.unitId));
  const isReinforcement = (order: MoveOrder): boolean => {
    const destination = control[order.to];
    return (destination?.kind === "controlled" && destination.factionId === order.factionId)
      || Object.values(armies).some((unit) =>
        unit.territoryId === order.to && unit.factionId === order.factionId && !moving.has(unit.id));
  };
  return { advances: valid.filter((order) => !isReinforcement(order)), reinforcements: valid.filter(isReinforcement) };
}

