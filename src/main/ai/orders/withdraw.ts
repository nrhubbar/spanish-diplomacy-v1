import { groundView } from "../../engine/air/pieces";
import { compareIds } from "../../engine/board";
import { armyValue, oddsForValues } from "../../engine/combat";
import { requireAiProfile, requireFaction } from "../../engine/lookup";
import { isContested, isPartitioned } from "../../engine/partition/holders";
import { canWithdraw } from "../../engine/partition/orders";
import { withdrawRoutes } from "../../engine/partition/paths";
import type { FactionId, TerritoryId, UnitId, UnitState, WithdrawOrder } from "../../engine/types";
import { assess, type Assessment } from "../assessment";
import type { OrderPlanner, PlanningContext } from "./planner";

/**
 * H5: the computer player's Withdraw orders, in contested ground only (C1). By default its units
 * there attack (the M27 standing battle) or sweep. It withdraws:
 * - every unit, when the position is hopeless: the strongest enemy faction there would attack in
 *   the standing battle (its attack is at least the faction's own), and the engine's own odds for
 *   that battle, without works as M27 fights it, give it at least the profile's
 *   `withdraw.hopelessTakeChance` of taking the territory whole; or every unit there is
 *   demoralized;
 * - its demoralized units, when healthy ones stay to hold, since a demoralized unit cannot
 *   recover in contested ground (C4) but can rest behind the line.
 * D24: its seat, its last objective (the only one it has units in) and victory-critical ground
 * (`Assessment.isCritical`) are a last stand. Every unit leaves them only when the standing battle
 * would take them whole at the stricter `withdraw.lastStandTakeChance`, demoralized or not, so the
 * computer player never walks off them while the odds of holding are better than hopeless.
 * Each goes to the reachable neighbour (P6) holding the most of its units, ties by scenario order.
 */
export const planWithdrawals: OrderPlanner<WithdrawOrder> = (context) => {
  const { factionId, planned, scenario, state } = context;
  if (!isPartitioned(scenario)) return [];
  const ordered = new Set(planned.flatMap((order) => ("unitId" in order ? [order.unitId] : [])));
  const units = Object.values(state.units);
  const lastStand = lastStandsOf(context);
  return scenario.territories.flatMap((territory): WithdrawOrder[] => {
    if (!isContested(scenario, state, territory.id)) return [];
    const own = units.filter((unit) => unit.territoryId === territory.id && unit.factionId === factionId && !ordered.has(unit.id) && canWithdraw(scenario, state, unit.id));
    const enemies = units.filter((unit) => unit.territoryId === territory.id && unit.factionId !== factionId);
    if (own.length === 0 || enemies.length === 0) return [];
    const to = bestRoute(context, territory.id);
    if (to === undefined) return [];
    const leaving = hopeless(context, territory.id, own, enemies, lastStand(territory.id)) ? own : leavingDemoralized(own);
    return leaving.map((unit) => order(factionId, unit.id, territory.id, to));
  });
};

function order(factionId: FactionId, unitId: UnitId, from: TerritoryId, to: TerritoryId): WithdrawOrder {
  return { factionId, from, kind: "withdraw", to, unitId };
}

/**
 * Whether holding the contested territory is hopeless. Values are summed as a battle side sums
 * them (M12); a demoralized unit cannot attack (M23). Only the attack of the faction that would
 * attack in the standing battle threatens the faction's units there.
 */
function hopeless(
  { factionId, scenario, state }: PlanningContext,
  territoryId: TerritoryId,
  own: readonly UnitState[],
  enemies: readonly UnitState[],
  lastStand: boolean
): boolean {
  if (!lastStand && own.every((unit) => unit.morale.demoralized)) return true;
  const { withdraw } = requireAiProfile(scenario, factionId);
  const attackOf = (units: readonly UnitState[]): number => units.filter((unit) => !unit.morale.demoralized).reduce((sum, unit) => sum + armyValue(scenario, unit, "attack"), 0);
  const defence = own.reduce((sum, unit) => sum + armyValue(scenario, unit, "defence"), 0);
  const attackBy = new Map<FactionId, number>();
  for (const unit of enemies) attackBy.set(unit.factionId, (attackBy.get(unit.factionId) ?? 0) + attackOf([unit]));
  const [attacker, attack] = [...attackBy].sort((left, right) => right[1] - left[1] || compareIds(left[0], right[0]))[0] ?? [undefined, 0];
  // The faction attacks in the standing battle itself when its attack is the greatest (M27).
  if (attacker === undefined || attack <= 0 || attack < attackOf(own)) return false;
  const odds = oddsForValues(scenario, state, { attackerFactionId: attacker, defenderFactionIds: [factionId], diggingIn: false, territoryId }, attack, defence);
  return odds.takeChance >= (lastStand ? withdraw.lastStandTakeChance : withdraw.hopelessTakeChance);
}

/**
 * D24: the territories the faction makes a last stand in: its seat, its last objective (when it
 * has units in only one), and victory-critical ground.
 */
function lastStandsOf({ factionId, scenario, state }: PlanningContext): (territoryId: TerritoryId) => boolean {
  const faction = requireFaction(scenario, factionId);
  // Aircraft hold no ground (D17), so only ground units keep an objective held.
  const ground = groundView(scenario, state);
  const held = faction.objectiveTerritoryIds.filter((id) => Object.values(ground.units).some((unit) => unit.factionId === factionId && unit.territoryId === id));
  let assessment: Assessment | undefined;
  return (territoryId) => {
    if (territoryId === faction.seatTerritoryId || (held.length === 1 && held[0] === territoryId)) return true;
    assessment ??= assess(scenario, ground, factionId);
    return assessment.isCritical(territoryId);
  };
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
