import { plannedAir } from "../../engine/air/groundSupport";
import { isAirbaseFor, onGroundBoard, territoriesWithin, unitTypeIn } from "../../engine/air/pieces";
import { compareIds } from "../../engine/board";
import { subTerritoriesOf } from "../../engine/economy/holdings";
import { hookedGrounded } from "../../engine/hooks";
import { neighborsOf, requireAiProfile } from "../../engine/lookup";
import type { AirMission, AirMissionOrder, FactionId, GameState, Scenario, SubTerritoryId, TerritoryId, UnitId, UnitState, UnitTypeId } from "../../engine/types";
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

/** D7, R11: the faction's planned attacks on defended ground it does not hold: the units going, by destination. */
function plannedAttacks(context: PlanningContext): ReadonlyMap<TerritoryId, readonly UnitId[]> {
  const attacks = new Map<TerritoryId, UnitId[]>();
  for (const order of context.planned) {
    if (order.kind !== "move" || order.factionId !== context.factionId || ownControlled(context.state, order.to, context.factionId)) continue;
    attacks.set(order.to, [...(attacks.get(order.to) ?? []), order.unitId]);
  }
  return attacks;
}

/** The other factions' units that would fight on the ground in a territory. */
function defendersIn(scenario: Scenario, state: GameState, territoryId: TerritoryId, factionId: FactionId): readonly UnitState[] {
  return Object.values(state.units).filter((unit) => unit.territoryId === territoryId && unit.factionId !== factionId && onGroundBoard(scenario, state.raised, unit.id));
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
 * - Ground Support (fighters and bombers, R10, R11): over the biggest attack the move planner
 *   chose in range on defended ground, by the combination of free aircraft (at most the scenario's
 *   `air.supportMax`) that adds most on average, and only while its support applies, after the air
 *   battle against the defenders' AA, with at least the profile's `air.supportChance`. An unopposed
 *   move needs none. A support-only type defends a threatened own territory instead.
 * - Bombers otherwise raid the richest enemy sub-territory in range, avoiding anti-air.
 * - Fighters otherwise patrol the own territory in reach most threatened: in reach of an enemy
 *   bomber (Patrol still intercepts raids) by what a raid would hit, plus the enemy units next
 *   door when own units stand there (a likely battle, whose air battle Patrol joins). Else their base.
 * - Recon looks at the enemy territory in range with the most enemy units, not revealed already.
 */
export const planAirMissions: OrderPlanner<AirMissionOrder> = (context) => {
  const { factionId, scenario, state } = context;
  if (scenario.air === undefined || scenario.rules.air === "none") return [];
  const orders: AirMissionOrder[] = [];
  // D1: an aircraft to be disbanded flies nothing.
  const ordered = new Set<UnitId>(context.planned.flatMap((order) => ("unitId" in order ? [order.unitId] : [])));
  const aircraft = Object.values(state.units)
    .filter((unit) => unit.factionId === factionId && !ordered.has(unit.id) && unitTypeIn(scenario, state.raised, unit.id)?.air !== undefined)
    .sort((a, b) => compareIds(a.id, b.id));
  const attacks = plannedAttacks(context);
  const enemyBombers = Object.values(state.units).filter((unit) => unit.factionId !== factionId
    && (unitTypeIn(scenario, state.raised, unit.id)?.air?.missions.includes("raid") ?? false));
  const ready = aircraft.flatMap((unit): readonly FreeAircraft[] => {
    const type = unitTypeIn(scenario, state.raised, unit.id);
    if (type?.air === undefined || !isAirbaseFor(scenario, state, unit.territoryId, factionId)) return [];
    if (hookedGrounded({ scenario, state, territoryId: unit.territoryId, unitId: unit.id })) return [];
    return [{ missions: type.air.missions, reach: [...territoriesWithin(scenario, unit.territoryId, type.air.range).keys()], typeId: type.id, unit }];
  });
  const support = planSupport(context, ready, attacks);
  const supported = new Set<TerritoryId>(support.values());
  for (const { missions, reach, unit } of ready) {
    const mission = chooseMission(context, unit, missions, reach, support.get(unit.id), supported, enemyBombers);
    if (mission === undefined) continue;
    const order: AirMissionOrder = { factionId, kind: "air-mission", mission, unitId: unit.id };
    if (!validateAirMission(scenario, state, order).ok) continue;
    if (mission.kind === "support") supported.add(mission.territoryId);
    orders.push(order);
  }
  return orders;
};

/** An aircraft that can fly a mission this turn. */
interface FreeAircraft {
  readonly missions: readonly AirMission["kind"][];
  readonly reach: readonly TerritoryId[];
  readonly typeId: UnitTypeId;
  readonly unit: UnitState;
}

/**
 * Every way to send at most `cap` of these aircraft. Aircraft of one type count alike, so only
 * how many of each type go matters, and the first of them in id order go.
 */
function combinations(aircraft: readonly FreeAircraft[], cap: number): readonly (readonly UnitId[])[] {
  const byType = new Map<UnitTypeId, UnitId[]>();
  for (const { typeId, unit } of aircraft) byType.set(typeId, [...(byType.get(typeId) ?? []), unit.id]);
  let ways: readonly (readonly UnitId[])[] = [[]];
  for (const ids of byType.values()) {
    ways = ways.flatMap((way) => Array.from({ length: Math.min(ids.length, cap - way.length) + 1 }, (_, count) => [...way, ...ids.slice(0, count)]));
  }
  return ways.filter((way) => way.length > 0);
}

/**
 * R11: the Ground Support each planned attack gets, the biggest attack first: the combination of
 * free aircraft in reach that adds most to its roll on average, of those whose support applies
 * with the profile's chance.
 */
function planSupport({ factionId, scenario, state }: PlanningContext, ready: readonly FreeAircraft[], attacks: ReadonlyMap<TerritoryId, readonly UnitId[]>): ReadonlyMap<UnitId, TerritoryId> {
  const cap = scenario.air?.supportMax ?? Number.POSITIVE_INFINITY;
  const least = requireAiProfile(scenario, factionId).air.supportChance;
  const flying = new Map<UnitId, TerritoryId>();
  const targets = [...attacks].sort(([a, going], [b, others]) => others.length - going.length || compareIds(a, b));
  for (const [territoryId] of targets) {
    const defenders = defendersIn(scenario, state, territoryId, factionId);
    if (defenders.length === 0) continue;
    const setting = { attackerFactionId: factionId, defenderFactionIds: [...new Set(defenders.map((other) => other.factionId))], defenderUnitIds: defenders.map((other) => other.id), territoryId };
    const free = ready.filter(({ missions, reach, unit }) => missions.includes("support") && reach.includes(territoryId) && !flying.has(unit.id));
    const options = combinations(free, cap).flatMap((ids) => {
      const air = plannedAir(scenario, state, setting, ids);
      return air !== undefined && air.supportChance >= least ? [{ average: air.average, ids }] : [];
    });
    // Of those that add as much, the fewest go: every aircraft sent is one that can be lost.
    const chosen = best(options, (option) => option.average, (option) => `${String(option.ids.length)}|${option.ids.join()}`);
    for (const id of chosen?.ids ?? []) flying.set(id, territoryId);
  }
  return flying;
}

function chooseMission(
  context: PlanningContext,
  unit: UnitState,
  missions: readonly AirMission["kind"][],
  reach: readonly TerritoryId[],
  attack: TerritoryId | undefined,
  supported: ReadonlySet<TerritoryId>,
  enemyBombers: readonly UnitState[]
): AirMission | undefined {
  const { factionId, scenario, state } = context;
  if (missions.includes("support")) {
    const target = attack
      ?? (missions.includes("raid") || missions.includes("patrol") ? undefined : best(reach.filter((id) => threatened(context, id) && !supported.has(id)), (id) => hostileIn(state, id, factionId), (id) => id));
    if (target !== undefined) return { kind: "support", territoryId: target };
  }
  if (missions.includes("raid")) {
    const targets = reach.flatMap((territoryId) => subTerritoriesOf(scenario, territoryId)
      .filter((sub) => { const holder = state.subTerritories[sub.id]?.holder; return holder !== undefined && holder !== factionId; })
      .map((sub) => ({ id: sub.id, score: yieldOf(state, sub.id) + antiAir(scenario, state, territoryId, factionId) })));
    const target = best(targets.filter((entry) => entry.score > 0), (entry) => entry.score, (entry) => entry.id);
    if (target !== undefined) return { kind: "raid", subTerritoryId: target.id };
  }
  if (missions.includes("patrol")) {
    const value = (id: TerritoryId): number => subTerritoriesOf(scenario, id).reduce((sum, sub) => sum + yieldOf(state, sub.id), 0);
    const raided = (id: TerritoryId): boolean => enemyBombers.some((bomber) => territoriesWithin(scenario, bomber.territoryId, unitTypeIn(scenario, state.raised, bomber.id)?.air?.range ?? 0).has(id));
    const nextDoor = (id: TerritoryId): number => neighborsOf(scenario, id).reduce((sum, neighbor) => sum + hostileIn(state, neighbor.territoryId, factionId), 0);
    const threat = (id: TerritoryId): number => (raided(id) ? 1 + value(id) : 0) + (threatened(context, id) ? nextDoor(id) : 0);
    const covered = reach.filter((id) => ownControlled(state, id, factionId) && threat(id) > 0);
    return { kind: "patrol", territoryId: best(covered, threat, (id) => id) ?? unit.territoryId };
  }
  if (missions.includes("recon")) {
    const revealed = new Set(state.reveals.filter((reveal) => reveal.viewerFactionId === factionId && reveal.untilTurn > state.turnNumber).map((reveal) => reveal.territoryId));
    const target = best(reach.filter((id) => !ownControlled(state, id, factionId) && !revealed.has(id) && hostileIn(state, id, factionId) > 0), (id) => hostileIn(state, id, factionId), (id) => id);
    if (target !== undefined) return { kind: "recon", territoryId: target };
  }
  return undefined;
}
