import { applyBuildOrder, isCapital, projectCost, queuedLevel, siteRefusal, validateBuildOrder } from "../../engine/economy/catalogue";
import { holdersIn, subTerritoriesOf, territoriesHeldWhole } from "../../engine/economy/holdings";
import { amountOf, treasuryOf } from "../../engine/economy/resources";
import { requireAiProfile } from "../../engine/lookup";
import type {
  BuildOrder,
  BuildProject,
  FactionId,
  GameState,
  ResourceId,
  Resources,
  Scenario,
  SubTerritoryDefinition,
  TerritoryId
} from "../../engine/types";
import type { OrderPlanner, PlanningContext } from "./planner";
import { balanceLeft } from "./spending";

/**
 * H5: the computer player's Build orders ($3-$5, $8). It builds only in territories it holds
 * whole (queues pause in contested ground) and only where a sub-territory's queue is empty. Its
 * profile's `builds` budget (EB-15, L27) sets the share of what the earlier planners (Recruit)
 * left that it may spend, the orders a turn, and the new items per empty queue. In priority order:
 * - repair rail lost to fighting ($8);
 * - buildings that unlock unit types at a capital (Barracks, then Factory and the rest);
 * - Fortifications (any `defence-roll` building) at the front;
 * - development of the resource it has least of, best yield for the price first;
 * - anything else, only when rich.
 * It never draws from the tie-break source: ties go by scenario order.
 */

interface Candidate {
  readonly order: BuildOrder;
  readonly score: number;
}

export const planBuilds: OrderPlanner<BuildOrder> = (context) => {
  const { factionId, scenario, state } = context;
  const limits = requireAiProfile(scenario, factionId).builds;
  if (scenario.rules.economy === "none" || limits === undefined || state.treasuries[factionId] === undefined) return [];
  const left = balanceLeft(context);
  const budget = scaleBalance(scenario, left, limits.spendShare);
  const candidates = [...candidatesFor(context)].sort((a, b) => b.score - a.score);

  const chosen: BuildOrder[] = [];
  let ledger: GameState = { ...state, treasuries: { ...state.treasuries, [factionId]: budget } };
  const used = new Map<string, number>();
  for (const { order } of candidates) {
    if (chosen.length >= limits.maxOrdersPerTurn) break;
    const items = used.get(order.subTerritoryId) ?? 0;
    if (items >= limits.itemsPerEmptyQueue || !validateBuildOrder(scenario, state, order).ok) continue;
    const applied = applyBuildOrder(scenario, ledger, order);
    if (!applied.ok) continue;
    ledger = applied.state;
    used.set(order.subTerritoryId, items + 1);
    chosen.push(order);
  }
  return chosen;
};

/** The balance with every resource scaled down by `share` (whole numbers, rounded down), never below 0. */
function scaleBalance(scenario: Scenario, balance: Resources, share: number): Resources {
  return Object.fromEntries(scenario.resources.map((resource) => [resource.id, Math.max(0, Math.floor(amountOf(balance, resource.id) * share))]));
}

function candidatesFor(context: PlanningContext): readonly Candidate[] {
  const { factionId, scenario, state } = context;
  const front = frontTerritories(scenario, state, factionId);
  const scarce = scarcestResource(scenario, state, factionId);
  const candidates: Candidate[] = [];
  for (const territoryId of territoriesHeldWhole(scenario, state.subTerritories, factionId)) {
    for (const sub of subTerritoriesOf(scenario, territoryId)) {
      const site = state.subTerritories[sub.id];
      if (site === undefined || site.queue.length > 0) continue;
      for (const project of projectsFor(scenario)) {
        if (siteRefusal(scenario, state, factionId, sub.id, project) !== undefined) continue;
        const score = scoreOf(scenario, state, factionId, sub, project, { front: front.has(territoryId), scarce });
        if (score > 0) candidates.push({ order: { factionId, kind: "build", project, subTerritoryId: sub.id }, score });
      }
    }
  }
  return candidates;
}

function projectsFor(scenario: Scenario): readonly BuildProject[] {
  return [
    ...scenario.buildings.map((building): BuildProject => ({ buildingId: building.id, kind: "building" })),
    ...scenario.development.map((track): BuildProject => ({ developmentId: track.id, kind: "development" })),
    ...(scenario.improvements === undefined ? [] : [{ improvement: "rail", kind: "improvement" } as const])
  ];
}

/** Territories the faction holds whole that border ground another faction holds any of. */
function frontTerritories(scenario: Scenario, state: GameState, factionId: FactionId): ReadonlySet<TerritoryId> {
  const front = new Set<TerritoryId>();
  for (const territoryId of territoriesHeldWhole(scenario, state.subTerritories, factionId)) {
    const neighbours = scenario.index.neighbors.get(territoryId) ?? [];
    if (neighbours.some((neighbour) => holdersIn(scenario, state.subTerritories, neighbour.territoryId).some((holder) => holder !== factionId))) front.add(territoryId);
  }
  return front;
}

/** The resource the faction holds least of, measured against what the scenario's recruits cost. */
function scarcestResource(scenario: Scenario, state: GameState, factionId: FactionId): ResourceId | undefined {
  const balance = treasuryOf(state, factionId);
  let scarcest: ResourceId | undefined;
  let lowest = Number.POSITIVE_INFINITY;
  for (const resource of scenario.resources) {
    const demand = scenario.unitTypes.reduce((sum, type) => sum + amountOf(type.recruit?.cost ?? {}, resource.id), 0);
    if (demand === 0) continue;
    const cover = amountOf(balance, resource.id) / demand;
    if (cover < lowest) {
      lowest = cover;
      scarcest = resource.id;
    }
  }
  return scarcest;
}

function scoreOf(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  sub: SubTerritoryDefinition,
  project: BuildProject,
  where: { readonly front: boolean; readonly scarce: ResourceId | undefined }
): number {
  const site = state.subTerritories[sub.id];
  const cost = projectCost(scenario, project);
  if (site === undefined || cost === undefined) return 0;
  const price = Math.max(1, Object.values(cost.cost).reduce((sum, value) => sum + value, 0));
  switch (project.kind) {
    case "improvement":
      // $8: a repair back to the 1936 level; new rail only when rich (score 0 here).
      return queuedLevel(site, project) < sub.rail ? 30 : 0;
    case "development": {
      const track = scenario.index.development.get(project.developmentId);
      if (track === undefined) return 0;
      const value = (10 * track.yieldPerLevel) / price;
      return track.resource === where.scarce ? value * 2 : value;
    }
    case "building": {
      const building = scenario.index.buildings.get(project.buildingId);
      if (building === undefined) return 0;
      if (building.effects.some((effect) => effect.kind === "defence-roll")) return where.front ? 6 : 0;
      if (!isCapital(scenario, sub)) return 0;
      return unlockScore(scenario, factionId, site.buildings, project.buildingId);
    }
  }
}

/**
 * R3: how much a building opens up at a capital: 4 for each recruitable type it completes, 1 for
 * each it brings closer.
 */
function unlockScore(scenario: Scenario, factionId: FactionId, standing: readonly string[], buildingId: string): number {
  let score = 0;
  for (const type of scenario.unitTypes) {
    const recruit = type.recruit;
    if (recruit === undefined || (recruit.factionIds !== undefined && !recruit.factionIds.includes(factionId))) continue;
    const missing = recruit.requires.filter((id) => !standing.includes(id));
    if (!missing.includes(buildingId as never)) continue;
    score += missing.length === 1 ? 4 : 1;
  }
  return score;
}
