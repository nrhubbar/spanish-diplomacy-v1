// Planar polygon helpers for the map pipeline. Coordinates are projected map units (km).

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type Ring = readonly Point[];
export type Position = readonly [number, number];

export interface GeoJsonPolygonal {
  readonly type: string;
  readonly coordinates: unknown;
}

/** Every ring (outer and holes) of a Polygon or MultiPolygon, as GeoJSON positions. */
export function polygonRings(geometry: GeoJsonPolygonal): Position[][] {
  if (geometry.type === "Polygon") return geometry.coordinates as Position[][];
  if (geometry.type === "MultiPolygon") return (geometry.coordinates as Position[][][]).flat();
  throw new Error(`Unsupported geometry type ${geometry.type}`);
}

/** Signed shoelace area; positive for clockwise rings in y-down space. */
export function ringArea(ring: Ring): number {
  let total = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const point = ring[index] as Point;
    const next = ring[(index + 1) % ring.length] as Point;
    total += point.x * next.y - next.x * point.y;
  }
  return total / 2;
}

function segmentDistanceSquared(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length));
  const x = start.x + t * dx - point.x;
  const y = start.y + t * dy - point.y;
  return x * x + y * y;
}

/** Douglas-Peucker simplification of a closed ring (the closing duplicate point is dropped). */
export function simplifyRing(ring: Ring, tolerance: number): Point[] {
  const points = [...ring];
  const first = points[0];
  const last = points[points.length - 1];
  if (first !== undefined && last !== undefined && points.length > 1 && first.x === last.x && first.y === last.y) points.pop();
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  const limit = tolerance * tolerance;
  for (let span = stack.pop(); span !== undefined; span = stack.pop()) {
    const [from, to] = span;
    let furthest = -1;
    let distance = limit;
    for (let index = from + 1; index < to; index += 1) {
      const candidate = segmentDistanceSquared(points[index] as Point, points[from] as Point, points[to] as Point);
      if (candidate > distance) {
        distance = candidate;
        furthest = index;
      }
    }
    if (furthest !== -1) {
      keep[furthest] = 1;
      stack.push([from, furthest], [furthest, to]);
    }
  }
  return points.filter((_, index) => keep[index] === 1);
}

/** Even-odd point-in-polygon over every ring. */
export function containsPoint(rings: readonly Ring[], point: Point): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
      const a = ring[index] as Point;
      const b = ring[previous] as Point;
      if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
  }
  return inside;
}

/** Distance from a point to the nearest ring edge. */
export function distanceToEdges(rings: readonly Ring[], point: Point): number {
  let best = Infinity;
  for (const ring of rings) {
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
      best = Math.min(best, segmentDistanceSquared(point, ring[previous] as Point, ring[index] as Point));
    }
  }
  return Math.sqrt(best);
}

/**
 * Pole of inaccessibility: the interior point farthest from every edge (Garcia-Castellanos and
 * Lombardo 2007; the quadtree search popularised by Mapbox polylabel). A better counter and
 * label anchor than the centroid, which can fall outside concave or crescent-shaped regions.
 */
export function poleOfInaccessibility(rings: readonly Ring[], precision: number): Point {
  const outer = rings[0] ?? [];
  const xs = outer.map((point) => point.x);
  const ys = outer.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const size = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
  interface Cell { readonly x: number; readonly y: number; readonly half: number; readonly distance: number; readonly potential: number }
  const cell = (x: number, y: number, half: number): Cell => {
    const point = { x, y };
    const distance = (containsPoint(rings, point) ? 1 : -1) * distanceToEdges(rings, point);
    return { distance, half, potential: distance + half * Math.SQRT2, x, y };
  };
  let best = cell(minX + size / 2, minY + size / 2, 0);
  const queue: Cell[] = [];
  const step = size / 8;
  for (let x = minX; x < minX + size; x += step) {
    for (let y = minY; y < minY + size; y += step) queue.push(cell(x + step / 2, y + step / 2, step / 2));
  }
  while (queue.length > 0) {
    queue.sort((left, right) => left.potential - right.potential);
    const current = queue.pop() as Cell;
    if (current.distance > best.distance) best = current;
    if (current.potential - best.distance <= precision) continue;
    const half = current.half / 2;
    queue.push(
      cell(current.x - half, current.y - half, half),
      cell(current.x + half, current.y - half, half),
      cell(current.x - half, current.y + half, half),
      cell(current.x + half, current.y + half, half)
    );
  }
  return { x: best.x, y: best.y };
}

/**
 * Compact SVG path data for closed rings: points are rounded to `decimals` first, then written
 * as an absolute move followed by relative line steps between the rounded points, so the
 * shorter encoding describes exactly the same (rounded) outline.
 */
export function pathData(rings: readonly Ring[], decimals: number): string {
  const unit = 10 ** decimals;
  const format = (steps: number): string => {
    const fixed = (steps / unit).toFixed(decimals);
    const text = decimals > 0 ? fixed.replace(/\.?0+$/, "") : fixed;
    return text === "-0" ? "0" : text;
  };
  // Numbers are separated by a space, or by nothing when the next one starts with a minus sign.
  const pair = (x: number, y: number): string => {
    const second = format(y);
    return `${format(x)}${second.startsWith("-") ? "" : " "}${second}`;
  };
  return rings
    .filter((ring) => ring.length >= 3)
    .map((ring) => {
      const steps = ring.map((point) => ({ x: Math.round(point.x * unit), y: Math.round(point.y * unit) }));
      const [first, ...rest] = steps as [Point, ...Point[]];
      let previous = first;
      const moves = rest.map((point) => {
        const step = pair(point.x - previous.x, point.y - previous.y);
        previous = point;
        return step;
      });
      return `M${pair(first.x, first.y)}l${moves.join(" ").replace(/ -/g, "-")}z`;
    })
    .join("");
}
