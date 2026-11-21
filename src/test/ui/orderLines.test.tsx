import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { moveRoutes } from "../../main/engine/movement/routes";
import { initialGameState } from "../../main/engine/resolution";
import type { MoveOrder, SubTerritoryId } from "../../main/engine/types";
import { battleMarkPoints, RouteLayer } from "../../main/map/RouteLayer";
import {
  groupRoutes,
  laneOffset,
  offsetPolyline,
  pointAlong,
  polylineHead,
  polylineLength,
  polylinePath,
  routeLine,
  routePoints,
  routeShape,
  trimPolyline
} from "../../main/map/routes";
import { staticMapView } from "../../main/map/view";
import { faction, move, spain, territory, unit } from "../support";

afterEach(cleanup);

const scenario = spain();
const start = initialGameState(scenario);
const republic = faction("republic");
const madrid = territory("madrid");

/** Every sub-territory sits at a point named by its id's length, so the tests can follow a line. */
const subPoint = (id: SubTerritoryId) => ({ x: id.length * 10, y: id.length });
const anchor = (id: string) => ({ x: id.length, y: 0 });

function railOrder(): MoveOrder {
  const route = moveRoutes(scenario, start, republic, madrid, [unit("rep-wad-ras-1")]).get(territory("catalunya"));
  if (route === undefined) throw new Error("fixture: Madrid rides to Catalonia");
  return { factionId: republic, from: madrid, kind: "move", legs: route.legs, to: territory("catalunya"), unitId: unit("rep-wad-ras-1") };
}

describe("U8: order lines follow the links they use", () => {
  it("gives a March line its one link and a Rail line every link it rides", () => {
    const [march] = groupRoutes([move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha")], [], scenario, start);
    expect(march?.line).toEqual(["madrid", "toledo"]);
    const [rail] = groupRoutes([railOrder()], [], scenario, start);
    expect(rail?.line.length).toBeGreaterThan(2);
    expect(rail?.line[0]).toBe("madrid");
  });

  it("draws routes over different links as separate lines, and nothing without the board", () => {
    const groups = groupRoutes([railOrder(), { ...move("republic", "rep-otumba-9", "madrid", "catalunya") }], [], scenario, start);
    expect(new Set(groups.map((group) => group.key)).size).toBe(groups.length);
    expect(groupRoutes([move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha")], []).map((group) => group.line)).toEqual([[]]);
  });

  it("reads each line once per board", () => {
    const entry = { factionId: republic, from: madrid, to: territory("castilla-la-mancha"), unitId: unit("rep-wad-ras-1") };
    expect(routeLine(scenario, start, entry)).toBe(routeLine(scenario, start, entry));
    // A move the board no longer describes has no line.
    expect(routeLine(scenario, start, { ...entry, to: territory("ceuta") })).toEqual([]);
  });

  it("keeps only a line from the origin to the destination, and traces a battle along its move's legs", () => {
    const entry = { factionId: republic, from: madrid, to: territory("castilla-la-mancha"), unitId: unit("rep-wad-ras-1") };
    // A board where Castilla-La Mancha's ground reads as Madrid's: the traced line no longer ends in the destination.
    const moved = { ...scenario, index: { ...scenario.index, subTerritories: new Map([...scenario.index.subTerritories].map(([id, sub]) => [id, sub.territoryId === territory("castilla-la-mancha") ? { ...sub, territoryId: madrid } : sub])) } };
    expect(routeLine(moved, { ...start }, entry)).toEqual([]);
    const ride = railOrder();
    const battle = groupRoutes([], [
      { kind: "bounced-move", order: ride } as never,
      { attacker: { armies: [{ factionId: republic, from: madrid, unitId: ride.unitId }] }, defender: { armies: [] }, dice: "d6", kind: "battle", result: "attacker-demoralized", site: { kind: "assault", territoryId: territory("catalunya") } } as never
    ], scenario, start);
    expect(battle.find((group) => group.kind === "battle")?.line.length).toBeGreaterThan(2);
  });

  it("runs through the sub-territories' capitals, or straight between anchors without them", () => {
    const route = { from: madrid, line: ["madrid", "toledo"].map((id) => id as SubTerritoryId), to: territory("castilla-la-mancha") };
    expect(routePoints(route, { anchor, subPoint })).toEqual([{ x: 60, y: 6 }, { x: 60, y: 6 }]);
    expect(routePoints(route, { anchor })).toEqual([{ x: 6, y: 0 }, { x: 18, y: 0 }]);
    expect(routePoints({ ...route, line: [] }, { anchor, subPoint })).toEqual([{ x: 6, y: 0 }, { x: 18, y: 0 }]);
    expect(routePoints(route, { anchor, subPoint: () => undefined })).toEqual([{ x: 6, y: 0 }, { x: 18, y: 0 }]);
  });
});

describe("U8: polyline geometry", () => {
  const bend = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];

  it("measures, walks and trims a line", () => {
    expect(polylineLength(bend)).toBe(200);
    expect(pointAlong(bend, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(bend, 0.75)).toEqual({ x: 100, y: 50 });
    expect(pointAlong(bend, 2)).toEqual({ x: 100, y: 100 });
    expect(pointAlong([], 0.5)).toEqual({ x: 0, y: 0 });
    expect(pointAlong([{ x: 3, y: 3 }, { x: 3, y: 3 }], 0.5)).toEqual({ x: 3, y: 3 });
    expect(trimPolyline(bend, 10, 10)).toEqual([{ x: 10, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 90 }]);
    // A short line keeps its middle fifth.
    expect(trimPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], 50, 50)).toEqual([{ x: 4, y: 0 }, { x: 6, y: 0 }]);
    const point = [{ x: 5, y: 5 }, { x: 5, y: 5 }];
    expect(trimPolyline(point, 1, 1)).toBe(point);
  });

  it("offsets lines to their right, so opposite directions part", () => {
    expect(offsetPolyline(bend, 0)).toBe(bend);
    expect(offsetPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], 2)).toEqual([{ x: 0, y: 2 }, { x: 10, y: 2 }]);
    expect(offsetPolyline([{ x: 10, y: 0 }, { x: 0, y: 0 }], 2)).toEqual([{ x: 10, y: -2 }, { x: 0, y: -2 }]);
    expect(offsetPolyline([{ x: 1, y: 1 }, { x: 1, y: 1 }], 2)).toEqual([{ x: 1, y: 1 }, { x: 1, y: 1 }]);
    const corner = offsetPolyline(bend, 2)[1];
    expect(corner?.x).toBeCloseTo(99);
    expect(corner?.y).toBeCloseTo(1);
    expect(laneOffset(1)).toBeGreaterThan(laneOffset(0));
  });

  it("heads the last link and writes straight segments only", () => {
    expect(polylineHead(bend, 5).split(" ")).toHaveLength(3);
    expect(polylineHead([], 5).split(" ")[0]).toBe("0,0");
    expect(polylinePath(bend)).toBe("M 0 0 L 100 0 L 100 100");
    const shape = routeShape({ from: madrid, lane: 0, line: [], to: territory("catalunya") }, { anchor: () => ({ x: 0, y: 0 }) }, 1);
    expect(shape.path).not.toContain("Q");
  });
});

describe("U8: the route layer", () => {
  it("draws a planned ride along its links, and puts a battle's mark on its line", () => {
    const view = { ...staticMapView, plannedOrders: [railOrder()] };
    render(<svg><RouteLayer anchor={anchor} factionColor={() => "#c00"} game={start} scenario={scenario} subPoint={subPoint} unit={1} view={view} /></svg>);
    const route = document.querySelector("[data-route-kind='planned']");
    expect(route?.getAttribute("data-route-links")?.split(" ").length).toBeGreaterThan(2);
    expect(route?.querySelector(".map-route-line")?.getAttribute("d")).toMatch(/^M [^Q]* L /);
    cleanup();
    render(<svg><RouteLayer anchor={anchor} factionColor={() => "#c00"} scenario={scenario} unit={1} view={view} /></svg>);
    expect(document.querySelector("[data-route-kind='planned']")?.hasAttribute("data-route-links")).toBe(false);
    expect(battleMarkPoints(view, scenario, anchor, 1, { game: start, subPoint })).toEqual([]);
    expect(battleMarkPoints(view, scenario, anchor, 1)).toEqual([]);
  });
});
