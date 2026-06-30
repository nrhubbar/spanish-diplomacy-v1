import type { GameState, MoveOrder, ScenarioDefinition, ValidationResult } from "./types";

export function validateMoveOrder(
  scenario: ScenarioDefinition,
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

  const fromTerritory = scenario.territories.find((territory) => territory.id === order.from);

  if (fromTerritory === undefined) {
    return { ok: false, reason: "Unknown origin territory." };
  }

  if (!fromTerritory.adjacent.includes(order.to)) {
    return { ok: false, reason: "Destination is not adjacent." };
  }

  return { ok: true };
}
