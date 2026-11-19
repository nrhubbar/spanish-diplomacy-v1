// Downloads and vendors the elevation, neutral-land, and river sources that `npm run maps:build` reads.
// This is the only map script that uses the network; run it deliberately (`npm run maps:fetch`)
// and review the resulting changes under scripts/sources/. Every upstream file's SHA-256 is
// recorded so the vendored derivatives can be traced back byte for byte.
//
// Elevation: AWS Terrain Tiles, "terrarium" PNG encoding (Registry of Open Data on AWS).
// Each tile is decoded to whole metres and the tiles of one zoom are joined into a single
// 16-bit grayscale TIFF (value = metres + 12000, 0 = no data; Deflate with the horizontal
// predictor, readable by GDAL and any TIFF reader) covering only the tiles the map uses. Whole
// metres are the precision of the underlying SRTM and EU-DEM sources; dropping the resampled
// fraction byte roughly halves the vendored size against the upstream tiles.
//
// Neutral land: Natural Earth 1:10m Admin 0 countries (public domain), filtered to the countries
// that intersect the overview extent, with coordinates rounded to 0.0001 degree (about 10 m).
//
// Rivers: Natural Earth 1:10m rivers and lake centrelines and its Europe supplement (public
// domain), cut to the Iberian river extent with the same rounding.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { excludedCountries, projection as projectionDefinition, riverExtent, terrain } from "./map/iberia-1936.ts";
import { type LineFeature, subsetLines } from "./map/lines.ts";
import { lambertConformalConic, webMercatorPixel } from "./map/projection.ts";
import type { Rect } from "./map/iberia-1936.ts";

const root = new URL("../", import.meta.url);
const terrariumRoot = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
const naturalEarthRoot = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/f1890d9f152c896d250a77557a5751a93d494776";
const naturalEarth = {
  revision: "f1890d9f152c896d250a77557a5751a93d494776",
  tag: "v5.1.2",
  url: `${naturalEarthRoot}/geojson/ne_10m_admin_0_countries.geojson`
};
const projection = lambertConformalConic(projectionDefinition);
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

async function download(url: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (attempt === 4) throw new Error(`${url}: HTTP ${String(response.status)}`);
  }
}

/** Every Web Mercator tile at `zoom` that some point of the projected rectangle falls in. */
function tilesFor(bounds: Rect, zoom: number): Set<string> {
  const tiles = new Set<string>();
  const step = 40075 / 2 ** zoom / 4;
  for (let x = bounds.x; x <= bounds.x + bounds.width + step; x += step) {
    for (let y = bounds.y; y <= bounds.y + bounds.height + step; y += step) {
      const { latitude, longitude } = projection.inverse(Math.min(x, bounds.x + bounds.width), Math.min(y, bounds.y + bounds.height));
      const pixel = webMercatorPixel(longitude, latitude, zoom);
      tiles.add(`${String(Math.floor(pixel.x / 256))}/${String(Math.floor(pixel.y / 256))}`);
    }
  }
  return tiles;
}

async function fetchElevation(name: string, bounds: Rect, zoom: number): Promise<object> {
  const keys = [...tilesFor(bounds, zoom)].sort();
  const coordinates = keys.map((key) => key.split("/").map(Number) as [number, number]);
  const firstColumn = Math.min(...coordinates.map(([x]) => x));
  const firstRow = Math.min(...coordinates.map(([, y]) => y));
  const columns = Math.max(...coordinates.map(([x]) => x)) - firstColumn + 1;
  const rows = Math.max(...coordinates.map(([, y]) => y)) - firstRow + 1;
  const width = columns * 256;
  const mosaic = new Uint16Array(width * rows * 256);
  const upstream: Record<string, string> = {};
  const queue = [...coordinates];
  const worker = async (): Promise<void> => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const [column, row] = next;
      const url = `${terrariumRoot}/${String(zoom)}/${String(column)}/${String(row)}.png`;
      const bytes = await download(url);
      upstream[`${String(zoom)}/${String(column)}/${String(row)}`] = sha256(bytes);
      const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      if (info.width !== 256 || info.height !== 256 || info.channels !== 3) throw new Error(`${url}: unexpected tile shape`);
      for (let y = 0; y < 256; y += 1) {
        for (let x = 0; x < 256; x += 1) {
          const offset = (y * 256 + x) * 3;
          const metres = (data[offset] ?? 0) * 256 + (data[offset + 1] ?? 0) + (data[offset + 2] ?? 0) / 256 - 32768;
          const target = ((row - firstRow) * 256 + y) * width + (column - firstColumn) * 256 + x;
          mosaic[target] = Math.min(65535, Math.max(1, Math.round(metres) + 12000));
        }
      }
    }
  };
  await Promise.all(Array.from({ length: 16 }, worker));
  const file = `scripts/sources/dem/${name}-z${String(zoom)}.tif`;
  const tiff = await sharp(mosaic, { raw: { channels: 1, height: rows * 256, width } })
    .toColourspace("grey16")
    .tiff({ compression: "deflate", predictor: "horizontal" })
    .toBuffer();
  await writeFile(new URL(file, root), tiff);
  console.log(`${file}: ${String(keys.length)} tiles, ${(tiff.length / 1e6).toFixed(1)} MB`);
  return {
    file,
    sha256: sha256(tiff),
    zoom,
    firstColumn,
    firstRow,
    columns,
    rows,
    encoding: "16-bit grayscale; value = whole metres + 12000; 0 = tile not fetched",
    upstreamTiles: Object.fromEntries(Object.entries(upstream).sort(([left], [right]) => left.localeCompare(right)))
  };
}

type Position = [number, number];
interface CountryFeature {
  readonly geometry: { readonly type: "Polygon" | "MultiPolygon"; readonly coordinates: Position[][] | Position[][][] };
  readonly properties: Record<string, unknown>;
}

async function fetchNeutralLand(bounds: Rect): Promise<object> {
  const bytes = await download(naturalEarth.url);
  const collection = JSON.parse(bytes.toString("utf8")) as { features: CountryFeature[] };
  const corners = Array.from({ length: 41 }, (_, index) => index / 40).flatMap((t) => [
    projection.inverse(bounds.x + t * bounds.width, bounds.y),
    projection.inverse(bounds.x + t * bounds.width, bounds.y + bounds.height),
    projection.inverse(bounds.x, bounds.y + t * bounds.height),
    projection.inverse(bounds.x + bounds.width, bounds.y + t * bounds.height)
  ]);
  const west = Math.min(...corners.map((point) => point.longitude));
  const east = Math.max(...corners.map((point) => point.longitude));
  const south = Math.min(...corners.map((point) => point.latitude));
  const north = Math.max(...corners.map((point) => point.latitude));
  const inside = (polygon: Position[][]): boolean => {
    const ring = polygon[0] ?? [];
    return ring.some(([longitude, latitude]) => longitude >= west && longitude <= east && latitude >= south && latitude <= north);
  };
  const round = (polygon: Position[][]): Position[][] => polygon.map((ring) => ring.map(([longitude, latitude]) => [
    Math.round(longitude * 1e4) / 1e4,
    Math.round(latitude * 1e4) / 1e4
  ]));
  const features = collection.features.flatMap((feature) => {
    const code = String(feature.properties["ADM0_A3"]);
    if (excludedCountries.includes(code)) return [];
    const polygons = feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates as Position[][]]
      : feature.geometry.coordinates as Position[][][];
    const kept = polygons.filter(inside).map(round);
    if (kept.length === 0) return [];
    return [{
      type: "Feature",
      properties: { ADM0_A3: code, NAME: feature.properties["NAME"] },
      geometry: { type: "MultiPolygon", coordinates: kept }
    }];
  });
  const file = "scripts/sources/naturalearth/ne_10m_admin_0_countries-subset.geojson";
  const output = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
  await writeFile(new URL(file, root), output);
  console.log(`${file}: ${String(features.length)} countries`);
  return {
    file,
    sha256: sha256(Buffer.from(output)),
    upstream: { ...naturalEarth, sha256: sha256(bytes) },
    extent: { east, north, south, west }
  };
}

/**
 * Rivers: Natural Earth 1:10m rivers and lake centrelines plus its Europe supplement, each cut to
 * the Iberian river extent (`subsetLines`) and joined into one vendored file.
 */
async function fetchRivers(): Promise<object> {
  const upstream = [];
  const features = [];
  for (const layer of ["ne_10m_rivers_lake_centerlines", "ne_10m_rivers_europe"]) {
    const url = `${naturalEarthRoot}/geojson/${layer}.geojson`;
    const bytes = await download(url);
    const collection = JSON.parse(bytes.toString("utf8")) as { features: LineFeature[] };
    const kept = subsetLines(collection.features, riverExtent).map((feature) => ({ ...feature, properties: { ...feature.properties, layer } }));
    features.push(...kept);
    upstream.push({ url, sha256: sha256(bytes), features: kept.length });
  }
  const file = "scripts/sources/naturalearth/ne_10m_rivers-iberia.geojson";
  const output = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
  await writeFile(new URL(file, root), output);
  console.log(`${file}: ${String(features.length)} river lines`);
  return { file, sha256: sha256(Buffer.from(output)), revision: naturalEarth.revision, tag: naturalEarth.tag, upstream, extent: riverExtent };
}

const sources = {
  elevation: async (): Promise<object> => {
    await mkdir(new URL("scripts/sources/dem/", root), { recursive: true });
    return {
      source: `${terrariumRoot}/{z}/{x}/{y}.png`,
      mosaics: [
        await fetchElevation("terrarium-detail", terrain.master.bounds, terrain.master.demZoom),
        await fetchElevation("terrarium-overview", terrain.overview.bounds, terrain.overview.demZoom)
      ]
    };
  },
  neutralLand: async (): Promise<object> => {
    await mkdir(new URL("scripts/sources/naturalearth/", root), { recursive: true });
    return fetchNeutralLand(terrain.overview.bounds);
  },
  rivers: async (): Promise<object> => {
    await mkdir(new URL("scripts/sources/naturalearth/", root), { recursive: true });
    return fetchRivers();
  }
} as const;

// `npm run maps:fetch` refreshes every source; `npm run maps:fetch -- rivers` refreshes only the
// named ones and keeps the other manifest entries as they are.
const known = Object.keys(sources);
const requested = process.argv.slice(2);
const unknown = requested.filter((name) => !known.includes(name));
if (unknown.length > 0) throw new Error(`Unknown source ${unknown.join(", ")}; choose from ${known.join(", ")}.`);
const selected = requested.length === 0 ? known : requested;
const manifestUrl = new URL("scripts/sources/manifest.json", root);
const previous = selected.length === known.length ? {} : JSON.parse(await readFile(manifestUrl, "utf8")) as Record<string, unknown>;
const retrieved = new Date().toISOString().slice(0, 10);
const refreshed: Record<string, unknown> = {};
for (const [name, fetchSource] of Object.entries(sources)) {
  if (selected.includes(name)) refreshed[name] = { retrieved, ...await fetchSource() };
}
await writeFile(manifestUrl, `${JSON.stringify({ ...previous, ...refreshed }, null, 2)}\n`);
console.log("wrote scripts/sources/manifest.json");
