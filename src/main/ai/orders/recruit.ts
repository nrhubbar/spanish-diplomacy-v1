import { armyValue } from "../../engine/combat";
import { neighborsOf, requireUnitDefinition } from "../../engine/lookup";
import { recruitSiteProblem, recruitSlots, recruitableTypes, typeLock } from "../../engine/recruitment/rules";
import { canAfford, scaleResources, subtractResources } from "../../engine/resources";
import type { FactionId, GameState, RecruitOrder, ResourceId, Resources, Scenario, TerritoryId, UnitState, UnitTypeDefinition } from "../../engine/types";
import type { OrderPlanner } from "./planner";
import { balanceLeft } from "./spending";

/**
 * Design notes for the harness to tune (H7). The share of each resource the Recruit planner
 * leaves unspent for the Build planner, which runs after it; a type's price counts each
 * resource against the faction's balance of it, so the scarcer resource weighs more; and each
 * turn of training lowers a type's worth a little, so a threatened front prefers quicker units.
 */
const reserveShare = 0.3;
const trainingDrag = 0.15;
/** Artillery-like types (`cannot-attack-alone`) are wanted up to one per this many own ground units. */
const supportRatio = 4;

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
 * adding one support type (artillery) when the faction has too few. It spends only what the
 * earlier planners left, less a reserve for builds. Air types are left to the air planner's
 * stream (TODO(m3r1-air-generals): recruit aircraft where airfields stand). No random draws (CT-36).
 */
export const planRecruits: OrderPlanner<RecruitOrder> = (context) => {
  const { factionId, scenario, state } = context;
  if (scenario.recruitment === undefined || scenario.rules.recruitment === "none") return [];
  const start = balanceLeft(context);
  const floor = scaleResources(start, reserveShare);
  let balance = start;
  const spendable = (price: Resources): boolean => canAfford(subtractResources(balance, floor), price);

  const ground = recruitableTypes(scenario).filter((type) => type.kind === "ground" && type.attack + type.defence > 0);
  const own = Object.values(state.units).filter((unit) => unit.factionId === factionId);
  const typeOf = (unit: UnitState): UnitTypeDefinition | undefined => scenario.index.unitTypes.get(requireUnitDefinition(scenario, unit.id).type);
  let support = own.filter((unit) => typeOf(unit)?.effects.some((effect) => effect.kind === "cannot-attack-alone") ?? false).length;
  let groundCount = own.length;

  const orders: RecruitOrder[] = [];
  for (const site of recruitSites(scenario, state, factionId)) {
    const open = ground
      .filter((type) => typeLock(scenario, state, factionId, site.territoryId, type).reasons.length === 0)
      .sort((left, right) => worth(right, start) - worth(left, start) || left.id.localeCompare(right.id));
    if (open.length === 0) continue;
    for (let slot = 0; slot < recruitSlots(scenario, state, site.territoryId); slot += 1) {
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
