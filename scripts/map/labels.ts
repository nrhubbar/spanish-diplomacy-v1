// Curves for text that follows the map: open-sea names along a coast and river names along a
// river. Curves are smooth, readable (see `readable`), and rounded to 0.1 map units.
import { item, type Point } from "./geometry.ts";
import { densify, type Line, lineLength, simplifyLine, sliceLine, smoothLine } from "./lines.ts";
import { roundPoint } from "./package.ts";

/**
 * Text never runs upside down: a mostly horizontal curve reads west to east, and a mostly
 * vertical one reads south to north (rotated, with the text on its western side).
 */
export function readable(curve: Line): Point[] {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (first === undefined || last === undefined) return [...curve];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const backwards = Math.abs(dx) >= Math.abs(dy) ? dx < 0 : dy > 0;
  return backwards ? [...curve].reverse() : [...curve];
}

/** A smooth, compact, rounded curve through (or near) the given points. */
export function labelCurve(points: Line, smoothing = 4): Point[] {
  return readable(simplifyLine(smoothLine(points, smoothing), 0.15).map(roundPoint));
}

export interface RiverLabelOptions {
  /** Curve length to aim for; shorter rivers get most of their length. */
  readonly length: number;
  /** Generalization applied before smoothing, so the text follows the valley, not every meander. */
  readonly generalize: number;
  /** Places the label should keep clear of (cities, territory labels), and by how much. */
  readonly obstacles: readonly Point[];
  readonly clearance: number;
  /** Only stretches whose middle lies within this rectangle are considered. */
  readonly within: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

/**
 * Picks the stretch of a river that reads best as a label: straight, close to horizontal, inside
 * the framed area, and clear of other labels. Returns undefined when no stretch qualifies.
 */
export function riverLabelCurve(river: Line, options: RiverLabelOptions): Point[] | undefined {
  const total = lineLength(river);
  const length = Math.min(options.length, total * 0.8);
  let best: { readonly curve: Point[]; readonly score: number } | undefined;
  for (let start = 0; start + length <= total; start += 4) {
    const stretch = sliceLine(river, start, start + length);
    const curve = smoothLine(simplifyLine(stretch, options.generalize), 5);
    const first = item(curve, 0);
    const last = item(curve, curve.length - 1);
    // The name covers the middle of the curve; on a narrow screen, most of it.
    const middle = sliceLine(curve, lineLength(curve) * 0.2, lineLength(curve) * 0.8);
    const centre = item(middle, Math.floor(middle.length / 2));
    const { within } = options;
    if (centre.x < within.x || centre.y < within.y || centre.x > within.x + within.width || centre.y > within.y + within.height) continue;
    const chord = Math.hypot(last.x - first.x, last.y - first.y);
    const straightness = chord / lineLength(curve);
    const level = Math.abs(last.x - first.x) / Math.max(chord, 1e-9);
    const crowded = densify(middle, options.clearance / 2).some((point) => options.obstacles.some((obstacle) => Math.hypot(obstacle.x - point.x, obstacle.y - point.y) < options.clearance));
    const score = straightness * straightness * (0.2 + 0.8 * level) - (crowded ? 1 : 0);
    if (best === undefined || score > best.score) best = { curve, score };
  }
  return best === undefined ? undefined : readable(simplifyLine(best.curve, 0.15).map(roundPoint));
}
