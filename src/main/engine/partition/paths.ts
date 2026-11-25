import { neighborsOf, requireSubTerritory } from "../lookup";
import type { ConnectionDefinition, FactionId, GameState, Scenario, SubTerritoryId, TerritoryId, UnitId } from "../types";
import { isSeaConnectionClosed } from "../weather";
import { subTerritoryGraph } from "./flips";
import { heldBy, holdsWhole, isContested, subTerritoriesOf } from "./holders";
import { pocketOfUnit } from "./pockets";

/**
 * P6 (Q-MR-22, Q-PART-2 rule 2), R1: an army leaving a territory, by a forced retreat or a
 * Withdraw order, needs a path out of its own pocket to the adjacent territory it goes to: the
 * path exists when one of the pocket's sub-territories borders a sub-territory of the destination
 * its faction holds (a land border, or the connection's entry pair). Other pockets of its side
 * are no way out (Rev 1's path through them is gone). Holders are judged at the start of the
 * turn, as M21 judges control.
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

/**
 * R1: the ground the given armies may leave `from` through: the sub-territories every one of
 * their pockets shares (none when they stand in different pockets). Without armies given, every
 * pocket where the side has an army; with no army there at all, everything it holds. Armies that
 * do not stand in `from` in this state (they entered it this turn) are not counted.
 */
export function exitGround(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId, unitIds: readonly UnitId[] = []): readonly SubTerritoryId[] {
  const there = (ids: Iterable<UnitId>) => [...ids].flatMap((id) => {
    const unit = state.units[id];
    return unit !== undefined && unit.territoryId === from && unit.factionId === factionId ? [unit] : [];
  });
  const given = there(unitIds);
  const held = heldBy(scenario, state.subTerritories, from, factionId);
  if (given.length > 0) {
    const pockets = given.map((unit) => new Set(pocketOfUnit(scenario, state.subTerritories, unit)?.subTerritoryIds));
    return held.filter((id) => pockets.every((pocket) => pocket.has(id)));
  }
  const present = there(Object.keys(state.units) as UnitId[]);
  if (present.length === 0) return held;
  const pockets = new Set(present.flatMap((unit) => pocketOfUnit(scenario, state.subTerritories, unit)?.subTerritoryIds ?? []));
  return held.filter((id) => pockets.has(id));
}

/** R1, P6: the armies' sub-territories in `from` (`exitGround`) that touch their side's ground in `to` by an open crossing, in scenario order. */
export function pathThrough(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId, to: TerritoryId, unitIds: readonly UnitId[] = []): readonly SubTerritoryId[] {
  const graph = subTerritoryGraph(scenario);
  const ownInDestination = new Set(heldBy(scenario, state.subTerritories, to, factionId));
  return exitGround(scenario, state, factionId, from, unitIds).filter((id) => (graph.get(id) ?? []).some((neighbor) =>
    ownInDestination.has(neighbor) && crossingOpen(scenario, state, id, neighbor)));
}

/** True when P6 lets the armies go: without sub-territories on both sides there is no path rule. */
export function hasPath(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId, to: TerritoryId, unitIds: readonly UnitId[] = []): boolean {
  if (subTerritoriesOf(scenario, from).length === 0 || subTerritoriesOf(scenario, to).length === 0) return true;
  return pathThrough(scenario, state, factionId, from, to, unitIds).length > 0;
}

/** A Withdraw route: the destination and the sub-territories the army leaves through. */
export interface WithdrawRoute {
  readonly through: readonly SubTerritoryId[];
  readonly to: TerritoryId;
}

/**
 * C1, P6, R1: where a faction's armies in a contested territory may withdraw to: each adjacent
 * territory the faction holds whole, reached out of their pocket (`exitGround`: the given
 * armies', else every pocket where the side has armies). Empty when the territory is not
 * contested or every way out is cut.
 */
export function withdrawRoutes(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId, unitIds: readonly UnitId[] = []): readonly WithdrawRoute[] {
  if (!isContested(scenario, state, from)) return [];
  // R3: a pair may have a land and a sea connection (Málaga's lane); each territory is one way out.
  const seen = new Set<TerritoryId>();
  return neighborsOf(scenario, from).flatMap((neighbor): WithdrawRoute[] => {
    const to = neighbor.territoryId;
    if (seen.has(to) || !holdsWhole(scenario, state, to, factionId)) return [];
    seen.add(to);
    const through = pathThrough(scenario, state, factionId, from, to, unitIds);
    return through.length === 0 ? [] : [{ through, to }];
  });
}

/** The sub-territory names along a route, for the order menu and reports. */
export function routeNames(scenario: Scenario, route: WithdrawRoute): readonly string[] {
  return route.through.map((id) => requireSubTerritory(scenario, id).name);
}
