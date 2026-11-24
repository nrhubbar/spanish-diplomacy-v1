import { allProjects, applyBuildOrder, isCapital, projectCost, projectKey, queuedLevel, sameProject, siteRefusal, validateBuildOrder } from "../../engine/economy/catalogue";
import { holdersIn, subTerritoriesOf, territoriesHeldWhole } from "../../engine/economy/holdings";
import { amountOf, treasuryOf } from "../../engine/economy/resources";
import { requireAiProfile } from "../../engine/lookup";
import { meetsRequirement } from "../../engine/recruitment/rules";
import { addResources, subtractResources } from "../../engine/resources";
import type {
  BuildOrder,
  SiteProject,
  BuildingDefinition,
  BuildingEffect,
  DevelopmentId,
  FactionId,
  GameState,
  RecruitRequirement,
  ResourceId,
  Resources,
  Scenario,
  SubTerritoryDefinition,
  TerritoryId
} from "../../engine/types";
import type { OrderPlanner, PlanningContext } from "./planner";
import { linkWorkCandidate } from "./linkWorks";
import { balanceLeft, starves } from "./spending";

/**
 * H5: the computer player's Build orders ($3-$5, $8). It builds only in territories it holds
 * whole (queues pause in contested ground) and only where a sub-territory's queue is empty. Its
 * profile's `builds` budget (EB-15, L27) sets the share of what the earlier planners (Recruit)
 * left that it may spend, the orders a turn, and the new items per empty queue. In priority order:
 * - repair rail lost to fighting ($8);
 * - M5: while the faction has fewer development items (Farms, Mines, Factory) in its queues
 *   than its profile's `developmentProjects`, the best one: the Recruit planner saves its price
 *   (`buildReserve`), and it may spend everything Recruit left;
 * - what unlocks unit types: a building at a capital (Barracks and the rest), or the first level of
 *   a development track in the territory (Factory). These never take the order or the site the
 *   development target needs;
 * - m4: Fortifications (a `defence-roll` building) in the capital of a front territory that has
 *   none built or queued, since only the strongest counts, once per battle;
 * - more development: best yield for the price, the scarcest resource first;
 * - m5: then, while the budget lasts, a Hospital at a front capital, a Rail yard at a capital
 *   with rail (each once per territory), more rail at a capital, and a better port where one is;
 * - R7: one link work (a new rail line, a rail or road upgrade) when it opens routes the armies
 *   would use, scored by the routes it opens for its price (`linkWorks.ts`).
 * It never draws from the tie-break source: ties go by scenario order.
 */

interface Candidate {
  readonly order: BuildOrder;
  readonly score: number;
}

/** Design notes for the harness to tune (H7): the priorities above, as scores. The development target outranks every unlock. */
const scores = { development: 12, developmentTarget: 25, fortifications: 6, improvement: 1, railRepair: 30, support: 1.5 } as const;

type Where = Pick<PlanningContext, "factionId" | "scenario" | "state">;

export const planBuilds: OrderPlanner<BuildOrder> = (context) => {
  const { factionId, scenario, state } = context;
  const limits = requireAiProfile(scenario, factionId).builds;
  if (scenario.rules.economy === "none" || limits === undefined || state.treasuries[factionId] === undefined) return [];
  const left = balanceLeft(context);
  const budget = scaleBalance(scenario, left, limits.spendShare);
  // The share of what Recruit left that only the development target may spend.
  const saved = subtractResources(left, budget);
  const target = developmentTarget(context);
  // R7: at most one link work, and only one that opens a route (`linkWorks.ts`).
  const link = linkWorkCandidate(context, frontTerritories(scenario, state, factionId), budget);
  const candidates = [...candidatesFor(context, target?.order), ...(link === undefined ? [] : [link])].sort((a, b) => b.score - a.score);

  const chosen: BuildOrder[] = [];
  let ledger: GameState = { ...state, treasuries: { ...state.treasuries, [factionId]: budget } };
  const used = new Map<string, number>();
  for (const { order } of candidates) {
    if (chosen.length >= limits.maxOrdersPerTurn) break;
    const items = used.get(order.subTerritoryId) ?? 0;
    if (items >= limits.itemsPerEmptyQueue || !validateBuildOrder(scenario, state, order).ok) continue;
    const isTarget = order === target?.order;
    const applied = applyBuildOrder(scenario, isTarget ? withBalance(ledger, factionId, addResources(treasuryOf(ledger, factionId), saved)) : ledger, order);
    if (!applied.ok || starves(context, [...context.planned, ...chosen], order)) continue;
    ledger = isTarget ? withBalance(applied.state, factionId, subtractResources(treasuryOf(applied.state, factionId), saved)) : applied.state;
    used.set(order.subTerritoryId, items + 1);
    chosen.push(order);
  }
  return chosen;
};

function withBalance(state: GameState, factionId: FactionId, balance: Resources): GameState {
  return { ...state, treasuries: { ...state.treasuries, [factionId]: balance } };
}

/** The balance with every resource scaled down by `share` (whole numbers, rounded down), never below 0. */
function scaleBalance(scenario: Scenario, balance: Resources, share: number): Resources {
  return Object.fromEntries(scenario.resources.map((resource) => [resource.id, Math.max(0, Math.floor(amountOf(balance, resource.id) * share))]));
}

/** Development items the faction has in its own queues. */
function developmentQueued(state: GameState, factionId: FactionId): number {
  return Object.values(state.subTerritories).reduce((sum, site) => sum + site.queue.filter((item) => item.factionId === factionId && item.project.kind === "development").length, 0);
}

/**
 * M5: the development item the faction saves for this turn: its best-scoring Farms, Mines or
 * Factory level that may be queued now, while it has fewer development items queued than its
 * profile's `developmentProjects`. Undefined when it has enough, or nowhere to develop.
 */
export function developmentTarget(context: Where): { readonly order: BuildOrder; readonly price: Resources } | undefined {
  const { factionId, scenario, state } = context;
  const limits = requireAiProfile(scenario, factionId).builds;
  if (scenario.rules.economy === "none" || limits === undefined || state.treasuries[factionId] === undefined) return undefined;
  if (developmentQueued(state, factionId) >= limits.developmentProjects) return undefined;
  let best: Candidate | undefined;
  for (const candidate of candidatesFor(context, undefined)) {
    if (candidate.order.project.kind === "development" && (best === undefined || candidate.score > best.score)) best = candidate;
  }
  const price = best === undefined ? undefined : projectCost(scenario, best.order.project)?.cost;
  return best === undefined || price === undefined ? undefined : { order: best.order, price };
}

/**
 * M5: what the Recruit planner leaves unspent for builds: the profile's `reserveShare` of each
 * resource some build costs, and at least the price of this turn's development target while that price is at most the
 * profile's `developmentShare` of the balance.
 */
export function buildReserve(context: Where, balance: Resources): Resources {
  const { factionId, scenario, state } = context;
  const limits = requireAiProfile(scenario, factionId).builds;
  if (scenario.rules.economy === "none" || limits === undefined || state.treasuries[factionId] === undefined) return {};
  const used = new Set(allProjects(scenario).flatMap((project) => Object.keys(projectCost(scenario, project)?.cost ?? {})));
  const price = developmentTarget(context)?.price ?? {};
  // Saved for only while it takes at most `developmentShare` of the balance: a poor faction recruits first.
  const affordable = Object.entries(price).every(([id, amount]) => amount <= amountOf(balance, id as ResourceId) * limits.developmentShare);
  return Object.fromEntries(scenario.resources.filter((resource) => used.has(resource.id)).map((resource) => [
    resource.id,
    Math.max(Math.floor(amountOf(balance, resource.id) * limits.reserveShare), affordable ? amountOf(price, resource.id) : 0)
  ]));
}

function candidatesFor(context: Where, target: BuildOrder | undefined): readonly Candidate[] {
  const { factionId, scenario, state } = context;
  const front = frontTerritories(scenario, state, factionId);
  const scarce = scarcestResource(scenario, state, factionId);
  const candidates: Candidate[] = [];
  for (const territoryId of territoriesHeldWhole(scenario, state.subTerritories, factionId)) {
    const where: Site = { built: kindsIn(scenario, state, territoryId), front: front.has(territoryId), scarce, unlocked: tracksIn(scenario, state, territoryId) };
    for (const sub of subTerritoriesOf(scenario, territoryId)) {
      const site = state.subTerritories[sub.id];
      if (site === undefined || site.queue.length > 0) continue;
      for (const project of allProjects(scenario)) {
        if (siteRefusal(scenario, state, factionId, sub.id, project) !== undefined) continue;
        if (target !== undefined && target.subTerritoryId === sub.id && projectKey(target.project) === projectKey(project)) {
          candidates.push({ order: target, score: scores.developmentTarget });
          if (project.kind === "development") where.unlocked.add(project.developmentId);
          continue;
        }
        const score = scoreOf(scenario, state, factionId, sub, project, where);
        // One first level is enough to unlock a type anywhere in the territory.
        if (project.kind === "development") where.unlocked.add(project.developmentId);
        if (score > 0) candidates.push({ order: { factionId, kind: "build", project, subTerritoryId: sub.id }, score });
      }
    }
  }
  return candidates;
}

/** The building effect kinds standing or queued anywhere in a territory (m4, m5: once per territory). */
function kindsIn(scenario: Scenario, state: GameState, territoryId: TerritoryId): ReadonlySet<BuildingEffect["kind"]> {
  const kinds = new Set<BuildingEffect["kind"]>();
  for (const sub of subTerritoriesOf(scenario, territoryId)) {
    const site = state.subTerritories[sub.id];
    if (site === undefined) continue;
    const ids = [...site.buildings, ...site.queue.flatMap((item) => (item.project.kind === "building" ? [item.project.buildingId] : []))];
    for (const id of ids) for (const effect of scenario.index.buildings.get(id)?.effects ?? []) kinds.add(effect.kind);
  }
  return kinds;
}

/** The development tracks at level 1 or more, standing or queued, anywhere in a territory. */
function tracksIn(scenario: Scenario, state: GameState, territoryId: TerritoryId): Set<DevelopmentId> {
  const sites = subTerritoriesOf(scenario, territoryId).flatMap((sub) => state.subTerritories[sub.id] ?? []);
  return new Set(scenario.development.map((track) => track.id).filter((developmentId) => sites.some((site) => queuedLevel(site, { developmentId, kind: "development" }) > 0)));
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

interface Site {
  /** Building effect kinds already standing or queued in the territory. */
  readonly built: ReadonlySet<BuildingEffect["kind"]>;
  readonly front: boolean;
  readonly scarce: ResourceId | undefined;
  /** R3: the tracks the territory has, or has been offered a first level of, and so unlock nothing more. */
  readonly unlocked: Set<DevelopmentId>;
}

function scoreOf(scenario: Scenario, state: GameState, factionId: FactionId, sub: SubTerritoryDefinition, project: SiteProject, where: Site): number {
  const site = state.subTerritories[sub.id];
  const cost = projectCost(scenario, project);
  if (site === undefined || cost === undefined) return 0;
  const price = Math.max(1, Object.values(cost.cost).reduce((sum, value) => sum + value, 0));
  const capital = isCapital(scenario, sub);
  switch (project.kind) {
    case "improvement":
      // $8: a repair back to the 1936 level; m5: more rail, or a better port, at a capital that has some.
      if (project.improvement === "rail" && queuedLevel(site, project) < sub.rail) return scores.railRepair;
      return capital && queuedLevel(site, project) > 0 ? scores.improvement : 0;
    case "development": {
      const track = scenario.index.development.get(project.developmentId);
      if (track === undefined) return 0;
      // M5: yield for the price; the scarcest resource doubled, the others halved (Manpower piles up).
      const value = (scores.development * track.yieldPerLevel) / price;
      const unlocks = where.unlocked.has(track.id) ? 0 : unlockScore(scenario, state, factionId, sub.territoryId, project);
      return unlocks + (track.resource === where.scarce ? value * 2 : value / 2);
    }
    case "building": {
      const building = scenario.index.buildings.get(project.buildingId);
      if (building === undefined || !capital) return 0;
      if (building.effects.some((effect) => effect.kind === "defence-roll")) return where.front && !where.built.has("defence-roll") ? scores.fortifications : 0;
      const unlocks = unlockScore(scenario, state, factionId, sub.territoryId, project);
      return unlocks > 0 ? unlocks : supportScore(building, where, site.rail);
    }
  }
}

/** m5: a Hospital at a front capital, where units replenish; a Rail yard where there is rail. Each once per territory. */
function supportScore(building: BuildingDefinition, where: Site, rail: number): number {
  const kinds = building.effects.map((effect) => effect.kind);
  if (kinds.includes("replenish-cap") && where.front && !where.built.has("replenish-cap")) return scores.support;
  if (kinds.includes("rail-capacity") && rail > 0 && !where.built.has("rail-capacity")) return scores.support;
  return 0;
}

/**
 * R3: how much a building or a track's first level opens up in a territory: 4 for each recruitable type it completes, 1 for
 * each it brings closer.
 */
function unlockScore(scenario: Scenario, state: GameState, factionId: FactionId, territoryId: TerritoryId, project: RecruitRequirement): number {
  let score = 0;
  for (const type of scenario.unitTypes) {
    const recruit = type.recruit;
    if (recruit === undefined || (recruit.factionIds !== undefined && !recruit.factionIds.includes(factionId))) continue;
    const missing = recruit.requires.filter((requirement) => !meetsRequirement(scenario, state, factionId, territoryId, requirement));
    if (!missing.some((requirement) => sameProject(requirement, project))) continue;
    score += missing.length === 1 ? 4 : 1;
  }
  return score;
}
