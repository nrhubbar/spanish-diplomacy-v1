import type {
  FactionId,
  Scenario,
  SubTerritoryChange,
  SubTerritoryChangeCause,
  SubTerritoryId,
  SubTerritoryState,
  TerritoryId
} from "../types";
import { type Holdings, holderOf, subTerritoriesOf } from "./holders";

/**
 * P3, P4: which sub-territories change hands, and in what order. Ground is taken from the
 * outside in: nearest the attack's origin first, the territory's capital always last, ties in
 * scenario order (Q-PART-3 note, Q-TEN-1).
 */

/** Sub-territory adjacency for distances: the borders, plus each connection's entry pair (sea crossings). */
const graphs = new WeakMap<Scenario, ReadonlyMap<SubTerritoryId, readonly SubTerritoryId[]>>();

export function subTerritoryGraph(scenario: Scenario): ReadonlyMap<SubTerritoryId, readonly SubTerritoryId[]> {
  const cached = graphs.get(scenario);
  if (cached !== undefined) return cached;
  const graph = new Map<SubTerritoryId, Set<SubTerritoryId>>();
  const link = (a: SubTerritoryId, b: SubTerritoryId): void => {
    if (a === b) return;
    graph.set(a, (graph.get(a) ?? new Set()).add(b));
    graph.set(b, (graph.get(b) ?? new Set()).add(a));
  };
  for (const [a, b] of scenario.subTerritoryBorders) link(a, b);
  for (const connection of scenario.connections) {
    if (connection.entry !== undefined) link(connection.entry[0], connection.entry[1]);
  }
  const frozen = new Map([...graph].map(([id, neighbors]) => [id, [...neighbors]] as const));
  graphs.set(scenario, frozen);
  return frozen;
}

/** Steps from the nearest source to every sub-territory reachable over the graph (breadth first). */
export function distancesFrom(scenario: Scenario, sources: Iterable<SubTerritoryId>): ReadonlyMap<SubTerritoryId, number> {
  const graph = subTerritoryGraph(scenario);
  const distance = new Map<SubTerritoryId, number>();
  let frontier = [...new Set(sources)];
  for (const id of frontier) distance.set(id, 0);
  let step = 0;
  while (frontier.length > 0) {
    step += 1;
    const next: SubTerritoryId[] = [];
    for (const id of frontier) {
      for (const neighbor of graph.get(id) ?? []) {
        if (!distance.has(neighbor)) {
          distance.set(neighbor, step);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  return distance;
}

/** Where an attack comes from, as distance sources: every sub-territory of each origin territory, plus extra ones. */
export function attackSources(scenario: Scenario, origins: Iterable<TerritoryId>, extra: Iterable<SubTerritoryId> = []): readonly SubTerritoryId[] {
  return [...new Set([...[...origins].flatMap((id) => subTerritoriesOf(scenario, id).map((sub) => sub.id)), ...extra])];
}

/**
 * P4: the sub-territories of `territoryId` that `losers` hold, in the order they fall: nearest
 * the sources first, the capital last, ties (and unreachable ones) in scenario order.
 */
export function flipOrder(
  scenario: Scenario,
  holdings: Holdings,
  territoryId: TerritoryId,
  losers: ReadonlySet<FactionId>,
  sources: readonly SubTerritoryId[]
): readonly SubTerritoryId[] {
  const capital = scenario.index.territories.get(territoryId)?.capitalSubTerritoryId;
  const distance = distancesFrom(scenario, sources);
  const rank = (id: SubTerritoryId): number => scenario.subTerritories.findIndex((sub) => sub.id === id);
  return subTerritoriesOf(scenario, territoryId)
    .filter((sub) => {
      const holder = holderOf(scenario, holdings, sub.id);
      return holder !== undefined && losers.has(holder);
    })
    .map((sub) => ({ capital: sub.id === capital, distance: distance.get(sub.id) ?? Number.POSITIVE_INFINITY, id: sub.id, rank: rank(sub.id) }))
    .sort((left, right) =>
      Number(left.capital) - Number(right.capital) || left.distance - right.distance || left.rank - right.rank)
    .map((entry) => entry.id);
}

/** How much ground a result takes: a count, or the whole territory (P4). */
export type Ground = 0 | 1 | 2 | "all";

/**
 * P4, P5: the sub-territories a result takes, from `ordered` (the losers' ground in falling
 * order). Where the territory has a single sub-territory, a partial grade takes nothing: it acts
 * as a stalemate (P5, Q-D20-7).
 */
export function groundTaken(scenario: Scenario, territoryId: TerritoryId, ordered: readonly SubTerritoryId[], ground: Ground): readonly SubTerritoryId[] {
  if (ground === "all") return ordered;
  if (subTerritoriesOf(scenario, territoryId).length <= 1) return [];
  return ordered.slice(0, ground);
}

export interface Flipped {
  readonly changes: readonly SubTerritoryChange[];
  readonly holdings: Holdings;
}

/** Hands each sub-territory to `gainer`, reporting a change for each that was someone else's. */
export function flip(
  holdings: Holdings,
  subTerritoryIds: readonly SubTerritoryId[],
  gainer: FactionId,
  cause: SubTerritoryChangeCause,
  battleIndex?: number
): Flipped {
  const next: Record<SubTerritoryId, SubTerritoryState> = { ...holdings };
  const changes: SubTerritoryChange[] = [];
  for (const id of subTerritoryIds) {
    const current = next[id];
    if (current === undefined || current.holder === gainer) continue;
    next[id] = { ...current, holder: gainer };
    changes.push({
      after: gainer,
      before: current.holder,
      cause,
      subTerritoryId: id,
      ...(battleIndex === undefined ? {} : { battleIndex })
    });
  }
  return { changes, holdings: changes.length === 0 ? holdings : next };
}
