import { neighborsOf, requireAiProfile, requireUnitType } from "../../engine/lookup";
import { fightingValue } from "../../engine/d20/rules";
import { recruitSiteProblem, recruitSlots, recruitableTypes, typeLock, unitBasics } from "../../engine/recruitment/rules";
import { compareIds } from "../../engine/board";
import { upkeepProblem } from "../../engine/economy/upkeep";
import { canAfford, subtractResources } from "../../engine/resources";
import { canFight, carriesOf, isTruckType, typeCanFight } from "../../engine/units/fighting";
import type { FactionId, GameState, RecruitOrder, Resources, Scenario, TerritoryId, UnitId, UnitTypeDefinition } from "../../engine/types";
import { fliesOver } from "../airWorth";
import { pressingRivals } from "../alarm";
import { assess } from "../assessment";
import { tripsMade } from "../memory";
import { movePlanningView } from "../planningView";
import { motorPays, threatReach } from "../reach";
import { isFootType, type RecruitBoard, recruitBoard, recruitSupply, siteBattles, worthOf } from "../unitWorth";
import type { OrderPlanner, PlanningContext } from "./planner";
import { buildReserve } from "./build";
import { balanceLeft, starves } from "./spending";

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

/** The sites the units of a rival near victory can reach this turn. */
function sitesInReach(scenario: Scenario, state: GameState, rivals: ReadonlySet<FactionId>): ReadonlySet<TerritoryId> {
  if (rivals.size === 0) return new Set();
  return new Set(Object.values(state.units)
    .filter((unit) => rivals.has(unit.factionId) && canFight(scenario, state.raised, unit.id))
    .flatMap((unit) => [...threatReach(scenario, state, unit)]));
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

/** Own units the faction has or will have, by territory: on the map, in training and ordered this turn. */
function typesAt(board: RecruitBoard, scenario: Scenario, ordered: readonly RecruitOrder[]): ReadonlyMap<TerritoryId, readonly UnitTypeDefinition[]> {
  const types = new Map<TerritoryId, UnitTypeDefinition[]>();
  const add = (territoryId: TerritoryId, type: UnitTypeDefinition): void => { types.set(territoryId, [...(types.get(territoryId) ?? []), type]); };
  for (const unit of board.own) add(unit.territoryId, unit.type);
  for (const order of ordered) add(order.territoryId, requireUnitType(scenario, order.unitTypeId));
  return types;
}

/**
 * M1, R5: whether the faction has trucks to spare: somewhere they carry more than the foot there
 * that a Motor road lets them carry, or one carried no foot last turn. A truck carries foot on a trip of
 * two territories, the only one that needs it; one that finished training last turn had no trip to make.
 */
function trucksIdle({ factionId, memory, scenario, state }: PlanningContext, board: RecruitBoard, ordered: readonly RecruitOrder[]): boolean {
  for (const [territoryId, types] of typesAt(board, scenario, ordered)) {
    const capacity = types.filter(isTruckType).reduce((sum, type) => sum + carriesOf(type), 0);
    if (capacity > 0 && capacity > (motorPays(scenario, state, factionId, territoryId) ? types.filter(isFootType).length : 0)) return true;
  }
  const outcomes = memory.previousOutcomes;
  if (outcomes === undefined) return false;
  const trained = new Set(outcomes.flatMap((outcome) => (outcome.kind === "training-completed" ? [outcome.unitId] : [])));
  const trips = tripsMade(outcomes, factionId).filter(({ from, to }) => !neighborsOf(scenario, from).some((neighbor) => neighbor.territoryId === to));
  const typeOf = (unitId: UnitId): UnitTypeDefinition | undefined => unitBasics(scenario, state, unitId)?.type;
  const carried = (truck: UnitId): boolean => trips.some((trip) => trip.unitId === truck
    && trips.some((other) => { const type = typeOf(other.unitId); return other.from === trip.from && other.to === trip.to && type !== undefined && isFootType(type); }));
  return Object.values(state.units).some((unit) => {
    const type = unit.factionId === factionId && !trained.has(unit.id) ? typeOf(unit.id) : undefined;
    return type !== undefined && isTruckType(type) && !carried(unit.id);
  });
}

/** The resources the planned Disband orders save: a faction short of them recruits nothing that takes them this turn. */
function savedByDisbanding({ planned, scenario, state }: PlanningContext): ReadonlySet<string> {
  return new Set(planned.flatMap((order) => (order.kind === "disband" ? Object.keys(unitBasics(scenario, state, order.unitId)?.type.upkeep ?? {}) : [])));
}

/**
 * H5, R2-R4: the computer player's Recruit orders. At each allowed site, the most threatened
 * first, it fills the territory's D7 slots with the type worth most there for its price
 * (`worthOf`: what one more of it changes in the battles near the site, the raids it flies or
 * spares, the foot it carries), and with none where nothing would; support types (artillery) stay
 * within the profile's ratio, and it takes at most the profile's aircraft and trucks a turn (one
 * each), no truck while one is idle (`trucksIdle`). A recon flight changes no battle: it takes one
 * when it has none and nothing else it can afford is worth anything. It spends only what the
 * earlier planners left, less a reserve for builds and what its army needs to eat (`starves`), and
 * never what a Disband this turn saves. D6: while a rival is near victory there is no reserve, and
 * units that train in one turn come first at sites it can reach and would take with at least the
 * profile's `quickTakeChance`. No random draws (CT-36).
 */
export const planRecruits: OrderPlanner<RecruitOrder> = (context) => {
  const { factionId, scenario, state } = context;
  if (scenario.recruitment === undefined || scenario.rules.recruitment === "none") return [];
  const profile = requireAiProfile(scenario, factionId);
  const start = balanceLeft(context);
  const pressing = pressingRivals(scenario, state, factionId, profile);
  const hurried = sitesInReach(scenario, state, pressing);
  // M5: the profile's reserve of what builds cost, and at least the development item saved for.
  const floor = pressing.size > 0 ? {} : buildReserve(context, start);
  const saved = savedByDisbanding(context);
  // The stakes are read from the ground board, as the move planner reads them, and remembered with it.
  const board = recruitBoard(scenario, state, assess(scenario, movePlanningView(scenario, state, factionId), factionId), context.planned);
  // What is left to spend, read again as orders are taken: a resource grows dearer as they use it up.
  const supplyLeft = (): Resources => recruitSupply(scenario, state, board.assessment, [...context.planned, ...orders]);
  let balance = start;

  // A type the profile counts for nothing is never recruited, whatever it would be recruited for.
  const recruitable = recruitableTypes(scenario).filter((type) => profile.recruits.typeWorth?.[type.id] !== 0);
  const held = typesHeld(context);
  let support = held.filter(isSupport).length;
  let fighters = held.filter(typeCanFight).length;

  const orders: RecruitOrder[] = [];
  const order = (type: UnitTypeDefinition, territoryId: TerritoryId): RecruitOrder => ({ factionId, kind: "recruit", territoryId, unitTypeId: type.id });
  const open = (type: UnitTypeDefinition, territoryId: TerritoryId): boolean => typeLock(scenario, state, factionId, territoryId, type).refusals.length === 0;
  // D1: never into a shortage: next turn's stock must cover its price, and its upkeep once it is trained.
  const spendable = (type: UnitTypeDefinition, territoryId: TerritoryId): boolean =>
    type.recruit !== undefined && fighters < (profile.recruits.maxUnits ?? Number.POSITIVE_INFINITY) && canAfford(subtractResources(balance, floor), type.recruit.cost)
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
  // At most the profile's aircraft and trucks a turn (one each) across the faction.
  const ordered = (test: (type: UnitTypeDefinition) => boolean): number => orders.filter((entry) => test(requireUnitType(scenario, entry.unitTypeId))).length;
  const flies = (type: UnitTypeDefinition): boolean => type.air !== undefined;
  const inTurn = (type: UnitTypeDefinition): boolean => (!flies(type) || ordered(flies) < (profile.recruits.aircraftPerTurn ?? 1))
    && (!isTruckType(type) || ordered(isTruckType) < (profile.recruits.trucksPerTurn ?? 1));
  const slotsLeft = (territoryId: TerritoryId): number => recruitSlots(scenario, state, territoryId) - orders.filter((entry) => entry.territoryId === territoryId).length;
  for (const { territoryId } of sites) {
    const trainable = recruitable.filter((type) => open(type, territoryId));
    while (slotsLeft(territoryId) > 0) {
      const near = siteBattles(board, territoryId, orders);
      const supply = supplyLeft();
      const ranked = trainable
        .filter((type) => inTurn(type) && (!isSupport(type) || support * profile.recruits.fightersPerSupport < fighters))
        .map((type) => ({ type, worth: worthOf(board, type, supply, near) }))
        .filter(({ type, worth }) => worth > 0 && !(isTruckType(type) && trucksIdle(context, board, orders)))
        .sort((left, right) => right.worth - left.worth || compareIds(left.type.id, right.type.id))
        .map(({ type }) => type);
      // D6: a quick defender comes first only where the rival in reach would likely take the site.
      const falling = hurried.has(territoryId) && board.assessment.danger(territoryId, near.ready) >= profile.recruits.quickTakeChance;
      const quick = falling ? ranked.filter((type) => typeCanFight(type) && type.recruit?.trainingTurns === 1) : [];
      const choice = [...quick, ...ranked].find((type) => spendable(type, territoryId));
      if (choice === undefined) break;
      take(choice, territoryId);
    }
  }
  // U2, H5: a recon flight wins no battle, so it comes last: one, where there are enemies to look at.
  const looks = (type: UnitTypeDefinition): boolean => type.air?.missions.includes("recon") === true;
  if (!held.some(looks) && ordered(flies) === 0) {
    const enemies = Object.values(state.units).filter((unit) => unit.factionId !== factionId);
    const recon = sites.filter(({ territoryId }) => slotsLeft(territoryId) > 0).flatMap(({ territoryId }) => recruitable
      .filter((type) => looks(type) && open(type, territoryId) && spendable(type, territoryId) && enemies.some((unit) => fliesOver(scenario, type, "recon", territoryId, unit.territoryId)))
      .map((type) => ({ territoryId, type })))[0];
    if (recon !== undefined) take(recon.type, recon.territoryId);
  }
  return orders;
};
