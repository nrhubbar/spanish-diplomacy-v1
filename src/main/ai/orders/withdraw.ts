import { compareIds } from "../../engine/board";
import { armyValue } from "../../engine/combat";
import { isContested, isPartitioned } from "../../engine/partition/holders";
import { withdrawRoutes } from "../../engine/partition/paths";
import type { FactionId, TerritoryId, UnitId, UnitState, WithdrawOrder } from "../../engine/types";
import type { OrderPlanner, PlanningContext } from "./planner";

/**
 * Design note (H5, C1): the computer player gives up contested ground when the strongest enemy
 * faction there attacks with at least this many times its own defence. A starting value for the
 * harness to tune.
 */
export const hopelessRatio = 2;

/**
 * H5: the computer player's Withdraw orders, in contested ground only (C1). By default its units
 * there attack (the M27 standing battle) or sweep. It withdraws:
 * - every unit, when the position is hopeless (the strongest enemy attack is at least
 *   `hopelessRatio` times its defence, or every unit there is demoralized);
 * - its demoralized units, when healthy ones stay to hold, since a demoralized unit cannot
 *   recover in contested ground (C4) but can rest behind the line.
 * Each goes to the reachable neighbour (P6) holding the most of its units, ties by scenario order.
 */
export const planWithdrawals: OrderPlanner<WithdrawOrder> = (context) => {
  const { factionId, planned, scenario, state } = context;
  if (!isPartitioned(scenario)) return [];
  const ordered = new Set(planned.flatMap((order) => ("unitId" in order ? [order.unitId] : [])));
  const units = Object.values(state.units);
  return scenario.territories.flatMap((territory): WithdrawOrder[] => {
    if (!isContested(scenario, state, territory.id)) return [];
    const own = units.filter((unit) => unit.territoryId === territory.id && unit.factionId === factionId && !ordered.has(unit.id));
    const enemies = units.filter((unit) => unit.territoryId === territory.id && unit.factionId !== factionId);
    if (own.length === 0 || enemies.length === 0) return [];
    const to = bestRoute(context, territory.id);
    if (to === undefined) return [];
    const leaving = hopeless(context, own, enemies) ? own : leavingDemoralized(own);
    return leaving.map((unit) => order(factionId, unit.id, territory.id, to));
  });
};

function order(factionId: FactionId, unitId: UnitId, from: TerritoryId, to: TerritoryId): WithdrawOrder {
  return { factionId, from, kind: "withdraw", to, unitId };
}

function hopeless({ scenario }: PlanningContext, own: readonly UnitState[], enemies: readonly UnitState[]): boolean {
  if (own.every((unit) => unit.morale.demoralized)) return true;
  const defence = own.reduce((sum, unit) => sum + armyValue(scenario, unit, "defence"), 0);
  const attackBy = new Map<FactionId, number>();
  for (const unit of enemies) {
    if (!unit.morale.demoralized) attackBy.set(unit.factionId, (attackBy.get(unit.factionId) ?? 0) + armyValue(scenario, unit, "attack"));
  }
  return Math.max(0, ...attackBy.values()) >= hopelessRatio * defence;
}

function leavingDemoralized(own: readonly UnitState[]): readonly UnitState[] {
  const shaken = own.filter((unit) => unit.morale.demoralized);
  return shaken.length < own.length ? shaken : [];
}

function bestRoute({ factionId, scenario, state }: PlanningContext, from: TerritoryId): TerritoryId | undefined {
  const friends = (id: TerritoryId): number => Object.values(state.units).filter((unit) => unit.territoryId === id && unit.factionId === factionId).length;
  const rank = (id: TerritoryId): number => scenario.territories.findIndex((territory) => territory.id === id);
  return withdrawRoutes(scenario, state, factionId, from)
    .map((route) => route.to)
    .sort((left, right) => friends(right) - friends(left) || rank(left) - rank(right) || compareIds(left, right))[0];
}
