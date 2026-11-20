import { describe, expect, it } from "vitest";
import { containsPoint, type Point, ringArea } from "../../scripts/map/geometry.ts";
import { evenOddArea, partitionRegion } from "../../scripts/map/partition.ts";
import { buildSubTerritories } from "../../scripts/map/subTerritories.ts";
import { connectionEntries, measureTopology, seaLinkBorders } from "../../scripts/map/topology.ts";

const square = (x: number, y: number, width: number, height = width): Point[] => [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
const options = { cellSize: 0.125, tolerance: 0.25 };
const areaOf = (parts: { id: string; rings: Point[][] }[], id: string): number => evenOddArea(parts.find((part) => part.id === id)?.rings ?? []);

describe("evenOddArea", () => {
  it("subtracts holes and adds islands inside holes", () => {
    expect(evenOddArea([square(0, 0, 10), square(2, 2, 6), square(4, 4, 2)])).toBeCloseTo(100 - 36 + 4, 9);
  });
});

describe("partitionRegion", () => {
  // A 10 x 10 square with a 2 x 2 hole, plus a 3 x 3 island.
  const region = [square(0, 0, 10), square(6, 6, 2), square(20, 0, 3)];

  it("cuts a region along province polygons, keeping its holes and islands, and covers it exactly", () => {
    const parts = partitionRegion(region, { kind: "polygons", sources: [{ id: "west", rings: [square(-5, -5, 9.3, 40)] }, { id: "east", rings: [square(4.3, -5, 30, 40)] }] }, options);
    expect(parts.map((part) => part.id).sort()).toEqual(["east", "west"]);
    expect(areaOf(parts, "west") + areaOf(parts, "east")).toBeCloseTo(105, 6);
    expect(Math.abs(areaOf(parts, "west") - 43)).toBeLessThan(10 * options.cellSize);
    const east = parts.find((part) => part.id === "east")?.rings ?? [];
    expect(containsPoint(east, { x: 7, y: 7 })).toBe(false);
    expect(containsPoint(east, { x: 21, y: 1 })).toBe(true);
    // Every outer vertex of the region is a vertex of some part: outer edges are the region's own.
    const vertices = new Set(parts.flatMap((part) => part.rings.flat()).map((point) => `${String(point.x)},${String(point.y)}`));
    for (const point of region.flat()) expect(vertices.has(`${String(point.x)},${String(point.y)}`)).toBe(true);
  });

  it("gives gaps between sources the nearest label, or the fallback", () => {
    const sources = [{ id: "west", rings: [square(-5, -5, 8, 40)] }, { id: "east", rings: [square(5, -5, 30, 40)] }];
    const nearest = partitionRegion([square(0, 0, 10)], { kind: "polygons", sources }, options);
    expect(areaOf(nearest, "west")).toBeCloseTo(40, 0);
    const fallback = partitionRegion([square(0, 0, 10)], { kind: "polygons", sources, fallback: "middle" }, options);
    expect(areaOf(fallback, "middle")).toBeCloseTo(20, 0);
  });

  it("rejects sources that cover nothing", () => {
    expect(() => partitionRegion([square(0, 0, 10)], { kind: "polygons", sources: [] }, options)).toThrow("No label source");
  });

  it("cuts along hand-drawn lines from seeds, including a closed pocket", () => {
    const lines = [[{ x: 4.3, y: -1 }, { x: 4.3, y: 11 }], [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 2, y: 2 }]];
    const seeds = [{ id: "west", point: { x: 1, y: 1 } }, { id: "east", point: { x: 9, y: 1 } }, { id: "pocket", point: { x: 2.5, y: 2.5 } }];
    const parts = partitionRegion(region, { kind: "lines", lines, seeds }, options);
    expect(areaOf(parts, "west") + areaOf(parts, "east") + areaOf(parts, "pocket")).toBeCloseTo(105, 6);
    expect(areaOf(parts, "pocket")).toBeGreaterThan(0.5);
    const west = parts.find((part) => part.id === "west")?.rings ?? [];
    expect(containsPoint(west, { x: 2.5, y: 2.5 })).toBe(false);
    expect(containsPoint(west, { x: 1, y: 8 })).toBe(true);
    // The island no seed reaches joins the nearest part.
    expect(containsPoint(parts.find((part) => part.id === "east")?.rings ?? [], { x: 21, y: 1 })).toBe(true);
  });

  it("moves a seed off a line, and rejects lines that do not separate the seeds", () => {
    const parts = partitionRegion([square(0, 0, 10)], { kind: "lines", lines: [[{ x: 5, y: -1 }, { x: 5, y: 11 }]], seeds: [{ id: "west", point: { x: 5.01, y: 5 } }, { id: "east", point: { x: 9, y: 5 } }] }, options);
    expect(parts).toHaveLength(2);
    expect(() => partitionRegion([square(0, 0, 10)], { kind: "lines", lines: [[{ x: 5, y: -1 }, { x: 5, y: 6 }]], seeds: [{ id: "west", point: { x: 1, y: 1 } }, { id: "east", point: { x: 9, y: 1 } }] }, options))
      .toThrow("do not separate");
    expect(() => partitionRegion([square(0, 0, 10)], { kind: "lines", lines: [], seeds: [{ id: "far", point: { x: 50, y: 50 } }] }, options)).toThrow("outside the region's grid");
    expect(() => partitionRegion([square(0, 0, 10)], { kind: "lines", lines: [], seeds: [{ id: "a", point: { x: 1, y: 1 } }, { id: "b", point: { x: 1.01, y: 1.01 } }] }, options)).toThrow("share a cell");
  });
});

describe("measureTopology and connectionEntries", () => {
  // Two territories: A (a1, a2 side by side) and B (b1 below a1 and a2, offset), plus island C.
  const parts = [
    { id: "a1", rings: [square(0, 0, 10)], territoryId: "A" },
    { id: "a2", rings: [square(10, 0, 10)], territoryId: "A" },
    { id: "b1", rings: [square(4, 10.2, 20, 10)], territoryId: "B" },
    { id: "c1", rings: [square(0, 40, 5)], territoryId: "C" }
  ];
  const topologyOptions = { contact: 0.75, minimumBorder: 2, seaProbes: [0.5, 1, 2], step: 0.25 };
  // Neutral land west of A.
  const neutral = [square(-30, -10, 29.5, 30)];
  const topology = measureTopology(parts, neutral, topologyOptions);

  it("finds shared borders with symmetric lengths, across small gaps between territories", () => {
    const lengths = Object.fromEntries(topology.borders.map((border) => [border.between.join("-"), border.length]));
    expect(Object.keys(lengths).sort()).toEqual(["a1-a2", "a1-b1", "a2-b1"]);
    // Each side also counts the boundary within `contact` of the other's corners.
    expect(lengths["a1-a2"]).toBeGreaterThanOrEqual(10);
    expect(lengths["a1-a2"]).toBeLessThanOrEqual(10 + 4 * 0.75);
    expect(lengths["a1-b1"]).toBeGreaterThanOrEqual(6);
    expect(lengths["a1-b1"]).toBeLessThanOrEqual(6 + 4 * 0.75);
    expect(lengths["a2-b1"]).toBeGreaterThanOrEqual(10);
    const reversed = measureTopology([...parts].reverse(), neutral, topologyOptions);
    for (const border of reversed.borders) expect(lengths[[...border.between].reverse().join("-")]).toBeCloseTo(border.length, 9);
  });

  it("measures coast as boundary facing the sea, not neutral land or a neighbour", () => {
    // North side, less the corner next to a2 (9.25), and the south side west of b1 (3.25).
    expect(topology.coast.get("a1")).toBeCloseTo(12.5, 0);
    expect(topology.coast.get("c1")).toBeCloseTo(20, 6);
  });

  it("enters land connections across the longest border and sea connections at the closest coasts", () => {
    const entries = connectionEntries(parts, topology, [{ between: ["B", "A"], kind: "land" }, { between: ["A", "C"], kind: "sea" }], 3);
    expect(entries[0]?.entry).toEqual(["b1", "a2"]);
    expect(entries[1]?.entry).toEqual(["a1", "c1"]);
    expect(entries[1]?.length).toBeCloseTo(30, 0);
    expect(() => connectionEntries(parts, topology, [{ between: ["A", "C"], kind: "land" }], 3)).toThrow("no sub-territories sharing a border");
    expect(() => connectionEntries(parts, topology, [{ between: ["A", "C"], kind: "sea" }], 1000)).toThrow("no coastal sub-territory");
  });

  it("takes an override over the derived entry, and checks it", () => {
    const land = [{ between: ["B", "A"], kind: "land" }] as const;
    const chosen = connectionEntries(parts, topology, land, 3, [{ entry: { A: "a1", B: "b1" }, reason: "the old road" }]);
    expect(chosen[0]).toMatchObject({ entry: ["b1", "a1"], reason: "the old road", rule: "override" });
    expect(connectionEntries(parts, topology, land, 3)[0]?.rule).toBe("longest-border");
    const sea = connectionEntries(parts, topology, [{ between: ["A", "C"], kind: "sea" }], 3, [{ entry: { A: "a2", C: "c1" }, reason: "ferry" }]);
    expect(sea[0]?.entry).toEqual(["a2", "c1"]);
    expect(() => connectionEntries(parts, topology, land, 3, [{ entry: { A: "zz", B: "b1" }, reason: "" }])).toThrow("unknown sub-territory");
    expect(() => connectionEntries(parts, topology, land, 3, [{ entry: { A: "b1", B: "a1" }, reason: "" }])).toThrow("is not in");
    expect(() => connectionEntries(parts, topology, [{ between: ["A", "C"], kind: "land" }], 3, [{ entry: { A: "a1", C: "c1" }, reason: "" }])).toThrow("do not share a border");
    expect(() => connectionEntries(parts, topology, [{ between: ["A", "C"], kind: "sea" }], 1000, [{ entry: { A: "a1", C: "c1" }, reason: "" }])).toThrow("no coast for a port");
    expect(() => connectionEntries(parts, topology, land, 3, [{ entry: { A: "a1", C: "c1" }, reason: "" }])).toThrow("match no connection");
  });

  it("adds sea links inside a territory, and checks them", () => {
    const islands = [...parts, { id: "c2", rings: [square(20, 40, 5)], territoryId: "C" }];
    const islandTopology = measureTopology(islands, neutral, topologyOptions);
    const [link] = seaLinkBorders(islands, islandTopology, [{ between: ["c1", "c2"], reason: "ferry" }], 3);
    expect(link).toMatchObject({ between: ["c1", "c2"], sea: true });
    expect(link?.length).toBeCloseTo(15, 0);
    expect(() => seaLinkBorders(islands, islandTopology, [{ between: ["c1", "zz"], reason: "" }], 3)).toThrow("unknown sub-territory");
    expect(() => seaLinkBorders(islands, islandTopology, [{ between: ["a1", "c1"], reason: "" }], 3)).toThrow("joins two territories");
    expect(() => seaLinkBorders(islands, islandTopology, [{ between: ["a1", "a2"], reason: "" }], 3)).toThrow("duplicates a land border");
    expect(() => seaLinkBorders(islands, islandTopology, [{ between: ["c1", "c2"], reason: "" }], 1000)).toThrow("has no coast");
  });
});

describe("buildSubTerritories", () => {
  const territoryRings = new Map([["land", [square(0, 0, 10)]], ["isle", [square(30, 0, 4)]]]);
  const base = { capitalInset: 0.3, handSplits: {}, options, provinceAreaTolerance: 0.03, territoryRings };

  it("splits by province, keeps one-part territories whole, and moves capitals inside", () => {
    const built = buildSubTerritories({
      ...base,
      subTerritories: {
        west: { capital: { x: -1, y: 5 }, province: [square(0, 0, 5, 10)], territoryId: "land" },
        east: { capital: { x: 8, y: 5 }, province: [square(5, 0, 5, 10)], territoryId: "land" },
        isle: { capital: { x: 32, y: 2 }, territoryId: "isle" }
      }
    });
    expect(built.map((part) => part.id)).toEqual(["west", "east", "isle"]);
    for (const part of built) {
      expect(containsPoint(part.rings, part.label)).toBe(true);
      expect(containsPoint(part.rings, part.capital)).toBe(true);
    }
    expect(built[0]?.capital.x).toBeCloseTo(0.3, 1);
    expect(built[1]?.capital).toEqual({ x: 8, y: 5 });
    expect(built[2]?.area).toBeCloseTo(16, 9);
    expect(Math.abs(built.reduce((total, part) => total + part.area, 0) - 116)).toBeLessThan(1e-6);
  });

  it("splits by hand-drawn lines seeded at the capitals", () => {
    const built = buildSubTerritories({
      ...base,
      handSplits: { land: { lines: [[{ x: 3, y: -1 }, { x: 3, y: 11 }]] } },
      subTerritories: { left: { capital: { x: 1, y: 5 }, territoryId: "land" }, right: { capital: { x: 7, y: 5 }, territoryId: "land" }, isle: { capital: { x: 32, y: 2 }, territoryId: "isle" } }
    });
    expect(Math.abs((built[0]?.area ?? 0) - 30)).toBeLessThan(10 * 2 * options.cellSize);
    expect(ringArea(built[1]?.rings[0] ?? [])).toBeGreaterThan(60);
  });

  it("rejects a province part far from its province's area, and unknown or unsplittable territories", () => {
    expect(() => buildSubTerritories({
      ...base,
      subTerritories: { west: { capital: { x: 1, y: 5 }, province: [square(-5, -5, 10, 20)], territoryId: "land" }, east: { capital: { x: 8, y: 5 }, province: [square(5, -5, 10, 20)], territoryId: "land" } }
    })).toThrow("disagree with their provinces");
    expect(() => buildSubTerritories({ ...base, subTerritories: { lost: { capital: { x: 0, y: 0 }, territoryId: "atlantis" } } })).toThrow("no region rings");
    expect(() => buildSubTerritories({
      ...base,
      subTerritories: { a: { capital: { x: 1, y: 5 }, territoryId: "land" }, b: { capital: { x: 8, y: 5 }, territoryId: "land" } }
    })).toThrow("neither a province nor a hand-drawn split");
  });
});
