import { capitalOf, railLinks, rideableNetwork } from "../engine/movement/network";
import { armyKey, describeRoute, legsOf, type MoveRoute } from "../engine/movement/routes";
import type { FactionId, GameState, MoveOrder, Scenario, SubTerritoryId, TerritoryId, UnitId } from "../engine/types";
import { selectionRoutes } from "./movement";

/** X5, X6: what the rail layer draws, before it is placed on the map. The layer memoizes each of these. */

export type RailLine = ReturnType<typeof railLinks>[number];

/** Every two bordering sub-territories joined by rail, with the line's level. */
export function railLines(scenario: Scenario, state: GameState): readonly RailLine[] {
  return railLinks(scenario, state);
}

export interface SelectedArmy {
  readonly factionId: FactionId;
  readonly from: TerritoryId;
}

/** The faction and territory of the selected units, when they stand together. */
export function selectedArmy(state: GameState, unitIds: readonly UnitId[]): SelectedArmy | undefined {
  const units = unitIds.flatMap((id) => state.units[id] ?? []);
  const [first] = units;
  if (first === undefined || units.some((unit) => unit.territoryId !== first.territoryId)) return undefined;
  return { factionId: first.factionId, from: first.territoryId };
}

/** The stations the selected army can ride to this turn; none when nothing stands selected. */
export function rideableStations(scenario: Scenario, state: GameState, army: SelectedArmy | undefined): ReadonlySet<SubTerritoryId> {
  return army === undefined || scenario.rules.movement !== "allowance" ? new Set() : rideableNetwork(scenario, state, army.factionId, army.from);
}

/** The rail and sea routes open to the selected army. */
export function ridesFor(scenario: Scenario, state: GameState, army: SelectedArmy, unitIds: readonly UnitId[], planned: readonly MoveOrder[]): readonly MoveRoute[] {
  return [...(selectionRoutes(scenario, state, army.factionId, army.from, unitIds, planned)?.values() ?? [])].filter(rides);
}

/** Planned rail and sea moves, one per army. */
export function plannedRides(scenario: Scenario, state: GameState, orders: readonly MoveOrder[]): readonly MoveRoute[] {
  if (scenario.rules.movement !== "allowance") return [];
  const seen = new Set<string>();
  const routes: MoveRoute[] = [];
  for (const order of orders) {
    const key = armyKey(scenario, order);
    if (seen.has(key)) continue;
    seen.add(key);
    const check = describeRoute(scenario, state, order.factionId, order.from, legsOf(scenario, order), true);
    if (check.ok && rides(check.route)) routes.push(check.route);
  }
  return routes;
}

function rides(route: MoveRoute): boolean {
  return route.shape !== "step" && route.shape !== "march";
}

/** A point a route passes: the first of its stations the map places, else the territory's label. */
export interface RouteStop {
  readonly stations: readonly SubTerritoryId[];
  readonly territory?: TerritoryId | undefined;
}

/** The stops of a route: the capitals at its ends and steps, each station of a ride, and a voyage's ports. */
export function routeStops(scenario: Scenario, route: MoveRoute): readonly RouteStop[] {
  const at = (territory: TerritoryId, ...first: readonly SubTerritoryId[]): RouteStop => {
    const capital = capitalOf(scenario, territory);
    return { stations: capital === undefined ? first : [...first, capital], territory };
  };
  return [at(route.from), ...route.legs.flatMap((leg): readonly RouteStop[] => {
    if (leg.kind === "rail" && route.rail !== undefined) return route.rail.stations.map((id) => ({ stations: [id] }));
    if (leg.kind === "sea" && route.sea !== undefined) {
      const { departure, port } = route.sea;
      return [{ stations: [departure] }, at(leg.to, port ?? departure), ...(port === undefined ? [at(leg.to)] : [])];
    }
    return [at(leg.to)];
  })];
}
