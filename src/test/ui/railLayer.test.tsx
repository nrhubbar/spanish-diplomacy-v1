import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { moveRoutes, type MoveRoute } from "../../main/engine/movement/routes";
import { initialGameState } from "../../main/engine/resolution";
import type { GameState, MoveOrder, SubTerritoryId, UnitId } from "../../main/engine/types";
import { destinationTags, RailLayer, routePoints } from "../../main/map/layers/RailLayer";
import type { MapLayerProps } from "../../main/map/layers/slots";
import { type MapView, staticMapView } from "../../main/map/view";
import type { ScenarioPackage } from "../../main/scenarios/loader";
import { faction, spainId, territory, testRegistry, unit } from "../support";

afterEach(cleanup);

const sub = (id: string): SubTerritoryId => id as SubTerritoryId;
const identity = (point: { readonly x: number; readonly y: number }) => point;
const republic = faction("republic");
const madridUnits: readonly UnitId[] = [unit("rep-wad-ras-1"), unit("rep-covadonga-4")];

const spainPackage = (): ScenarioPackage => testRegistry().require(spainId);

function renderLayer(props: Partial<MapLayerProps> & { readonly view?: MapView } = {}) {
  const scenarioPackage = props.scenarioPackage ?? spainPackage();
  const game = props.game ?? initialGameState(scenarioPackage.scenario);
  const { container } = render(
    <svg>
      <RailLayer game={game} level={props.level ?? "detail"} scenarioPackage={scenarioPackage} toScreen={identity} unitSymbols={new Map()} view={props.view ?? staticMapView} />
    </svg>
  );
  return container;
}

function railRoute(game: GameState): MoveRoute {
  const { scenario } = spainPackage();
  const found = [...moveRoutes(scenario, game, republic, territory("madrid"), madridUnits).values()].find((route) => route.shape === "rail");
  if (found === undefined) throw new Error("No rail route from Madrid.");
  return found;
}

const toOrder = (route: MoveRoute, unitId: UnitId): MoveOrder => ({ factionId: republic, from: route.from, kind: "move", legs: route.legs, to: route.to, unitId });

describe("the rail layer (X6)", () => {
  it("draws every rail line and station at the detail zoom, main lines and branch lines", () => {
    const container = renderLayer();
    const layer = container.querySelector("[data-testid='rail-layer']");
    expect(layer).not.toBeNull();
    expect(layer).toHaveAttribute("aria-hidden", "true");
    const groups = [...container.querySelectorAll("g[data-level]")];
    expect(groups.length).toBeGreaterThan(5);
    expect(groups.every((group) => group.querySelector(".rail-line") !== null)).toBe(true);
    const main = groups.filter((group) => Number(group.getAttribute("data-level")) >= 2);
    const branch = groups.filter((group) => Number(group.getAttribute("data-level")) < 2);
    expect(main.length).toBeGreaterThan(0);
    expect(branch.length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".rail-station").length).toBeGreaterThan(5);
    expect(container.querySelector("[data-rideable]")).toBeNull();
    expect(container.querySelector(".move-route")).toBeNull();
    // Each line is a path between two stations.
    expect(groups[0]?.querySelector(".rail-line")?.getAttribute("d")).toMatch(/^M/u);
  });

  it("sizes a station by its rail level", () => {
    const container = renderLayer();
    const sizes = new Set([...container.querySelectorAll(".rail-station")].map((station) => Number(station.getAttribute("width"))));
    // Busier stations are drawn larger.
    expect(sizes.size).toBeGreaterThan(1);
    expect([...sizes].every((size) => size > 0)).toBe(true);
  });

  it("keeps only main lines at the overview zoom, unless the selection can ride them", () => {
    const detail = renderLayer().querySelectorAll("g[data-level]").length;
    cleanup();
    const overview = renderLayer({ level: "overview" });
    const levels = [...overview.querySelectorAll("g[data-level]")].map((group) => Number(group.getAttribute("data-level")));
    expect(levels.length).toBeLessThan(detail);
    expect(levels.every((level) => level >= 2)).toBe(true);
  });

  it("lights the network the selected units can ride", () => {
    const view: MapView = { ...staticMapView, selectedUnitIds: new Set(madridUnits) };
    const container = renderLayer({ view });
    const rideable = container.querySelectorAll(".rail-line[data-rideable='true']");
    expect(rideable.length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".rail-station[data-rideable='true']").length).toBeGreaterThan(1);
  });

  it("lights nothing for units standing apart, or under single-step movement", () => {
    const apart: MapView = { ...staticMapView, selectedUnitIds: new Set([unit("rep-wad-ras-1"), unit("rep-asturian-militia")]) };
    expect(renderLayer({ view: apart }).querySelector("[data-rideable]")).toBeNull();
    cleanup();
    const base = spainPackage();
    const single: ScenarioPackage = { ...base, scenario: { ...base.scenario, rules: { ...base.scenario.rules, movement: "single-step" } } };
    const view: MapView = { ...staticMapView, destinationIds: [territory("valencia")], plannedOrders: [], selectedUnitIds: new Set(madridUnits) };
    const container = renderLayer({ scenarioPackage: single, view });
    expect(container.querySelector("[data-rideable]")).toBeNull();
    expect(container.querySelector(".move-route")).toBeNull();
  });

  it("traces rail routes while a destination is chosen, but not steps", () => {
    const game = initialGameState(spainPackage().scenario);
    const ride = railRoute(game);
    const view: MapView = { ...staticMapView, destinationIds: [ride.to], selectedUnitIds: new Set(madridUnits) };
    const container = renderLayer({ game, view });
    const traced = [...container.querySelectorAll(".move-route")];
    expect(traced.length).toBeGreaterThan(0);
    expect(traced.find((path) => path.getAttribute("data-to") === ride.to)).toHaveAttribute("data-kind", "rail");
    expect(traced.some((path) => path.getAttribute("data-to") === "castilla-la-mancha" && path.getAttribute("data-kind") === null)).toBe(false);
    expect(traced[0]?.getAttribute("d")).toMatch(/^M/u);
  });

  it("traces a sea route from a port", () => {
    const game = initialGameState(spainPackage().scenario);
    const sailors = Object.values(game.units).filter((entry) => entry.factionId === republic && entry.territoryId === "catalunya").slice(0, 2).map((entry) => entry.id);
    const view: MapView = { ...staticMapView, destinationIds: [territory("islas-baleares")], selectedUnitIds: new Set(sailors) };
    const container = renderLayer({ game, view });
    expect(container.querySelector(".move-route[data-to='islas-baleares']")).toHaveAttribute("data-kind", "sea");
  });

  it("keeps planned rail moves traced, once per army", () => {
    const game = initialGameState(spainPackage().scenario);
    const ride = railRoute(game);
    const plannedOrders = [toOrder(ride, unit("rep-wad-ras-1")), toOrder(ride, unit("rep-covadonga-4")), { factionId: republic, from: territory("madrid"), kind: "move" as const, to: territory("castilla-la-mancha"), unitId: unit("rep-madrid-security") }];
    const container = renderLayer({ game, view: { ...staticMapView, plannedOrders } });
    const traced = [...container.querySelectorAll(".move-route")];
    expect(traced).toHaveLength(1);
    expect(traced[0]).toHaveAttribute("data-to", ride.to);
  });

  it("draws nothing without rail, or without sub-territory points on the map", () => {
    const base = spainPackage();
    const start = initialGameState(base.scenario);
    const noRail: GameState = { ...start, subTerritories: Object.fromEntries(Object.entries(start.subTerritories).map(([id, entry]) => [id, { ...entry, rail: 0 }])) };
    expect(renderLayer({ game: noRail }).querySelector("[data-testid='rail-layer']")).toBeNull();
    cleanup();
    const bare = { ...base.map };
    delete (bare as { subTerritories?: unknown }).subTerritories;
    expect(renderLayer({ scenarioPackage: { ...base, map: bare } }).querySelector("[data-testid='rail-layer']")).toBeNull();
  });
});

describe("route points and destination tags (X5)", () => {
  const { map, scenario } = spainPackage();
  const game = initialGameState(scenario);
  const capital = (id: string) => map.subTerritories?.entries.get(sub(id))?.capital;

  const base = (overrides: Partial<MoveRoute>): MoveRoute => ({
    cost: 1, from: territory("valencia"), legs: [], rough: [], shape: "step", staging: territory("valencia"), steps: 1, to: territory("islas-baleares"), transit: [], ...overrides
  });

  it("passes each station of a ride", () => {
    const ride = railRoute(game);
    const points = routePoints(scenario, map, ride);
    expect(points[0]).toEqual(capital("madrid"));
    expect(points.length).toBeGreaterThanOrEqual(2);
    // Repeated points are dropped.
    expect(points.every((point, index) => index === 0 || point.x !== points[index - 1]?.x || point.y !== points[index - 1]?.y)).toBe(true);
  });

  it("sails from the departure port to the landing port, or storms the coast", () => {
    const port = routePoints(scenario, map, base({ legs: [{ kind: "sea", to: territory("islas-baleares") }], sea: { departure: sub("valencia"), kind: "port", level: 1, port: sub("mallorca") }, shape: "sea" }));
    expect(port).toEqual([capital("valencia"), capital("mallorca")]);
    const storm = routePoints(scenario, map, base({ legs: [{ kind: "sea", to: territory("islas-baleares") }], sea: { departure: sub("alicante"), kind: "amphibious" }, shape: "sea" }));
    expect(storm[0]).toEqual(capital("valencia"));
    expect(storm[1]).toEqual(capital("alicante"));
    expect(storm.at(-1)).toEqual(capital("mallorca"));
  });

  it("treats a rail or sea leg without its ride or landing as a step", () => {
    const points = routePoints(scenario, map, base({ legs: [{ kind: "rail", to: territory("murcia") }, { kind: "sea", to: territory("islas-baleares") }] }));
    expect(points).toEqual([capital("valencia"), capital("murcia"), capital("mallorca")]);
  });

  it("falls back to the territory label where a territory has no capital point", () => {
    const bare = { ...map };
    delete (bare as { subTerritories?: unknown }).subTerritories;
    const points = routePoints(scenario, bare, base({ legs: [{ kind: "land", to: territory("murcia") }], to: territory("murcia") }));
    expect(points).toEqual([map.territories.get(territory("valencia"))?.label, map.territories.get(territory("murcia"))?.label]);
    expect(routePoints(scenario, bare, base({ from: territory("atlantis"), legs: [] }))).toEqual([]);
  });

  it("tags each offered destination that is not a plain step", () => {
    expect(destinationTags(scenario, game, staticMapView)).toBeUndefined();
    const single = { ...scenario, rules: { ...scenario.rules, movement: "single-step" as const } };
    const view: MapView = { ...staticMapView, selectedUnitIds: new Set(madridUnits) };
    expect(destinationTags(single, game, view)).toBeUndefined();
    const tags = destinationTags(scenario, game, view);
    const ride = railRoute(game);
    expect(tags?.get(ride.to)).toBe("By rail");
    expect(tags?.has(territory("castilla-la-mancha"))).toBe(false);
    expect(tags?.get(territory("aragon"))).toMatch(/^Rail\b/u);
    expect(tags?.get(territory("aragon"))).not.toMatch(/attack/u);
    const withBattle = destinationTags(scenario, game, { ...view, destinationEstimates: new Map([[territory("aragon"), { kind: "battle" } as never]]) });
    expect(withBattle?.get(territory("aragon"))).toMatch(/attack/u);
  });
});
