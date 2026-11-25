// Rebuilds scripts/sources/naturalearth/europe-1805.topo.json: the modern Natural Earth provinces,
// merged into the sub-territories listed in scripts/map/europe-1805-areas.json, as shared-edge
// TopoJSON. Run it only when those lists change, then run `node scripts/build-europe-map.ts`.
//   node scripts/europe-geometry.mjs <ne_10m_admin_1_states_provinces.geojson> <mapshaper binary> <work folder>
// It needs mapshaper (https://github.com/mbloch/mapshaper), which is not a project dependency.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [source, mapshaper, work] = process.argv.slice(2);
if (source === undefined || mapshaper === undefined || work === undefined) {
  console.error("usage: node scripts/europe-geometry.mjs <admin-1 geojson> <mapshaper> <work folder>");
  process.exit(2);
}
const output = "scripts/sources/naturalearth/europe-1805.topo.json";
const manifestFile = "scripts/sources/europe-manifest.json";
const { subTerritories } = JSON.parse(readFileSync("scripts/map/europe-1805-areas.json", "utf8"));
const provinces = JSON.parse(readFileSync(source, "utf8")).features.filter((feature) => feature.geometry !== null);
mkdirSync(work, { recursive: true });
const file = (name) => join(work, name);
const write = (name, features) => { writeFileSync(file(name), JSON.stringify({ type: "FeatureCollection", features })); };
const read = (name) => JSON.parse(readFileSync(file(name), "utf8")).features;
const run = (...args) => execFileSync(mapshaper, args, { maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"] });
const polygons = (geometry) => (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates);

// Every province's sub-territory; provinces marked ~ are shared between several by nearest seed.
const problems = [];
const owner = new Map();
const splits = new Map();
for (const sub of subTerritories) {
  for (const entry of sub.provinces) {
    const [, shared, country, list] = /^(~?)([A-Z]{3}):(.*)$/.exec(entry);
    const pool = provinces.filter((feature) => feature.properties.adm0_a3 === country);
    if (shared === "~") {
      const [name, at] = list.split(" @ ");
      const seed = at === undefined ? [sub.town.latitude, sub.town.longitude] : at.split(", ").map(Number);
      const key = `${country}:${name}`;
      splits.set(key, [...(splits.get(key) ?? []), { seed, sub: sub.id }]);
      for (const feature of pool.filter((candidate) => candidate.properties.name === name)) owner.set(feature, undefined);
      continue;
    }
    const byRegion = list.endsWith(" (region)");
    const names = list.replace(" (region)", "").split(", ");
    const chosen = list === "*" ? pool.filter((feature) => !owner.has(feature)) : names.flatMap((name) => {
      const hits = pool.filter((feature) => (byRegion ? feature.properties.region : feature.properties.name) === name);
      if (hits.length === 0) problems.push(`${sub.id}: no province ${country}:${name}`);
      return hits;
    });
    for (const feature of chosen) {
      if (owner.has(feature) && owner.get(feature) !== sub.id) problems.push(`${sub.id}: ${feature.properties.name} already belongs to ${String(owner.get(feature))}`);
      owner.set(feature, sub.id);
    }
  }
}
if (problems.length > 0) throw new Error(problems.join("\n"));

/** The part of a convex polygon nearer to `a` than to `b`. */
function nearer(polygon, a, b) {
  const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const side = (point) => (point[0] - middle[0]) * (b[0] - a[0]) + (point[1] - middle[1]) * (b[1] - a[1]);
  return polygon.flatMap((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    const [from, to] = [side(point), side(next)];
    const kept = from <= 0 ? [point] : [];
    if (from * to >= 0) return kept;
    const t = from / (from - to);
    return [...kept, [point[0] + (next[0] - point[0]) * t, point[1] + (next[1] - point[1]) * t]];
  });
}

const hash = (text) => {
  let value = 2166136261;
  for (const character of text) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return (value >>> 0) / 4294967296;
};
const round = (point) => point.map((value) => Math.round(value * 1e6) / 1e6);

/** Midpoints that bend a straight line, the same way every time and from either end. */
function bend(a, b, depth, key) {
  if (depth === 0) return [];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const offset = (hash(key) - 0.5) * 0.22 * length;
  const middle = [(a[0] + b[0]) / 2 - (b[1] - a[1]) / length * offset, (a[1] + b[1]) / 2 + (b[0] - a[0]) / length * offset];
  return [...bend(a, middle, depth - 1, `${key}l`), middle, ...bend(middle, b, depth - 1, `${key}r`)];
}

const features = [];
for (const [key, seeds] of splits) {
  const [country, name] = key.split(":");
  const shared = provinces.filter((feature) => feature.properties.adm0_a3 === country && feature.properties.name === name);
  if (shared.length === 0) throw new Error(`No province ${key}`);
  const points = shared.flatMap((feature) => polygons(feature.geometry).flatMap((polygon) => polygon[0]));
  const squeeze = Math.cos(50 * Math.PI / 180);
  const xs = points.map((point) => point[0] * squeeze);
  const ys = points.map((point) => point[1]);
  const [west, east, south, north] = [Math.min(...xs) - 1, Math.max(...xs) + 1, Math.min(...ys) - 1, Math.max(...ys) + 1];
  const placed = seeds.map(({ seed, sub }) => ({ at: [seed[1] * squeeze, seed[0]], sub }));
  const onFrame = (a, b) => (Math.abs(a[0] - b[0]) < 1e-5 && (Math.abs(a[0] - west) < 1e-4 || Math.abs(a[0] - east) < 1e-4))
    || (Math.abs(a[1] - b[1]) < 1e-5 && (Math.abs(a[1] - south) < 1e-4 || Math.abs(a[1] - north) < 1e-4));
  const cells = placed.map((own) => {
    const start = [[west, south], [east, south], [east, north], [west, north]];
    const cell = placed.filter((other) => other !== own).reduce((polygon, other) => nearer(polygon, own.at, other.at), start).map(round);
    const ring = cell.flatMap((a, index) => {
      const b = cell[(index + 1) % cell.length];
      if (onFrame(a, b)) return [a];
      const forward = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
      const [from, to] = forward ? [a, b] : [b, a];
      const middles = bend(from, to, 5, `${String(from)}|${String(to)}`).map(round);
      return [a, ...(forward ? middles : middles.reverse())];
    });
    return { geometry: { coordinates: [[...ring, ring[0]].map(([x, y]) => [x / squeeze, y])], type: "Polygon" }, properties: { sub: own.sub }, type: "Feature" };
  });
  write("state.json", shared.map(({ geometry }) => ({ geometry, properties: { keep: 1 }, type: "Feature" })));
  write("cells.json", cells);
  run("-i", file("state.json"), file("cells.json"), "combine-files", "-union", "target=state,cells", "name=parts", "-filter", "keep==1 && sub!=null", "target=parts", "-dissolve", "sub", "-o", file("parts.json"), "target=parts", "format=geojson");
  features.push(...read("parts.json"));
}

// The frame reaches past the map's own edges, so that no cut line shows; Greenland is left out.
const near = ({ geometry, properties }) => properties.adm0_a3 !== "GRL" && polygons(geometry).some((polygon) => polygon[0].some(([x, y]) => x > -30 && x < 92 && y > 6 && y < 76));
/** Arctic islands that belong to a playable province but lie off the board. */
const offBoard = ({ properties }, polygon) => (properties.adm0_a3 === "RUS" && polygon[0].every(([x, y]) => x > 48 && y > 69.5))
  || (properties.adm0_a3 === "NOR" && polygon[0].every(([x]) => x < 0));
/** Where the playable part of each desert country ends, in degrees north. */
const southEdge = { DZA: 32.6, EGY: 28.6, LBY: 29, MAR: 30.6, TUN: 32 };
const whole = provinces.filter((feature) => near(feature) && !(owner.has(feature) && owner.get(feature) === undefined));
for (const feature of whole) {
  const sub = owner.get(feature) ?? "_neutral";
  if (sub !== "_neutral" && southEdge[feature.properties.adm0_a3] !== undefined) continue;
  for (const [part, own] of [[sub, true], ["_neutral", false]]) {
    const coordinates = polygons(feature.geometry).filter((polygon) => offBoard(feature, polygon) !== own);
    if (coordinates.length > 0) features.push({ geometry: { coordinates, type: "MultiPolygon" }, properties: { sub: part }, type: "Feature" });
  }
}
for (const [country, edge] of Object.entries(southEdge)) {
  write("country.json", whole.filter((feature) => feature.properties.adm0_a3 === country && owner.has(feature)).map((feature) => ({ geometry: feature.geometry, properties: { sub: owner.get(feature) }, type: "Feature" })));
  const steps = Array.from({ length: 121 }, (_, step) => step / 2);
  write("bands.json", [[edge, 60, 1], [-5, edge, 0]].map(([low, high, playable]) => ({
    geometry: { coordinates: [[...steps.map((x) => [x - 20, low]), ...steps.map((x) => [40 - x, high]), [-20, low]]], type: "Polygon" },
    properties: { playable },
    type: "Feature"
  })));
  run("-i", file("country.json"), file("bands.json"), "combine-files", "-union", "target=country,bands", "name=parts", "-filter", "sub!=null && playable!=null", "target=parts", "-o", file("parts.json"), "target=parts", "format=geojson");
  features.push(...read("parts.json").filter(({ geometry }) => geometry !== null).map(({ geometry, properties }) => ({ geometry, properties: { sub: properties.playable === 1 ? properties.sub : "_neutral" }, type: "Feature" })));
}

write("all.json", features);
run("-i", file("all.json"), "-clip", "bbox=-32,7,92,78", "-snap", "interval=0.0004", "-dissolve2", "sub", "-filter-slivers", "min-area=3km2", "-o", file("clean.json"), "format=geojson");
run("-i", file("clean.json"), "-filter-islands", "min-area=70km2", "-simplify", "weighted", "interval=1300", "keep-shapes", "-o", file("europe.json"), "format=topojson", "quantization=200000");
const bytes = readFileSync(file("europe.json"));
writeFileSync(output, bytes);
const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
manifest.sha256[output] = createHash("sha256").update(bytes).digest("hex");
writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${output}`);
