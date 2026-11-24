import { neighborsOf, requireAiProfile, requireUnitType } from "../../engine/lookup";
import { fightingValue } from "../../engine/d20/rules";
import { recruitSiteProblem, recruitSlots, recruitableTypes, typeLock, unitBasics } from "../../engine/recruitment/rules";
import { compareIds } from "../../engine/board";
import { upkeepProblem } from "../../engine/economy/upkeep";
import { canAfford, subtractResources } from "../../engine/resources";
import { canFight, carriesOf, isTruckType, typeCanFight } from "../../engine/units/fighting";
import type { FactionId, GameState, RecruitOrder, Scenario, TerritoryId, UnitTypeDefinition } from "../../engine/types";
import { pressingRivals } from "../alarm";
import { motorPays, threatReach } from "../reach";
import { columnsPerRoll, siteBattles, worthOf } from "../unitWorth";
import type { OrderPlanner, PlanningContext } from "./planner";
import { airRecruitChoices } from "./airRecruits";
import { buildReserve } from "./build";
import { balanceLeft, starves } from "./spending";

/** Artillery-like types (`cannot-attack-alone`) are bought up to one per this many own ground units that fight (design note). */
const supportRatio = 4;
/** M1: trucks are wanted until the transport carries one in this many own ground units that fight. */
const transportRatio = 2;

interface Site {
  readonly territoryId: TerritoryId;
  /** Enemy attack value next door: how threatened the site is. */
  readonly threat: number;
}

/** Own uncontested territories where recruiting is allowed, the most threatened first, then in scenario order. */
function recruitSites(scenario: Scenario, state: GameState, factionId: FactionId): readonly Site[] {
  const enemyAttack = new Map<TerritoryId, number>();
  for (const unit of Object.values(state.units)) {
    if (unit.factionId === factionId || !canFight(scenario, state.raised, unit.id)) continue;
    enemyAttack.set(unit.territoryId, (enemyAttack.get(unit.territoryId) ?? 0) + fightingValue(scenario, state.raised, unit, "attack"));
  }
  return scenario.territories
    .filter((territory) => recruitSiteProblem(scenario, state, factionId, territory.id) === undefined)
    .map((territory, order) => ({
      order,
      territoryId: territory.id,
      threat: neighborsOf(scenario, territory.id).reduce((sum, neighbor) => sum + (enemyAttack.get(neighbor.territoryId) ?? 0), 0)
    }))
    .sort((left, right) => right.threat - left.threat || left.order - right.order);
}

/** Sites from which a unit can meet a rival near victory: next door to its ground, or in reach of its units. */
function sitesInReach(scenario: Scenario, state: GameState, rivals: ReadonlySet<FactionId>): (territoryId: TerritoryId) => boolean {
  if (rivals.size === 0) return () => false;
  const reached = new Set(Object.values(state.units)
    .filter((unit) => rivals.has(unit.factionId) && canFight(scenario, state.raised, unit.id))
    .flatMap((unit) => [...threatReach(scenario, state, unit)]));
  const holds = (territoryId: TerritoryId): boolean => {
    const control = state.control[territoryId];
    return control?.kind === "controlled" ? rivals.has(control.factionId) : control?.kind === "contested" && control.factionIds.some((id) => rivals.has(id));
  };
  return (territoryId) => reached.has(territoryId) || neighborsOf(scenario, territoryId).some((neighbor) => holds(neighbor.territoryId));
}

/** The types of the faction's units on the map and in training. */
function typesHeld({ factionId, scenario, state }: PlanningContext): readonly UnitTypeDefinition[] {
  const standing = Object.values(state.units).flatMap((unit) => {
    const type = unit.factionId === factionId ? unitBasics(scenario, state, unit.id)?.type : undefined;
    return type === undefined ? [] : [type];
  });
  const training = state.training.filter((item) => item.factionId === factionId).map((item) => requireUnitType(scenario, item.typeId));
  return [...standing, ...training];
}

const isSupport = (type: UnitTypeDefinition): boolean => type.effects.some((effect) => effect.kind === "cannot-attack-alone");

/** The resources the planned Disband orders save: a faction short of them recruits nothing that takes them this turn. */
function savedByDisbanding({ planned, scenario, state }: PlanningContext): ReadonlySet<string> {
  return new Set(planned.flatMap((order) => (order.kind === "disband" ? Object.keys(unitBasics(scenario, state, order.unitId)?.type.upkeep ?? {}) : [])));
}

/**
 * H5, R2-R4: the computer player's Recruit orders. At each allowed site, the most threatened
 * first, it fills the territory's D7 slots with the type worth most there for its price
 * (`worthOf`: its values and what its roll bonuses add to the battles near the site), so it builds
 * mixed armies where they pay; support types (artillery) stay within their ratio and one aircraft
 * a turn. While its transport carries too few of its units (M1), it first recruits one truck a turn
 * at the most threatened site that can train it and where trucks pay (`motorPays`, R5: a Motor road
 * leaves it). It spends only what the earlier planners left, less a reserve for builds and what its
 * army needs to eat (`starves`), and never what a Disband this turn saves. Anti-air and aircraft
 * come first where the site can train them (`airRecruits.ts`, m3r1-air-generals). D6: while a rival
 * is near victory there is no reserve, and units that train in one turn come first at sites from
 * which they can meet it. No random draws (CT-36).
 */
export const planRecruits: OrderPlanner<RecruitOrder> = (context) => {
  const { factionId, scenario, state } = context;
  if (scenario.recruitment === undefined || scenario.rules.recruitment === "none") return [];
  const start = balanceLeft(context);
  const pressing = pressingRivals(scenario, state, factionId, requireAiProfile(scenario, factionId));
  const hurried = sitesInReach(scenario, state, pressing);
  // M5: the profile's reserve of what builds cost, and at least the development item saved for.
  const floor = pressing.size > 0 ? {} : buildReserve(context, start);
  const saved = savedByDisbanding(context);
  const perRoll = columnsPerRoll(scenario.d20);
  let balance = start;

  const recruitable = recruitableTypes(scenario);
  const held = typesHeld(context);
  let support = held.filter(isSupport).length;
  let fighters = held.filter(typeCanFight).length;
  const carrying = held.reduce((sum, type) => sum + carriesOf(type), 0);

  const orders: RecruitOrder[] = [];
  const order = (type: UnitTypeDefinition, territoryId: TerritoryId): RecruitOrder => ({ factionId, kind: "recruit", territoryId, unitTypeId: type.id });
  const open = (type: UnitTypeDefinition, territoryId: TerritoryId): boolean => typeLock(scenario, state, factionId, territoryId, type).reasons.length === 0;
  // D1: never into a shortage: next turn's stock must cover its price, and its upkeep once it is trained.
  const spendable = (type: UnitTypeDefinition, territoryId: TerritoryId): boolean =>
    type.recruit !== undefined && canAfford(subtractResources(balance, floor), type.recruit.cost)
    && ![...Object.keys(type.recruit.cost), ...Object.keys(type.upkeep)].some((id) => saved.has(id))
    && upkeepProblem(scenario, state, factionId, [...context.planned, ...orders, order(type, territoryId)]) === undefined
    && !starves(context, [...context.planned, ...orders], order(type, territoryId));
  const take = (type: UnitTypeDefinition, territoryId: TerritoryId): void => {
    balance = subtractResources(balance, type.recruit?.cost ?? {});
    orders.push(order(type, territoryId));
    if (isSupport(type)) support += 1;
    if (typeCanFight(type)) fighters += 1;
  };
  const sites = recruitSites(scenario, state, factionId);
  // M1: one truck a turn, while the faction's transport (trucks and tanks) carries too few of its units.
  if (carrying * transportRatio < fighters) {
    for (const { territoryId } of sites) {
      const transport = recruitable.find((type) => isTruckType(type) && open(type, territoryId) && spendable(type, territoryId));
      // R5: only where a Motor road leaves the site; elsewhere trucks carry nothing.
      if (transport === undefined || recruitSlots(scenario, state, territoryId) === 0 || !motorPays(scenario, state, factionId, territoryId)) continue;
      take(transport, territoryId);
      break;
    }
  }
  // At most one aircraft a turn across the faction.
  const inTurn = (type: UnitTypeDefinition): boolean => type.air === undefined || !orders.some((entry) => scenario.index.unitTypes.get(entry.unitTypeId)?.air !== undefined);
  for (const { territoryId } of sites) {
    const trainable = recruitable.filter((type) => open(type, territoryId));
    const fighting = trainable.filter((type) => typeCanFight(type) || type.effects.some((effect) => effect.kind === "battle-support"));
    // U1-U3 (m3r1-air-generals): anti-air and aircraft first, where the site can train them.
    const air = airRecruitChoices(scenario, state, factionId, territoryId, trainable.filter((type) => type.air !== undefined || type.effects.some((effect) => effect.kind === "raid-defence")));
    for (let slot = orders.filter((entry) => entry.territoryId === territoryId).length; slot < recruitSlots(scenario, state, territoryId); slot += 1) {
      const battles = siteBattles(scenario, state, factionId, territoryId, orders, perRoll);
      const ranked = fighting
        .map((type) => ({ type, worth: worthOf(scenario, type, start, battles) }))
        .sort((left, right) => right.worth - left.worth || compareIds(left.type.id, right.type.id))
        .map(({ type }) => type)
        .filter((type) => inTurn(type) && (!isSupport(type) || support * supportRatio < fighters));
      const quick = hurried(territoryId) ? ranked.filter((type) => type.recruit?.trainingTurns === 1) : [];
      const special = air.filter((type) => inTurn(type) && !orders.some((entry) => entry.territoryId === territoryId && entry.unitTypeId === type.id));
      const choice = [...quick, ...special, ...ranked].find((type) => spendable(type, territoryId));
      if (choice === undefined) break;
      take(choice, territoryId);
    }
  }
  return orders;
};
