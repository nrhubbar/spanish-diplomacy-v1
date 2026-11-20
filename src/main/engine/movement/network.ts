import { hookedSeaClosed } from "../hooks";
import { neighborsOf } from "../lookup";
import type {
  ConnectionDefinition,
  FactionId,
  GameState,
  Scenario,
  SubTerritoryId,
  TerritoryId,
  UnitId,
  UnitTypeDefinition
} from "../types";

/**
 * The ground a move crosses (M2, M3, M5): which territories a faction holds whole, its rail
 * network and its ports. Every answer reads the given state, so rail and port levels and holders
 * built or taken in play count at once.
 */

/** A unit's type, for scenario units and units raised in play alike (R6). */
export function unitTypeOf(scenario: Scenario, state: GameState, unitId: UnitId): UnitTypeDefinition | undefined {
  const typeId = scenario.index.units.get(unitId)?.type ?? state.raised[unitId]?.type;
  return typeId === undefined ? undefined : scenario.index.unitTypes.get(typeId);
}

/** The sub-territories of a territory, in scenario order. */
export function subTerritoriesOf(scenario: Scenario, territoryId: TerritoryId): readonly SubTerritoryId[] {
  return (scenario.index.subTerritoriesByTerritory.get(territoryId) ?? []).map((sub) => sub.id);
}

export function holderOf(state: GameState, subTerritoryId: SubTerritoryId): FactionId | undefined {
  return state.subTerritories[subTerritoryId]?.holder;
}

/** M2: the faction holds every sub-territory of the territory. */
export function holdsWhole(scenario: Scenario, state: GameState, factionId: FactionId, territoryId: TerritoryId): boolean {
  const subs = subTerritoriesOf(scenario, territoryId);
  if (subs.length === 0) {
    const control = state.control[territoryId];
    return control?.kind === "controlled" && control.factionId === factionId;
  }
  return subs.every((id) => holderOf(state, id) === factionId);
}

/** Another faction has an army in the territory. */
export function enemyArmyIn(state: GameState, factionId: FactionId, territoryId: TerritoryId): boolean {
  return Object.values(state.units).some((unit) => unit.territoryId === territoryId && unit.factionId !== factionId);
}

/** M2, M3: friendly ground a move may pass through, or a rail ride end in: held whole, with no other faction's army. */
export function isFriendlyGround(scenario: Scenario, state: GameState, factionId: FactionId, territoryId: TerritoryId): boolean {
  return holdsWhole(scenario, state, factionId, territoryId) && !enemyArmyIn(state, factionId, territoryId);
}

/** The connection between two territories of the given kind, if any. */
export function connectionBetween(scenario: Scenario, from: TerritoryId, to: TerritoryId, kind?: "land" | "sea"): ConnectionDefinition | undefined {
  return scenario.connections.find((connection) =>
    (kind === undefined || connection.kind === kind)
    && ((connection.between[0] === from && connection.between[1] === to) || (connection.between[0] === to && connection.between[1] === from)));
}

/** P8: the sub-territory a step from `from` into `to` enters. */
export function entrySubTerritory(scenario: Scenario, from: TerritoryId, to: TerritoryId, kind?: "land" | "sea"): SubTerritoryId | undefined {
  const connection = connectionBetween(scenario, from, to, kind);
  if (connection?.entry === undefined) return undefined;
  return connection.between[0] === to ? connection.entry[0] : connection.entry[1];
}

/** M1, P8: the step enters a mountain or swamp sub-territory. */
export function roughEntry(scenario: Scenario, from: TerritoryId, to: TerritoryId, kind?: "land" | "sea"): SubTerritoryId | undefined {
  const entry = entrySubTerritory(scenario, from, to, kind);
  const terrain = entry === undefined ? undefined : scenario.index.subTerritories.get(entry)?.terrain;
  return terrain === "mountain" || terrain === "swamp" ? entry : undefined;
}

export function landNeighbors(scenario: Scenario, territoryId: TerritoryId): readonly TerritoryId[] {
  return neighborsOf(scenario, territoryId).filter((neighbor) => neighbor.kind === "land").map((neighbor) => neighbor.territoryId);
}

export function seaNeighbors(scenario: Scenario, territoryId: TerritoryId): readonly TerritoryId[] {
  return neighborsOf(scenario, territoryId).filter((neighbor) => neighbor.kind === "sea").map((neighbor) => neighbor.territoryId);
}

/* ---------------------------------------------------------------- rail (M3) */

export function railLevel(state: GameState, subTerritoryId: SubTerritoryId): number {
  return state.subTerritories[subTerritoryId]?.rail ?? 0;
}

/** The capital sub-territory of a territory, if the scenario names one. */
export function capitalOf(scenario: Scenario, territoryId: TerritoryId): SubTerritoryId | undefined {
  return scenario.index.territories.get(territoryId)?.capitalSubTerritoryId;
}

/** M3, D7: armies that may board at a capital per turn: its rail level, plus each building's `rail-departures`. */
export function railDepartures(scenario: Scenario, state: GameState, capital: SubTerritoryId): number {
  const sub = state.subTerritories[capital];
  if (sub === undefined || sub.rail <= 0) return 0;
  const extra = sub.buildings.reduce((sum, buildingId) => sum + (scenario.index.buildings.get(buildingId)?.effects ?? [])
    .reduce((inner, effect) => inner + (effect.kind === "rail-departures" ? effect.extra : 0), 0), 0);
  return sub.rail + extra;
}

/** One rail ride from a territory's capital to another's (M3). */
export interface RailRide {
  /** The boarding capital. */
  readonly boarding: SubTerritoryId;
  /** Territory borders the ride crosses; at most `range`. */
  readonly crossings: number;
  readonly end: TerritoryId;
  /** The lowest rail level on the route, which sets the range. */
  readonly level: number;
  readonly range: number;
  /** Every station from the boarding capital to the end capital, in order. */
  readonly stations: readonly SubTerritoryId[];
  readonly start: TerritoryId;
  /** Territories the ride passes through between its start and its end, in order. */
  readonly through: readonly TerritoryId[];
}

/**
 * M3, D7: every territory an army in `from` can reach by rail this turn. It boards at `from`'s
 * capital, rides through rail sub-territories its faction holds, and leaves the train at another
 * territory's capital in friendly ground. The lowest level on the route sets the range in
 * territory borders crossed (`railRangePerLevel` per level). For each level from the highest
 * down, a search over the sub-territories with at least that level finds the routes it allows;
 * the first level that reaches a territory gives its ride, so a ride always uses the best line.
 */
export function railReach(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId): ReadonlyMap<TerritoryId, RailRide> {
  // States are never changed in place, so a ride map is remembered per state, scenario and start.
  const byState = reachMemo.get(state) ?? new WeakMap<Scenario, Map<string, ReadonlyMap<TerritoryId, RailRide>>>();
  reachMemo.set(state, byState);
  const byKey = byState.get(scenario) ?? new Map<string, ReadonlyMap<TerritoryId, RailRide>>();
  byState.set(scenario, byKey);
  const key = `${factionId}|${from}`;
  const known = byKey.get(key);
  if (known !== undefined) return known;
  const rides = computeRailReach(scenario, state, factionId, from);
  byKey.set(key, rides);
  return rides;
}

const reachMemo = new WeakMap<GameState, WeakMap<Scenario, Map<string, ReadonlyMap<TerritoryId, RailRide>>>>();

function computeRailReach(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId): ReadonlyMap<TerritoryId, RailRide> {
  const rides = new Map<TerritoryId, RailRide>();
  const boarding = capitalOf(scenario, from);
  const perLevel = scenario.movement?.railRangePerLevel ?? 0;
  const maxLevel = scenario.improvements?.rail.maxLevel ?? 3;
  if (boarding === undefined || perLevel <= 0 || holderOf(state, boarding) !== factionId) return rides;
  const territoryOf = (id: SubTerritoryId): TerritoryId | undefined => scenario.index.subTerritories.get(id)?.territoryId;
  for (let level = Math.min(maxLevel, railLevel(state, boarding)); level >= 1; level -= 1) {
    const range = perLevel * level;
    const usable = (id: SubTerritoryId): boolean => holderOf(state, id) === factionId && railLevel(state, id) >= level;
    // 0-1 breadth-first search: crossing a territory border costs 1, a station inside one costs 0.
    const distance = new Map<SubTerritoryId, number>([[boarding, 0]]);
    const previous = new Map<SubTerritoryId, SubTerritoryId>();
    const queue: SubTerritoryId[] = [boarding];
    while (queue.length > 0) {
      const current = queue.shift() as SubTerritoryId;
      const here = distance.get(current) ?? 0;
      for (const next of scenario.index.subTerritoryNeighbors.get(current) ?? []) {
        if (!usable(next)) continue;
        const cost = here + (territoryOf(next) === territoryOf(current) ? 0 : 1);
        if (cost > range || cost >= (distance.get(next) ?? Number.POSITIVE_INFINITY)) continue;
        distance.set(next, cost);
        previous.set(next, current);
        if (cost === here) queue.unshift(next);
        else queue.push(next);
      }
    }
    for (const territory of scenario.territories) {
      const end = territory.id;
      const capital = territory.capitalSubTerritoryId;
      if (end === from || rides.has(end) || capital === undefined) continue;
      const crossings = distance.get(capital);
      if (crossings === undefined || !isFriendlyGround(scenario, state, factionId, end)) continue;
      const stations: SubTerritoryId[] = [capital];
      for (let at = previous.get(capital); at !== undefined; at = previous.get(at)) stations.unshift(at);
      const through: TerritoryId[] = [];
      for (const station of stations) {
        const territoryId = territoryOf(station);
        if (territoryId !== undefined && territoryId !== from && territoryId !== end && !through.includes(territoryId)) through.push(territoryId);
      }
      rides.set(end, { boarding, crossings, end, level, range, start: from, stations, through });
    }
  }
  return rides;
}

/**
 * X6: every rail link between adjacent sub-territories that both have rail, with the lower of
 * their two levels. Each pair appears once, in border order.
 */
export function railLinks(scenario: Scenario, state: GameState): readonly { readonly a: SubTerritoryId; readonly b: SubTerritoryId; readonly level: number }[] {
  return scenario.subTerritoryBorders.flatMap(([a, b]) => {
    const level = Math.min(railLevel(state, a), railLevel(state, b));
    return level > 0 ? [{ a, b, level }] : [];
  });
}

/** X6: the sub-territories an army in `from` can ride through this turn, and the links between them. */
export function rideableNetwork(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId): ReadonlySet<SubTerritoryId> {
  const stations = new Set<SubTerritoryId>();
  for (const ride of railReach(scenario, state, factionId, from).values()) for (const station of ride.stations) stations.add(station);
  return stations;
}

/* ---------------------------------------------------------------- sea (M5) */

/** M5: the faction's best port in a territory: the highest level among the sub-territories it holds. */
export function friendlyPort(scenario: Scenario, state: GameState, factionId: FactionId, territoryId: TerritoryId): { readonly level: number; readonly subTerritoryId: SubTerritoryId } | undefined {
  let best: { readonly level: number; readonly subTerritoryId: SubTerritoryId } | undefined;
  for (const id of subTerritoriesOf(scenario, territoryId)) {
    const sub = state.subTerritories[id];
    if (sub === undefined || sub.holder !== factionId || sub.port <= 0) continue;
    if (best === undefined || sub.port > best.level) best = { level: sub.port, subTerritoryId: id };
  }
  return best;
}

/** M5, D7: armies a friendly port lands per turn. */
export function portLandings(scenario: Scenario, level: number): number {
  return level * (scenario.movement?.landingsPerPortLevel ?? 1);
}

/** T4: the sea between two territories is closed this turn (winter Rain), by the weather module's hook. */
export function seaClosed(scenario: Scenario, state: GameState, from: TerritoryId, to: TerritoryId): boolean {
  return hookedSeaClosed({ from, scenario, state, to });
}

/** M5: how a sea leg from `from` lands in `to`: in a friendly port, or as an amphibious assault. */
export function landingAt(scenario: Scenario, state: GameState, factionId: FactionId, to: TerritoryId):
  | { readonly kind: "port"; readonly level: number; readonly subTerritoryId: SubTerritoryId }
  | { readonly kind: "amphibious" } {
  const port = friendlyPort(scenario, state, factionId, to);
  return port === undefined ? { kind: "amphibious" } : { kind: "port", ...port };
}

/** A key for an undirected connection. */
export function connectionKey(a: TerritoryId, b: TerritoryId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
