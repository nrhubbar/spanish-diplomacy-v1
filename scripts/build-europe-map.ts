// Builds the europe-1805 map package from vendored geographic sources, offline:
//   - assets/maps/europe-regions.svg and europe-sub-territories.svg (drawn from the same arcs),
//   - the relief layers (overview and detail),
//   - map.json and sub-territory-topology.json in the scenario package.
// The geometry is a TopoJSON file whose arcs are shared between neighbours, so every border is one
// line and adjacency is exact. Run with `node scripts/build-europe-map.ts`; `--package-only` skips the
// relief. Afterwards run `npm run maps:checksums`.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { edgeIndex } from "./map/edgeIndex.ts";
import * as config from "./map/europe-1805.ts";
import type { LonLat, Rect } from "./map/europe-1805.ts";
import { containsPoint, distanceToEdges, item, pathData, type Point, poleOfInaccessibility, polygonRings, relativePath, ringArea } from "./map/geometry.ts";
import { asciiJson, hexColor, roundPoint } from "./map/package.ts";
import { lambertConformalConic, webMercatorPixel } from "./map/projection.ts";
import { blur, colorRamp, type Color, createGrid, distanceField, type Grid, hillshade, sampleBicubic, smoothstep } from "./map/raster.ts";

const root = new URL("../", import.meta.url);
const projection = lambertConformalConic(config.projection);
const project = ([longitude, latitude]: LonLat): Point => projection.forward(longitude, latitude);

interface Manifest {
  readonly elevation: { readonly zoom: number; readonly firstColumn: number; readonly firstRow: number };
  readonly sha256: Readonly<Record<string, string>>;
}
const manifest = JSON.parse(await readFile(new URL(config.sources.manifest, root), "utf8")) as Manifest;

async function readVerified(file: string): Promise<Buffer> {
  const bytes = await readFile(new URL(file, root));
  if (createHash("sha256").update(bytes).digest("hex") !== manifest.sha256[file]) throw new Error(`${file} does not match ${config.sources.manifest}.`);
  return bytes;
}
const readJson = async (file: string): Promise<unknown> => JSON.parse((await readVerified(file)).toString("utf8")) as unknown;

// ---------------------------------------------------------------------------------------------
// Geometry

interface Topology {
  readonly arcs: readonly (readonly LonLat[])[];
  readonly objects: Readonly<Record<string, { readonly geometries: readonly Shape[] }>>;
  readonly transform: { readonly scale: LonLat; readonly translate: LonLat };
}
interface Shape {
  readonly arcs?: unknown;
  readonly properties: { readonly sub: string };
  readonly type: string;
}
interface Areas {
  readonly subTerritories: readonly { readonly city?: string; readonly id: string; readonly name: string; readonly territoryId: string; readonly town: { readonly latitude: number; readonly longitude: number } }[];
  readonly territories: readonly { readonly capital: string; readonly id: string; readonly name: string }[];
}

const areas = JSON.parse(await readFile(new URL(config.areas, root), "utf8")) as Areas;
const topology = (await readJson(config.sources.geometry)) as Topology;
const { scale, translate } = topology.transform;
const arcs = topology.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return project([x * scale[0] + translate[0], y * scale[1] + translate[1]]);
  });
});
const arcPoints = (index: number): readonly Point[] => (index >= 0 ? item(arcs, index) : [...item(arcs, ~index)].reverse());
const lengthOf = (line: readonly Point[]): number => line.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - item(line, index).x, point.y - item(line, index).y), 0);

/** The signed arc indices of every ring of a shape. */
function shapeArcs(shape: Shape): number[][] {
  if (shape.arcs === undefined) return [];
  if (shape.type === "Polygon") return shape.arcs as number[][];
  if (shape.type === "MultiPolygon") return (shape.arcs as number[][][]).flat();
  throw new Error(`Unsupported shape ${shape.type}`);
}

/** Joins signed arcs end to end into closed rings. */
function chain(indices: readonly number[]): Point[][] {
  const key = (point: Point): string => `${point.x.toFixed(6)},${point.y.toFixed(6)}`;
  const starts = new Map<string, number[]>();
  for (const index of indices) {
    const start = key(item(arcPoints(index), 0));
    starts.set(start, [...(starts.get(start) ?? []), index]);
  }
  const rings: Point[][] = [];
  const used = new Set<number>();
  for (const first of indices) {
    if (used.has(first)) continue;
    const ring: Point[] = [];
    let current: number | undefined = first;
    while (current !== undefined) {
      used.add(current);
      const points = arcPoints(current);
      ring.push(...points.slice(0, -1));
      current = (starts.get(key(item(points, points.length - 1))) ?? []).find((candidate) => !used.has(candidate));
    }
    rings.push(ring);
  }
  return rings;
}

const shapes = new Map(Object.values(topology.objects).flatMap((object) => object.geometries).map((shape) => [shape.properties.sub, shape]));
const neutralRings = chain(shapeArcs(item([shapes.get("_neutral")].filter((shape) => shape !== undefined), 0)).flat());

interface Part {
  readonly arcs: readonly number[];
  readonly capital: Point;
  readonly id: string;
  readonly label: Point;
  readonly name: string;
  readonly rings: readonly Point[][];
  readonly territoryId: string;
}

const bySize = (rings: readonly Point[][]): Point[][] => [...rings].sort((left, right) => Math.abs(ringArea(right)) - Math.abs(ringArea(left)));

/** The nearest point to `wanted` that is well inside the rings. */
function inside(rings: readonly Point[][], wanted: Point, fallback: Point): Point {
  const fits = (point: Point): boolean => containsPoint(rings, point) && distanceToEdges(rings, point) >= 1.5;
  for (let radius = 0; radius <= 90; radius += 2) {
    for (let step = 0; step < Math.max(1, radius * 3); step += 1) {
      const angle = 2 * Math.PI * step / Math.max(1, radius * 3);
      const point = { x: wanted.x + radius * Math.cos(angle), y: wanted.y + radius * Math.sin(angle) };
      if (fits(point)) return point;
    }
  }
  return fallback;
}

/** A hexagon for a place the simplified geometry leaves out. */
const hexagon = (centre: Point, radius: number): Point[] => Array.from({ length: 6 }, (_, side) => ({ x: centre.x + radius * Math.cos(Math.PI * side / 3), y: centre.y + radius * Math.sin(Math.PI * side / 3) }));

const parts = areas.subTerritories.map((area): Part => {
  const shape = shapes.get(area.id);
  const town = project([area.town.longitude, area.town.latitude]);
  const enclave = config.enclaves[area.territoryId];
  const indices = shape === undefined ? [] : shapeArcs(shape).flat();
  const rings = indices.length === 0 ? (enclave === undefined ? [] : [hexagon(town, 4)]) : shapeArcs(shape as Shape).map((ring) => ring.flatMap((index) => arcPoints(index).slice(0, -1)));
  if (rings.length === 0) throw new Error(`Sub-territory ${area.id} has no geometry.`);
  const ordered = bySize(rings);
  const label = poleOfInaccessibility(ordered, 1);
  return { arcs: indices, capital: inside(rings, town, label), id: area.id, label, name: area.name, rings, territoryId: area.territoryId };
});
const partOf = new Map(parts.map((part) => [part.id, part]));
const requirePart = (id: string): Part => {
  const part = partOf.get(id);
  if (part === undefined) throw new Error(`Unknown sub-territory ${id}`);
  return part;
};

/** A territory's outline: its parts' arcs, less those two of its parts share. */
const territoryRings = new Map(areas.territories.map(({ id }) => {
  const own = parts.filter((part) => part.territoryId === id);
  const all = own.flatMap((part) => part.arcs);
  const present = new Set(all);
  const outline = all.filter((index) => !present.has(~index));
  return [id, outline.length === 0 ? own.flatMap((part) => part.rings.map((ring) => [...ring])) : chain(outline)] as const;
}));
const ringsOf = (territoryId: string): Point[][] => [...(territoryRings.get(territoryId) ?? [])];

// ---------------------------------------------------------------------------------------------
// Topology

const minimumBorder = 6;
const pairKey = (a: string, b: string): string => [a, b].sort().join("|");
const ownersOf = new Map<number, string[]>();
for (const part of parts) {
  for (const index of part.arcs) {
    const arc = index >= 0 ? index : ~index;
    ownersOf.set(arc, [...(ownersOf.get(arc) ?? []), part.id]);
  }
}
const borderKm = new Map<string, number>();
for (const [arc, owners] of ownersOf) {
  const [a, b] = [...new Set(owners)];
  if (a !== undefined && b !== undefined) borderKm.set(pairKey(a, b), (borderKm.get(pairKey(a, b)) ?? 0) + lengthOf(item(arcs, arc)));
}
for (const [a, b] of config.handBorders) borderKm.set(pairKey(a, b), minimumBorder);
const order = new Map(parts.map((part, index) => [part.id, index]));
const inOrder = (a: string, b: string): [string, string] => ((order.get(a) ?? 0) <= (order.get(b) ?? 0) ? [a, b] : [b, a]);
const landBorders = [...borderKm].filter(([, km]) => km >= minimumBorder).map(([key, km]) => {
  const [a = "", b = ""] = key.split("|");
  return { between: inOrder(a, b), km };
}).sort((left, right) => (order.get(left.between[0]) ?? 0) - (order.get(right.between[0]) ?? 0) || (order.get(left.between[1]) ?? 0) - (order.get(right.between[1]) ?? 0));
const distance = (a: string, b: string): number => Math.hypot(requirePart(a).capital.x - requirePart(b).capital.x, requirePart(a).capital.y - requirePart(b).capital.y);
const borders = [...landBorders.map((border) => ({ ...border, sea: false })), ...config.seaLinks.map(([a, b]) => ({ between: inOrder(a, b), km: distance(a, b), sea: true }))];

interface Connection {
  readonly between: readonly [string, string];
  readonly entry: readonly [string, string];
  readonly km: number;
  readonly kind: "land" | "sea";
}
const landConnections = new Map<string, Connection>();
for (const { between: [a, b], km } of landBorders) {
  const from = requirePart(a).territoryId;
  const to = requirePart(b).territoryId;
  if (from === to) continue;
  const key = pairKey(from, to);
  const known = landConnections.get(key);
  if (known === undefined || km > known.km) landConnections.set(key, { between: [from, to], entry: [a, b], km, kind: "land" });
}
const seaConnections = config.seaCrossings.map(([a, b]): Connection => ({ between: [requirePart(a).territoryId, requirePart(b).territoryId], entry: [a, b], km: distance(a, b), kind: "sea" }));
const connections = [...landConnections.values(), ...seaConnections];
const km = (value: number): number => Math.round(value * 10) / 10;

const cityPoint = (id: string): Point => roundPoint(requirePart(id).capital);
const cities = areas.subTerritories.filter((area) => area.city !== undefined);
await writeFile(new URL(config.topologyDocument, root), asciiJson({
  $comment: "Generated by scripts/build-europe-map.ts from the sub-territory geometry; do not edit.",
  subTerritories: parts.map((part) => ({ id: part.id, territoryId: part.territoryId, name: part.name })),
  subTerritoryBorders: borders.map((border) => border.between),
  connections: connections.map(({ between, entry, kind }) => ({ between, kind, entry })),
  cities: Object.fromEntries(cities.map(({ id }) => [id, id])),
  measurements: {
    borderKm: borders.map((border) => ({ between: border.between, km: km(border.km), ...(border.sea ? { sea: true } : {}) })),
    connectionKm: connections.map((connection) => ({ entry: connection.entry, km: km(connection.km) }))
  }
}));
console.log(`${String(areas.territories.length)} territories, ${String(parts.length)} sub-territories, ${String(borders.length)} borders, ${String(connections.length)} connections`);
const disconnected: string[] = [];
for (const { id } of areas.territories) {
  const own = parts.filter((part) => part.territoryId === id).map((part) => part.id);
  const reached = new Set(own.slice(0, 1));
  for (let grown = true; grown;) {
    grown = false;
    for (const { between: [a, b] } of borders) {
      if (own.includes(a) && own.includes(b) && reached.has(a) !== reached.has(b)) {
        reached.add(a).add(b);
        grown = true;
      }
    }
  }
  if (reached.size !== own.length) disconnected.push(`The sub-territories of ${id} are not connected: ${own.filter((part) => !reached.has(part)).join(", ")}`);
}
if (disconnected.length > 0) throw new Error(disconnected.join("\n"));

// ---------------------------------------------------------------------------------------------
// Rivers, labels and map.json

interface LineFeature {
  readonly geometry: { readonly coordinates: unknown; readonly type: string };
  readonly properties: { readonly name: string };
}
const riverFeatures = ((await readJson(config.sources.rivers)) as { features: LineFeature[] }).features;
const lakeFeatures = ((await readJson(config.sources.lakes)) as { features: { geometry: { coordinates: unknown; type: string } }[] }).features;
const landIndex = edgeIndex(parts.flatMap((part) => part.rings));

function simplifyLine(line: readonly Point[], tolerance: number): Point[] {
  const first = line[0];
  const last = line[line.length - 1];
  if (first === undefined || last === undefined || line.length < 3) return [...line];
  let furthest = 0;
  let far = 0;
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const length = Math.hypot(dx, dy);
  line.forEach((point, index) => {
    const off = length === 0 ? Math.hypot(point.x - first.x, point.y - first.y) : Math.abs((point.x - first.x) * dy - (point.y - first.y) * dx) / length;
    if (off > far) {
      far = off;
      furthest = index;
    }
  });
  if (far <= tolerance) return [first, last];
  return [...simplifyLine(line.slice(0, furthest + 1), tolerance).slice(0, -1), ...simplifyLine(line.slice(furthest), tolerance)];
}

/** The stretches of a line on playable land. */
function onLand(line: readonly Point[]): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (const point of line) {
    if (landIndex.contains(point)) run.push(point);
    else {
      if (run.length > 1) runs.push(run);
      run = [];
    }
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

const rivers = Object.entries(config.rivers).flatMap(([id, river]) => {
  const lines = riverFeatures.filter((feature) => river.source.includes(feature.properties.name)).flatMap(({ geometry }) =>
    (geometry.type === "LineString" ? [geometry.coordinates as LonLat[]] : geometry.coordinates as LonLat[][]).map((line) => line.map(project)));
  const runs = lines.flatMap(onLand).map((run) => simplifyLine(run, 1.2)).filter((run) => lengthOf(run) > 12);
  if (runs.length === 0) return [];
  return [{ id, name: river.name, rank: river.rank, path: runs.map((run) => relativePath(run, 1, true)).join("") }];
});

const territoryEntries = Object.fromEntries(areas.territories.map(({ capital, id }) => {
  const enclave = config.enclaves[id];
  if (enclave !== undefined) {
    const centre = roundPoint(requirePart(capital).capital);
    return [id, {
      unitAnchor: centre,
      label: { ...roundPoint({ x: centre.x + enclave.labelOffset.x, y: centre.y + enclave.labelOffset.y }), tier: "detail" },
      shape: { "@type": "circle", "@data": { ...centre, r: enclave.radius } }
    }];
  }
  const rings = bySize(ringsOf(id));
  const area = rings.reduce((sum, ring) => sum + Math.abs(ringArea(ring)), 0);
  const anchor = poleOfInaccessibility(rings, 1);
  const lift = Math.min(95, Math.max(22, Math.sqrt(area) * 0.2));
  return [id, { unitAnchor: roundPoint(anchor), label: { ...roundPoint({ x: anchor.x, y: anchor.y - lift }), tier: area > 150000 ? "overview" : "detail" } }];
}));

const regionId = (territoryId: string): string => `region-${territoryId}`;
const drawn = areas.territories.filter(({ id }) => config.enclaves[id] === undefined);
const viewBoxText = [config.viewBox.x, config.viewBox.y, config.viewBox.width, config.viewBox.height].join(" ");
const svg = (id: string, paths: readonly string[]): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxText}">\n<g id="${id}">${paths.join("")}</g>\n</svg>\n`;
const path = (id: string, rings: readonly Point[][]): string => `<path id="${id}" d="${pathData(rings, 1)}" fill-rule="evenodd"/>`;
await writeFile(new URL(config.outputs.geometry, root), svg("map-group", drawn.map(({ id }) => path(regionId(id), ringsOf(id)))));
await writeFile(new URL(config.outputs.subTerritories, root), svg("sub-territories", parts.map((part) => path(part.id, part.rings))));

const mapUrl = new URL(config.mapDocument, root);
/** The unit symbols are written by hand in map.json and kept through a rebuild. */
const { unitSymbols } = JSON.parse(await readFile(mapUrl, "utf8")) as { unitSymbols: Record<string, string> };
/** Cities shown from the widest zoom: territory capitals of the larger territories. */
const majorTowns = new Set(areas.territories.filter(({ id }) => ringsOf(id).reduce((sum, ring) => sum + Math.abs(ringArea(ring)), 0) > 90000).map(({ capital }) => capital));
await writeFile(mapUrl, asciiJson({
  $schema: "../map.schema.json",
  specVersion: 2,
  id: "europe-1805",
  viewBox: config.viewBox,
  focus: config.focus,
  background: hexColor(config.art.background),
  geometry: { svg: config.outputs.geometry, stripSelectors: [] },
  terrain: { layers: [{ image: config.outputs.overview, bounds: config.terrain.overview.bounds }, { image: config.outputs.detail, bounds: config.terrain.detail.bounds }] },
  regions: Object.fromEntries(drawn.map(({ id }) => [regionId(id), { territoryId: id }])),
  territories: territoryEntries,
  subTerritories: {
    svg: config.outputs.subTerritories,
    entries: Object.fromEntries(parts.map((part) => [part.id, { territoryId: part.territoryId, label: roundPoint(part.label), capital: roundPoint(part.capital) }]))
  },
  cities: Object.fromEntries(cities.map(({ id }) => [id, { ...cityPoint(id), tier: majorTowns.has(id) ? "overview" : "detail" }])),
  contextLabels: config.contextLabels.map(({ at, text }) => ({ text, ...roundPoint(project(at)) })),
  rivers,
  waterLabels: config.waterLabels.map(({ at, text, tier }) => {
    if (at.length === 1) return { text, tier, ...roundPoint(project(item(at, 0))) };
    const [from, to] = [item(at, 0), item(at, 1)];
    const curve = Array.from({ length: 13 }, (_, step): LonLat => [from[0] + (to[0] - from[0]) * step / 12, from[1] + (to[1] - from[1]) * step / 12]).map(project);
    return { text, tier, paths: [relativePath(curve, 1, true)] };
  }),
  unitSymbols,
  attribution: config.attribution
}));
console.log(`wrote ${config.mapDocument}: ${String(rivers.length)} rivers, ${String(cities.length)} cities`);
if (process.argv.includes("--package-only")) process.exit(0);

// ---------------------------------------------------------------------------------------------
// Relief

interface Raster {
  readonly bounds: Rect;
  readonly height: number;
  readonly texelsPerUnit: number;
  readonly width: number;
}
const rasterFor = (bounds: Rect, texelsPerUnit: number): Raster => {
  const width = bounds.width * texelsPerUnit;
  const height = bounds.height * texelsPerUnit;
  if (Math.abs(width - Math.round(width)) > 1e-6 || Math.abs(height - Math.round(height)) > 1e-6) throw new Error("Rasters must be a whole number of texels.");
  return { bounds, height: Math.round(height), texelsPerUnit, width: Math.round(width) };
};

const { data: elevationBytes, info } = await sharp(await readVerified(config.sources.elevation), { limitInputPixels: false }).toColourspace("grey16").raw({ depth: "ushort" }).toBuffer({ resolveWithObject: true });
const elevationValues = new Uint16Array(elevationBytes.buffer, elevationBytes.byteOffset, elevationBytes.length / 2);
const elevation = createGrid(info.width, info.height);
elevationValues.forEach((value, index) => { elevation.data[index] = value - 12000; });

function sampleElevation({ bounds, height, texelsPerUnit, width }: Raster): Grid {
  const grid = createGrid(width, height);
  const { firstColumn, firstRow, zoom } = manifest.elevation;
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const { latitude, longitude } = projection.inverse(bounds.x + (column + 0.5) / texelsPerUnit, bounds.y + (row + 0.5) / texelsPerUnit);
      const pixel = webMercatorPixel(longitude, latitude, zoom);
      grid.data[row * width + column] = sampleBicubic(elevation, pixel.x - firstColumn * 256 - 0.5, pixel.y - firstRow * 256 - 0.5);
    }
  }
  return grid;
}

/** Rasterizes filled paths (even-odd each) into an antialiased coverage grid in [0, 1]. */
async function coverage({ bounds, height, width }: Raster, paths: readonly string[]): Promise<Float32Array> {
  const document = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="${[bounds.x, bounds.y, bounds.width, bounds.height].join(" ")}"><rect x="${String(bounds.x)}" y="${String(bounds.y)}" width="${String(bounds.width)}" height="${String(bounds.height)}" fill="#000"/>${paths.map((d) => `<path d="${d}" fill="#fff" fill-rule="evenodd"/>`).join("")}</svg>`;
  const { data } = await sharp(Buffer.from(document), { density: 72, limitInputPixels: false, unlimited: true }).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  if (data.length !== width * height) throw new Error("Unexpected mask size");
  return Float32Array.from(data, (value) => value / 255);
}

const lights = [
  { altitude: 40, azimuth: 315, weight: 0.55 },
  { altitude: 45, azimuth: 270, weight: 0.17 },
  { altitude: 45, azimuth: 0, weight: 0.17 },
  { altitude: 55, azimuth: 225, weight: 0.11 }
] as const;
const mix = (a: Color, b: Color, t: number): Color => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const playablePaths = drawn.map(({ id }) => pathData(ringsOf(id), 1));
const enclavePaths = areas.territories.filter(({ id }) => config.enclaves[id] !== undefined).map(({ id }) => pathData(ringsOf(id), 1));
const neutralPaths = [pathData(neutralRings, 1)];
const lakePaths = lakeFeatures.map(({ geometry }) => pathData(polygonRings(geometry).map((ring) => ring.map(([longitude, latitude]) => project([longitude, latitude]))), 1));

/** Shaded relief: gold hypsometric land, cooler neutral land, and a blue depth-tinted sea. RGB bytes. */
async function bake(raster: Raster): Promise<Uint8Array> {
  const { height, texelsPerUnit, width } = raster;
  const cellMetres = 1000 / texelsPerUnit;
  const surface = sampleElevation(raster);
  const playable = await coverage(raster, [...playablePaths, ...enclavePaths]);
  const neutral = await coverage(raster, neutralPaths);
  const lakes = await coverage(raster, lakePaths);
  const land = playable.map((value, index) => Math.min(1, value + (neutral[index] ?? 0)));
  const landHeight = createGrid(width, height);
  const seaDepth = createGrid(width, height);
  land.forEach((value, index) => {
    const metres = surface.data[index] ?? 0;
    landHeight.data[index] = value >= 0.5 ? Math.max(0, metres) : 0;
    seaDepth.data[index] = Math.min(0, metres);
  });
  const { relief } = config.art;
  const fine = hillshade(landHeight, cellMetres, relief.exaggeration, lights);
  const broad = hillshade(blur(landHeight, relief.broadRadius * texelsPerUnit), cellMetres, relief.broadExaggeration, lights);
  const seaShade = hillshade(blur(seaDepth, 4 * texelsPerUnit), cellMetres, 12, lights);
  const surroundings = blur(landHeight, 14 * texelsPerUnit);
  const shoreDistance = distanceField(width, height, (index) => (land[index] ?? 0) >= 0.5);
  const flat = Math.cos(Math.PI / 4);
  const pixels = new Uint8Array(width * height * 3);
  for (let index = 0; index < land.length; index += 1) {
    const metres = landHeight.data[index] ?? 0;
    const light = ((fine[index] ?? flat) * (1 - relief.broadWeight) + (broad[index] ?? flat) * relief.broadWeight) / flat;
    const ridge = Math.max(-1, Math.min(1, (metres - (surroundings.data[index] ?? 0)) / 500));
    const tint = colorRamp(config.art.land, metres);
    const lit = Math.max(relief.darkest, Math.min(relief.brightest, relief.ambient + (1 - relief.ambient) * light + relief.ridge * ridge));
    const landColor: Color = [tint[0] * lit, tint[1] * lit, tint[2] * lit];
    const gray = 0.3 * landColor[0] + 0.59 * landColor[1] + 0.11 * landColor[2];
    const { lift, saturation, tint: cool, tone } = config.art.neutral;
    const neutralColor = mix([gray * tone * cool[0] + lift, gray * tone * cool[1] + lift, gray * tone * cool[2] + lift], landColor, saturation);
    const p = playable[index] ?? 0;
    const n = Math.min(neutral[index] ?? 0, 1 - p);
    const shaded = mix(p + n > 0 ? mix(neutralColor, landColor, p / (p + n)) : landColor, config.art.lake, (lakes[index] ?? 0) * 0.9);
    const seaTint = colorRamp(config.art.sea, seaDepth.data[index] ?? 0);
    const seaLight = 1 - config.art.seaRelief + config.art.seaRelief * ((seaShade[index] ?? flat) / flat);
    const shore = 1 - smoothstep(0, config.art.shoreGlow.width * texelsPerUnit, shoreDistance[index] ?? Infinity);
    const seaColor = mix([seaTint[0] * seaLight, seaTint[1] * seaLight, seaTint[2] * seaLight], config.art.shoreGlow.color, config.art.shoreGlow.strength * shore);
    const color = mix(seaColor, shaded, land[index] ?? 0);
    color.forEach((channel, offset) => { pixels[index * 3 + offset] = Math.round(Math.max(0, Math.min(255, channel))); });
  }
  return pixels;
}

const webp = { effort: 6, quality: config.art.webpQuality, smartSubsample: true } as const;
const overviewRaster = rasterFor(config.terrain.overview.bounds, config.terrain.overview.texelsPerUnit);
const overview = await bake(overviewRaster);
for (let row = 0; row < overviewRaster.height; row += 1) {
  for (let column = 0; column < overviewRaster.width; column += 1) {
    const edge = Math.min(column, row, overviewRaster.width - 1 - column, overviewRaster.height - 1 - row);
    const keep = smoothstep(0, config.terrain.overview.fade * config.terrain.overview.texelsPerUnit, edge);
    const index = (row * overviewRaster.width + column) * 3;
    config.art.background.forEach((channel, offset) => { overview[index + offset] = Math.round(channel + ((overview[index + offset] ?? channel) - channel) * keep); });
  }
}
await sharp(overview, { raw: { channels: 3, height: overviewRaster.height, width: overviewRaster.width } }).webp(webp).toFile(new URL(config.outputs.overview, root).pathname);

const detailRaster = rasterFor(config.terrain.detail.bounds, config.terrain.detail.texelsPerUnit);
const detail = await bake(detailRaster);
const feathered = new Uint8Array(detailRaster.width * detailRaster.height * 4);
for (let row = 0; row < detailRaster.height; row += 1) {
  for (let column = 0; column < detailRaster.width; column += 1) {
    const index = row * detailRaster.width + column;
    const edge = Math.min(column, row, detailRaster.width - 1 - column, detailRaster.height - 1 - row);
    feathered.set(detail.subarray(index * 3, index * 3 + 3), index * 4);
    feathered[index * 4 + 3] = Math.round(255 * smoothstep(0, config.terrain.detail.feather * detailRaster.texelsPerUnit, edge + 0.5));
  }
}
await sharp(feathered, { raw: { channels: 4, height: detailRaster.height, width: detailRaster.width } }).webp({ ...webp, alphaQuality: 100 }).toFile(new URL(config.outputs.detail, root).pathname);
console.log(`wrote ${Object.values(config.outputs).join(", ")}`);
