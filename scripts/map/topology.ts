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
  /** Shared border length (the mean of what each side measures), or for a sea link the crossing. */
  readonly length: number;
  /** A sea link between islands of one territory, not a land border. */
  readonly sea?: true;
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

/** The shortest distance between two parts' coasts (sampled), or Infinity when either has none. */
export function coastDistance(topology: Topology, a: string, b: string): number {
  let closest = Infinity;
  for (const point of topology.coastPoints.get(a) ?? []) {
    for (const other of topology.coastPoints.get(b) ?? []) closest = Math.min(closest, Math.hypot(other.x - point.x, other.y - point.y));
  }
  return closest;
}

/**
 * A chosen entry for one connection: the sub-territory entered in each territory, by territory id,
 * and why (a road, railway, or ferry line the geometric rule would miss).
 */
export interface EntryOverride {
  readonly entry: Readonly<Record<string, string>>;
  readonly reason: string;
}

export interface ChosenEntry extends ConnectionEntry {
  /** `override`, or the rule that chose it: `longest-border` (land) or `closest-coasts` (sea). */
  readonly rule: "override" | "longest-border" | "closest-coasts";
  readonly reason?: string;
}

/**
 * The entry sub-territories of every connection, in `between` order. An override wins when one is
 * given for the connection's two territories; otherwise land takes the pair across the two
 * territories with the longest shared border, and sea the pair of coastal sub-territories (at
 * least `minimumCoast` of coast) whose coasts come closest. Overrides must name a sub-territory
 * of each side, bordering for land and coastal for sea, and match a connection.
 */
export function connectionEntries(
  parts: readonly TopologyPart[],
  topology: Topology,
  connections: readonly Connection[],
  minimumCoast: number,
  overrides: readonly EntryOverride[] = []
): ChosenEntry[] {
  const territoryOf = new Map(parts.map((part) => [part.id, part.territoryId]));
  const isCoastal = (id: string): boolean => (topology.coast.get(id) ?? 0) >= minimumCoast;
  const borderLength = (a: string, b: string): number | undefined => topology.borders
    .find((border) => (border.between[0] === a && border.between[1] === b) || (border.between[0] === b && border.between[1] === a))?.length;
  const used = new Set<EntryOverride>();
  const result = connections.map((connection): ChosenEntry => {
    const [first, second] = connection.between;
    const label = `${connection.kind} connection ${first} - ${second}`;
    const override = overrides.find((candidate) => {
      const territories = Object.keys(candidate.entry).sort();
      return territories.length === 2 && territories[0] === [first, second].sort()[0] && territories[1] === [first, second].sort()[1];
    });
    if (override !== undefined) {
      used.add(override);
      const a = override.entry[first] ?? "";
      const b = override.entry[second] ?? "";
      for (const [territoryId, id] of [[first, a], [second, b]] as const) {
        if (!territoryOf.has(id)) throw new Error(`Entry override for ${label} names unknown sub-territory "${id}".`);
        if (territoryOf.get(id) !== territoryId) throw new Error(`Entry override for ${label}: "${id}" is not in ${territoryId}.`);
      }
      if (connection.kind === "land") {
        const length = borderLength(a, b);
        if (length === undefined) throw new Error(`Entry override for ${label}: ${a} and ${b} do not share a border.`);
        return { entry: [a, b], length, reason: override.reason, rule: "override" };
      }
      for (const id of [a, b]) if (!isCoastal(id)) throw new Error(`Entry override for ${label}: ${id} has no coast for a port.`);
      return { entry: [a, b], length: coastDistance(topology, a, b), reason: override.reason, rule: "override" };
    }
    if (connection.kind === "land") {
      let best: ChosenEntry | undefined;
      for (const border of topology.borders) {
        const [a, b] = border.between;
        const pair = territoryOf.get(a) === first && territoryOf.get(b) === second ? [a, b] as const
          : territoryOf.get(b) === first && territoryOf.get(a) === second ? [b, a] as const : undefined;
        if (pair !== undefined && (best === undefined || border.length > best.length)) best = { entry: pair, length: border.length, rule: "longest-border" };
      }
      if (best === undefined) throw new Error(`Land connection ${first} - ${second} has no sub-territories sharing a border.`);
      return best;
    }
    const coastal = (territoryId: string): string[] => parts.filter((part) => part.territoryId === territoryId && isCoastal(part.id)).map((part) => part.id);
    let best: ChosenEntry | undefined;
    for (const a of coastal(first)) {
      for (const b of coastal(second)) {
        const closest = coastDistance(topology, a, b);
        if (best === undefined || closest < best.length) best = { entry: [a, b], length: closest, rule: "closest-coasts" };
      }
    }
    if (best === undefined) throw new Error(`Sea connection ${first} - ${second} has no coastal sub-territory on both sides.`);
    return best;
  });
  const unused = overrides.filter((override) => !used.has(override));
  if (unused.length > 0) throw new Error(`Entry overrides match no connection: ${unused.map((override) => Object.keys(override.entry).join(" - ")).join("; ")}.`);
  return result;
}

/** A sea link between two coastal sub-territories of one territory (islands), and why. */
export interface SeaLink {
  readonly between: readonly [string, string];
  readonly reason: string;
}

/**
 * Borders by sea inside a territory, so its sub-territories form one connected graph (islands).
 * Each joins two coastal sub-territories of the same territory that share no land border; its
 * length is the sea crossing between their coasts.
 */
export function seaLinkBorders(parts: readonly TopologyPart[], topology: Topology, links: readonly SeaLink[], minimumCoast: number): Border[] {
  const territoryOf = new Map(parts.map((part) => [part.id, part.territoryId]));
  return links.map(({ between: [a, b] }): Border => {
    for (const id of [a, b]) {
      if (!territoryOf.has(id)) throw new Error(`Sea link names unknown sub-territory "${id}".`);
      if ((topology.coast.get(id) ?? 0) < minimumCoast) throw new Error(`Sea link ${a} - ${b}: ${id} has no coast.`);
    }
    if (territoryOf.get(a) !== territoryOf.get(b)) throw new Error(`Sea link ${a} - ${b} joins two territories; use a scenario connection.`);
    if (topology.borders.some((border) => border.between.includes(a) && border.between.includes(b))) throw new Error(`Sea link ${a} - ${b} duplicates a land border.`);
    return { between: [a, b], length: coastDistance(topology, a, b), sea: true };
  });
}
