import { type JSX, useMemo } from "react";
import { capitalOf, railLinks, rideableNetwork } from "../../engine/movement/network";
import { armyKey, describeRoute, legsOf, type MoveRoute } from "../../engine/movement/routes";
import type { FactionId, GameState, MoveOrder, Scenario, SubTerritoryId, TerritoryId } from "../../engine/types";
import { routeTag, selectionRoutes } from "../../presentation/movement";
import type { MapView } from "../view";
import type { MapPackage, MapPoint, MapSubTerritory } from "../../scenarios/loader";
import type { MapLayerProps } from "./slots";

type Point = { readonly x: number; readonly y: number };

interface RailLayerProps extends MapLayerProps {
  /** The phone sheet layout: branch lines (level 1) wait for the detail zoom (M4). */
  readonly narrow?: boolean;
}

/**
 * X6: rail on the map. Lines are thin curves between sub-territory stations (each one's chief
 * town), joining every two bordering sub-territories that both have rail. Main lines (level 2
 * and up) show at full-map zoom, every line from the operational zoom (the detail zoom on a
 * phone, M4). When units are selected, the network they can ride this turn is drawn in the route
 * colour, and while a destination is being chosen each rail or sea route is traced (X5). Planned
 * rail and sea moves stay traced. Decorative: the Orders pane says the same in words.
 *
 * A `<g>` in screen pixels, drawn inside the vector layer under the names and cities (B4); see
 * `VectorLayer`'s `underlay`.
 */
export function RailLayer({ game, level, narrow = false, scenarioPackage, toScreen, view }: RailLayerProps): JSX.Element | null {
  const { map, scenario } = scenarioPackage;
  const links = useMemo(() => railLinks(scenario, game), [scenario, game]);
  const selection = useMemo(() => selectedArmy(game, [...view.selectedUnitIds]), [game, view.selectedUnitIds]);
  const rideable = useMemo(
    () => (selection === undefined || scenario.rules.movement !== "allowance" ? new Set<SubTerritoryId>() : rideableNetwork(scenario, game, selection.factionId, selection.from)),
    [game, scenario, selection]
  );
  const choosing = view.destinationIds.length > 0 && selection !== undefined;
  const routes = useMemo(
    () => (choosing ? [...(selectionRoutes(scenario, game, selection.factionId, selection.from, [...view.selectedUnitIds], view.plannedOrders)?.values() ?? [])] : []),
    [choosing, game, scenario, selection, view.plannedOrders, view.selectedUnitIds]
  );
  const planned = useMemo(() => plannedRouteList(scenario, game, view.plannedOrders), [game, scenario, view.plannedOrders]);
  if (stationPoints(map).size === 0 || links.length === 0) return null;

  const station = (id: SubTerritoryId): Point | undefined => {
    const entry = stationPoints(map).get(id);
    return entry === undefined ? undefined : toScreen(entry.capital);
  };
  const branchLines = narrow ? level === "detail" : level !== "overview";
  const shown = links.filter((link) => branchLines || link.level >= 2 || (rideable.has(link.a) && rideable.has(link.b)));
  const stations = new Set(shown.flatMap((link) => [link.a, link.b]));
  const traced = [...routes.filter((route) => route.shape !== "step" && route.shape !== "march"), ...planned];

  return (
    <g aria-hidden="true" className="rail-layer" data-testid="rail-layer">
      {shown.map((link) => {
        const a = station(link.a);
        const b = station(link.b);
        if (a === undefined || b === undefined) return null;
        const d = curve(a, b, link.a < link.b ? 1 : -1);
        const width = 0.8 + 0.45 * link.level;
        const ride = rideable.has(link.a) && rideable.has(link.b);
        return (
          <g data-level={link.level} key={`${link.a}|${link.b}`}>
            <path className="rail-line-halo" d={d} strokeWidth={width + 1} />
            <path className="rail-line" d={d} data-rideable={ride ? "true" : undefined} strokeWidth={ride ? width + 0.8 : width} />
            {link.level >= 2 ? <path className="rail-ties" d={d} strokeWidth={width + 1.6} /> : null}
          </g>
        );
      })}
      {[...stations].map((id) => {
        const at = station(id);
        if (at === undefined) return null;
        const size = (game.subTerritories[id]?.rail ?? 1) >= 3 ? 5 : 4;
        return <rect className="rail-station" data-rideable={rideable.has(id) ? "true" : undefined} height={size} key={id} width={size} x={at.x - size / 2} y={at.y - size / 2} />;
      })}
      {traced.map((route) => {
        const points = routePoints(scenario, map, route).map(toScreen);
        return points.length < 2 ? null : (
          <path
            className="move-route"
            d={polylineCurve(points)}
            data-kind={route.sea === undefined ? "rail" : "sea"}
            data-to={route.to}
            key={`${route.from}>${route.legs.map((leg) => `${leg.kind}:${leg.to}`).join(">")}`}
          />
        );
      })}
    </g>
  );
}

const noStations: ReadonlyMap<SubTerritoryId, MapSubTerritory> = new Map();

/** Each sub-territory's points on the map (`m3r1-sub-territories`' map field); empty without them. */
function stationPoints(map: MapPackage): ReadonlyMap<SubTerritoryId, MapSubTerritory> {
  return map.subTerritories?.entries ?? noStations;
}

/** X5: each highlighted destination's route tag ("By rail"), for the odds plaques. */
export function destinationTags(scenario: Scenario, game: GameState, view: MapView): ReadonlyMap<TerritoryId, string> | undefined {
  const selection = selectedArmy(game, [...view.selectedUnitIds]);
  if (selection === undefined) return undefined;
  const routes = selectionRoutes(scenario, game, selection.factionId, selection.from, [...view.selectedUnitIds], view.plannedOrders);
  if (routes === undefined) return undefined;
  return new Map([...routes].flatMap(([to, route]): [TerritoryId, string][] => {
    const tag = routeTag(route, view.destinationEstimates?.get(to)?.kind === "battle", true);
    return tag === undefined ? [] : [[to, tag]];
  }));
}

/** The faction and territory of the selected units, when they stand together. */
function selectedArmy(game: GameState, unitIds: readonly string[]): { readonly factionId: FactionId; readonly from: TerritoryId } | undefined {
  const units = unitIds.flatMap((id) => game.units[id as keyof typeof game.units] ?? []);
  const [first] = units;
  if (first === undefined || units.some((unit) => unit.territoryId !== first.territoryId)) return undefined;
  return { factionId: first.factionId, from: first.territoryId };
}

/** Planned rail and sea moves, one per army. */
function plannedRouteList(scenario: Scenario, game: GameState, orders: readonly MoveOrder[]): readonly MoveRoute[] {
  if (scenario.rules.movement !== "allowance") return [];
  const seen = new Set<string>();
  const routes: MoveRoute[] = [];
  for (const order of orders) {
    const key = armyKey(scenario, order);
    if (seen.has(key)) continue;
    seen.add(key);
    const check = describeRoute(scenario, game, order.factionId, order.from, legsOf(scenario, order), true);
    if (check.ok && check.route.shape !== "step" && check.route.shape !== "march") routes.push(check.route);
  }
  return routes;
}

/** Map points a route passes: territory labels for its ends and steps, each station for a ride. */
export function routePoints(scenario: Scenario, map: MapPackage, route: MoveRoute): readonly MapPoint[] {
  const territoryPoint = (id: TerritoryId): MapPoint | undefined => {
    const capital = capitalOf(scenario, id);
    return (capital === undefined ? undefined : stationPoints(map).get(capital)?.capital) ?? map.territories.get(id)?.label;
  };
  const points: MapPoint[] = [];
  const push = (point: MapPoint | undefined): void => {
    if (point !== undefined) points.push(point);
  };
  push(territoryPoint(route.from));
  for (const leg of route.legs) {
    if (leg.kind === "rail" && route.rail !== undefined) {
      for (const id of route.rail.stations) push(stationPoints(map).get(id)?.capital);
    } else if (leg.kind === "sea" && route.sea !== undefined) {
      push(stationPoints(map).get(route.sea.departure)?.capital);
      push(stationPoints(map).get(route.sea.port ?? route.sea.departure)?.capital ?? territoryPoint(leg.to));
      if (route.sea.port === undefined) push(territoryPoint(leg.to));
    } else {
      push(territoryPoint(leg.to));
    }
  }
  return points.filter((point, index) => index === 0 || point.x !== points[index - 1]?.x || point.y !== points[index - 1]?.y);
}

/** A gentle quadratic curve from a to b, bowed to one side. */
function curve(a: Point, b: Point, side: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const bow = 0.12 * side;
  const cx = (a.x + b.x) / 2 - dy * bow;
  const cy = (a.y + b.y) / 2 + dx * bow;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

/** A smooth path through the points: quadratic curves through each segment's midpoint. */
function polylineCurve(points: readonly Point[]): string {
  const [first, ...rest] = points;
  if (first === undefined) return "";
  let d = `M${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (let index = 0; index < rest.length; index += 1) {
    const control = rest[index];
    const next = rest[index + 1];
    if (control === undefined) continue;
    if (next === undefined) {
      d += ` L${control.x.toFixed(1)} ${control.y.toFixed(1)}`;
    } else {
      d += ` Q${control.x.toFixed(1)} ${control.y.toFixed(1)} ${((control.x + next.x) / 2).toFixed(1)} ${((control.y + next.y) / 2).toFixed(1)}`;
    }
  }
  return d;
}
