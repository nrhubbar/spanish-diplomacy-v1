import { neighborsOf } from "../lookup";
import type { ConnectionDefinition, FactionId, GameState, Scenario, SubTerritoryId, TerritoryId } from "../types";
import { isSeaConnectionClosed } from "../weather";
import { subTerritoryGraph } from "./flips";
import { heldBy, holderOf, holdsWhole, isContested, subTerritoriesOf } from "./holders";

/**
 * P6 (Q-MR-22, Q-PART-2 rule 2): an army leaving a territory, by a forced retreat or a Withdraw
 * order, needs a path through its own sub-territories to the adjacent territory it goes to.
 * Units never stand in a sub-territory, so the army may leave from any sub-territory its faction
 * holds there: the path exists when one of them borders a sub-territory of the destination its
 * faction holds (a land border, or the connection's entry pair). Holders are judged at the start
 * of the turn, as M21 judges control.
 *
 * A crossing that only a sea connection's entry pair makes (T4, M5, Q-CITY-7) is a voyage: it
 * needs the sea open this turn and a port in the sub-territory the army sails from, as a sea
 * Move does. The weather, too, is the start of the turn's.
 */

const pairKey = (a: SubTerritoryId, b: SubTerritoryId): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
const voyages = new WeakMap<Scenario, ReadonlyMap<string, ConnectionDefinition>>();

/** The sub-territory pairs joined only across the sea (a sea connection's entry pair that is no land border or land entry). */
function seaOnlyPairs(scenario: Scenario): ReadonlyMap<string, ConnectionDefinition> {
  const known = voyages.get(scenario);
  if (known !== undefined) return known;
  const land = new Set(scenario.subTerritoryBorders.map(([a, b]) => pairKey(a, b)));
  for (const connection of scenario.connections) {
    if (connection.kind === "land" && connection.entry !== undefined) land.add(pairKey(connection.entry[0], connection.entry[1]));
  }
  const sea = new Map<string, ConnectionDefinition>();
  for (const connection of scenario.connections) {
    if (connection.kind !== "sea" || connection.entry === undefined) continue;
    const key = pairKey(connection.entry[0], connection.entry[1]);
    if (!land.has(key)) sea.set(key, connection);
  }
  voyages.set(scenario, sea);
  return sea;
}

/** T4, M5: the crossing from `from` to `to` may be made this turn. */
function crossingOpen(scenario: Scenario, state: GameState, from: SubTerritoryId, to: SubTerritoryId): boolean {
  const connection = seaOnlyPairs(scenario).get(pairKey(from, to));
  if (connection === undefined) return true;
  return (state.subTerritories[from]?.port ?? 0) > 0 && !isSeaConnectionClosed(scenario, state, connection);
}

/** The faction's sub-territories in `from` that touch its own ground in `to` by an open crossing, in scenario order. */
export function pathThrough(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId, to: TerritoryId): readonly SubTerritoryId[] {
  const graph = subTerritoryGraph(scenario);
  const holdings = state.subTerritories;
  const ownInDestination = new Set(heldBy(scenario, holdings, to, factionId));
  return heldBy(scenario, holdings, from, factionId).filter((id) => (graph.get(id) ?? []).some((neighbor) =>
    ownInDestination.has(neighbor) && crossingOpen(scenario, state, id, neighbor)));
}

/** True when P6 lets the army go: without sub-territories on both sides there is no path rule. */
export function hasPath(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId, to: TerritoryId): boolean {
  if (subTerritoriesOf(scenario, from).length === 0 || subTerritoriesOf(scenario, to).length === 0) return true;
  return pathThrough(scenario, state, factionId, from, to).length > 0;
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
export function withdrawRoutes(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId): readonly WithdrawRoute[] {
  if (!isContested(scenario, state, from)) return [];
  return neighborsOf(scenario, from).flatMap((neighbor): WithdrawRoute[] => {
    const to = neighbor.territoryId;
    if (!holdsWhole(scenario, state, to, factionId)) return [];
    const through = pathThrough(scenario, state, factionId, from, to);
    return through.length === 0 ? [] : [{ through, to }];
  });
}

/** The sub-territory names along a route, for the order menu and reports. */
export function routeNames(scenario: Scenario, route: WithdrawRoute): readonly string[] {
  return route.through.map((id) => scenario.index.subTerritories.get(id)?.name ?? id);
}

/** True when the faction holds at least one sub-territory of the territory (start of turn). */
export function holdsAny(scenario: Scenario, holdings: GameState["subTerritories"], factionId: FactionId, territoryId: TerritoryId): boolean {
  return subTerritoriesOf(scenario, territoryId).some((sub) => holderOf(scenario, holdings, sub.id) === factionId);
}
