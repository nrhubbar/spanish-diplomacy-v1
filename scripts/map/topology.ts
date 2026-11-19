// Sub-territory topology from built geometry: which sub-territories share a border (and how long
// it is), how much coast each has, and the sub-territories each scenario connection enters.
// Package-agnostic; `scripts/build-map.ts` feeds it the built parts and the scenario connections.
import { edgeIndex, type EdgeIndex } from "./edgeIndex.ts";
import { item, type Point, type Ring } from "./geometry.ts";

export interface TopologyPart {
  readonly id: string;
  readonly territoryId: string;
  readonly rings: readonly Ring[];
}

export interface TopologyOptions {
  /** Boundary points closer than this to another part's boundary count as shared border. */
  readonly contact: number;
  /**
   * A boundary point is coast when probes this far out from it, along its outward normal, all
   * land in the sea: on no sub-territory and no neutral land. Several distances bridge the
   * slivers where two boundary datasets meet on land.
   */
  readonly seaProbes: readonly number[];
  /** Shared border shorter than this (a corner touch) does not make two parts neighbours. */
  readonly minimumBorder: number;
  /** Boundary sampling step. */
  readonly step: number;
}

export interface Border {
  readonly between: readonly [string, string];
  /** Shared border length: the mean of what each side measures. */
  readonly length: number;
}

export interface Connection {
  readonly between: readonly [string, string];
  readonly kind: "land" | "sea";
}

export interface ConnectionEntry {
  /** The sub-territory entered on each side, in `between` order: the longest shared border for a land connection, the closest coasts for a sea one. */
  readonly entry: readonly [string, string];
  /** Shared border length (land) or the sea crossing between the two coasts (sea). */
  readonly length: number;
}

interface Sample {
  readonly point: Point;
  readonly length: number;
  /** Unit normal of the edge the sample is on (either side). */
  readonly normal: Point;
}

/** Points along every ring edge, each standing for `length` of boundary. */
function samples(rings: readonly Ring[], step: number): Sample[] {
  return rings.flatMap((ring) => ring.flatMap((a, index) => {
    const b = item(ring, (index + 1) % ring.length);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const count = Math.max(1, Math.ceil(length / step));
    const normal = length === 0 ? { x: 0, y: 0 } : { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    return Array.from({ length: count }, (_, sample) => ({
      length: length / count,
      normal,
      point: { x: a.x + (b.x - a.x) * (sample + 0.5) / count, y: a.y + (b.y - a.y) * (sample + 0.5) / count }
    }));
  }));
}

interface Box { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number }

function boxOf(rings: readonly Ring[], margin: number): Box {
  const points = rings.flat();
  return {
    maxX: Math.max(...points.map((point) => point.x)) + margin,
    maxY: Math.max(...points.map((point) => point.y)) + margin,
    minX: Math.min(...points.map((point) => point.x)) - margin,
    minY: Math.min(...points.map((point) => point.y)) - margin
  };
}

const inBox = (box: Box, point: Point): boolean => point.x >= box.minX && point.x <= box.maxX && point.y >= box.minY && point.y <= box.maxY;

export interface Topology {
  /** Neighbouring pairs (at least `minimumBorder` shared), in part order, each pair in part order. */
  readonly borders: Border[];
  /** Coast length per part: boundary facing the sea, next to neither another part nor neutral land. */
  readonly coast: ReadonlyMap<string, number>;
  /** Coast sample points per part, for sea crossings. */
  readonly coastPoints: ReadonlyMap<string, Point[]>;
}

export function measureTopology(parts: readonly TopologyPart[], neutral: readonly Ring[], options: TopologyOptions): Topology {
  const indexes = parts.map((part) => edgeIndex(part.rings));
  const boxes = parts.map((part) => boxOf(part.rings, options.contact));
  const neutralIndex: EdgeIndex = edgeIndex(neutral);
  const landIndex: EdgeIndex = edgeIndex(parts.flatMap((part) => part.rings));
  const onLand = (point: Point): boolean => landIndex.contains(point) || neutralIndex.contains(point);
  const shared = parts.map(() => new Float64Array(parts.length));
  const coast = new Map<string, number>();
  const coastPoints = new Map<string, Point[]>();
  parts.forEach((part, index) => {
    let coastLength = 0;
    const points: Point[] = [];
    const own = item(indexes, index);
    for (const { length, normal, point } of samples(part.rings, options.step)) {
      let touched = false;
      parts.forEach((_, other) => {
        if (other === index || !inBox(item(boxes, other), point)) return;
        if (item(indexes, other).nearest(point, options.contact) === undefined) return;
        touched = true;
        item(shared, index)[other] = (item(shared, index)[other] ?? 0) + length;
      });
      if (touched) continue;
      const side = own.contains({ x: point.x + normal.x * 0.01, y: point.y + normal.y * 0.01 }) ? -1 : 1;
      if (options.seaProbes.some((distance) => onLand({ x: point.x + side * normal.x * distance, y: point.y + side * normal.y * distance }))) continue;
      coastLength += length;
      points.push(point);
    }
    coast.set(part.id, coastLength);
    coastPoints.set(part.id, points);
  });
  const borders: Border[] = [];
  parts.forEach((part, index) => {
    parts.forEach((other, otherIndex) => {
      if (otherIndex <= index) return;
      const length = ((item(shared, index)[otherIndex] ?? 0) + (item(shared, otherIndex)[index] ?? 0)) / 2;
      if (length >= options.minimumBorder) borders.push({ between: [part.id, other.id], length });
    });
  });
  return { borders, coast, coastPoints };
}

/**
 * The entry sub-territories of every connection, in `between` order. Land: the pair across the
 * two territories with the longest shared border. Sea: the pair of coastal sub-territories (at
 * least `minimumCoast` of coast) whose coasts come closest.
 */
export function connectionEntries(
  parts: readonly TopologyPart[],
  topology: Topology,
  connections: readonly Connection[],
  minimumCoast: number
): ConnectionEntry[] {
  const territoryOf = new Map(parts.map((part) => [part.id, part.territoryId]));
  return connections.map((connection): ConnectionEntry => {
    const [first, second] = connection.between;
    if (connection.kind === "land") {
      let best: ConnectionEntry | undefined;
      for (const border of topology.borders) {
        const [a, b] = border.between;
        const pair = territoryOf.get(a) === first && territoryOf.get(b) === second ? [a, b] as const
          : territoryOf.get(b) === first && territoryOf.get(a) === second ? [b, a] as const : undefined;
        if (pair !== undefined && (best === undefined || border.length > best.length)) best = { entry: pair, length: border.length };
      }
      if (best === undefined) throw new Error(`Land connection ${first} - ${second} has no sub-territories sharing a border.`);
      return best;
    }
    const coastal = (territoryId: string): string[] => parts
      .filter((part) => part.territoryId === territoryId && (topology.coast.get(part.id) ?? 0) >= minimumCoast)
      .map((part) => part.id);
    let best: ConnectionEntry | undefined;
    for (const a of coastal(first)) {
      for (const b of coastal(second)) {
        let closest = Infinity;
        for (const point of topology.coastPoints.get(a) ?? []) {
          for (const other of topology.coastPoints.get(b) ?? []) closest = Math.min(closest, Math.hypot(other.x - point.x, other.y - point.y));
        }
        if (best === undefined || closest < best.length) best = { entry: [a, b], length: closest };
      }
    }
    if (best === undefined) throw new Error(`Sea connection ${first} - ${second} has no coastal sub-territory on both sides.`);
    return best;
  });
}
