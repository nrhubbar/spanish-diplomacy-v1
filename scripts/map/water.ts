// Assembles the `rivers` and `waterLabels` fields of a map package from projected river lines and
// the package's water configuration. Every point comes through the caller's projection, so rivers
// and labels are registered with the regions and the relief by construction.
import type { EdgeIndex } from "./edgeIndex.ts";
import { item, type Point } from "./geometry.ts";
import type { GeoPoint, Rect } from "./iberia-1936.ts";
import type { RiverEntry, RiverStyle, WaterLabelSource, WaterTier } from "./iberia-1936-water.ts";
import { labelCurve, riverLabelCurve } from "./labels.ts";
import { type Line, lineData, lineDistance, lineLength, simplifyLine, sliceLine } from "./lines.ts";
import { roundPoint } from "./package.ts";
import { chainParts, clipToLand, hugsLand, type Land, nearSea, type Run } from "./rivers.ts";

export interface RiverDocument {
  readonly id: string;
  readonly name: string;
  readonly rank: RiverEntry["rank"];
  readonly path: string;
  readonly mouth?: string;
  /** A smooth curve beside a stretch of the river, read west to east, for its name. */
  readonly labelPath?: string;
}

export type WaterLabelDocument =
  | { readonly text: string; readonly tier: WaterTier; readonly x: number; readonly y: number }
  | { readonly text: string; readonly tier: WaterTier; readonly paths: readonly string[] };

export interface RiverInput {
  /** Ground height at a map point: the lower end of a chain is its downstream end. */
  readonly elevation: (point: Point) => number;
  readonly entries: Readonly<Record<string, RiverEntry>>;
  /** Projected source lines per Natural Earth `rivernum`. */
  readonly lines: ReadonlyMap<number, readonly Line[]>;
  readonly land: Land;
  readonly style: RiverStyle;
  /** Label positions river names keep clear of, and the area labels must sit in. */
  readonly obstacles: readonly Point[];
  readonly focus: Rect;
}

export interface BuiltRiver {
  readonly document: RiverDocument;
  /** The lines written (rounded), for the registration and confluence checks. */
  readonly lines: readonly (readonly Point[])[];
  /** Every vertex written, for the registration check against the baked land mask. */
  readonly vertices: readonly Point[];
  /** Where the main chain ends downstream, and why. */
  readonly downstream?: { readonly point: Point; readonly end: Run["end"] };
}

function downhill(chain: readonly Point[], elevation: RiverInput["elevation"]): Point[] {
  const first = chain[0];
  const last = chain[chain.length - 1];
  return first !== undefined && last !== undefined && elevation(last) > elevation(first) ? [...chain].reverse() : [...chain];
}

function splitMouth(run: Run, length: number): { readonly course: Point[]; readonly mouth: Point[] } {
  const total = lineLength(run.points);
  const cut = total - Math.min(length, total / 3);
  return { course: sliceLine(run.points, 0, cut), mouth: sliceLine(run.points, cut, total) };
}

/** Clips, simplifies, and tapers one river; returns undefined when nothing of it is on land. */
export function buildRiver(id: string, entry: RiverEntry, input: RiverInput): BuiltRiver | undefined {
  const { land, style } = input;
  const parts = entry.rivernums.flatMap((rivernum) => input.lines.get(rivernum) ?? []);
  // Source lines are not reliably digitized downstream, so each chain is turned to run downhill.
  // Chains come longest first, so the main chain's last run is the river's own downstream end.
  const chains = chainParts(parts, 1.5).map((chain) => clipToLand(downhill(chain, input.elevation), land, style.clip));
  const runs = chains.flat();
  if (runs.length === 0) return undefined;
  const tolerance = style.simplify[entry.rank];
  // Simplified spans may not cut across the sea or a neighbour.
  const simplify = (line: Line): Point[] => simplifyLine(line, tolerance, (from, to) => hugsLand(from, to, land));
  const mouthIndex = (chains[0]?.length ?? 0) - 1;
  const mouthRun = runs[mouthIndex];
  const tapers = mouthRun !== undefined && mouthRun.end !== "border" && nearSea(item(mouthRun.points, mouthRun.points.length - 1), land, style.mouthReach);
  const courses: Point[][] = [];
  let mouth: Point[] | undefined;
  runs.forEach((run, index) => {
    if (index === mouthIndex && tapers) {
      const split = splitMouth(run, style.mouthLength);
      courses.push(simplify(split.course));
      mouth = simplify(split.mouth);
    } else courses.push(simplify(run.points));
  });
  const rounded = [...courses, ...(mouth === undefined ? [] : [mouth])].map((line) => line.map(roundPoint));
  const margin = style.label.margin;
  const longest = runs.reduce((best, run) => lineLength(run.points) > lineLength(best.points) ? run : best);
  const labelled = entry.rank === "main" ? riverLabelCurve(longest.points, {
    clearance: style.label.clearance,
    generalize: style.label.generalize,
    length: style.label.length,
    obstacles: input.obstacles,
    within: { height: input.focus.height - 2 * margin, width: input.focus.width - 2 * margin, x: input.focus.x + margin, y: input.focus.y + margin }
  }) : undefined;
  return {
    document: {
      id,
      name: entry.name,
      rank: entry.rank,
      path: courses.map((line) => lineData(line, 1)).join(""),
      ...(mouth === undefined ? {} : { mouth: lineData(mouth, 1) }),
      ...(labelled === undefined ? {} : { labelPath: lineData(labelled, 1) })
    },
    lines: rounded,
    vertices: rounded.flat(),
    ...(mouthRun === undefined ? {} : { downstream: { end: mouthRun.end, point: mouthRun.points[mouthRun.points.length - 1] ?? { x: 0, y: 0 } } })
  };
}

/** Throws unless the river's downstream end meets another river, the sea, or a land border within `reach`. */
export function assertConfluence(river: BuiltRiver, all: readonly BuiltRiver[], land: Land, reach: number): void {
  const { downstream } = river;
  if (river.document.rank === "main" || downstream === undefined || downstream.end === "border") return;
  const meets = all.some((other) => other !== river && other.lines.some((line) => lineDistance(line, downstream.point) <= reach));
  const atBorder = land.neutral.nearest(downstream.point, reach) !== undefined;
  if (!meets && !atBorder && !nearSea(downstream.point, land, reach)) {
    throw new Error(`River ${river.document.id} ends ${String(downstream.point.x)}, ${String(downstream.point.y)} away from any river, coast, or border.`);
  }
}

/** Throws unless every vertex lies on the playable land (rounding included). */
export function assertOnLand(river: BuiltRiver, playable: EdgeIndex): void {
  const outside = river.vertices.filter((point) => !playable.contains(point));
  if (outside.length > 0) throw new Error(`River ${river.document.id}: ${String(outside.length)} vertices lie off the playable land.`);
}

export function buildWaterLabels(sources: readonly WaterLabelSource[], project: (point: GeoPoint) => Point): WaterLabelDocument[] {
  return sources.map((source) => "at" in source
    ? { text: source.text, tier: source.tier, ...roundPoint(project(source.at)) }
    : { text: source.text, tier: source.tier, paths: source.along.map((curve) => lineData(labelCurve(curve.map(project)), 1)) });
}
