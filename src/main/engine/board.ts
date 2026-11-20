import { raisedOrder } from "./recruitment/rules";
import type { FactionId, GameState, MoveOrder, Scenario, TerritoryId, UnitId, UnitState } from "./types";

/**
 * The armies in play while a turn resolves, keyed by id. Each army's `territoryId` is where it
 * stands now; an army still on the road keeps its origin until it arrives. Helpers return new
 * records and never change their inputs.
 */
export type Armies = GameState["units"];

/** An army in a battle, and where it fought from (its origin when it moved this turn). */
export interface Combatant {
  readonly from: TerritoryId;
  readonly unit: UnitState;
}

/** An army in play; a miss is a programming error. */
export function requireArmy(armies: Armies, id: UnitId): UnitState {
  const unit = armies[id];
  if (unit === undefined) {
    throw new Error(`Invariant violated: unknown army in play "${id}".`);
  }
  return unit;
}

/** Moving armies as combatants, each fighting from its origin. */
export function combatantsOf(armies: Armies, orders: readonly MoveOrder[]): readonly Combatant[] {
  return orders.map((order) => ({ from: order.from, unit: requireArmy(armies, order.unitId) }));
}

export function replaceArmies(armies: Armies, updates: readonly UnitState[]): Armies {
  if (updates.length === 0) {
    return armies;
  }
  const next: Record<UnitId, UnitState> = { ...armies };
  for (const unit of updates) {
    next[unit.id] = unit;
  }
  return next;
}

export function removeArmies(armies: Armies, ids: Iterable<UnitId>): Armies {
  const removed = new Set(ids);
  if (removed.size === 0) {
    return armies;
  }
  const next: Record<UnitId, UnitState> = {};
  for (const unit of Object.values(armies)) {
    if (!removed.has(unit.id)) {
      next[unit.id] = unit;
    }
  }
  return next;
}

/** An army standing in a new territory. It leaves its city behind; men, morale and fatigue go with it. */
export function placeAt(unit: UnitState, territoryId: TerritoryId): UnitState {
  if (unit.territoryId === territoryId) {
    return unit;
  }
  return { factionId: unit.factionId, fatigue: unit.fatigue, id: unit.id, morale: unit.morale, strength: unit.strength, territoryId };
}

export function armiesIn(armies: Armies, territoryId: TerritoryId): readonly UnitState[] {
  return Object.values(armies).filter((unit) => unit.territoryId === territoryId);
}

/** Distinct factions of the given items, in id order. */
export function factionsOf(items: readonly { readonly factionId: FactionId }[]): readonly FactionId[] {
  return [...new Set(items.map((item) => item.factionId))].sort(compareIds);
}

/** The given factions in scenario order, which is how reports list them. */
export function inScenarioOrder(scenario: Scenario, factionIds: Iterable<FactionId>): readonly FactionId[] {
  const wanted = new Set(factionIds);
  return scenario.factions.map((definition) => definition.id).filter((id) => wanted.has(id));
}

/** Plain code-unit order for ids, so ordering never depends on the locale (M26). */
export function compareIds(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

/** Position of each army in the scenario's unit list, for "scenario order" tie-breaks. */
export function unitOrder(scenario: Scenario): (id: UnitId) => number {
  const order = new Map(scenario.units.map((unit, index) => [unit.id, index]));
  return (id) => {
    const index = order.get(id) ?? raisedOrder(scenario, id);
    if (index === undefined) {
      throw new Error(`Invariant violated: unknown unit "${id}".`);
    }
    return index;
  };
}
