import { isGroundUnit } from "../../engine/air/pieces";
import type { Scenario, UnitState } from "../../engine/types";
import type { PlanningSession } from "./selection";

/**
 * U2 (Q-R2B-4): the player's armies that have no order this turn: no move or withdrawal, no
 * Replenish, and not told to stay (Entrench, Rest, Attack or Hold from the selection bar).
 * Aircraft and generals are left out. Listed in the scenario's territory order, so the End Turn
 * confirm reads place by place.
 */
export function armiesWithoutOrders(scenario: Scenario, session: PlanningSession): readonly UnitState[] {
  const { draft, factionId, game } = session;
  const ordered = new Set([
    ...draft.orders.map((order) => order.unitId),
    ...(draft.replenishments ?? []).map((order) => order.unitId),
    ...(draft.orderedToStay ?? [])
  ]);
  const place = (unit: UnitState): number => scenario.territories.findIndex((territory) => territory.id === unit.territoryId);
  return Object.values(game.state.units)
    .filter((unit) => unit.factionId === factionId && !ordered.has(unit.id) && isGroundUnit(scenario, game.state.raised, unit.id))
    .sort((a, b) => place(a) - place(b));
}
