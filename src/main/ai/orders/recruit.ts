import { compareIds } from "../../engine/board";
import { armyValue } from "../../engine/combat";
import { neighborsOf, requireUnitDefinition } from "../../engine/lookup";
import { recruitSiteProblem, recruitSlots, recruitableTypes, typeLock } from "../../engine/recruitment/rules";
import { canAfford, subtractResources } from "../../engine/resources";
import type { FactionId, GameState, RecruitOrder, ResourceId, Resources, Scenario, TerritoryId, UnitState, UnitTypeDefinition } from "../../engine/types";
import type { OrderPlanner } from "./planner";
import { airRecruitChoices } from "./airRecruits";
import { buildReserve } from "./build";
import { balanceLeft } from "./spending";

/**
 * Design notes for the harness to tune (H7). A type's price counts each resource against the
 * faction's balance of it, so the scarcer resource weighs more; and each turn of training lowers
 * a type's worth a little, so a threatened front prefers quicker units. What the planner leaves
 * for the Build planner, which runs after it, is the profile's (`buildReserve`, M5).
 */
const trainingDrag = 0.15;
/** Artillery-like types (`cannot-attack-alone`) are wanted up to one per this many own ground units. */
const supportRatio = 4;
/** M1: transport (trucks) is wanted until it carries one in this many own ground units. */
const transportRatio = 2;

/** M1: the units a type carries (`transport` effects); 0 for every other type. */
function carriesOf(type: UnitTypeDefinition | undefined): number {
  return (type?.effects ?? []).reduce((sum, effect) => sum + (effect.kind === "transport" ? effect.carries : 0), 0);
}

interface Site {
  readonly territoryId: TerritoryId;
  /** Enemy attack value next door: how threatened the site is. */
  readonly threat: number;
}

/** Own uncontested territories where recruiting is allowed, the most threatened first, then in scenario order. */
function recruitSites(scenario: Scenario, state: GameState, factionId: FactionId): readonly Site[] {
  const enemyAttack = new Map<TerritoryId, number>();
  for (const unit of Object.values(state.units)) {
    if (unit.factionId !== factionId) enemyAttack.set(unit.territoryId, (enemyAttack.get(unit.territoryId) ?? 0) + armyValue(scenario, unit, "attack"));
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

/** Combat value per price, each resource counted as a share of the balance, lowered for long training. */
function worth(type: UnitTypeDefinition, balance: Resources): number {
  const recruit = type.recruit;
  if (recruit === undefined) return 0;
  const price = (Object.entries(recruit.cost) as [ResourceId, number][]).reduce((sum, [id, amount]) => sum + amount / Math.max(1, balance[id] ?? 0), 0);
  return (type.attack + type.defence) / Math.max(0.01, price) / (1 + trainingDrag * recruit.trainingTurns);
}

/**
 * H5, R2-R4: the computer player's Recruit orders. At each allowed site, the most threatened
 * first, it fills the territory's D7 slots with the best ground type the capital can train,
 * adding one support type (artillery) when the faction has too few. While its trucks carry too
 * few of its units (M1), it first recruits one transport type a turn at the most threatened
 * site that can train it. It spends only what the
 * earlier planners left, less a reserve for builds. Anti-air and aircraft come first where the
 * site can train them (`airRecruits.ts`, m3r1-air-generals). No random draws (CT-36).
 */
export const planRecruits: OrderPlanner<RecruitOrder> = (context) => {
  const { factionId, scenario, state } = context;
  if (scenario.recruitment === undefined || scenario.rules.recruitment === "none") return [];
  const start = balanceLeft(context);
  // M5: the profile's reserve of what builds cost, and at least the development item saved for.
  const floor = buildReserve(context, start);
  let balance = start;
  const spendable = (price: Resources): boolean => canAfford(subtractResources(balance, floor), price);

  const ground = recruitableTypes(scenario).filter((type) => type.kind === "ground" && (type.attack + type.defence > 0 || carriesOf(type) > 0));
  const own = Object.values(state.units).filter((unit) => unit.factionId === factionId);
  const typeOf = (unit: UnitState): UnitTypeDefinition | undefined => scenario.index.unitTypes.get(requireUnitDefinition(scenario, unit.id).type);
  let support = own.filter((unit) => typeOf(unit)?.effects.some((effect) => effect.kind === "cannot-attack-alone") ?? false).length;
  let groundCount = own.length;
  const carrying = own.reduce((sum, unit) => sum + carriesOf(typeOf(unit)), 0);

  const orders: RecruitOrder[] = [];
  const sites = recruitSites(scenario, state, factionId);
  const trainable = (territoryId: TerritoryId): readonly UnitTypeDefinition[] => ground.filter((type) => typeLock(scenario, state, factionId, territoryId, type).reasons.length === 0);
  // M1: one transport type a turn, while the faction's trucks carry too few of its units.
  if (carrying * transportRatio < groundCount) {
    for (const site of sites) {
      const transport = trainable(site.territoryId).find((type) => carriesOf(type) > 0 && type.recruit !== undefined && spendable(type.recruit.cost));
      if (transport?.recruit === undefined || recruitSlots(scenario, state, site.territoryId) === 0) continue;
      balance = subtractResources(balance, transport.recruit.cost);
      orders.push({ factionId, kind: "recruit", territoryId: site.territoryId, unitTypeId: transport.id });
      groundCount += 1;
      break;
    }
  }
  for (const site of sites) {
    const open = trainable(site.territoryId)
      .filter((type) => carriesOf(type) === 0)
      .sort((left, right) => worth(right, start) - worth(left, start) || compareIds(left.id, right.id));
    // U1-U3 (m3r1-air-generals): anti-air and aircraft first, where the site can train them.
    const air = airRecruitChoices(scenario, state, factionId, site.territoryId, recruitableTypes(scenario)
      .filter((type) => (type.air !== undefined || type.effects.some((effect) => effect.kind === "raid-defence")) && typeLock(scenario, state, factionId, site.territoryId, type).reasons.length === 0));
    if (open.length === 0 && air.length === 0) continue;
    for (let slot = orders.filter((order) => order.territoryId === site.territoryId).length; slot < recruitSlots(scenario, state, site.territoryId); slot += 1) {
      const airChoice = air.find((type) => type.recruit !== undefined && spendable(type.recruit.cost) && !orders.some((order) => order.territoryId === site.territoryId && order.unitTypeId === type.id)
        // At most one aircraft a turn across the faction.
        && !(type.air !== undefined && orders.some((order) => scenario.index.unitTypes.get(order.unitTypeId)?.air !== undefined)));
      if (airChoice?.recruit !== undefined) {
        balance = subtractResources(balance, airChoice.recruit.cost);
        orders.push({ factionId, kind: "recruit", territoryId: site.territoryId, unitTypeId: airChoice.id });
        continue;
      }
      const wantsSupport = support * supportRatio < groundCount;
      const supportType = wantsSupport ? open.find((type) => type.effects.some((effect) => effect.kind === "cannot-attack-alone")) : undefined;
      const choice = [supportType, ...open.filter((type) => !type.effects.some((effect) => effect.kind === "cannot-attack-alone"))]
        .find((type): type is UnitTypeDefinition => type?.recruit !== undefined && spendable(type.recruit.cost));
      if (choice?.recruit === undefined) break;
      balance = subtractResources(balance, choice.recruit.cost);
      orders.push({ factionId, kind: "recruit", territoryId: site.territoryId, unitTypeId: choice.id });
      groundCount += 1;
      if (choice === supportType) support += 1;
    }
  }
  return orders;
};
