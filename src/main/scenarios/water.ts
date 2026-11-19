import type { MapDocument } from "./schema/mapSchema";

interface Point {
  readonly x: number;
  readonly y: number;
}

/** When a water name shows: from the overview (always), the operational zoom, or the detail zoom. */
export type WaterTier = "overview" | "operational" | "detail";

/** A curve that text follows: its path data for `textPath`, its points, and its length in map units. */
export interface LabelCurve {
  readonly length: number;
  readonly path: string;
  readonly points: readonly Point[];
}

export interface MapRiver {
  readonly id: string;
  readonly label?: LabelCurve;
  /** Final stretch into the sea, drawn tapering. */
  readonly mouth?: string;
  readonly name: string;
  readonly path: string;
  readonly rank: "main" | "tributary";
}

export type WaterLabel =
  | { readonly kind: "point"; readonly text: string; readonly tier: WaterTier; readonly x: number; readonly y: number }
  | { readonly curves: readonly LabelCurve[]; readonly kind: "curve"; readonly text: string; readonly tier: WaterTier };

/**
 * Points of polyline path data in the package's compact form (`M x y` moves followed by
 * relative `l` steps, as the schema requires), one list per move.
 */
export function polylinePoints(path: string): Point[][] {
  return path.split("M").filter((part) => part.length > 0).map((part) => {
    const numbers = (part.match(/-?(?:\d+(?:\.\d+)?|\.\d+)/g) ?? []).map(Number);
    const points: Point[] = [];
    let x = 0;
    let y = 0;
    for (let index = 0; index + 1 < numbers.length; index += 2) {
      x += numbers[index] ?? 0;
      y += numbers[index + 1] ?? 0;
      points.push({ x, y });
    }
    return points;
  });
}

export function curveLength(points: readonly Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    if (a !== undefined && b !== undefined) total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

function labelCurve(path: string): LabelCurve {
  const points = polylinePoints(path).flat();
  return { length: curveLength(points), path, points };
}

export function indexWater(document: MapDocument): { readonly rivers: readonly MapRiver[]; readonly waterLabels: readonly WaterLabel[] } {
  return {
    rivers: document.rivers.map((river) => ({
      id: river.id,
      name: river.name,
      path: river.path,
      rank: river.rank,
      ...(river.mouth === undefined ? {} : { mouth: river.mouth }),
      ...(river.labelPath === undefined ? {} : { label: labelCurve(river.labelPath) })
    })),
    waterLabels: document.waterLabels.map((label) => "paths" in label
      ? { curves: label.paths.map(labelCurve), kind: "curve", text: label.text, tier: label.tier }
      : { kind: "point", text: label.text, tier: label.tier, x: label.x, y: label.y })
  };
}

/** Package rules for water: unique river ids, and every river and label point inside the view box. */
export function checkWater(document: MapDocument): readonly string[] {
  const { viewBox } = document;
  const outside = (point: Point): boolean =>
    point.x < viewBox.x || point.x > viewBox.x + viewBox.width || point.y < viewBox.y || point.y > viewBox.y + viewBox.height;
  const issues: string[] = [];
  const seen = new Set<string>();
  document.rivers.forEach((river, index) => {
    if (seen.has(river.id)) issues.push(`map.rivers[${String(index)}]: duplicate river id "${river.id}"`);
    seen.add(river.id);
    const paths = [river.path, river.mouth, river.labelPath].filter((path) => path !== undefined);
    if (paths.some((path) => polylinePoints(path).flat().some(outside))) issues.push(`map.rivers.${river.id}: leaves the view box`);
  });
  document.waterLabels.forEach((label, index) => {
    const points = "paths" in label ? label.paths.flatMap((path) => polylinePoints(path).flat()) : [label];
    if (points.some(outside)) issues.push(`map.waterLabels[${String(index)}] "${label.text}": outside the view box`);
  });
  return issues;
}
