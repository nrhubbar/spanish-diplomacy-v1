// River geometry for a map package: joins a river's source pieces into chains, clips them to the
// playable land, and finds the mouths. Everything is in projected map units (km). Lines passed
// to `clipToLand` run downstream, so a run's last point is its downstream end.
import type { EdgeIndex } from "./edgeIndex.ts";
import { item, type Point } from "./geometry.ts";
import { densify, type Line, lineLength } from "./lines.ts";

export interface Land {
  /** The playable country's land: rivers are clipped to it. */
  readonly playable: EdgeIndex;
  /** Neighbouring countries' land; anything in neither is sea. */
  readonly neutral: EdgeIndex;
}

export interface ClipOptions {
  /** Vertex spacing used while clipping. */
  readonly step: number;
  /** Rivers within this distance of the border, on neutral land, are drawn just inside it. */
  readonly snap: number;
  /** How far inside the edge snapped and cut points are placed, so rounding never leaves the land. */
  readonly inset: number;
  /** Gaps up to this long (slivers between two boundary datasets) are bridged. */
  readonly bridge: number;
  /** Runs shorter than this are dropped. */
  readonly shortest: number;
}

export type RunEnd = "border" | "sea" | "source";

export interface Run {
  readonly points: readonly Point[];
  /** Why the run stops at its downstream end: a land border, the sea, or the source line's own end. */
  readonly end: RunEnd;
}

const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * Joins pieces whose ends meet (within `reach`) into chains, keeping their direction: a piece
 * that starts where another ends continues it. Pieces that meet head to head are reversed.
 */
export function chainParts(parts: readonly Line[], reach: number): Point[][] {
  const open = parts.filter((part) => part.length >= 2).map((part) => [...part]);
  const chains: Point[][] = [];
  for (let chain = open.shift(); chain !== undefined; chain = open.shift()) {
    let current = chain;
    for (let joined = true; joined;) {
      joined = false;
      for (let index = 0; index < open.length; index += 1) {
        const part = item(open, index);
        const head = item(current, 0);
        const tail = item(current, current.length - 1);
        const first = item(part, 0);
        const last = item(part, part.length - 1);
        let next: Point[] | undefined;
        if (distance(tail, first) <= reach) next = [...current, ...part.slice(1)];
        else if (distance(last, head) <= reach) next = [...part, ...current.slice(1)];
        else if (distance(tail, last) <= reach) next = [...current, ...[...part].reverse().slice(1)];
        else if (distance(first, head) <= reach) next = [...[...part].reverse(), ...current.slice(1)];
        if (next !== undefined) {
          current = next;
          open.splice(index, 1);
          joined = true;
          break;
        }
      }
    }
    chains.push(current);
  }
  return chains.sort((left, right) => lineLength(right) - lineLength(left));
}

type Classified = { readonly kind: "land"; readonly point: Point } | { readonly kind: "out"; readonly point: Point; readonly end: RunEnd };

/**
 * Moves a point on land at least `inset` away from the land edge where it can, so neither
 * rounding nor the relief's antialiased mask puts it in the sea or across a border.
 */
function clearOfEdge(point: Point, land: Land, inset: number): Point {
  let current = point;
  for (let round = 0; round < 3; round += 1) {
    const edge = land.playable.nearest(current, inset);
    if (edge === undefined) return current;
    if (edge.distance === 0) {
      // Exactly on the edge: step inward in whichever direction is on land.
      const inward = Array.from({ length: 8 }, (_, step) => ({ x: current.x + inset * Math.cos(step * Math.PI / 4), y: current.y + inset * Math.sin(step * Math.PI / 4) }))
        .find((probe) => land.playable.contains(probe) && land.playable.nearest(probe, inset * 0.99) === undefined);
      return inward ?? current;
    }
    const scale = inset / edge.distance;
    const moved = { x: edge.point.x + (current.x - edge.point.x) * scale, y: edge.point.y + (current.y - edge.point.y) * scale };
    if (!land.playable.contains(moved)) return current;
    current = moved;
  }
  return current;
}

function classify(point: Point, land: Land, options: ClipOptions): Classified {
  if (land.playable.contains(point)) return { kind: "land", point: clearOfEdge(point, land, options.inset) };
  // The two boundary datasets differ by a few hundred metres, so "next to neutral land" counts.
  const onNeutral = land.neutral.contains(point) || land.neutral.nearest(point, 1) !== undefined;
  const edge = land.playable.nearest(point, options.snap);
  if (onNeutral && edge !== undefined && edge.distance > 0) {
    for (const inset of [options.inset, 2 * options.inset]) {
      const scale = (edge.distance + inset) / edge.distance;
      const moved = { x: point.x + (edge.point.x - point.x) * scale, y: point.y + (edge.point.y - point.y) * scale };
      if (land.playable.contains(moved)) return { kind: "land", point: clearOfEdge(moved, land, options.inset) };
    }
  }
  return { end: onNeutral ? "border" : "sea", kind: "out", point };
}

/** The point `inset` before the land edge on the segment from `inside` (on land) to `outside`. */
function edgeBefore(inside: Point, outside: Point, land: Land, inset: number): Point {
  let low = 0;
  let high = 1;
  for (let round = 0; round < 24; round += 1) {
    const middle = (low + high) / 2;
    if (land.playable.contains({ x: inside.x + (outside.x - inside.x) * middle, y: inside.y + (outside.y - inside.y) * middle })) low = middle;
    else high = middle;
  }
  const length = distance(inside, outside);
  const t = Math.max(0, low - inset / Math.max(length, 1e-9));
  return clearOfEdge({ x: inside.x + (outside.x - inside.x) * t, y: inside.y + (outside.y - inside.y) * t }, land, inset);
}

/** Whether the straight span stays on the land, or within 0.2 km of its edge, every 0.25 km. */
export function hugsLand(from: Point, to: Point, land: Land): boolean {
  return densify([from, to], 0.25).every((point) => land.playable.contains(point) || land.playable.nearest(point, 0.2) !== undefined);
}

/**
 * Clips a downstream-ordered line to the playable land. Stretches that run along a land border
 * are kept just inside it, short gaps are bridged, and each run records why it ends.
 */
export function clipToLand(line: Line, land: Land, options: ClipOptions): Run[] {
  const points = densify(line, options.step).map((point) => classify(point, land, options));
  const runs: Run[] = [];
  let current: Point[] = [];
  let gap: Classified[] = [];
  const close = (end: RunEnd, outside?: Point): void => {
    const last = current[current.length - 1];
    if (last !== undefined && outside !== undefined) current.push(edgeBefore(last, outside, land, options.inset));
    if (current.length >= 2 && lineLength(current) >= options.shortest) runs.push({ end, points: current });
    current = [];
  };
  for (const entry of points) {
    if (entry.kind === "out") {
      gap.push(entry);
      continue;
    }
    if (gap.length > 0) {
      const first = gap[0];
      // Only slivers are bridged: short gaps off both lands whose bridge hugs the land edge. A gap
      // on neighbouring land is the river leaving the country.
      const last = current[current.length - 1];
      const sliver = gap.every((point) => point.kind === "out" && point.end === "sea") && last !== undefined && hugsLand(last, entry.point, land);
      const bridgeable = sliver && (gap.length + 1) * options.step <= options.bridge;
      if (!bridgeable && first?.kind === "out") {
        close(first.end, first.point);
        const outside = gap[gap.length - 1];
        if (outside !== undefined) current.push(edgeBefore(entry.point, outside.point, land, options.inset));
      }
      gap = [];
    }
    // Two points snapped to either side of a neighbour's salient would join across it: cut there.
    const last = current[current.length - 1];
    if (last !== undefined && !hugsLand(last, entry.point, land)) close("border");
    current.push(entry.point);
  }
  const trailing = gap[0];
  if (trailing?.kind === "out") close(trailing.end, trailing.point);
  else close("source");
  return runs;
}

/** How far a probe must be from any land to count as open sea. */
const seaClearance = 2.5;

/**
 * Whether the coast lies within about `reach` of the point: some probe on rings 1 km apart, out
 * to `reach` plus the clearance, is open sea. A probe counts as sea only when it is clear of both
 * kinds of land, so the slivers where the two boundary datasets fail to meet along a land border
 * are not mistaken for sea.
 */
export function nearSea(point: Point, land: Land, reach: number): boolean {
  const isSea = (probe: Point): boolean => !land.playable.contains(probe) && !land.neutral.contains(probe)
    && land.playable.nearest(probe, seaClearance) === undefined && land.neutral.nearest(probe, seaClearance) === undefined;
  for (let radius = 1; radius <= reach + seaClearance; radius += 1) {
    for (let step = 0; step < 32; step += 1) {
      const angle = step * Math.PI / 16;
      if (isSea({ x: point.x + radius * Math.cos(angle), y: point.y + radius * Math.sin(angle) })) return true;
    }
  }
  return false;
}
