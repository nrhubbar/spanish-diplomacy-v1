import { antiAirRoll, flightRolls, plannedSupport } from "../engine/air/groundSupport";
import { raidResult } from "../engine/air/missions";
import { territoriesWithin, unitTypeIn } from "../engine/air/pieces";
import { compareIds } from "../engine/board";
import { d20Faces } from "../engine/d20/rules";
import { subTerritoriesOf, wholeHolder } from "../engine/economy/holdings";
import { subTerritoryYield } from "../engine/economy/income";
import { addResources } from "../engine/resources";
import type { AirBattleAircraft, AirMission, FactionId, GameState, RaidOutcome, Resources, Scenario, SubTerritoryId, TerritoryId, UnitId, UnitTypeDefinition } from "../engine/types";
import type { RecruitBoard, SiteBattles } from "./unitWorth";

/**
 * What aircraft and anti-air change, for the Recruit planner (`unitWorth.ts`): the Ground Support
 * a battle gets after its air battle, and what raids cost. The odds are the engine's own, the ones
 * the air mission planner reads.
 */

/** Every way to send at most `cap` of these aircraft. Aircraft of one type count alike, so only how many of each type go matters, and the first of them go. */
export function combinations<Item>(aircraft: readonly Item[], typeIdOf: (item: Item) => string, cap: number): readonly (readonly Item[])[] {
  const byType = new Map<string, Item[]>();
  for (const item of aircraft) byType.set(typeIdOf(item), [...(byType.get(typeIdOf(item)) ?? []), item]);
  let ways: readonly (readonly Item[])[] = [[]];
  for (const alike of byType.values()) {
    ways = ways.flatMap((way) => Array.from({ length: Math.min(alike.length, cap - way.length) + 1 }, (_, count) => [...way, ...alike.slice(0, count)]));
  }
  return ways.filter((way) => way.length > 0);
}

const withinMemo = new WeakMap<Scenario, Map<string, ReadonlyMap<TerritoryId, number>>>();

/** `territoriesWithin`, remembered: the map never changes. */
function within(scenario: Scenario, from: TerritoryId, range: number): ReadonlyMap<TerritoryId, number> {
  const memo = withinMemo.get(scenario) ?? new Map<string, ReadonlyMap<TerritoryId, number>>();
  withinMemo.set(scenario, memo);
  const key = `${from}|${String(range)}`;
  const reached = memo.get(key) ?? territoriesWithin(scenario, from, range);
  memo.set(key, reached);
  return reached;
}

/** Whether an aircraft of the type based at `from` flies the mission over `to`. */
export function fliesOver(scenario: Scenario, type: UnitTypeDefinition, mission: AirMission["kind"], from: TerritoryId, to: TerritoryId): boolean {
  return type.air?.missions.includes(mission) === true && within(scenario, from, type.air.range).has(to);
}

/** What stands against an attack's Ground Support: the defenders' AA, and their fighters on Patrol. */
export interface AirDefence {
  readonly antiAir: number;
  readonly patrols: readonly UnitTypeDefinition[];
}

/** The Ground Support an attack may get, each roll with its chance; the chances sum to 1. */
export type SupportOdds = readonly { readonly chance: number; readonly roll: number }[];

/** No Ground Support. */
export const noSupport: SupportOdds = [{ chance: 1, roll: 0 }];

const supportMemo = new WeakMap<Scenario, Map<string, SupportOdds>>();

/**
 * R11: the Ground Support of the best of these aircraft in an attack, after the air battle, as the
 * air mission planner chooses them: at most `air.supportMax`, the most on average, and none where
 * it applies with less than the chance `least`. The same question gets the same answer object.
 */
export function supportFrom(scenario: Scenario, factionId: FactionId, fliers: readonly UnitTypeDefinition[], against: AirDefence, least: number): SupportOdds {
  if (fliers.length === 0) return noSupport;
  const memo = supportMemo.get(scenario) ?? new Map<string, SupportOdds>();
  supportMemo.set(scenario, memo);
  const idsOf = (types: readonly UnitTypeDefinition[]): string => types.map((type) => type.id).sort(compareIds).join();
  const key = `${idsOf(fliers)}|${idsOf(against.patrols)}|${String(against.antiAir)}|${String(least)}`;
  const known = memo.get(key);
  if (known !== undefined) return known;
  const aircraft = (types: readonly UnitTypeDefinition[], mission: AirBattleAircraft["mission"]): readonly AirBattleAircraft[] =>
    // The mission is in the id: the same type may fly on both sides, and the air battle tells aircraft apart by it.
    types.map((type, index) => ({ ...flightRolls(type, mission), factionId, mission, unitId: `${mission}-${type.id}-${String(index)}` as UnitId }));
  const { supportMax } = scenario.air ?? {};
  const planned = combinations(fliers, (type) => type.id, supportMax ?? Number.POSITIVE_INFINITY).map((sent) => plannedSupport(scenario, {
    attacker: { aircraft: aircraft(sent, "support"), antiAir: 0, factionId },
    defender: { aircraft: aircraft(against.patrols, "patrol"), antiAir: against.antiAir, factionId },
    ...(supportMax === undefined ? {} : { supportMax })
  }));
  const best = planned.filter((option) => option.supportChance >= least).reduce<(typeof planned)[number] | undefined>((chosen, option) => (option.average > (chosen?.average ?? 0) ? option : chosen), undefined);
  const odds = best === undefined ? noSupport : (best.results ?? [{ chance: 1, roll: best.average }]).filter(({ chance }) => chance > 0).map(({ chance, roll }) => ({ chance, roll }));
  memo.set(key, odds);
  return odds;
}

/** U3: the chance of an outcome of a raid, with a modifier on its roll. */
function raidChance(scenario: Scenario, outcome: RaidOutcome, modifier: number): number {
  return d20Faces.filter((die) => raidResult(scenario, die + modifier) === outcome).length / d20Faces.length;
}

const scaled = (amounts: Resources, share: number): Resources => Object.fromEntries(Object.entries(amounts).map(([id, amount]) => [id, amount * share]));

/** U3: what rebuilding costs after a raid hits a building there: any of its buildings as likely, or else its highest development level. */
function rebuilding(scenario: Scenario, state: GameState, subTerritoryId: SubTerritoryId): Resources {
  const { buildings, development } = state.subTerritories[subTerritoryId] ?? { buildings: [], development: {} };
  if (buildings.length > 0) return buildings.reduce<Resources>((sum, id) => addResources(sum, scaled(scenario.index.buildings.get(id)?.cost ?? {}, 1 / buildings.length)), {});
  const [top] = Object.entries(development).filter(([, level]) => level > 0).sort((a, b) => b[1] - a[1] || compareIds(a[0], b[0]));
  return scenario.development.find((track) => track.id === top?.[0])?.upgrade.cost ?? {};
}

/** U3: what one raid on a sub-territory costs its holder on average, with a modifier on its roll: a turn's income, where the territory pays it, and what a building hit takes to rebuild. */
export function raidLoss(scenario: Scenario, state: GameState, subTerritoryId: SubTerritoryId, modifier: number): Resources {
  const site = state.subTerritories[subTerritoryId];
  const territoryId = scenario.index.subTerritories.get(subTerritoryId)?.territoryId;
  if (site === undefined || territoryId === undefined) return {};
  const income = wholeHolder(scenario, state.subTerritories, territoryId) === site.holder ? subTerritoryYield(scenario, site) : {};
  return addResources(
    scaled(income, raidChance(scenario, "income-cut", modifier)),
    scaled(rebuilding(scenario, state, subTerritoryId), raidChance(scenario, "building-hit", modifier))
  );
}

/** The turns of the profile's horizon that a unit of the type serves once it is trained: its price counts upkeep over the same horizon. */
function turnsServed({ assessment }: RecruitBoard, type: UnitTypeDefinition): number {
  return Math.max(0, assessment.profile.recruits.upkeepHorizon - (type.recruit?.trainingTurns ?? 0));
}

/** A raid's target: what a raid there costs its holder, in combat points, and the raider's chance to come back. */
export interface RaidTarget {
  readonly points: number;
  readonly survival: number;
  readonly subTerritoryId: SubTerritoryId;
}

/** The other factions' sub-territories in range of a site, the dearest to raid first. Remembered: the board does not change as orders are chosen. */
function raidTargets(board: RecruitBoard, site: TerritoryId, range: number): readonly RaidTarget[] {
  const key = `${site}|${String(range)}`;
  const known = board.raidTargets.get(key);
  if (known !== undefined) return known;
  const { assessment, scenario, state } = board;
  const targets = [...within(scenario, site, range).keys()].flatMap((territoryId) => subTerritoriesOf(scenario, territoryId).flatMap(({ id }): RaidTarget[] => {
    const holder = state.subTerritories[id]?.holder;
    if (holder === undefined || holder === assessment.factionId) return [];
    const modifier = -(board.antiAir.get(territoryId) ?? 0);
    return [{ points: board.points(raidLoss(scenario, state, id, modifier)), subTerritoryId: id, survival: 1 - raidChance(scenario, "air-eliminated", modifier) }];
  })).sort((a, b) => b.points - a.points || compareIds(a.subTerritoryId, b.subTerritoryId));
  board.raidTargets.set(key, targets);
  return targets;
}

/**
 * U3: what the raids of one more aircraft of the type based at a site are worth: one a turn while
 * it lasts, on the dearest target in range that the faction's other raiders near there leave it
 * (the mission planner sends them to different targets too, `chooseMission`).
 */
export function raidGain(board: RecruitBoard, type: UnitTypeDefinition, near: SiteBattles): number {
  if (type.air?.missions.includes("raid") !== true) return 0;
  const { air: { range } } = type;
  const others = near.all.filter((unit) => fliesOver(board.scenario, unit.type, "raid", unit.territoryId, near.site)).length;
  const target = raidTargets(board, near.site, range)[others];
  if (target === undefined) return 0;
  const raids = Array.from({ length: turnsServed(board, type) }, (_, turn) => target.survival ** turn).reduce((sum, chance) => sum + chance, 0);
  return board.assessment.profile.computer.enemyLoss * target.points * raids;
}

/** What one raid on the faction's ground in a territory costs it at most, in combat points. */
function raidCost({ assessment, points, scenario, state }: RecruitBoard, territoryId: TerritoryId, modifier: number): number {
  return Math.max(0, ...subTerritoriesOf(scenario, territoryId)
    .filter(({ id }) => state.subTerritories[id]?.holder === assessment.factionId)
    .map(({ id }) => points(raidLoss(scenario, state, id, modifier))));
}

/** The raids a turn the faction's ground in a territory can expect: each enemy raider flies one, over the faction's ground in its reach in proportion to what it would cost. */
function raidsExpected(board: RecruitBoard, territoryId: TerritoryId): number {
  const { raidThreat, scenario, state } = board;
  const known = raidThreat.get(territoryId);
  if (known !== undefined) return known;
  const costs = new Map(scenario.territories.map(({ id }) => [id, raidCost(board, id, 0)]));
  const expected = Object.values(state.units).reduce((sum, unit) => {
    const type = unitTypeIn(scenario, state.raised, unit.id);
    if (unit.factionId === board.assessment.factionId || type === undefined || !fliesOver(scenario, type, "raid", unit.territoryId, territoryId)) return sum;
    const all = [...within(scenario, unit.territoryId, type.air?.range ?? 0).keys()].reduce((total, id) => total + (costs.get(id) ?? 0), 0);
    return all > 0 ? sum + (costs.get(territoryId) ?? 0) / all : sum;
  }, 0);
  raidThreat.set(territoryId, expected);
  return expected;
}

/** The air defence of a site with one more unit of the type there: the better AA, and one more fighter on Patrol. */
export function defendedBy(near: Pick<SiteBattles, "antiAir" | "patrols">, type: UnitTypeDefinition | undefined): AirDefence {
  return {
    antiAir: Math.max(near.antiAir, antiAirRoll(type)),
    patrols: type?.air?.missions.includes("patrol") === true ? [...near.patrols, type] : near.patrols
  };
}

/** U3: what one more unit of the type saves the site from raids: what its AA or Patrol takes off each raid expected there, a turn, while it serves. */
export function raidsSpared(board: RecruitBoard, type: UnitTypeDefinition, near: SiteBattles): number {
  const [before, after] = [defendedBy(near, undefined), defendedBy(near, type)].map(({ antiAir, patrols }) => patrols.length * (board.scenario.air?.interceptRoll ?? 0) - antiAir);
  if (before === undefined || after === undefined || before === after) return 0;
  const expected = raidsExpected(board, near.site);
  if (expected === 0) return 0;
  const saved = raidCost(board, near.site, before) - raidCost(board, near.site, after);
  return board.assessment.profile.computer.ownLoss * saved * expected * turnsServed(board, type);
}
