import { describe, expect, it } from "vitest";
import { containsPoint, distanceToEdges, pathData, type Point, poleOfInaccessibility, polygonRings, ringArea, simplifyRing } from "../../scripts/map/geometry.ts";
import { hexColor, insideTerritory, placeTerritory } from "../../scripts/map/package.ts";
import { lambertConformalConic, webMercatorPixel } from "../../scripts/map/projection.ts";
import { blur, colorRamp, createGrid, distanceField, hillshade, sampleBicubic, smoothstep } from "../../scripts/map/raster.ts";

const iberia = lambertConformalConic({ centralMeridian: -3, originLatitude: 40, radius: 6371.0088, standardParallels: [37, 43] });
const square = (x: number, y: number, size: number): Point[] => [{ x, y }, { x: x + size, y }, { x: x + size, y: y + size }, { x, y: y + size }];

describe("map projection", () => {
  it("puts the origin at zero with x east and y south", () => {
    const origin = iberia.forward(-3, 40);
    expect(origin.x).toBeCloseTo(0, 9);
    expect(origin.y).toBeCloseTo(0, 9);
    expect(iberia.forward(-2, 40).x).toBeGreaterThan(0);
    expect(iberia.forward(-3, 41).y).toBeLessThan(0);
  });

  it("round-trips longitude and latitude across the map", () => {
    for (const [longitude, latitude] of [[-9.3, 43], [4.3, 39.9], [-5.32, 35.89], [-15, 32], [20, 52]] as const) {
      const { x, y } = iberia.forward(longitude, latitude);
      const back = iberia.inverse(x, y);
      expect(back.longitude).toBeCloseTo(longitude, 9);
      expect(back.latitude).toBeCloseTo(latitude, 9);
    }
  });

  it("keeps true scale on the standard parallels and near-true scale between them", () => {
    const kilometresPerDegreeEast = (latitude: number): number => {
      const a = iberia.forward(-3.005, latitude);
      const b = iberia.forward(-2.995, latitude);
      return Math.hypot(b.x - a.x, b.y - a.y) / 0.01;
    };
    const sphere = (latitude: number): number => 6371.0088 * Math.PI / 180 * Math.cos(latitude * Math.PI / 180);
    expect(kilometresPerDegreeEast(37) / sphere(37)).toBeCloseTo(1, 6);
    expect(kilometresPerDegreeEast(43) / sphere(43)).toBeCloseTo(1, 6);
    expect(Math.abs(kilometresPerDegreeEast(40) / sphere(40) - 1)).toBeLessThan(0.0035);
  });

  it("measures real distances: Madrid to Barcelona is about 505 km", () => {
    const madrid = iberia.forward(-3.703, 40.417);
    const barcelona = iberia.forward(2.177, 41.383);
    expect(Math.hypot(barcelona.x - madrid.x, barcelona.y - madrid.y)).toBeGreaterThan(500);
    expect(Math.hypot(barcelona.x - madrid.x, barcelona.y - madrid.y)).toBeLessThan(510);
  });

  it("supports a tangent cone with one standard parallel", () => {
    const tangent = lambertConformalConic({ centralMeridian: 0, originLatitude: 45, radius: 1, standardParallels: [45, 45] });
    const { x, y } = tangent.forward(10, 50);
    expect(tangent.inverse(x, y).latitude).toBeCloseTo(50, 9);
  });

  it("matches the Web Mercator tile scheme", () => {
    expect(webMercatorPixel(-180, 0, 0)).toEqual({ x: 0, y: 128 });
    const tile = webMercatorPixel(-3.7, 40.4, 8);
    expect(Math.floor(tile.x / 256)).toBe(125);
    expect(Math.floor(tile.y / 256)).toBe(96);
  });
});

describe("map geometry", () => {
  it("collects rings from polygons and multipolygons and rejects other types", () => {
    expect(polygonRings({ coordinates: [[[0, 0], [1, 0], [1, 1]]], type: "Polygon" })).toHaveLength(1);
    expect(polygonRings({ coordinates: [[[[0, 0], [1, 0], [1, 1]]], [[[2, 2], [3, 2], [3, 3]]]], type: "MultiPolygon" })).toHaveLength(2);
    expect(() => polygonRings({ coordinates: [0, 0], type: "Point" })).toThrow("Unsupported");
  });

  it("measures signed area", () => {
    expect(ringArea(square(0, 0, 2))).toBe(4);
    expect(ringArea([...square(0, 0, 2)].reverse())).toBe(-4);
  });

  it("simplifies within tolerance and drops the closing point", () => {
    const ring = [{ x: 0, y: 0 }, { x: 5, y: 0.01 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }];
    expect(simplifyRing(ring, 0.1)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
    expect(simplifyRing(ring, 0.001)).toHaveLength(5);
    expect(simplifyRing([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }], 1)).toHaveLength(2);
  });

  it("tests containment with holes and measures edge distance", () => {
    const rings = [square(0, 0, 10), square(4, 4, 2)];
    expect(containsPoint(rings, { x: 1, y: 1 })).toBe(true);
    expect(containsPoint(rings, { x: 5, y: 5 })).toBe(false);
    expect(containsPoint(rings, { x: 11, y: 5 })).toBe(false);
    expect(distanceToEdges(rings, { x: 1, y: 5 })).toBeCloseTo(1, 9);
    expect(distanceToEdges([[{ x: 0, y: 0 }, { x: 0, y: 0 }]], { x: 3, y: 4 })).toBeCloseTo(5, 9);
  });

  it("finds the pole of inaccessibility inside concave shapes, away from holes", () => {
    const ell: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 10 }, { x: 0, y: 10 }];
    const pole = poleOfInaccessibility([ell], 0.01);
    expect(containsPoint([ell], pole)).toBe(true);
    expect(distanceToEdges([ell], pole)).toBeGreaterThan(0.9);
    const ring = poleOfInaccessibility([square(0, 0, 10), square(3, 3, 4)], 0.01);
    expect(containsPoint([square(3, 3, 4)], ring)).toBe(false);
  });

  it("writes compact relative path data for the rounded outline", () => {
    expect(pathData([square(0, 0, 1.25), [{ x: 0, y: 0 }]], 1)).toBe("M0 0l1.3 0 0 1.3-1.3 0z");
    expect(pathData([[{ x: -0.01, y: 2 }, { x: 10, y: 2 }, { x: 100.04, y: -3 }]], 1)).toBe("M0 2l10 0 90-5z");
    expect(pathData([[{ x: 10, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 40 }]], 0)).toBe("M10 20l20 0 0 20z");
  });
});

describe("map package placement", () => {
  it("anchors inside the largest ring and lifts the label", () => {
    const rings = [square(100, 100, 2), square(0, 0, 20)];
    const placement = placeTerritory(rings, 5);
    expect(insideTerritory(rings, placement.unitAnchor)).toBe(true);
    expect(placement.unitAnchor.x).toBeLessThan(20);
    expect(placement.label).toEqual({ x: placement.unitAnchor.x, y: Math.round((placement.unitAnchor.y - 5) * 10) / 10 });
  });

  it("honours overrides and rounds to 0.1 units", () => {
    const placement = placeTerritory([square(0, 0, 20)], 5, { label: { x: 1.04, y: 2.06 }, unitAnchor: { x: 3.33, y: 4.44 } });
    expect(placement).toEqual({ label: { x: 1, y: 2.1 }, unitAnchor: { x: 3.3, y: 4.4 } });
  });

  it("formats colors", () => {
    expect(hexColor([72, 96, 114.4])).toBe("#486072");
  });
});

describe("map rasters", () => {
  it("samples bicubically through the source values and clamps at the edges", () => {
    const grid = createGrid(4, 2);
    grid.data.set([0, 10, 20, 30, 40, 50, 60, 70]);
    expect(sampleBicubic(grid, 1, 0)).toBeCloseTo(10, 9);
    expect(sampleBicubic(grid, 1.5, 0)).toBeCloseTo(15, 9);
    expect(sampleBicubic(grid, -5, 9)).toBeCloseTo(40, 9);
  });

  it("computes Euclidean distance fields", () => {
    const field = distanceField(5, 4, (index) => index === 0);
    expect(field[0]).toBe(0);
    expect(field[4]).toBe(4);
    expect(field[3 * 5 + 4]).toBeCloseTo(5, 6);
    const twoSeeds = distanceField(7, 1, (index) => index === 0 || index === 6);
    expect([...twoSeeds]).toEqual([0, 1, 2, 3, 2, 1, 0]);
  });

  it("blurs while preserving the mean of a flat field", () => {
    const grid = createGrid(9, 9);
    grid.data[40] = 81;
    const blurred = blur(grid, 1);
    expect(blurred.data.reduce((sum, value) => sum + value, 0)).toBeCloseTo(81, 3);
    expect(blurred.data[40]).toBeLessThan(81);
    const flat = createGrid(4, 4);
    flat.data.fill(7);
    expect([...blur(flat, 2).data].every((value) => Math.abs(value - 7) < 1e-5)).toBe(true);
  });

  it("lights slopes that face the light and shades the others", () => {
    const slope = createGrid(5, 5);
    for (let y = 0; y < 5; y += 1) for (let x = 0; x < 5; x += 1) slope.data[y * 5 + x] = x * 100;
    const fromWest = hillshade(slope, 100, 1, [{ altitude: 45, azimuth: 270, weight: 1 }]);
    const fromEast = hillshade(slope, 100, 1, [{ altitude: 45, azimuth: 90, weight: 2 }]);
    const flat = hillshade(createGrid(3, 3), 100, 1, [{ altitude: 45, azimuth: 315, weight: 1 }]);
    expect(fromWest[12]).toBeCloseTo(1, 6);
    expect(fromEast[12]).toBeCloseTo(0, 6);
    expect(flat[4]).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("interpolates color ramps and smooth steps", () => {
    const ramp = [[0, [0, 0, 0]], [10, [100, 200, 50]]] as const;
    expect(colorRamp(ramp, -1)).toEqual([0, 0, 0]);
    expect(colorRamp(ramp, 5)).toEqual([50, 100, 25]);
    expect(colorRamp(ramp, 99)).toEqual([100, 200, 50]);
    expect(() => colorRamp([], 1)).toThrow("needs stops");
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });
});
