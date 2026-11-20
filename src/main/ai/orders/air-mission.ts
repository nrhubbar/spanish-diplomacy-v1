import { isAirbaseFor, territoriesWithin, unitTypeIn } from "../../engine/air/pieces";
import { compareIds } from "../../engine/board";
import { hookedGrounded } from "../../engine/hooks";
import { neighborsOf } from "../../engine/lookup";
import type { AirMission, AirMissionOrder, FactionId, GameState, Scenario, SubTerritoryId, TerritoryId, UnitState } from "../../engine/types";
import { validateAirMission } from "../../engine/air/validation";
import type { OrderPlanner, PlanningContext } from "./planner";

/** A sub-territory's worth to a raider: its development levels plus its buildings. */
function yieldOf(state: GameState, subTerritoryId: SubTerritoryId): number {
  const sub = state.subTerritories[subTerritoryId];
  if (sub === undefined) return 0;
  return Object.values(sub.development).reduce((sum, level) => sum + level, 0) + sub.buildings.length;
}

function hostileIn(state: GameState, territoryId: TerritoryId, factionId: FactionId): number {
  return Object.values(state.units).filter((unit) => unit.territoryId === territoryId && unit.factionId !== factionId).length;
}

function ownControlled(state: GameState, territoryId: TerritoryId, factionId: FactionId): boolean {
  const control = state.control[territoryId];
  return control?.kind === "controlled" && control.factionId === factionId;
}

/** U3: other factions' anti-air in a territory, as the raid roll will read it (negative). */
function antiAir(scenario: Scenario, state: GameState, territoryId: TerritoryId, factionId: FactionId): number {
  let best = 0;
  for (const unit of Object.values(state.units)) {
    if (unit.territoryId !== territoryId || unit.factionId === factionId) continue;
    for (const effect of unitTypeIn(scenario, state.raised, unit.id)?.effects ?? []) if (effect.kind === "raid-defence") best = Math.min(best, effect.roll);
  }
  return best;
}

/** D7: the faction's planned attacks: destinations it does not hold, by the number of units going. */
function plannedAttacks(context: PlanningContext): ReadonlyMap<TerritoryId, number> {
  const attacks = new Map<TerritoryId, number>();
  for (const order of context.planned) {
    if (order.kind !== "move" || order.factionId !== context.factionId || ownControlled(context.state, order.to, context.factionId)) continue;
    attacks.set(order.to, (attacks.get(order.to) ?? 0) + 1);
  }
  return attacks;
}

/** Own territories with own units and enemies next door: where a defensive battle is likely. */
function threatened(context: PlanningContext, territoryId: TerritoryId): boolean {
  const { factionId, scenario, state } = context;
  const ownHere = Object.values(state.units).some((unit) => unit.territoryId === territoryId && unit.factionId === factionId);
  return ownHere && neighborsOf(scenario, territoryId).some((neighbor) => hostileIn(state, neighbor.territoryId, factionId) > 0);
}

function best<Item>(items: readonly Item[], score: (item: Item) => number, key: (item: Item) => string): Item | undefined {
  return [...items].sort((a, b) => score(b) - score(a) || compareIds(key(a), key(b)))[0];
}

/**
 * H5: one mission for each aircraft that can fly (at an airbase, not grounded). Ties break by id,
 * never by the move planner's random source (CT-36).
 * - Bombers support the biggest attack the move planner chose in range, else raid the richest
 *   enemy sub-territory in range, avoiding anti-air. A support-only type defends a threatened
 *   own territory instead.
 * - Fighters intercept over the richest own territory in reach of an enemy bomber, else their base.
 * - Recon looks at the enemy territory in range with the most enemy units, not revealed already.
 */
export const planAirMissions: OrderPlanner<AirMissionOrder> = (context) => {
  const { factionId, scenario, state } = context;
  if (scenario.air === undefined || scenario.rules.air === "none") return [];
  const orders: AirMissionOrder[] = [];
  const aircraft = Object.values(state.units)
    .filter((unit) => unit.factionId === factionId && unitTypeIn(scenario, state.raised, unit.id)?.air !== undefined)
    .sort((a, b) => compareIds(a.id, b.id));
  const attacks = plannedAttacks(context);
  const enemyBombers = Object.values(state.units).filter((unit) => unit.factionId !== factionId
    && (unitTypeIn(scenario, state.raised, unit.id)?.air?.missions.includes("raid") ?? false));
  const supported = new Set<TerritoryId>();
  for (const unit of aircraft) {
    const type = unitTypeIn(scenario, state.raised, unit.id);
    if (type?.air === undefined || !isAirbaseFor(scenario, state, unit.territoryId, factionId)) continue;
    if (hookedGrounded({ scenario, state, territoryId: unit.territoryId, unitId: unit.id })) continue;
    const reach = [...territoriesWithin(scenario, unit.territoryId, type.air.range).keys()];
    const mission = chooseMission(context, unit, type.air.missions, reach, attacks, supported, enemyBombers);
    if (mission === undefined) continue;
    const order: AirMissionOrder = { factionId, kind: "air-mission", mission, unitId: unit.id };
    if (!validateAirMission(scenario, state, order).ok) continue;
    if (mission.kind === "support") supported.add(mission.territoryId);
    orders.push(order);
  }
  return orders;
};

function chooseMission(
  context: PlanningContext,
  unit: UnitState,
  missions: readonly AirMission["kind"][],
  reach: readonly TerritoryId[],
  attacks: ReadonlyMap<TerritoryId, number>,
  supported: ReadonlySet<TerritoryId>,
  enemyBombers: readonly UnitState[]
): AirMission | undefined {
  const { factionId, scenario, state } = context;
  if (missions.includes("support")) {
    const target = best(reach.filter((id) => (attacks.get(id) ?? 0) > 0 && !supported.has(id)), (id) => attacks.get(id) ?? 0, (id) => id)
      ?? (missions.includes("raid") ? undefined : best(reach.filter((id) => threatened(context, id) && !supported.has(id)), (id) => hostileIn(state, id, factionId), (id) => id));
    if (target !== undefined) return { kind: "support", territoryId: target };
  }
  if (missions.includes("raid")) {
    const targets = reach.flatMap((territoryId) => (scenario.index.subTerritoriesByTerritory.get(territoryId) ?? [])
      .filter((sub) => { const holder = state.subTerritories[sub.id]?.holder; return holder !== undefined && holder !== factionId; })
      .map((sub) => ({ id: sub.id, score: yieldOf(state, sub.id) + antiAir(scenario, state, territoryId, factionId) })));
    const target = best(targets.filter((entry) => entry.score > 0), (entry) => entry.score, (entry) => entry.id);
    if (target !== undefined) return { kind: "raid", subTerritoryId: target.id };
  }
  if (missions.includes("intercept")) {
    const exposed = reach.filter((id) => ownControlled(state, id, factionId) && enemyBombers.some((bomber) => {
      const range = unitTypeIn(scenario, state.raised, bomber.id)?.air?.range ?? 0;
      return territoriesWithin(scenario, bomber.territoryId, range).has(id);
    }));
    const value = (id: TerritoryId): number => (scenario.index.subTerritoriesByTerritory.get(id) ?? []).reduce((sum, sub) => sum + yieldOf(state, sub.id), 0);
    return { kind: "intercept", territoryId: best(exposed, value, (id) => id) ?? unit.territoryId };
  }
  if (missions.includes("recon")) {
    const revealed = new Set(state.reveals.filter((reveal) => reveal.viewerFactionId === factionId && reveal.untilTurn > state.turnNumber).map((reveal) => reveal.territoryId));
    const target = best(reach.filter((id) => !ownControlled(state, id, factionId) && !revealed.has(id) && hostileIn(state, id, factionId) > 0), (id) => hostileIn(state, id, factionId), (id) => id);
    if (target !== undefined) return { kind: "recon", territoryId: target };
  }
  return undefined;
}
