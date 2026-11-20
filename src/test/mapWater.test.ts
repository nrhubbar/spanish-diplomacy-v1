import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { edgeIndex } from "../../scripts/map/edgeIndex.ts";
import { containsPoint, distanceToEdges, pathData, type Point, relativePath } from "../../scripts/map/geometry.ts";
import { labelCurve, readable, riverLabelCurve } from "../../scripts/map/labels.ts";
import { densify, lineData, lineDistance, lineLength, lineParts, pointAlong, simplifyLine, sliceLine, smoothLine, subsetLines } from "../../scripts/map/lines.ts";
import { asciiJson } from "../../scripts/map/package.ts";
import { chainParts, clipToLand, type Land, nearSea } from "../../scripts/map/rivers.ts";
import { assertConfluence, assertOnLand, buildRiver, buildWaterLabels, type RiverInput } from "../../scripts/map/water.ts";
import { riverStyle } from "../../scripts/map/iberia-1936-water.ts";
import { polylinePoints } from "../main/scenarios/water";

const square = (x: number, y: number, size: number): Point[] => [{ x, y }, { x: x + size, y }, { x: x + size, y: y + size }, { x, y: y + size }];

/** Playable land 0..100 square; neutral land to its east (100..200); sea everywhere else. */
const land: Land = { neutral: edgeIndex([square(100, 0, 100)]), playable: edgeIndex([square(0, 0, 100)]) };
const clip = riverStyle.clip;

describe("river lines (pipeline)", () => {
  it("cuts source lines to an extent, keeping one vertex either side and the useful properties", () => {
    const features = [
      { geometry: { coordinates: [[-20, 40], [-5, 40], [-4, 41], [-3, 42], [10, 42]], type: "LineString" }, properties: { name: "Ebro", name_fr: "Ebre", rivernum: 155 } },
      { geometry: { coordinates: [[[20, 20], [21, 21]]], type: "MultiLineString" }, properties: { name: "Far" } }
    ];
    const subset = subsetLines(features, { east: 0, north: 44, south: 36, west: -10 });
    expect(subset).toHaveLength(1);
    expect(subset[0]?.properties).toEqual({ name: "Ebro", rivernum: 155 });
    expect(lineParts(subset[0]?.geometry ?? { coordinates: [], type: "x" })).toEqual([[[-20, 40], [-5, 40], [-4, 41], [-3, 42], [10, 42]]]);
    expect(() => lineParts({ coordinates: [], type: "Point" })).toThrow("Unsupported");
    expect(() => lineParts({ coordinates: [["a", 1]], type: "LineString" })).toThrow("pairs");
  });

  it("measures, walks, slices, densifies, simplifies, and smooths open lines", () => {
    const line = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    expect(lineLength(line)).toBe(20);
    expect(pointAlong(line, 15)).toEqual({ x: 10, y: 5 });
    expect(pointAlong(line, 50)).toEqual({ x: 10, y: 10 });
    expect(() => pointAlong([], 1)).toThrow("needs a line");
    expect(sliceLine(line, 5, 15)).toEqual([{ x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }]);
    expect(densify(line, 4)).toHaveLength(7);
    expect(simplifyLine([{ x: 0, y: 0 }, { x: 5, y: 0.1 }, { x: 10, y: 0 }], 0.5)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(simplifyLine([{ x: 0, y: 0 }, { x: 5, y: 2 }, { x: 10, y: 0 }], 0.5)).toHaveLength(3);
    const straightish = [{ x: 0, y: 0 }, { x: 2, y: 0.1 }, { x: 4, y: 0 }, { x: 6, y: 0.1 }, { x: 8, y: 0 }];
    expect(simplifyLine(straightish, 1, (from, to) => to.x - from.x <= 4)).toEqual([straightish[0], straightish[2], straightish[4]]);
    const smooth = smoothLine(line, 2);
    expect(smooth[0]).toEqual(line[0]);
    expect(smooth[smooth.length - 1]).toEqual(line[2]);
    expect(smooth.length).toBeGreaterThan(line.length);
    expect(lineDistance(line, { x: 13, y: 5 })).toBe(3);
    expect(lineDistance([{ x: 0, y: 0 }], { x: 3, y: 4 })).toBe(5);
  });

  it("writes open path data the runtime reads back, without repeated points", () => {
    const line = [{ x: 1.04, y: -2 }, { x: 1.04, y: -2 }, { x: 4, y: 2.25 }, { x: -3, y: 2.3 }];
    const d = lineData(line, 1);
    expect(d).toBe("M1-2l3 4.3-7 0");
    expect(polylinePoints(d)[0]?.map(({ x, y }) => ({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }))).toEqual([{ x: 1, y: -2 }, { x: 4, y: 2.3 }, { x: -3, y: 2.3 }]);
    expect(lineData([], 1)).toBe("");
    expect(relativePath(square(0, 0, 1), 0)).toBe("M0 0l1 0 0 1-1 0");
  });

  it("escapes every non-ASCII character in generated JSON", () => {
    expect(asciiJson({ name: "R\u00edo Mi\u00f1o" })).toBe('{\n  "name": "R\\u00edo Mi\\u00f1o"\n}\n');
  });
});

describe("river clipping (pipeline)", () => {
  it("answers containment and nearest-edge queries like the plain polygon tests", () => {
    const rings = [square(0, 0, 10), square(4, 4, 2)];
    const index = edgeIndex(rings, 3);
    for (const point of [{ x: 1, y: 1 }, { x: 5, y: 5 }, { x: 11, y: 5 }, { x: 9.9, y: 0.1 }]) {
      expect(index.contains(point)).toBe(containsPoint(rings, point));
    }
    expect(index.nearest({ x: 1, y: 5 }, 2)?.distance).toBeCloseTo(distanceToEdges(rings, { x: 1, y: 5 }));
    expect(index.nearest({ x: 30, y: 5 }, 2)).toBeUndefined();
  });

  it("chains pieces whose ends meet, in either direction, longest first", () => {
    const chains = chainParts([
      [{ x: 10, y: 0 }, { x: 20, y: 0 }],
      [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      [{ x: 30, y: 0 }, { x: 20, y: 0.5 }],
      [{ x: 90, y: 90 }, { x: 91, y: 90 }]
    ], 1);
    expect(chains.map((chain) => chain.map((point) => point.x))).toEqual([[0, 10, 20, 30], [90, 91]]);
  });

  it("ends a river that runs into the sea just inside the coast", () => {
    const runs = clipToLand([{ x: 50, y: 50 }, { x: 50, y: -20 }], land, clip);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.end).toBe("sea");
    const last = runs[0]?.points.at(-1);
    expect(last?.y).toBeGreaterThanOrEqual(clip.inset - 1e-9);
    expect(last?.y).toBeLessThan(1);
  });

  it("keeps a river that runs along a land border just inside it, and stops where it leaves", () => {
    const along = clipToLand([{ x: 50, y: 50 }, { x: 100.8, y: 50 }, { x: 100.8, y: 90 }, { x: 150, y: 90 }], land, clip);
    expect(along).toHaveLength(1);
    expect(along[0]?.end).toBe("border");
    expect(along[0]?.points.every((point) => land.playable.contains(point))).toBe(true);
    expect(lineLength(along[0]?.points ?? [])).toBeGreaterThan(85);
  });

  it("bridges slivers, drops short runs, and records a source end", () => {
    // Two regions that fail to meet by 0.3 km, as two boundary datasets often do.
    const split: Land = { ...land, playable: edgeIndex([square(0, 0, 50), [{ x: 50.3, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 50.3, y: 100 }]]) };
    const bridged = clipToLand([{ x: 10.1, y: 50 }, { x: 90.1, y: 50 }], split, clip);
    expect(bridged).toHaveLength(1);
    expect(bridged[0]?.end).toBe("source");
    expect(clipToLand([{ x: 50, y: 2 }, { x: 50, y: -30 }], land, clip)).toEqual([]);
  });

  it("tells the coast from a land border", () => {
    expect(nearSea({ x: 50, y: 3 }, land, 5)).toBe(true);
    expect(nearSea({ x: 95, y: 50 }, land, 5)).toBe(false);
  });
});

describe("river assembly (pipeline)", () => {
  const input = (lines: ReadonlyMap<number, readonly (readonly Point[])[]>): RiverInput => ({
    elevation: (point) => point.y,
    entries: {},
    focus: { height: 100, width: 100, x: 0, y: 0 },
    land,
    lines,
    obstacles: [],
    style: { ...riverStyle, label: { ...riverStyle.label, length: 60, margin: 0 } }
  });

  it("turns a river downhill, tapers its mouth, labels a main river, and stays on land", () => {
    // Digitized upstream: the sea end (y = -20) is lower, so the build reverses it.
    const lines = new Map([[1, [[{ x: 50, y: -20 }, { x: 50, y: 95 }]]], [2, [[{ x: 20, y: 60 }, { x: 49, y: 60 }]]], [3, [[{ x: 10, y: 80 }, { x: 30, y: 80 }]]]]);
    const main = buildRiver("big", { name: "R\u00edo Grande", rank: "main", rivernums: [1] }, input(lines));
    expect(main?.document.mouth).toBeDefined();
    expect(main?.document.labelPath).toMatch(/^M/);
    expect(main?.downstream?.end).toBe("sea");
    expect(main?.document.path.startsWith("M50 95")).toBe(true);
    if (main === undefined) throw new Error("no river");
    expect(() => { assertOnLand(main, land.playable); }).not.toThrow();
    const tributary = buildRiver("small", { name: "R\u00edo Chico", rank: "tributary", rivernums: [2] }, input(lines));
    const stray = buildRiver("stray", { name: "R\u00edo Suelto", rank: "tributary", rivernums: [3] }, input(lines));
    if (tributary === undefined || stray === undefined) throw new Error("no tributary");
    expect(tributary.document.mouth).toBeUndefined();
    expect(() => { assertConfluence(tributary, [main, tributary], land, 3); }).not.toThrow();
    expect(() => { assertConfluence(stray, [main, stray], land, 3); }).toThrow("away from any river");
    expect(() => { assertOnLand({ ...main, vertices: [{ x: -5, y: 5 }] }, land.playable); }).toThrow("off the playable land");
    expect(buildRiver("dry", { name: "R\u00edo Seco", rank: "main", rivernums: [9] }, input(lines))).toBeUndefined();
  });

  it("chooses a straight, level stretch for a river name, clear of other labels", () => {
    const river = [{ x: 0, y: 50 }, { x: 40, y: 50 }, { x: 45, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 50 }];
    const options = { clearance: 5, generalize: 1, length: 30, obstacles: [], within: { height: 100, width: 100, x: 0, y: 0 } };
    const curve = riverLabelCurve(river, options) ?? [];
    expect(curve.every((point) => Math.abs(point.y - 50) < 1)).toBe(true);
    const crowded = riverLabelCurve(river, { ...options, obstacles: [{ x: 15, y: 50 }] }) ?? [];
    expect(Math.min(...crowded.map((point) => point.x))).toBeGreaterThan(20);
    expect(riverLabelCurve(river, { ...options, within: { height: 1, width: 1, x: 500, y: 500 } })).toBeUndefined();
  });

  it("orients label curves so text reads west to east, or south to north", () => {
    expect(readable([{ x: 10, y: 0 }, { x: 0, y: 1 }])[0]).toEqual({ x: 0, y: 1 });
    expect(readable([{ x: 0, y: 0 }, { x: 1, y: 10 }])[0]).toEqual({ x: 1, y: 10 });
    expect(readable([])).toEqual([]);
    const curve = labelCurve([{ x: 100, y: 0 }, { x: 50, y: 10 }, { x: 0, y: 0 }]);
    expect(curve[0]).toEqual({ x: 0, y: 0 });
    const labels = buildWaterLabels([
      { at: { latitude: 1, longitude: 2 }, text: "Bah\u00eda", tier: "detail" },
      { along: [[{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 10 }]], text: "Mar", tier: "overview" }
    ], ({ latitude, longitude }) => ({ x: longitude * 10, y: -latitude * 10 }));
    expect(labels).toEqual([{ text: "Bah\u00eda", tier: "detail", x: 20, y: -10 }, { paths: ["M0 0l100 0"], text: "Mar", tier: "overview" }]);
  });
});

describe("shipped rivers (acceptance: rivers lie on Spain's land)", () => {
  const svg = readFileSync("assets/maps/iberia-regions.svg", "utf8");
  const regions = [...svg.matchAll(/<path id="(ES\d+)" d="([^"]+)"/g)].map(([, , d]) => polylinePoints(d ?? ""));
  const map = JSON.parse(readFileSync("src/scenarios/spanish-civil-war-1936/map.json", "utf8")) as { rivers: { id: string; path: string; mouth?: string; rank: string }[] };
  const onLand = (point: Point): boolean => regions.some((rings) => containsPoint(rings, point));

  it("reads the region path data back exactly as the pipeline wrote it", () => {
    expect(regions).toHaveLength(16);
    for (const [, , d] of svg.matchAll(/<path id="(ES\d+)" d="([^"]+)"/g)) expect(pathData(polylinePoints(d ?? ""), 1)).toBe(d);
  });

  it("puts every river vertex inside a region and keeps every stretch within a pixel of the land", () => {
    expect(map.rivers.filter((river) => river.rank === "main")).toHaveLength(8);
    const lines = map.rivers.flatMap((river) => [river.path, river.mouth ?? ""].flatMap((d) => polylinePoints(d)).map((points) => ({ id: river.id, points })));
    const allRings = regions.flat();
    for (const { id, points } of lines) {
      expect(points.filter((point) => !onLand(point)), id).toEqual([]);
      const stray = densify(points, 0.5).filter((point) => !onLand(point) && distanceToEdges(allRings, point) > 0.3);
      expect(stray, id).toEqual([]);
    }
  });
});
