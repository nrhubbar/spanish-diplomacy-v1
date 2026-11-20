import { neighborsOf } from "../lookup";
import type { FactionId, GameState, Scenario, SubTerritoryId, TerritoryId } from "../types";
import { subTerritoryGraph } from "./flips";
import { type Holdings, heldBy, holderOf, holdsWhole, isContested, subTerritoriesOf } from "./holders";

/**
 * P6 (Q-MR-22, Q-PART-2 rule 2): an army leaving a territory, by a forced retreat or a Withdraw
 * order, needs a path through its own sub-territories to the adjacent territory it goes to.
 * Units never stand in a sub-territory, so the army may leave from any sub-territory its faction
 * holds there: the path exists when one of them borders a sub-territory of the destination its
 * faction holds (a land border, or the connection's entry pair across the sea). Holders are
 * judged at the start of the turn, as M21 judges control.
 */

/** The faction's sub-territories in `from` that touch its own ground in `to`, in scenario order. */
export function pathThrough(scenario: Scenario, holdings: Holdings, factionId: FactionId, from: TerritoryId, to: TerritoryId): readonly SubTerritoryId[] {
  const graph = subTerritoryGraph(scenario);
  const ownInDestination = new Set(heldBy(scenario, holdings, to, factionId));
  return heldBy(scenario, holdings, from, factionId).filter((id) => (graph.get(id) ?? []).some((neighbor) => ownInDestination.has(neighbor)));
}

/** True when P6 lets the army go: without sub-territories on both sides there is no path rule. */
export function hasPath(scenario: Scenario, holdings: Holdings, factionId: FactionId, from: TerritoryId, to: TerritoryId): boolean {
  if (subTerritoriesOf(scenario, from).length === 0 || subTerritoriesOf(scenario, to).length === 0) return true;
  return pathThrough(scenario, holdings, factionId, from, to).length > 0;
}

/** A Withdraw route: the destination and the sub-territories the army leaves through. */
export interface WithdrawRoute {
  readonly through: readonly SubTerritoryId[];
  readonly to: TerritoryId;
}

/**
 * C1, P6: where a faction's armies in a contested territory may withdraw to: each adjacent
 * territory the faction holds whole, reached through its own sub-territories. Empty when the
 * territory is not contested or every way out is cut.
 */
export function withdrawRoutes(scenario: Scenario, state: Pick<GameState, "control" | "subTerritories">, factionId: FactionId, from: TerritoryId): readonly WithdrawRoute[] {
  if (!isContested(scenario, state, from)) return [];
  return neighborsOf(scenario, from).flatMap((neighbor): WithdrawRoute[] => {
    const to = neighbor.territoryId;
    if (!holdsWhole(scenario, state, to, factionId)) return [];
    const through = pathThrough(scenario, state.subTerritories, factionId, from, to);
    return through.length === 0 ? [] : [{ through, to }];
  });
}

/** The sub-territory names along a route, for the order menu and reports. */
export function routeNames(scenario: Scenario, route: WithdrawRoute): readonly string[] {
  return route.through.map((id) => scenario.index.subTerritories.get(id)?.name ?? id);
}

/** True when the faction holds at least one sub-territory of the territory (start of turn). */
export function holdsAny(scenario: Scenario, holdings: Holdings, factionId: FactionId, territoryId: TerritoryId): boolean {
  return subTerritoriesOf(scenario, territoryId).some((sub) => holderOf(scenario, holdings, sub.id) === factionId);
}
