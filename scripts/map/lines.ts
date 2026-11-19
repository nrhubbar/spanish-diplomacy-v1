// Open-polyline helpers for the map pipeline (rivers and label curves). Planar functions work in
// projected map units (km); `subsetLines` works on GeoJSON longitude/latitude.
import { item, type Point, type Position, relativePath } from "./geometry.ts";

export type Line = readonly Point[];

export interface LineFeature {
  readonly geometry: { readonly type: string; readonly coordinates: unknown };
  readonly properties: Record<string, unknown>;
}

export interface GeoExtent {
  readonly east: number;
  readonly north: number;
  readonly south: number;
  readonly west: number;
}

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number";
}

function positions(value: unknown): Position[] {
  if (!Array.isArray(value) || !value.every(isPosition)) throw new Error("Line coordinates must be [longitude, latitude] pairs");
  return value;
}

/** Every line of a LineString or MultiLineString, as GeoJSON positions (checked, not assumed). */
export function lineParts(geometry: LineFeature["geometry"]): Position[][] {
  if (geometry.type === "LineString") return [positions(geometry.coordinates)];
  if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) return geometry.coordinates.map(positions);
  throw new Error(`Unsupported line geometry ${geometry.type}`);
}

/** Properties kept in vendored river subsets; the many translated names are dropped. */
const keptProperties = ["name", "name_en", "name_es", "featurecla", "scalerank", "min_zoom", "rivernum", "ne_id"] as const;

/**
 * Cuts line features to a longitude/latitude extent: each run of vertices inside it is kept with
 * one vertex either side, so a later clip still sees where the line leaves. Coordinates are
 * rounded to 0.0001 degree (about 10 m), and features with nothing inside are dropped.
 */
export function subsetLines(features: readonly LineFeature[], extent: GeoExtent): LineFeature[] {
  const inside = ([longitude, latitude]: Position): boolean =>
    longitude >= extent.west && longitude <= extent.east && latitude >= extent.south && latitude <= extent.north;
  const round = ([longitude, latitude]: Position): Position => [Math.round(longitude * 1e4) / 1e4, Math.round(latitude * 1e4) / 1e4];
  return features.flatMap((feature) => {
    const runs = lineParts(feature.geometry).flatMap((line) => {
      const pieces: Position[][] = [];
      let current: Position[] = [];
      line.forEach((position, index) => {
        const near = inside(position) || inside(line[index - 1] ?? position) || inside(line[index + 1] ?? position);
        if (near) current.push(round(position));
        else if (current.length > 0) {
          pieces.push(current);
          current = [];
        }
      });
      if (current.length > 0) pieces.push(current);
      return pieces.filter((piece) => piece.length >= 2);
    });
    if (runs.length === 0) return [];
    const properties = Object.fromEntries(keptProperties.flatMap((key) => feature.properties[key] === undefined || feature.properties[key] === null ? [] : [[key, feature.properties[key]]]));
    return [{ geometry: { coordinates: runs, type: "MultiLineString" }, properties }];
  });
}

export function lineLength(line: Line): number {
  let total = 0;
  for (let index = 1; index < line.length; index += 1) {
    const a = item(line, index - 1);
    const b = item(line, index);
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

function segmentDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length));
  return Math.hypot(start.x + t * dx - point.x, start.y + t * dy - point.y);
}

/** Shortest distance from a point to the polyline. */
export function lineDistance(line: Line, point: Point): number {
  let best = Infinity;
  for (let index = 1; index < line.length; index += 1) {
    const a = line[index - 1];
    const b = line[index];
    if (a !== undefined && b !== undefined) best = Math.min(best, segmentDistance(point, a, b));
  }
  return line.length === 1 && line[0] !== undefined ? Math.hypot(line[0].x - point.x, line[0].y - point.y) : best;
}

/**
 * Douglas-Peucker simplification of an open polyline; both ends are always kept. With `accepts`,
 * a span the predicate rejects (one that would cut across the sea, say) is split further even
 * when it is within tolerance.
 */
export function simplifyLine(line: Line, tolerance: number, accepts: (from: Point, to: Point) => boolean = () => true): Point[] {
  if (line.length < 3) return [...line];
  const keep = new Uint8Array(line.length);
  keep[0] = 1;
  keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  for (let span = stack.pop(); span !== undefined; span = stack.pop()) {
    const [from, to] = span;
    let furthest = -1;
    let distance = tolerance;
    for (let index = from + 1; index < to; index += 1) {
      const candidate = segmentDistance(item(line, index), item(line, from), item(line, to));
      if (candidate > distance) {
        distance = candidate;
        furthest = index;
      }
    }
    if (furthest === -1 && to - from > 1 && !accepts(item(line, from), item(line, to))) furthest = Math.floor((from + to) / 2);
    if (furthest !== -1) {
      keep[furthest] = 1;
      stack.push([from, furthest], [furthest, to]);
    }
  }
  return line.filter((_, index) => keep[index] === 1);
}

/** Inserts vertices so no step is longer than `step`; the original vertices are all kept. */
export function densify(line: Line, step: number): Point[] {
  const output: Point[] = [];
  line.forEach((point, index) => {
    const previous = line[index - 1];
    if (previous !== undefined) {
      const count = Math.ceil(Math.hypot(point.x - previous.x, point.y - previous.y) / step);
      for (let part = 1; part < count; part += 1) {
        output.push({ x: previous.x + (point.x - previous.x) * part / count, y: previous.y + (point.y - previous.y) * part / count });
      }
    }
    output.push(point);
  });
  return output;
}

/** The point `distance` along the line from its start (clamped to the ends). */
export function pointAlong(line: Line, distance: number): Point {
  let remaining = Math.max(0, distance);
  for (let index = 1; index < line.length; index += 1) {
    const a = item(line, index - 1);
    const b = item(line, index);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= length && length > 0) return { x: a.x + (b.x - a.x) * remaining / length, y: a.y + (b.y - a.y) * remaining / length };
    remaining -= length;
  }
  const last = line[line.length - 1];
  if (last === undefined) throw new Error("pointAlong needs a line");
  return last;
}

/** The stretch of the line between two distances from its start, with exact end points. */
export function sliceLine(line: Line, from: number, to: number): Point[] {
  const inner: Point[] = [];
  let travelled = 0;
  for (let index = 1; index < line.length; index += 1) {
    const a = item(line, index - 1);
    const b = item(line, index);
    travelled += Math.hypot(b.x - a.x, b.y - a.y);
    if (travelled > from && travelled < to && index < line.length - 1) inner.push(b);
  }
  return [pointAlong(line, from), ...inner, pointAlong(line, to)];
}

/** Chaikin corner cutting, keeping both end points: a smooth curve for text to follow. */
export function smoothLine(line: Line, iterations: number): Point[] {
  let current = [...line];
  for (let round = 0; round < iterations && current.length > 2; round += 1) {
    const next: Point[] = [item(current, 0)];
    for (let index = 0; index < current.length - 1; index += 1) {
      const a = item(current, index);
      const b = item(current, index + 1);
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y }, { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    next.push(item(current, current.length - 1));
    current = next;
  }
  return current;
}

/** Compact SVG path data for an open polyline (see `relativePath`), without repeated points. */
export function lineData(line: Line, decimals: number): string {
  return relativePath(line, decimals, true);
}
