// Builds the iberia-1936 map package from vendored geographic sources, offline:
//   - assets/maps/iberia-regions.svg (territory geometry),
//   - assets/maps/iberia-sub-territories.svg (sub-territory geometry, cut from the same region rings),
//   - the relief layers (overview, margin, and detail images),
//   - every coordinate in the scenario package's map.json (`scenarioPackage` in
//     scripts/map/iberia-1936.ts), including its rivers and water labels,
//   - the package's sub-territory-topology.json: sub-territory borders and connection entries.
// Geometry and rasters are produced in one projection from the same projected paths, so region
// borders and coastlines agree with the relief by construction. Run with `npm run maps:build`.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import * as config from "./map/iberia-1936.ts";
import * as water from "./map/iberia-1936-water.ts";
import * as subTerritoryConfig from "./map/iberia-1936-sub-territories.ts";
import { edgeIndex } from "./map/edgeIndex.ts";
import { lineParts, type LineFeature } from "./map/lines.ts";
import type { Rect } from "./map/iberia-1936.ts";
import { containsPoint, distanceToEdges, type GeoJsonPolygonal, pathData, type Point, polygonRings, ringArea, simplifyRing } from "./map/geometry.ts";
import { asciiJson, hexColor, insideTerritory, placeTerritory, roundPoint } from "./map/package.ts";
import { lambertConformalConic, webMercatorPixel } from "./map/projection.ts";
import { blur, colorRamp, type Color, createGrid, distanceField, type Grid, hillshade, sampleBicubic, smoothstep } from "./map/raster.ts";
import { buildSubTerritories } from "./map/subTerritories.ts";
import { type Connection, connectionEntries, measureTopology, seaLinkBorders } from "./map/topology.ts";
import { assertConfluence, assertOnLand, type BuiltRiver, buildRiver, buildWaterLabels } from "./map/water.ts";

const root = new URL("../", import.meta.url);
const projection = lambertConformalConic(config.projection);
const project = (longitude: number, latitude: number): Point => projection.forward(longitude, latitude);

// ---------------------------------------------------------------------------------------------
// Sources

const geoBoundaries = {
  file: "scripts/sources/geoboundaries/geoBoundaries-ESP-ADM1_simplified.geojson",
  sha256: "b61a1bf661b90883763f633f5e9dbc27e7356309e42cbe56b60d2ceab5112f63"
};

interface ElevationMosaic {
  readonly file: string;
  readonly sha256: string;
  readonly zoom: number;
  readonly firstColumn: number;
  readonly firstRow: number;
}

interface Manifest {
  readonly elevation: { readonly mosaics: readonly ElevationMosaic[] };
  readonly neutralLand: { readonly file: string; readonly sha256: string };
  readonly rivers: { readonly file: string; readonly sha256: string };
  readonly provinces: { readonly file: string; readonly sha256: string };
}

async function readVerified(file: string, expected: string): Promise<Buffer> {
  const bytes = await readFile(new URL(file, root));
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) throw new Error(`${file}: SHA-256 ${actual} does not match ${expected}; re-run npm run maps:fetch and review.`);
  return bytes;
}

interface Feature {
  readonly geometry: GeoJsonPolygonal;
  readonly properties: Record<string, unknown>;
}

const manifest = JSON.parse(await readFile(new URL("scripts/sources/manifest.json", root), "utf8")) as Manifest;
const administrative = JSON.parse((await readVerified(geoBoundaries.file, geoBoundaries.sha256)).toString("utf8")) as { features: Feature[] };
const neutralSource = JSON.parse((await readVerified(manifest.neutralLand.file, manifest.neutralLand.sha256)).toString("utf8")) as { features: Feature[] };
const riverSource = JSON.parse((await readVerified(manifest.rivers.file, manifest.rivers.sha256)).toString("utf8")) as { features: LineFeature[] };
const provinceSource = JSON.parse((await readVerified(manifest.provinces.file, manifest.provinces.sha256)).toString("utf8")) as { features: Feature[] };

interface Elevation {
  readonly grid: Grid;
  readonly mosaic: ElevationMosaic;
}

async function readElevation(zoom: number): Promise<Elevation> {
  const mosaic = manifest.elevation.mosaics.find((candidate) => candidate.zoom === zoom);
  if (mosaic === undefined) throw new Error(`No vendored elevation at zoom ${String(zoom)}`);
  const bytes = await readVerified(mosaic.file, mosaic.sha256);
  const { data, info } = await sharp(bytes, { limitInputPixels: false }).toColourspace("grey16").raw({ depth: "ushort" }).toBuffer({ resolveWithObject: true });
  const values = new Uint16Array(data.buffer, data.byteOffset, data.length / 2);
  const grid = createGrid(info.width, info.height);
  for (let index = 0; index < values.length; index += 1) grid.data[index] = (values[index] ?? 12000) - 12000;
  return { grid, mosaic };
}

// ---------------------------------------------------------------------------------------------
// Geometry

const geometryTolerance = 0.25;
const smallestIslet = 0.4;

function projectFeature(feature: Feature, tolerance: number): Point[][] {
  return polygonRings(feature.geometry)
    .map((ring) => simplifyRing(ring.map(([longitude, latitude]) => project(longitude, latitude)), tolerance))
    .filter((ring) => ring.length >= 3 && Math.abs(ringArea(ring)) >= smallestIslet);
}

function featureNamed(name: string): Feature {
  const feature = administrative.features.find((candidate) => candidate.properties["shapeName"] === name);
  if (feature === undefined) throw new Error(`geoBoundaries has no region named ${name}`);
  return feature;
}

const regionPaths = Object.entries(config.regionSources).map(([id, name]) => {
  const rings = projectFeature(featureNamed(name), geometryTolerance);
  return { d: pathData(rings, 1), id, rings };
});
const extraRings = Object.values(config.playableExtras).map((name) => projectFeature(featureNamed(name), geometryTolerance));
const playableRings = [...regionPaths.flatMap((region) => region.rings), ...extraRings.flat()];
const playablePaths = [...regionPaths.map(({ d }) => d), ...extraRings.map((rings) => pathData(rings, 1))];
const neutralRings = neutralSource.features.map((feature) => projectFeature(feature, 0.4));
const neutralPaths = neutralRings.map((rings) => pathData(rings, 1));

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${[config.viewBox.x, config.viewBox.y, config.viewBox.width, config.viewBox.height].join(" ")}">`,
  `<g id="map-group">${regionPaths.map(({ d, id }) => `<path id="${id}" d="${d}" fill-rule="evenodd"/>`).join("")}</g>`,
  "</svg>",
  ""
].join("\n");

const { detail, margin, master, overview } = config.terrain;
const outputs = {
  detail: "assets/maps/iberia-relief-detail.webp",
  geometry: "assets/maps/iberia-regions.svg",
  subTerritories: "assets/maps/iberia-sub-territories.svg",
  margin: "assets/maps/iberia-relief-margin.webp",
  overview: "assets/maps/iberia-relief-overview.webp"
};

// ---------------------------------------------------------------------------------------------
// map.json

const mapUrl = new URL(config.mapDocument, root);
const previous = JSON.parse(await readFile(mapUrl, "utf8")) as Record<string, unknown> & { regions: Record<string, { territoryId: string }>; territories: Record<string, unknown> };
const territoryRings = new Map<string, Point[][]>();
for (const region of regionPaths) {
  const territoryId = previous.regions[region.id]?.territoryId;
  if (territoryId === undefined) throw new Error(`map.json does not bind region ${region.id}`);
  territoryRings.set(territoryId, [...(territoryRings.get(territoryId) ?? []), ...region.rings]);
}
const geoPoint = ({ latitude, longitude }: config.GeoPoint): Point => roundPoint(project(longitude, latitude));
const territories = Object.fromEntries(Object.keys(previous.territories).map((territoryId) => {
  const enclave = config.enclaves[territoryId];
  if (enclave !== undefined) {
    const centre = geoPoint(enclave);
    return [territoryId, {
      unitAnchor: centre,
      label: { ...roundPoint({ x: centre.x + enclave.labelOffset.x, y: centre.y + enclave.labelOffset.y }), tier: "detail" },
      shape: { kind: "circle", ...centre, r: enclave.radius }
    }];
  }
  const rings = territoryRings.get(territoryId);
  if (rings === undefined) throw new Error(`Territory ${territoryId} has neither a region nor an enclave entry`);
  const override = config.anchorOverrides[territoryId] ?? {};
  const placement = placeTerritory(rings, override.lift ?? config.labelLift, {
    ...(override.anchor === undefined ? {} : { unitAnchor: geoPoint(override.anchor) }),
    ...(override.label === undefined ? {} : { label: geoPoint(override.label) })
  });
  if (!insideTerritory(rings, placement.label)) console.log(`note: the ${territoryId} label sits outside its territory`);
  const tier = (previous.territories[territoryId] as { label: { tier: string } }).label.tier;
  return [territoryId, { unitAnchor: placement.unitAnchor, label: { ...placement.label, tier } }];
}));

// ---------------------------------------------------------------------------------------------
// Sub-territories

/** Every ring of an ADM2 province, projected but not simplified: it only labels points. */
function provinceRings(name: string): Point[][] {
  const feature = provinceSource.features.find((candidate) => candidate.properties["shapeName"] === name);
  if (feature === undefined) throw new Error(`geoBoundaries ADM2 has no province named ${name}`);
  return polygonRings(feature.geometry).map((ring) => ring.map(([longitude, latitude]) => project(longitude, latitude)));
}

const subTerritoryRings = new Map<string, readonly Point[][]>(territoryRings);
for (const [territoryId, name] of Object.entries(config.playableExtras)) subTerritoryRings.set(territoryId, projectFeature(featureNamed(name), geometryTolerance));
const builtSubTerritories = buildSubTerritories({
  capitalInset: 0.3,
  handSplits: Object.fromEntries(Object.entries(subTerritoryConfig.handSplits).map(([territoryId, split]) => [
    territoryId,
    { lines: split.lines.map((line) => line.map(([longitude, latitude]) => project(longitude, latitude))) }
  ])),
  options: subTerritoryConfig.partition,
  provinceAreaTolerance: subTerritoryConfig.provinceAreaTolerance,
  subTerritories: Object.fromEntries(Object.entries(subTerritoryConfig.subTerritories).map(([id, entry]) => [id, {
    capital: project(entry.capital.longitude, entry.capital.latitude),
    ...(entry.province === undefined ? {} : { province: provinceRings(entry.province) }),
    territoryId: entry.territoryId
  }])),
  territoryRings: subTerritoryRings
});
console.log(`sub-territories: ${String(builtSubTerritories.length)} parts of ${String(new Set(builtSubTerritories.map((part) => part.territoryId)).size)} territories`);

// Topology: which sub-territories border each other, and what each scenario connection enters.
const scenarioDocument = JSON.parse(await readFile(new URL(config.scenarioDocument, root), "utf8")) as { connections: (Connection & Record<string, unknown>)[] };
const subTerritoryTopology = measureTopology(builtSubTerritories, neutralRings.flat(), subTerritoryConfig.topology);
const { minimumCoast } = subTerritoryConfig.topology;
const entries = connectionEntries(builtSubTerritories, subTerritoryTopology, scenarioDocument.connections, minimumCoast, subTerritoryConfig.entryOverrides);
const borders = [...subTerritoryTopology.borders, ...seaLinkBorders(builtSubTerritories, subTerritoryTopology, subTerritoryConfig.seaLinks, minimumCoast)];
const kilometres = (value: number): number => Math.round(value * 10) / 10;
/** The sub-territory each city stands in: the part containing it, else (a town on a spit the simplified coast leaves out) the nearest. */
const cityParts = Object.fromEntries(Object.entries(config.cities).map(([cityId, city]) => {
  const point = geoPoint(city);
  const nearest = [...builtSubTerritories].sort((left, right) =>
    (containsPoint(left.rings, point) ? -1 : distanceToEdges(left.rings, point)) - (containsPoint(right.rings, point) ? -1 : distanceToEdges(right.rings, point)))[0];
  return [cityId, nearest?.id];
}));
// `subTerritoryBorders` and `connections` are the scenario's own fields, value for value: each
// connection is the scenario's, unchanged but for `entry`.
const topologyDocument = {
  $comment: "Generated by scripts/build-map.ts from the sub-territory geometry; do not edit. See project/specs/map-package.md.",
  subTerritories: builtSubTerritories.map((part) => ({ id: part.id, territoryId: part.territoryId, name: subTerritoryConfig.subTerritories[part.id]?.name })),
  subTerritoryBorders: borders.map((border) => border.between),
  connections: scenarioDocument.connections.map((connection, index) => ({ ...connection, entry: entries[index]?.entry })),
  cities: cityParts,
  measurements: {
    borderKm: borders.map((border) => ({ between: border.between, km: kilometres(border.length), ...(border.sea === true ? { sea: true } : {}) })),
    coastKm: Object.fromEntries(builtSubTerritories.map((part) => [part.id, kilometres(subTerritoryTopology.coast.get(part.id) ?? 0)])),
    connectionKm: entries.map((entry) => ({ entry: entry.entry, km: kilometres(entry.length), rule: entry.rule, ...(entry.reason === undefined ? {} : { reason: entry.reason }) }))
  }
};
console.log(`sub-territory topology: ${String(borders.length)} borders, ${String(entries.length)} connection entries`);
const subTerritorySvg = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${[config.viewBox.x, config.viewBox.y, config.viewBox.width, config.viewBox.height].join(" ")}">`,
  `<g id="sub-territories">${builtSubTerritories.map(({ id, rings }) => `<path id="${id}" d="${pathData(rings, 1)}" fill-rule="evenodd"/>`).join("")}</g>`,
  "</svg>",
  ""
].join("\n");

// ---------------------------------------------------------------------------------------------
// Rivers and water labels

/** Projected river lines by Natural Earth `rivernum`; any feature not configured fails the build. */
function riverLines(): Map<number, Point[][]> {
  const listed = new Set([...Object.values(water.rivers).flatMap((entry) => entry.rivernums), ...water.excludedRivernums]);
  const lines = new Map<number, Point[][]>();
  for (const feature of riverSource.features) {
    const rivernum = Number(feature.properties["rivernum"]);
    if (!listed.has(rivernum)) throw new Error(`River source has unconfigured rivernum ${String(rivernum)} (${String(feature.properties["name"])}); list or exclude it.`);
    const projected = lineParts(feature.geometry).map((line) => line.map(([longitude, latitude]) => project(longitude, latitude)));
    lines.set(rivernum, [...(lines.get(rivernum) ?? []), ...projected]);
  }
  return lines;
}

const detailElevation = await readElevation(config.terrain.master.demZoom);
/** Ground height in metres at a map point, from the same elevation the relief is baked from. */
function elevationAt(point: Point): number {
  const { latitude, longitude } = projection.inverse(point.x, point.y);
  const { firstColumn, firstRow, zoom } = detailElevation.mosaic;
  const pixel = webMercatorPixel(longitude, latitude, zoom);
  return sampleBicubic(detailElevation.grid, pixel.x - firstColumn * 256 - 0.5, pixel.y - firstRow * 256 - 0.5);
}

const land = { neutral: edgeIndex(neutralRings.flat()), playable: edgeIndex(regionPaths.flatMap((region) => region.rings)) };
const obstacles = [
  ...Object.values(config.cities).map(geoPoint),
  ...Object.values(territories).map((entry) => entry.label)
];
const riverInput = { elevation: elevationAt, entries: water.rivers, focus: config.focus, land, lines: riverLines(), obstacles, style: water.riverStyle };
const builtRivers = Object.entries(water.rivers).flatMap(([id, entry]): BuiltRiver[] => {
  const river = buildRiver(id, entry, riverInput);
  if (river === undefined) throw new Error(`River ${id} has no course on the playable land.`);
  assertOnLand(river, land.playable);
  return [river];
});
for (const river of builtRivers) assertConfluence(river, builtRivers, land, water.riverStyle.confluenceReach);

const document = {
  $schema: previous["$schema"],
  specVersion: previous["specVersion"],
  id: previous["id"],
  viewBox: config.viewBox,
  focus: config.focus,
  background: hexColor(config.art.background),
  geometry: { svg: outputs.geometry, stripSelectors: [] },
  terrain: {
    layers: [
      { image: outputs.overview, bounds: overview.bounds },
      { image: outputs.margin, bounds: margin.bounds },
      { image: outputs.detail, bounds: detail.bounds }
    ]
  },
  regions: previous.regions,
  territories,
  subTerritories: {
    svg: outputs.subTerritories,
    entries: Object.fromEntries(builtSubTerritories.map((part) => [part.id, {
      territoryId: part.territoryId,
      label: roundPoint(part.label),
      capital: roundPoint(part.capital)
    }]))
  },
  cities: Object.fromEntries(Object.entries(config.cities).map(([id, city]) => [id, { ...geoPoint(city), tier: city.tier }])),
  contextLabels: config.contextLabels.map((label) => ({ text: label.text, ...geoPoint(label) })),
  rivers: builtRivers.map((river) => river.document),
  waterLabels: buildWaterLabels(water.waterLabels, geoPoint),
  unitSymbols: previous["unitSymbols"],
  attribution: config.attribution
};
await writeFile(mapUrl, asciiJson(document));
await writeFile(new URL(outputs.subTerritories, root), subTerritorySvg);
await writeFile(new URL(config.topologyDocument, root), asciiJson(topologyDocument));
console.log(`wrote ${config.mapDocument}, ${config.topologyDocument}, and ${outputs.subTerritories}`);
// `--package-only` rewrites map.json and the sub-territory SVG without re-baking the relief, for
// iterating on labels. Only the full build checks the relief registration and the asset checksums.
if (process.argv.includes("--package-only")) process.exit(0);


// ---------------------------------------------------------------------------------------------
// Relief

interface Raster {
  readonly bounds: Rect;
  readonly height: number;
  readonly texelsPerUnit: number;
  readonly width: number;
}

/** Rasterizes filled paths (even-odd) into an antialiased coverage grid in [0, 1]. */
async function coverage(raster: Raster, paths: readonly string[]): Promise<Float32Array> {
  const { bounds, height, width } = raster;
  const document = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="${[bounds.x, bounds.y, bounds.width, bounds.height].join(" ")}">`,
    `<rect x="${String(bounds.x)}" y="${String(bounds.y)}" width="${String(bounds.width)}" height="${String(bounds.height)}" fill="#000"/>`,
    ...paths.map((d) => `<path d="${d}" fill="#fff" fill-rule="evenodd"/>`),
    "</svg>"
  ].join("");
  const { data } = await sharp(Buffer.from(document), { density: 72, limitInputPixels: false, unlimited: true })
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (data.length !== width * height) throw new Error("Unexpected mask size");
  return Float32Array.from(data, (value) => value / 255);
}

function sampleElevation(raster: Raster, elevation: Elevation): Grid {
  const { bounds, height, texelsPerUnit, width } = raster;
  const grid = createGrid(width, height);
  const { firstColumn, firstRow, zoom } = elevation.mosaic;
  for (let row = 0; row < height; row += 1) {
    const y = bounds.y + (row + 0.5) / texelsPerUnit;
    for (let column = 0; column < width; column += 1) {
      const { latitude, longitude } = projection.inverse(bounds.x + (column + 0.5) / texelsPerUnit, y);
      const pixel = webMercatorPixel(longitude, latitude, zoom);
      grid.data[row * width + column] = sampleBicubic(elevation.grid, pixel.x - firstColumn * 256 - 0.5, pixel.y - firstRow * 256 - 0.5);
    }
  }
  return grid;
}

const lights = [
  { altitude: 40, azimuth: 315, weight: 0.55 },
  { altitude: 45, azimuth: 270, weight: 0.17 },
  { altitude: 45, azimuth: 0, weight: 0.17 },
  { altitude: 55, azimuth: 225, weight: 0.11 }
] as const;

const mix = (a: Color, b: Color, t: number): Color => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

interface Baked {
  readonly pixels: Uint8Array;
  readonly playable: Float32Array;
}

/** Bakes shaded relief: hypsometric land, neutral neighbours, and a depth-tinted sea. RGB bytes. */
async function bake(raster: Raster, elevation: Elevation): Promise<Baked> {
  const { height, texelsPerUnit, width } = raster;
  const cellMetres = 1000 / texelsPerUnit;
  const surface = sampleElevation(raster, elevation);
  const playable = await coverage(raster, playablePaths);
  const neutral = await coverage(raster, neutralPaths);

  // Seal hairline gaps where two boundary datasets meet on land (Spain against Portugal,
  // France, Andorra, Gibraltar, Morocco): fill texels close to both kinds of land.
  const reach = 1.5 * texelsPerUnit;
  const nearPlayable = distanceField(width, height, (index) => (playable[index] ?? 0) >= 0.5);
  const nearNeutral = distanceField(width, height, (index) => (neutral[index] ?? 0) >= 0.5);
  const land = new Float32Array(width * height);
  for (let index = 0; index < land.length; index += 1) {
    const p = playable[index] ?? 0;
    let n = Math.min(neutral[index] ?? 0, 1 - p);
    if ((nearPlayable[index] ?? Infinity) <= reach && (nearNeutral[index] ?? Infinity) <= reach) n = 1 - p;
    neutral[index] = n;
    land[index] = Math.min(1, p + n);
  }

  // Land relief never dips below sea level and the sea never rises above it, so the shoreline
  // comes from the vector mask, not from the elevation model's own coastline.
  const landHeight = createGrid(width, height);
  const seaDepth = createGrid(width, height);
  for (let index = 0; index < land.length; index += 1) {
    const value = surface.data[index] ?? 0;
    landHeight.data[index] = (land[index] ?? 0) >= 0.5 ? Math.max(0, value) : 0;
    seaDepth.data[index] = Math.min(0, value);
  }
  const { relief } = config.art;
  const fine = hillshade(landHeight, cellMetres, relief.exaggeration, lights);
  // A generalized relief (about 3 km features) keeps the massifs legible when the map is zoomed out.
  const broad = hillshade(blur(landHeight, relief.broadRadius * texelsPerUnit), cellMetres, relief.broadExaggeration, lights);
  const seaShade = hillshade(blur(seaDepth, 2 * texelsPerUnit), cellMetres, 6, lights);
  const surroundings = blur(landHeight, 4 * texelsPerUnit);
  const shoreDistance = distanceField(width, height, (index) => (land[index] ?? 0) >= 0.5);

  const pixels = new Uint8Array(width * height * 3);
  const flat = Math.cos(Math.PI / 4);
  for (let index = 0; index < land.length; index += 1) {
    const metres = landHeight.data[index] ?? 0;
    const light = ((fine[index] ?? flat) * (1 - relief.broadWeight) + (broad[index] ?? flat) * relief.broadWeight) / flat;
    const ridge = Math.max(-1, Math.min(1, (metres - (surroundings.data[index] ?? 0)) / 260));
    const tint = colorRamp(config.art.land, metres);
    const lit = Math.max(relief.darkest, Math.min(relief.brightest, relief.ambient + (1 - relief.ambient) * light + relief.ridge * ridge));
    const landColor: Color = [tint[0] * lit, tint[1] * lit, tint[2] * lit];
    const gray = 0.3 * landColor[0] + 0.59 * landColor[1] + 0.11 * landColor[2];
    const { lift, saturation, tone } = config.art.neutral;
    const neutralColor = mix([gray * tone + lift, gray * tone + lift, gray * tone + lift], landColor, saturation);
    const p = playable[index] ?? 0;
    const n = neutral[index] ?? 0;
    const shaded = p + n > 0 ? mix(neutralColor, landColor, p / (p + n)) : landColor;

    const depth = seaDepth.data[index] ?? 0;
    const seaTint = colorRamp(config.art.sea, depth);
    const seaLight = 1 - config.art.seaRelief + config.art.seaRelief * ((seaShade[index] ?? flat) / flat);
    const shore = 1 - smoothstep(0, config.art.shoreGlow.width * texelsPerUnit, shoreDistance[index] ?? Infinity);
    const seaColor = mix([seaTint[0] * seaLight, seaTint[1] * seaLight, seaTint[2] * seaLight], config.art.shoreGlow.color, config.art.shoreGlow.strength * shore);

    const color = mix(seaColor, shaded, land[index] ?? 0);
    pixels[index * 3] = Math.round(Math.max(0, Math.min(255, color[0])));
    pixels[index * 3 + 1] = Math.round(Math.max(0, Math.min(255, color[1])));
    pixels[index * 3 + 2] = Math.round(Math.max(0, Math.min(255, color[2])));
  }
  return { pixels, playable };
}

/** Rounds a texel count, insisting it was already whole (so texels stay square and layers align). */
function whole(value: number, what: string): number {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) > 1e-6 || rounded < 0) throw new Error(`${what} must be a whole number of texels, not ${String(value)}.`);
  return rounded;
}

function rasterFor(bounds: Rect, texelsPerUnit: number): Raster {
  return { bounds, height: whole(bounds.height * texelsPerUnit, "Raster height"), texelsPerUnit, width: whole(bounds.width * texelsPerUnit, "Raster width") };
}

/** Pixel offset and size of `inner` within `outer`, both on `outer`'s texel grid. */
function window(outer: Raster, inner: Rect): { left: number; top: number; width: number; height: number } {
  return {
    height: whole(inner.height * outer.texelsPerUnit, "Layer height"),
    left: whole((inner.x - outer.bounds.x) * outer.texelsPerUnit, "Layer offset"),
    top: whole((inner.y - outer.bounds.y) * outer.texelsPerUnit, "Layer offset"),
    width: whole(inner.width * outer.texelsPerUnit, "Layer width")
  };
}

const rgb = (pixels: Uint8Array, raster: { readonly width: number; readonly height: number }) =>
  sharp(pixels, { limitInputPixels: false, raw: { channels: 3, height: raster.height, width: raster.width } });

/**
 * Checks the registration the pipeline guarantees: on both sides of every region edge, the baked
 * playable-land coverage agrees with point-in-polygon on the very paths written to the SVG.
 */
function checkRegistration(raster: Raster, playable: Float32Array): void {
  const rings = playableRings;
  const offset = 0.6;
  let checked = 0;
  let disagreements = 0;
  for (const ring of regionPaths.flatMap((region) => region.rings)) {
    for (let index = 0; index < ring.length; index += 7) {
      const a = ring[index] as Point;
      const b = ring[(index + 1) % ring.length] as Point;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 2 * offset) continue;
      const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      for (const side of [-1, 1]) {
        const point = { x: middle.x + side * offset * (b.y - a.y) / length, y: middle.y - side * offset * (b.x - a.x) / length };
        const column = Math.floor((point.x - raster.bounds.x) * raster.texelsPerUnit);
        const row = Math.floor((point.y - raster.bounds.y) * raster.texelsPerUnit);
        const covered = (playable[row * raster.width + column] ?? 0) >= 0.5;
        checked += 1;
        if (covered !== containsPoint(rings, point)) disagreements += 1;
      }
    }
  }
  const rate = disagreements / checked;
  console.log(`registration: ${String(disagreements)} of ${String(checked)} edge samples disagree (${(rate * 100).toFixed(2)}%)`);
  if (rate > 0.01) throw new Error("Relief and region geometry disagree; the pipeline is no longer registered.");
}

// ---------------------------------------------------------------------------------------------
// Build

const masterRaster = rasterFor(master.bounds, master.texelsPerUnit);
const detailRaster = rasterFor(detail.bounds, detail.texelsPerUnit);
const marginRaster = rasterFor(margin.bounds, margin.texelsPerUnit);
const overviewRaster = rasterFor(overview.bounds, overview.texelsPerUnit);
const timer = performance.now();
const elapsed = (): string => `${((performance.now() - timer) / 1000).toFixed(1)} s`;

const masterBake = await bake(masterRaster, detailElevation);
console.log(`baked master ${String(masterRaster.width)}x${String(masterRaster.height)} (${elapsed()})`);
checkRegistration(masterRaster, masterBake.playable);
checkRiverRegistration(masterRaster, masterBake.playable, builtRivers);

const detailWindow = window(masterRaster, detail.bounds);
const detailPixels = await rgb(masterBake.pixels, masterRaster)
  .extract(detailWindow)
  .resize(detailRaster.width, detailRaster.height, { kernel: "lanczos3" })
  // Restores the edge contrast the downsample softens; the texture is magnified about 2x at full zoom.
  .sharpen({ sigma: 0.7, m1: 0.6, m2: 1.2 })
  .raw()
  .toBuffer();

const marginPixels = await rgb(masterBake.pixels, masterRaster)
  .extract(window(masterRaster, margin.bounds))
  .resize(marginRaster.width, marginRaster.height, { kernel: "lanczos3" })
  .raw()
  .toBuffer();

/** Adds an alpha channel that ramps from 0 at the raster edge to 1 at `feather` texels in. */
function featherEdges(pixels: Uint8Array, raster: Raster, feather: number): Uint8Array {
  const output = new Uint8Array(raster.width * raster.height * 4);
  for (let row = 0; row < raster.height; row += 1) {
    for (let column = 0; column < raster.width; column += 1) {
      const index = row * raster.width + column;
      const edge = Math.min(column, row, raster.width - 1 - column, raster.height - 1 - row);
      output.set(pixels.subarray(index * 3, index * 3 + 3), index * 4);
      output[index * 4 + 3] = Math.round(255 * smoothstep(0, feather, edge + 0.5));
    }
  }
  return output;
}

const overviewBake = await bake(overviewRaster, await readElevation(overview.demZoom));
const inset = window(overviewRaster, master.bounds);
const masterSmall = await rgb(masterBake.pixels, masterRaster).resize(inset.width, inset.height, { kernel: "lanczos3" }).raw().toBuffer();
const overviewPixels = overviewBake.pixels;
const feather = 100 * overview.texelsPerUnit;
const fade = overview.fade * overview.texelsPerUnit;
for (let row = 0; row < overviewRaster.height; row += 1) {
  for (let column = 0; column < overviewRaster.width; column += 1) {
    const index = row * overviewRaster.width + column;
    const x = column - inset.left;
    const y = row - inset.top;
    const inside = Math.min(x, y, inset.width - 1 - x, inset.height - 1 - y);
    const blend = inside < 0 ? 0 : smoothstep(0, feather, inside);
    const edge = Math.min(column, row, overviewRaster.width - 1 - column, overviewRaster.height - 1 - row);
    const keep = smoothstep(0, fade, edge);
    for (let channel = 0; channel < 3; channel += 1) {
      const own = overviewPixels[index * 3 + channel] ?? 0;
      const fromMaster = blend > 0 ? masterSmall[(y * inset.width + x) * 3 + channel] ?? own : own;
      const value = own + (fromMaster - own) * blend;
      overviewPixels[index * 3 + channel] = Math.round(config.art.background[channel as 0 | 1 | 2] + (value - config.art.background[channel as 0 | 1 | 2]) * keep);
    }
  }
}
console.log(`baked overview ${String(overviewRaster.width)}x${String(overviewRaster.height)} (${elapsed()})`);

const webp = { effort: 6, quality: config.art.webpQuality, smartSubsample: true } as const;
const rgba = (pixels: Uint8Array, raster: Raster) =>
  sharp(pixels, { limitInputPixels: false, raw: { channels: 4, height: raster.height, width: raster.width } });
await rgba(featherEdges(new Uint8Array(detailPixels), detailRaster, detail.feather * detail.texelsPerUnit), detailRaster)
  .webp({ ...webp, alphaQuality: 100 })
  .toFile(new URL(outputs.detail, root).pathname);
await rgba(featherEdges(new Uint8Array(marginPixels), marginRaster, margin.feather * margin.texelsPerUnit), marginRaster)
  .webp({ ...webp, alphaQuality: 100 })
  .toFile(new URL(outputs.margin, root).pathname);
await rgb(overviewPixels, overviewRaster).webp(webp).toFile(new URL(outputs.overview, root).pathname);
await writeFile(new URL(outputs.geometry, root), svg);
if (process.argv.includes("--preview")) {
  await mkdir(new URL("build/map/", root), { recursive: true });
  await rgb(masterBake.pixels, masterRaster).png({ compressionLevel: 2 }).toFile(new URL("build/map/master.png", root).pathname);
}

/** The baked relief's land mask agrees: every river vertex sits on playable land in the raster. */
function checkRiverRegistration(raster: Raster, playable: Float32Array, rivers: readonly BuiltRiver[]): void {
  const vertices = rivers.flatMap((river) => river.vertices);
  const offLand = vertices.filter((point) => {
    const column = Math.floor((point.x - raster.bounds.x) * raster.texelsPerUnit);
    const row = Math.floor((point.y - raster.bounds.y) * raster.texelsPerUnit);
    return (playable[row * raster.width + column] ?? 0) < 0.5;
  });
  console.log(`river registration: ${String(offLand.length)} of ${String(vertices.length)} river vertices off the baked land mask`);
  if (offLand.length > 0) throw new Error("Rivers leave the baked land mask; the pipeline is no longer registered.");
}
console.log(`wrote ${Object.values(outputs).join(", ")} (${elapsed()})`);
