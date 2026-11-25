import type {
  BuildableId,
  BuildCost,
  BuildOrder,
  BuildProject,
  BuildRefusal,
  FactionId,
  GameState,
  LinkModifier,
  LinkProject,
  Order,
  QueueItem,
  ResourceId,
  Resources,
  Scenario,
  SiteProject,
  SubTerritoryDefinition,
  SubTerritoryId,
  SubTerritoryState,
  ValidationResult
} from "../types";
import { linkBetween, linkKey, linkModifiers, stationCap, workMisfit } from "../network/links";
import { isContested } from "./holdings";
import { sumResources, canAfford, shortfall, subtractResources } from "./resources";

/**
 * $3-$5: what a sub-territory may build, what each project costs, and whether a Build order is
 * legal. One validator serves the engine (step 1), the planning screen and the computer player,
 * so they never disagree.
 */

/** The part of the state a Build order is judged against: the sites, the balances and the links built in play (R7). */
export type EconomyState = Pick<GameState, "builtLinks" | "subTerritories" | "treasuries">;

/** A stable key for comparing projects. */
export function projectKey(project: BuildProject): string {
  switch (project.kind) {
    case "building":
      return `building:${project.buildingId}`;
    case "development":
      return `development:${project.developmentId}`;
    case "improvement":
      return `improvement:${project.improvement}`;
    case "link":
      return `link:${project.work}:${[project.a, project.b].sort().join("|")}`;
  }
}

/** D4: the id a sub-territory's `buildable` list names the project by; undefined for link works. */
export function buildableId(project: BuildProject): BuildableId | undefined {
  switch (project.kind) {
    case "building":
      return project.buildingId;
    case "development":
      return project.developmentId;
    case "improvement":
      return project.improvement;
    case "link":
      return undefined;
  }
}

export function sameProject(a: BuildProject, b: BuildProject): boolean {
  return projectKey(a) === projectKey(b);
}

/** A project's price and build time; undefined for a project the scenario does not know. */
export function projectCost(scenario: Scenario, project: BuildProject): BuildCost | undefined {
  switch (project.kind) {
    case "building":
      return scenario.index.buildings.get(project.buildingId);
    case "development":
      return scenario.index.development.get(project.developmentId)?.upgrade;
    case "improvement":
      return scenario.improvements?.[project.improvement];
    case "link":
      return scenario.linkProjects?.[project.work];
  }
}

/** The level a levelled project has now (development, rail, port); 0 or 1 for a building. */
export function currentLevel(site: SubTerritoryState, project: BuildProject): number {
  switch (project.kind) {
    case "building":
      return site.buildings.includes(project.buildingId) ? 1 : 0;
    case "development":
      return site.development[project.developmentId] ?? 0;
    case "improvement":
      return site[project.improvement];
    case "link":
      return 0;
  }
}

/** The highest level a project may reach; 1 for a building. A rail station's own cap is `levelCap`. */
export function maxLevel(scenario: Scenario, project: BuildProject): number {
  switch (project.kind) {
    case "building":
      return 1;
    case "development":
      return scenario.index.development.get(project.developmentId)?.maxLevel ?? 0;
    case "improvement":
      return scenario.improvements?.[project.improvement].maxLevel ?? 0;
    case "link":
      return 0;
  }
}

/**
 * The highest level a project may reach in one sub-territory: `maxLevel`, except a rail station,
 * which a repair raises no higher than its best link allows (declog D12).
 */
export function levelCap(scenario: Scenario, state: Pick<GameState, "builtLinks">, subTerritoryId: SubTerritoryId, project: BuildProject): number {
  return project.kind === "improvement" && project.improvement === "rail" ? stationCap(scenario, state, subTerritoryId) : maxLevel(scenario, project);
}

/** The level the project will have once the queue ahead of it is done. */
export function queuedLevel(site: SubTerritoryState, project: BuildProject): number {
  return currentLevel(site, project) + site.queue.filter((item) => sameProject(item.project, project)).length;
}

/** Every project the scenario offers in a sub-territory, in catalogue order: buildings, development, rail, port. */
export function allProjects(scenario: Scenario): readonly SiteProject[] {
  return [
    ...scenario.buildings.map((building): SiteProject => ({ buildingId: building.id, kind: "building" })),
    ...scenario.development.map((track): SiteProject => ({ developmentId: track.id, kind: "development" })),
    ...(scenario.improvements === undefined ? [] : [{ improvement: "rail", kind: "improvement" } as const, { improvement: "port", kind: "improvement" } as const])
  ];
}

/** W3: the sub-territory is its territory's capital. */
export function isCapital(scenario: Scenario, sub: SubTerritoryDefinition): boolean {
  return scenario.index.territories.get(sub.territoryId)?.capitalSubTerritoryId === sub.id;
}

/** R7: the link's modifiers now, and whether a work on it is queued at either end. */
function queuedLink(scenario: Scenario, state: EconomyState, project: LinkProject): { readonly current: readonly LinkModifier[]; readonly queued: boolean } | undefined {
  const link = linkBetween(scenario, project.a, project.b);
  if (link === undefined) return undefined;
  const key = linkKey(project.a, project.b);
  const queued = [project.a, project.b].some((end) => (state.subTerritories[end]?.queue ?? []).some((item) => item.project.kind === "link" && linkKey(item.project.a, item.project.b) === key));
  return { current: linkModifiers(link, state), queued };
}

/**
 * R7: why a link work cannot be queued at `subTerritoryId`, past the holding checks: the link
 * must join it to a bordering sub-territory, the faction must hold that end too, uncontested,
 * the work must fit the link as it stands, and no other work on it may be queued.
 */
function linkRefusal(scenario: Scenario, state: EconomyState, factionId: FactionId, subTerritoryId: SubTerritoryId, project: LinkProject): BuildRefusal | undefined {
  if (project.a !== subTerritoryId && project.b !== subTerritoryId) return { code: "link-not-at-end" };
  const links = queuedLink(scenario, state, project);
  const otherId = project.a === subTerritoryId ? project.b : project.a;
  const other = scenario.index.subTerritories.get(otherId);
  if (links === undefined || other === undefined) return { code: "link-not-bordering" };
  if (state.subTerritories[otherId]?.holder !== factionId) return { code: "site-not-held", subTerritoryId: otherId };
  if (isContested(scenario, state.subTerritories, other.territoryId)) return { code: "build-contested" };
  const now = workMisfit(links.current, project.work, scenario.linkModifiers.road);
  if (now !== undefined) return now;
  // One work at a time on a link, so a later one never finishes before the one it needs.
  return links.queued ? { code: "link-busy" } : undefined;
}

/** What a balance lacks of a cost it cannot cover, resource by resource. */
function shortfallRefusal(balance: Resources, cost: Resources): BuildRefusal {
  const missing = Object.entries(shortfall(balance, cost)) as [ResourceId, number][];
  return { code: "resources-short", short: missing.map(([resourceId, amount]) => ({ amount, resourceId })) };
}

/**
 * Why the project cannot be queued in the sub-territory, ignoring the price; undefined when the
 * site allows it. Covers holding, contested ground ($5), the catalogue's limits (L18's rules:
 * capital only, city only, upgrade of, max level) and what is already built or queued.
 */
export function siteRefusal(scenario: Scenario, state: EconomyState, factionId: FactionId, subTerritoryId: SubTerritoryId, project: BuildProject): BuildRefusal | undefined {
  const sub = scenario.index.subTerritories.get(subTerritoryId);
  const site = state.subTerritories[subTerritoryId];
  if (sub === undefined || site === undefined) return { code: "unknown-site" };
  if (site.holder !== factionId) return { code: "site-not-held", subTerritoryId };
  if (isContested(scenario, state.subTerritories, sub.territoryId)) return { code: "build-contested" };
  if (projectCost(scenario, project) === undefined) return { code: "project-unavailable" };
  if (project.kind === "link") return linkRefusal(scenario, state, factionId, subTerritoryId, project);
  // D4: the sub-territory's own list, after the catalogue's refusals, which say more.
  const id = buildableId(project);
  const unlisted: BuildRefusal | undefined = id === undefined || !sub.buildable.includes(id) ? { code: "not-buildable-here", subTerritoryId } : undefined;
  const max = levelCap(scenario, state, subTerritoryId, project);
  if (project.kind === "building") {
    const building = scenario.index.buildings.get(project.buildingId);
    if (building === undefined) return { code: "project-unavailable" };
    if (site.buildings.includes(building.id)) return { code: "already-built" };
    if (site.queue.some((item) => sameProject(item.project, project))) return { code: "already-queued" };
    if (building.capitalOnly && !isCapital(scenario, sub)) return { code: "needs-capital" };
    if (building.cityOnly && sub.cityIds.length === 0) return { code: "needs-city" };
    if (unlisted !== undefined) return unlisted;
    if (building.upgradeOf !== undefined) {
      const base: BuildProject = { buildingId: building.upgradeOf, kind: "building" };
      if (queuedLevel(site, base) === 0) return { buildingId: building.upgradeOf, code: "needs-building" };
    }
    return undefined;
  }
  if (project.kind === "development" && scenario.index.development.get(project.developmentId)?.cityOnly === true && sub.cityIds.length === 0) return { code: "needs-city" };
  if (unlisted !== undefined) return unlisted;
  if (project.kind === "improvement" && project.improvement === "rail" && max === 0) return { code: "no-railway" };
  if (queuedLevel(site, project) >= max) return { code: "max-level", level: max };
  return undefined;
}

/** $5: why a Build order fails against a state, or undefined when it may be queued and paid. */
export function buildRefusal(scenario: Scenario, state: EconomyState, order: BuildOrder): BuildRefusal | undefined {
  const site = siteRefusal(scenario, state, order.factionId, order.subTerritoryId, order.project);
  if (site !== undefined) return site;
  const cost = projectCost(scenario, order.project);
  const balance = state.treasuries[order.factionId] ?? {};
  return cost === undefined || canAfford(balance, cost.cost) ? undefined : shortfallRefusal(balance, cost.cost);
}

/** M1, $5: a Build order against the start-of-turn state, on its own. The engine's validation gateway calls this. */
export function validateBuildOrder(scenario: Scenario, state: GameState, order: BuildOrder): ValidationResult {
  if (scenario.rules.economy === "none") return { ok: false, refusal: { code: "order-unavailable" } };
  const refusal = buildRefusal(scenario, state, order);
  return refusal === undefined ? { ok: true } : { ok: false, refusal };
}

/**
 * $5: queues a Build order: pays its full price and appends it to the sub-territory's queue.
 * Returns the new state and the queue position, or the refusal. Applying a turn's
 * orders one by one is the running ledger of step 1, and the planning screen's preview.
 */
export function applyBuildOrder<S extends EconomyState>(scenario: Scenario, state: S, order: BuildOrder): { readonly ok: true; readonly position: number; readonly state: S; readonly paid: Resources } | { readonly ok: false; readonly refusal: BuildRefusal } {
  const refusal = buildRefusal(scenario, state, order);
  const cost = projectCost(scenario, order.project);
  const site = state.subTerritories[order.subTerritoryId];
  if (refusal !== undefined || cost === undefined || site === undefined) return { ok: false, refusal: refusal ?? { code: "project-unavailable" } };
  const item: QueueItem = { factionId: order.factionId, paid: cost.cost, progress: 0, project: order.project };
  const balance = state.treasuries[order.factionId] ?? {};
  const treasuries = { ...state.treasuries, [order.factionId]: subtractResources(balance, cost.cost) };
  return {
    ok: true,
    paid: cost.cost,
    position: site.queue.length,
    state: { ...state, subTerritories: { ...state.subTerritories, [order.subTerritoryId]: { ...site, queue: [...site.queue, item] } }, treasuries }
  };
}

/** The state with a faction's planned Build orders queued and paid; orders that fail are skipped. */
export function withBuildOrders<S extends EconomyState>(scenario: Scenario, state: S, orders: readonly BuildOrder[]): S {
  return orders.reduce<S>((current, order) => {
    const applied = applyBuildOrder(scenario, current, order);
    return applied.ok ? applied.state : current;
  }, state);
}

/** What a list of planned orders costs at step 1: Build orders and Recruit orders (R2). */
export function plannedSpend(scenario: Scenario, orders: readonly Order[]): Resources {
  return sumResources(...orders.flatMap((order): Resources[] => {
    if (order.kind === "build") {
      const cost = projectCost(scenario, order.project);
      return cost === undefined ? [] : [cost.cost];
    }
    if (order.kind === "recruit") {
      const cost = scenario.index.unitTypes.get(order.unitTypeId)?.recruit?.cost;
      return cost === undefined ? [] : [cost];
    }
    return [];
  }));
}
