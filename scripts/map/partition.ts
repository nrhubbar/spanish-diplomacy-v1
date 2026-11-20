// Splits a region's polygon rings into labelled parts (sub-territories). The parts' outer edges
// are the region's own edges, vertex for vertex, so sub-territory borders agree with the region
// borders by construction; only the internal lines come from the label sources.
//
// The label sources (province polygons, or hand-drawn split polygons) need not be topologically
// clean or agree with the region outline: they only decide which side of an internal line a point
// falls on. The method:
//   1. label a fine grid over the region's bounds from the sources (first source wins, cells no
//      source covers take the nearest label, or a fallback);
//   2. trace the label boundaries as chains between junctions and simplify each chain once,
//      keeping its ends, so chains that meet at a junction still meet there;
//   3. cut the chains where they cross the region rings and keep the pieces inside the region;
//   4. trace the faces of the planar graph of region edges plus kept chain pieces, label each face
//      from the grid, and merge faces that share a label.
import { edgeIndex } from "./edgeIndex.ts";
import { containsPoint, item, type Point, poleOfInaccessibility, type Ring, ringArea, simplifyRing } from "./geometry.ts";

export interface LabelSource {
  readonly id: string;
  /** Polygon rings in map units, read even-odd. */
  readonly rings: readonly Ring[];
}

/**
 * What decides the label of each point:
 * - `polygons`: the first source containing it; points no source covers take the fallback label,
 *   or the nearest source's label when there is none;
 * - `lines`: the seed it can reach inside the region without crossing a line; points no seed
 *   reaches (other islands, the sea) take the nearest label. Lines must separate every seed from
 *   the others inside the region, so they run past the region's edge where they meet it.
 */
export type LabelSpec =
  | { readonly kind: "polygons"; readonly sources: readonly LabelSource[]; readonly fallback?: string }
  | { readonly kind: "lines"; readonly lines: readonly (readonly Point[])[]; readonly seeds: readonly { readonly id: string; readonly point: Point }[] };

export interface PartitionOptions {
  /** Grid cell size in map units. Internal lines are accurate to about one cell before simplification. */
  readonly cellSize: number;
  /** Douglas-Peucker tolerance for the internal lines. */
  readonly tolerance: number;
}

export interface Part {
  readonly id: string;
  /** Rings read even-odd: faces, plus the holes (enclaves of other regions) inside them. */
  readonly rings: Point[][];
}

interface LabelGrid {
  readonly x0: number;
  readonly y0: number;
  readonly cell: number;
  readonly width: number;
  readonly height: number;
  readonly labels: Int32Array;
  readonly ids: readonly string[];
}

/** Area of rings read even-odd: each ring counts positive or negative by how many others contain it. */
export function evenOddArea(rings: readonly Ring[]): number {
  return rings.reduce((total, ring, index) => {
    const depth = rings.filter((other, otherIndex) => otherIndex !== index && containsPoint([other], item(ring, 0))).length;
    return total + (depth % 2 === 0 ? 1 : -1) * Math.abs(ringArea(ring));
  }, 0);
}

function bounds(rings: readonly Ring[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const points = rings.flat();
  return {
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y))
  };
}

/** Fills polygon interiors (even-odd, by cell centre) with `label` wherever no label is set yet. */
function fillPolygon(grid: LabelGrid, rings: readonly Ring[], label: number): void {
  const { cell, height, labels, width, x0, y0 } = grid;
  const crossings: number[][] = Array.from({ length: height }, () => []);
  for (const ring of rings) {
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
      const a = item(ring, previous);
      const b = item(ring, index);
      if (a.y === b.y) continue;
      const first = Math.max(0, Math.ceil((Math.min(a.y, b.y) - y0) / cell - 0.5));
      const last = Math.min(height - 1, Math.ceil((Math.max(a.y, b.y) - y0) / cell - 0.5) - 1);
      for (let row = first; row <= last; row += 1) {
        const y = y0 + (row + 0.5) * cell;
        item(crossings, row).push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
      }
    }
  }
  crossings.forEach((xs, row) => {
    xs.sort((left, right) => left - right);
    for (let pair = 0; pair + 1 < xs.length; pair += 2) {
      const from = Math.max(0, Math.ceil((item(xs, pair) - x0) / cell - 0.5));
      const to = Math.min(width - 1, Math.ceil((item(xs, pair + 1) - x0) / cell - 0.5) - 1);
      for (let column = from; column <= to; column += 1) {
        if (labels[row * width + column] === -1) labels[row * width + column] = label;
      }
    }
  });
}

/**
 * Breadth-first growth of the labelled cells into unlabelled ones (four-connected), skipping
 * cells marked in `blocked`.
 */
function grow(grid: LabelGrid, starts: readonly number[], blocked?: Uint8Array): void {
  const { labels, width } = grid;
  const queue = new Int32Array(labels.length);
  let tail = 0;
  for (const start of starts) queue[tail++] = start;
  for (let head = 0; head < tail; head += 1) {
    const index = queue[head] ?? 0;
    const column = index % width;
    const label = labels[index] ?? -1;
    for (const next of [column > 0 ? index - 1 : -1, column < width - 1 ? index + 1 : -1, index - width, index + width]) {
      if (next < 0 || next >= labels.length || labels[next] !== -1 || blocked?.[next] === 1) continue;
      labels[next] = label;
      queue[tail++] = next;
    }
  }
}

function labelledCells(labels: Int32Array): number[] {
  const cells: number[] = [];
  labels.forEach((value, index) => {
    if (value !== -1) cells.push(index);
  });
  return cells;
}

/** Labels every cell centre of a grid over the region's bounds, as `spec` says. */
function labelGrid(regionRings: readonly Ring[], spec: LabelSpec, cell: number): LabelGrid {
  const box = bounds(regionRings);
  const margin = 4 * cell;
  const x0 = Math.floor((box.minX - margin) / cell) * cell;
  const y0 = Math.floor((box.minY - margin) / cell) * cell;
  const width = Math.ceil((box.maxX + margin - x0) / cell);
  const height = Math.ceil((box.maxY + margin - y0) / cell);
  const labels = new Int32Array(width * height).fill(-1);
  const cellOf = (point: Point): number => {
    const column = Math.floor((point.x - x0) / cell);
    const row = Math.floor((point.y - y0) / cell);
    if (column < 0 || row < 0 || column >= width || row >= height) throw new Error(`Point ${String(point.x)},${String(point.y)} lies outside the region's grid.`);
    return row * width + column;
  };
  if (spec.kind === "polygons") {
    const ids = [...spec.sources.map((source) => source.id), ...(spec.fallback === undefined ? [] : [spec.fallback])];
    const grid = { cell, height, ids, labels, width, x0, y0 };
    spec.sources.forEach((source, label) => fillPolygon(grid, source.rings, label));
    if (spec.fallback !== undefined) labels.forEach((value, index) => {
      if (value === -1) labels[index] = ids.length - 1;
    });
    const starts = labelledCells(labels);
    if (starts.length === 0) throw new Error("No label source covers the region.");
    grow(grid, starts);
    return grid;
  }
  // Lines: mark every cell a line passes through (sampled at a quarter cell, which leaves an
  // eight-connected barrier that four-connected growth cannot cross), grow each seed through the
  // region's own cells up to the barrier, then let every other cell take the nearest label. So
  // islands and cells cut off from every seed join the nearest seed's part.
  const ids = spec.seeds.map((seed) => seed.id);
  const grid = { cell, height, ids, labels, width, x0, y0 };
  const blocked = new Uint8Array(labels.length).fill(1);
  const region = { ...grid, labels: new Int32Array(labels.length).fill(-1) };
  fillPolygon(region, regionRings, 0);
  region.labels.forEach((value, index) => {
    if (value === 0) blocked[index] = 0;
  });
  for (const line of spec.lines) {
    for (let index = 1; index < line.length; index += 1) {
      const a = item(line, index - 1);
      const b = item(line, index);
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (cell / 4)));
      for (let step = 0; step <= steps; step += 1) {
        const column = Math.floor((a.x + (b.x - a.x) * step / steps - x0) / cell);
        const row = Math.floor((a.y + (b.y - a.y) * step / steps - y0) / cell);
        if (column >= 0 && row >= 0 && column < width && row < height) blocked[row * width + column] = 1;
      }
    }
  }
  // A seed on the coast or on a line moves to the nearest open cell within `reach` cells.
  const reach = Math.ceil(2 / cell);
  const seeds = spec.seeds.map((seed, label) => {
    const home = cellOf(seed.point);
    const homeColumn = home % width;
    const homeRow = Math.floor(home / width);
    let best = -1;
    let bestDistance = Infinity;
    for (let row = Math.max(0, homeRow - reach); row <= Math.min(height - 1, homeRow + reach); row += 1) {
      for (let column = Math.max(0, homeColumn - reach); column <= Math.min(width - 1, homeColumn + reach); column += 1) {
        const distance = Math.hypot(column - homeColumn, row - homeRow);
        if (blocked[row * width + column] === 0 && distance < bestDistance) {
          best = row * width + column;
          bestDistance = distance;
        }
      }
    }
    if (best === -1) throw new Error(`Seed ${item(ids, label)} is not near an open cell of the region.`);
    if (labels[best] !== -1) throw new Error(`Seeds ${item(ids, labels[best] ?? 0)} and ${item(ids, label)} share a cell.`);
    labels[best] = label;
    return best;
  });
  grow(grid, seeds, blocked);
  // Two seeds' areas may only meet across the barrier or outside the region.
  for (let index = 0; index < labels.length; index += 1) {
    if (blocked[index] === 1 || labels[index] === -1) continue;
    for (const next of [(index + 1) % width === 0 ? -1 : index + 1, index + width]) {
      if (next < 0 || next >= labels.length || blocked[next] === 1 || labels[next] === -1 || labels[next] === labels[index]) continue;
      throw new Error(`The split lines do not separate ${item(ids, labels[index] ?? 0)} from ${item(ids, labels[next] ?? 0)}.`);
    }
  }
  grow(grid, labelledCells(labels));
  return grid;
}

function labelAt(grid: LabelGrid, point: Point): string | undefined {
  const column = Math.floor((point.x - grid.x0) / grid.cell);
  const row = Math.floor((point.y - grid.y0) / grid.cell);
  if (column < 0 || row < 0 || column >= grid.width || row >= grid.height) return undefined;
  return grid.ids[grid.labels[row * grid.width + column] ?? -1];
}

/**
 * Label boundaries as chains of cell corners between junctions (corners where other than two
 * boundary edges meet), plus closed loops, which start and end on the same corner.
 */
function traceChains(grid: LabelGrid): Point[][] {
  const { cell, height, labels, width, x0, y0 } = grid;
  const stride = width + 1;
  // vertical[j * stride + i]: the edge from corner (i, j) to (i, j + 1), between cells (i - 1, j) and (i, j).
  const vertical = new Uint8Array(stride * height);
  // horizontal[j * width + i]: the edge from corner (i, j) to (i + 1, j), between cells (i, j - 1) and (i, j).
  const horizontal = new Uint8Array(width * (height + 1));
  for (let row = 0; row < height; row += 1) {
    for (let column = 1; column < width; column += 1) {
      if (labels[row * width + column - 1] !== labels[row * width + column]) vertical[row * stride + column] = 1;
    }
  }
  for (let row = 1; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (labels[(row - 1) * width + column] !== labels[row * width + column]) horizontal[row * width + column] = 1;
    }
  }
  // Incident edges of a corner, as [kind, index, other corner column, other corner row].
  const incident = (column: number, row: number): [0 | 1, number, number, number][] => {
    const found: [0 | 1, number, number, number][] = [];
    if (row > 0 && vertical[(row - 1) * stride + column] === 1) found.push([0, (row - 1) * stride + column, column, row - 1]);
    if (row < height && vertical[row * stride + column] === 1) found.push([0, row * stride + column, column, row + 1]);
    if (column > 0 && horizontal[row * width + column - 1] === 1) found.push([1, row * width + column - 1, column - 1, row]);
    if (column < width && horizontal[row * width + column] === 1) found.push([1, row * width + column, column + 1, row]);
    return found;
  };
  const degree = (column: number, row: number): number =>
    (row > 0 ? vertical[(row - 1) * stride + column] ?? 0 : 0) +
    (row < height ? vertical[row * stride + column] ?? 0 : 0) +
    (column > 0 ? horizontal[row * width + column - 1] ?? 0 : 0) +
    (column < width ? horizontal[row * width + column] ?? 0 : 0);
  const visited = [new Uint8Array(vertical.length), new Uint8Array(horizontal.length)] as const;
  const corner = (column: number, row: number): Point => ({ x: x0 + column * cell, y: y0 + row * cell });
  const chains: Point[][] = [];
  const walk = (startColumn: number, startRow: number, first: [0 | 1, number, number, number]): Point[] => {
    const points = [corner(startColumn, startRow)];
    let step: [0 | 1, number, number, number] | undefined = first;
    while (step !== undefined) {
      const [kind, index, column, row] = step;
      visited[kind][index] = 1;
      points.push(corner(column, row));
      const edges = incident(column, row);
      step = edges.length === 2 ? edges.find(([nextKind, nextIndex]) => visited[nextKind][nextIndex] === 0) : undefined;
    }
    return points;
  };
  for (let row = 0; row <= height; row += 1) {
    for (let column = 0; column <= width; column += 1) {
      const count = degree(column, row);
      if (count === 0 || count === 2) continue;
      for (const edge of incident(column, row)) if (visited[edge[0]][edge[1]] === 0) chains.push(walk(column, row, edge));
    }
  }
  // What is left are closed loops through corners of degree two.
  for (let row = 0; row <= height; row += 1) {
    for (let column = 0; column <= width; column += 1) {
      if (degree(column, row) === 0) continue;
      const edge = incident(column, row).find(([kind, index]) => visited[kind][index] === 0);
      if (edge !== undefined) chains.push(walk(column, row, edge));
    }
  }
  return chains;
}

function properIntersection(a: Point, b: Point, c: Point, d: Point): { t: number; u: number; point: Point } | undefined {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denominator = rx * sy - ry * sx;
  if (denominator === 0) return undefined;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denominator;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denominator;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return undefined;
  return { point: { x: a.x + t * rx, y: a.y + t * ry }, t, u };
}

interface Segment {
  readonly a: Point;
  readonly b: Point;
  readonly owner: number;
  readonly index: number;
}

/** Buckets segments into square cells so that crossing tests only compare nearby segments. */
function bucket(segments: readonly Segment[], size: number): Map<string, Segment[]> {
  const buckets = new Map<string, Segment[]>();
  for (const segment of segments) {
    for (const key of cellsOf(segment, size)) {
      const list = buckets.get(key) ?? [];
      list.push(segment);
      buckets.set(key, list);
    }
  }
  return buckets;
}

function cellsOf({ a, b }: { readonly a: Point; readonly b: Point }, size: number): string[] {
  const keys: string[] = [];
  for (let x = Math.floor(Math.min(a.x, b.x) / size); x <= Math.floor(Math.max(a.x, b.x) / size); x += 1) {
    for (let y = Math.floor(Math.min(a.y, b.y) / size); y <= Math.floor(Math.max(a.y, b.y) / size); y += 1) keys.push(`${String(x)},${String(y)}`);
  }
  return keys;
}

const samePoint = (left: Point, right: Point): boolean => left.x === right.x && left.y === right.y;

function segmentsOf(lines: readonly (readonly Point[])[]): Segment[] {
  return lines.flatMap((line, owner) => line.slice(1).map((b, index) => ({ a: item(line, index), b, index, owner })));
}

/** Chains whose simplified lines cross another chain (or themselves) anywhere but at a shared end. */
function crossingChains(lines: readonly (readonly Point[])[], size: number): Set<number> {
  const crossing = new Set<number>();
  for (const list of bucket(segmentsOf(lines), size).values()) {
    for (let first = 0; first < list.length; first += 1) {
      for (let second = first + 1; second < list.length; second += 1) {
        const left = item(list, first);
        const right = item(list, second);
        if (left.owner === right.owner && Math.abs(left.index - right.index) <= 1) continue;
        if (samePoint(left.a, right.a) || samePoint(left.a, right.b) || samePoint(left.b, right.a) || samePoint(left.b, right.b)) continue;
        if (properIntersection(left.a, left.b, right.a, right.b) !== undefined) {
          crossing.add(left.owner);
          crossing.add(right.owner);
        }
      }
    }
  }
  return crossing;
}

function simplifyChain(chain: readonly Point[], tolerance: number): Point[] {
  const closed = chain.length > 2 && samePoint(item(chain, 0), item(chain, chain.length - 1));
  const simplified = simplifyRing(chain, tolerance);
  return closed ? [...simplified, item(simplified, 0)] : simplified;
}

/** Simplifies every chain once; chains that would cross another are simplified less, then left raw. */
function simplifyChains(chains: readonly Point[][], tolerance: number, size: number): Point[][] {
  const lines = chains.map((chain) => simplifyChain(chain, tolerance));
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const crossing = crossingChains(lines, size);
    if (crossing.size === 0) return lines;
    for (const index of crossing) lines[index] = attempt === 6 ? [...item(chains, index)] : simplifyChain(item(chains, index), tolerance / 2 ** attempt);
  }
  if (crossingChains(lines, size).size > 0) throw new Error("Internal sub-territory lines cross each other.");
  return lines;
}

interface HalfEdge {
  readonly from: string;
  readonly to: string;
  readonly angle: number;
  twin?: HalfEdge;
  position: number;
  face: number;
}

interface Face {
  readonly ring: Point[];
  readonly area: number;
  readonly edges: HalfEdge[];
}

const keyOf = (point: Point): string => `${String(point.x)},${String(point.y)}`;

/** Every face boundary of a planar graph given as undirected edges. Bounded faces have positive area. */
function traceFaces(edges: readonly (readonly [Point, Point])[]): Face[] {
  const nodes = new Map<string, { point: Point; out: HalfEdge[] }>();
  const node = (point: Point): { point: Point; out: HalfEdge[] } => {
    const key = keyOf(point);
    const existing = nodes.get(key);
    if (existing !== undefined) return existing;
    const created = { out: [], point };
    nodes.set(key, created);
    return created;
  };
  const seen = new Set<string>();
  for (const [a, b] of edges) {
    const from = keyOf(a);
    const to = keyOf(b);
    if (from === to || seen.has(`${from}|${to}`) || seen.has(`${to}|${from}`)) continue;
    seen.add(`${from}|${to}`);
    const forward: HalfEdge = { angle: Math.atan2(b.y - a.y, b.x - a.x), face: -1, from, position: 0, to };
    const backward: HalfEdge = { angle: Math.atan2(a.y - b.y, a.x - b.x), face: -1, from: to, position: 0, to: from };
    forward.twin = backward;
    backward.twin = forward;
    node(a).out.push(forward);
    node(b).out.push(backward);
  }
  for (const { out } of nodes.values()) {
    out.sort((left, right) => left.angle - right.angle);
    out.forEach((edge, position) => {
      edge.position = position;
    });
  }
  const faces: Face[] = [];
  for (const { out } of nodes.values()) {
    for (const start of out) {
      if (start.face !== -1) continue;
      const ring: Point[] = [];
      const members: HalfEdge[] = [];
      for (let edge: HalfEdge = start; edge.face === -1;) {
        edge.face = faces.length;
        members.push(edge);
        ring.push((nodes.get(edge.from) as { point: Point }).point);
        const twin = edge.twin as HalfEdge;
        const around = (nodes.get(edge.to) as { out: HalfEdge[] }).out;
        edge = item(around, (twin.position - 1 + around.length) % around.length);
      }
      faces.push({ area: ringArea(ring), edges: members, ring });
    }
  }
  return faces;
}

interface LabelledFaces {
  readonly faces: Face[];
  readonly labels: (string | undefined)[];
}

/**
 * Labels faces. The outer boundary of a separate component (an island, or a hole in the region)
 * belongs to the smallest bounded face around it, if any. A bounded face inside the region takes
 * the grid label at its pole of inaccessibility, found with those holes cut out; a hole takes the
 * label of the face around it. Faces outside the region stay unlabelled.
 */
function labelFaces(faces: Face[], grid: LabelGrid, inside: (point: Point) => boolean): LabelledFaces {
  const around = faces.map((face): number => {
    if (face.area >= 0) return -1;
    const leftmost = face.ring.reduce((best, point) => (point.x < best.x ? point : best));
    const probe = { x: leftmost.x - 1e-6, y: leftmost.y };
    let best = -1;
    faces.forEach((candidate, candidateIndex) => {
      if (candidate.area <= 1e-9 || !containsPoint([candidate.ring], probe)) return;
      if (best === -1 || candidate.area < item(faces, best).area) best = candidateIndex;
    });
    return best;
  });
  const labels = faces.map((face, index): string | undefined => {
    if (face.area <= 1e-9) return undefined;
    const holes = faces.filter((_, holeIndex) => around[holeIndex] === index).map((hole) => hole.ring);
    const precision = Math.max(1e-4, Math.min(0.25, Math.sqrt(face.area) / 50));
    const point = poleOfInaccessibility([face.ring, ...holes], precision);
    return inside(point) ? labelAt(grid, point) : undefined;
  });
  around.forEach((face, index) => {
    if (face !== -1) labels[index] = labels[face];
  });
  return { faces, labels };
}

/**
 * Partitions `regionRings` (read even-odd) into parts labelled as `spec` says. Every part ring is
 * built from region edges and internal lines only, and the parts' areas add up to the region's.
 */
export function partitionRegion(regionRings: readonly Ring[], spec: LabelSpec, options: PartitionOptions): Part[] {
  const grid = labelGrid(regionRings, spec, options.cellSize);
  const region = edgeIndex(regionRings);
  const bucketSize = Math.max(1, 16 * options.cellSize);
  const lines = simplifyChains(traceChains(grid), options.tolerance, bucketSize);

  // Cut chains where they cross region edges; the crossing point is shared by both, exactly.
  const ringCuts = regionRings.map((ring) => ring.map((): { u: number; point: Point }[] => []));
  const lineCuts = lines.map((line) => line.map((): { t: number; point: Point }[] => []));
  const ringSegments = regionRings.flatMap((ring, owner) => ring.map((a, index) => ({ a, b: item(ring, (index + 1) % ring.length), index, owner })));
  const ringBuckets = bucket(ringSegments, bucketSize);
  for (const segment of segmentsOf(lines)) {
    const candidates = new Set(cellsOf(segment, bucketSize).flatMap((key) => ringBuckets.get(key) ?? []));
    for (const edge of candidates) {
      const hit = properIntersection(segment.a, segment.b, edge.a, edge.b);
      if (hit === undefined) continue;
      item(item(lineCuts, segment.owner), segment.index).push({ point: hit.point, t: hit.t });
      item(item(ringCuts, edge.owner), edge.index).push({ point: hit.point, u: hit.u });
    }
  }
  const graph: [Point, Point][] = [];
  regionRings.forEach((ring, owner) => {
    const points = ring.flatMap((point, index) => [point, ...item(item(ringCuts, owner), index).sort((left, right) => left.u - right.u).map((cut) => cut.point)]);
    points.forEach((point, index) => graph.push([point, item(points, (index + 1) % points.length)]));
  });
  lines.forEach((line, owner) => {
    const points = line.flatMap((point, index) => [point, ...(index < line.length - 1 ? item(item(lineCuts, owner), index).sort((left, right) => left.t - right.t).map((cut) => cut.point) : [])]);
    const cutAt = new Set(item(lineCuts, owner).flat().map((cut) => cut.point));
    let piece: [Point, Point][] = [];
    const flush = (): void => {
      const [first] = piece;
      if (first !== undefined && region.contains({ x: (first[0].x + first[1].x) / 2, y: (first[0].y + first[1].y) / 2 })) graph.push(...piece);
      piece = [];
    };
    for (let index = 0; index + 1 < points.length; index += 1) {
      const a = item(points, index);
      piece.push([a, item(points, index + 1)]);
      if (cutAt.has(item(points, index + 1))) flush();
    }
    flush();
  });

  // Trace, label, drop the lines between faces of one label, and trace again.
  const inside = (point: Point): boolean => region.contains(point);
  const first = labelFaces(traceFaces(graph), grid, inside);
  const faceLabel = (edge: HalfEdge): string | undefined => first.labels[edge.face];
  const kept = first.faces.flatMap((face) => face.edges.filter((edge) => {
    const twin = edge.twin as HalfEdge;
    return edge.from < edge.to && faceLabel(edge) !== faceLabel(twin);
  }));
  const pointOf = new Map(graph.flat().map((point) => [keyOf(point), point]));
  const second = labelFaces(traceFaces(kept.map((edge) => [pointOf.get(edge.from) as Point, pointOf.get(edge.to) as Point])), grid, inside);
  const parts = new Map<string, Point[][]>();
  second.faces.forEach((face, index) => {
    const label = second.labels[index];
    if (label === undefined || Math.abs(face.area) <= 1e-9) return;
    parts.set(label, [...(parts.get(label) ?? []), face.ring]);
  });
  const result = [...parts].map(([id, rings]) => ({ id, rings }));
  // A labelled face's signed area is positive for a face and negative for a hole around a
  // component, so the sum is the area the parts cover.
  const expected = evenOddArea(regionRings);
  const actual = second.faces.reduce((total, face, index) => total + (second.labels[index] === undefined || Math.abs(face.area) <= 1e-9 ? 0 : face.area), 0);
  if (Math.abs(actual - expected) > 1e-6 * Math.max(1, Math.abs(expected))) {
    throw new Error(`Parts cover ${actual.toFixed(3)} of a region of ${expected.toFixed(3)}; the partition leaks.`);
  }
  return result;
}
