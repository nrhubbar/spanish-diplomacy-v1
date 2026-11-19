// Fast point queries against many polygon rings: even-odd containment and the nearest point on
// any ring edge. Edges are bucketed into horizontal bands, so a query reads only the edges that
// can matter instead of every vertex of every region.
import { item, type Point, type Ring } from "./geometry.ts";

interface Edge {
  readonly a: Point;
  readonly b: Point;
}

export interface EdgeIndex {
  /** Even-odd containment over every indexed ring (the same rule as `containsPoint`). */
  readonly contains: (point: Point) => boolean;
  /** The closest point on any edge within `reach`, or undefined when none is that close. */
  readonly nearest: (point: Point, reach: number) => { readonly point: Point; readonly distance: number } | undefined;
}

function closestOnSegment(point: Point, { a, b }: Edge): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

export function edgeIndex(rings: readonly Ring[], bandHeight = 2): EdgeIndex {
  const bands = new Map<number, Edge[]>();
  const band = (y: number): number => Math.floor(y / bandHeight);
  for (const ring of rings) {
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
      const edge = { a: item(ring, previous), b: item(ring, index) };
      for (let row = band(Math.min(edge.a.y, edge.b.y)); row <= band(Math.max(edge.a.y, edge.b.y)); row += 1) {
        const list = bands.get(row) ?? [];
        list.push(edge);
        bands.set(row, list);
      }
    }
  }

  const contains = (point: Point): boolean => {
    let inside = false;
    for (const { a, b } of bands.get(band(point.y)) ?? []) {
      if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  };

  const nearest: EdgeIndex["nearest"] = (point, reach) => {
    let best: { point: Point; distance: number } | undefined;
    for (let row = band(point.y - reach); row <= band(point.y + reach); row += 1) {
      for (const edge of bands.get(row) ?? []) {
        if (Math.min(edge.a.x, edge.b.x) > point.x + reach || Math.max(edge.a.x, edge.b.x) < point.x - reach) continue;
        const candidate = closestOnSegment(point, edge);
        const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
        if (distance <= reach && (best === undefined || distance < best.distance)) best = { distance, point: candidate };
      }
    }
    return best;
  };

  return { contains, nearest };
}
