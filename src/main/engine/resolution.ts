import type { GameState, MoveOrder, Order, ScenarioDefinition, TurnOutcome, TurnResolutionResult, UnitId } from "./types";
import { validateOrder } from "./validation";

export function resolveTurn(
  scenario: ScenarioDefinition,
  state: GameState,
  orders: readonly Order[]
): TurnResolutionResult {
  const validOrders = orders.filter((order) => validateOrder(scenario, state, order).ok);
  const moveOrders = validOrders.filter((order): order is MoveOrder => order.kind === "move");
  const movingUnitIds = new Set<UnitId>(moveOrders.map((order) => order.unitId));
  const incomingByDestination = groupMovesByDestination(moveOrders);
  const outcomes: TurnOutcome[] = [];
  const finalUnits = structuredClone(state.units);

  for (const order of validOrders) {
    if (order.kind === "no-move") {
      outcomes.push({ kind: "no-move", order });
      continue;
    }

    const destinationIncoming = incomingByDestination.get(order.to) ?? [];
    const stationaryOccupant = Object.values(state.units).find(
      (unit) => unit.territoryId === order.to && !movingUnitIds.has(unit.id)
    );
    const headOnSwap = moveOrders.some(
      (otherOrder) =>
        otherOrder.unitId !== order.unitId && otherOrder.from === order.to && otherOrder.to === order.from
    );

    if (destinationIncoming.length === 1 && stationaryOccupant === undefined && !headOnSwap) {
      finalUnits[order.unitId] = {
        ...finalUnits[order.unitId],
        territoryId: order.to
      };
      outcomes.push({ kind: "successful-move", order });
    } else {
      outcomes.push({
        kind: "bounced-move",
        order,
        reason:
          headOnSwap
            ? "Units attempted to swap territories."
            : stationaryOccupant === undefined
            ? "Multiple units moved to the same territory."
            : "Destination was occupied."
      });
    }
  }

  return {
    outcomes,
    finalUnits,
    summaryLines: outcomes.map(formatOutcome)
  };
}

function groupMovesByDestination(moveOrders: readonly MoveOrder[]): Map<string, MoveOrder[]> {
  const grouped = new Map<string, MoveOrder[]>();

  for (const order of moveOrders) {
    grouped.set(order.to, [...(grouped.get(order.to) ?? []), order]);
  }

  return grouped;
}

function formatOutcome(outcome: TurnOutcome): string {
  if (outcome.kind === "no-move") {
    return `${outcome.order.factionId} held position.`;
  }

  if (outcome.kind === "successful-move") {
    return `${outcome.order.factionId} moved from ${outcome.order.from} to ${outcome.order.to}.`;
  }

  return `${outcome.order.factionId} bounced moving from ${outcome.order.from} to ${outcome.order.to}: ${outcome.reason}`;
}
