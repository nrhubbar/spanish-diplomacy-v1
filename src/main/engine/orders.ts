import { onGroundBoard } from "./air/pieces";
import type { Armies } from "./board";
import type { GameState, InvalidOrderOutcome, MoveOrder, Order, RejectedOrderOutcome, Scenario, UnitId, UnitState } from "./types";
import { validateOrder } from "./validation";

/** The orders an army follows when it has no move order. They are derived, never submitted (O5). */
export type StandingOrder = "entrench" | "rest";

/**
 * O1, O2, O5: an army without a move order entrenches when it is healthy (M22) and rests when it
 * is demoralized (M23). A demoralized army can never entrench.
 */
export function standingOrder(unit: Pick<UnitState, "morale">): StandingOrder {
  return unit.morale.demoralized ? "rest" : "entrench";
}

/**
 * M1, M9, M23: orders validate against the start-of-turn state; every order of a unit ordered
 * twice is invalid. Impossible moves disband their army (`invalid`); other failed orders are
 * rejected without disbanding (`rejected`).
 */
export function partitionOrders(
  scenario: Scenario,
  state: GameState,
  orders: readonly Order[]
): {
  readonly invalid: readonly InvalidOrderOutcome[];
  readonly rejected: readonly RejectedOrderOutcome[];
  readonly valid: readonly MoveOrder[];
} {
  const orderCount = new Map<UnitId, number>();
  for (const order of orders) {
    if ("unitId" in order) orderCount.set(order.unitId, (orderCount.get(order.unitId) ?? 0) + 1);
  }

  const invalid: InvalidOrderOutcome[] = [];
  const rejected: RejectedOrderOutcome[] = [];
  const valid: MoveOrder[] = [];
  const fail = (order: Order, reason: string): void => {
    if (order.kind === "move") invalid.push({ kind: "invalid-order", order, reason });
    else rejected.push({ kind: "rejected-order", order, reason });
  };
  for (const order of orders) {
    if ("unitId" in order && (orderCount.get(order.unitId) ?? 0) > 1) {
      fail(order, "A unit can receive only one order per turn.");
      continue;
    }
    const validation = validateOrder(scenario, state, order);
    if (!validation.ok) fail(order, validation.reason);
    else if (order.kind === "move") valid.push(order);
  }
  return { invalid, rejected, valid };
}

/**
 * M11 (C10): a move is a reinforcement when its faction controls the destination at the start
 * of the turn, or an army of its faction stays there: it has no move order, was not disbanded
 * for an impossible one (`armies` no longer holds those), and stands on the board through the
 * ground steps (D17, `onGroundBoard`: never aircraft, nor generals under the d6 table). Every
 * other move is an advance.
 */
export function classifyMoves(
  scenario: Scenario,
  state: Pick<GameState, "control" | "raised">,
  armies: Armies,
  valid: readonly MoveOrder[]
): { readonly advances: readonly MoveOrder[]; readonly reinforcements: readonly MoveOrder[] } {
  const moving = new Set(valid.map((order) => order.unitId));
  const staying = new Set(Object.values(armies)
    .filter((unit) => !moving.has(unit.id) && onGroundBoard(scenario, state.raised, unit.id))
    .map((unit) => `${unit.factionId}|${unit.territoryId}`));
  const isReinforcement = (order: MoveOrder): boolean => {
    const destination = state.control[order.to];
    return (destination?.kind === "controlled" && destination.factionId === order.factionId) || staying.has(`${order.factionId}|${order.to}`);
  };
  return { advances: valid.filter((order) => !isReinforcement(order)), reinforcements: valid.filter(isReinforcement) };
}

