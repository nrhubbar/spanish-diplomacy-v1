// Turns projected geography into the coordinate fields of a map package (`map.json`).
import { containsPoint, type Point, poleOfInaccessibility, type Ring, ringArea } from "./geometry.ts";

export interface Placement {
  readonly label: Point;
  readonly unitAnchor: Point;
}

const round = (value: number): number => Math.round(value * 10) / 10;
export const roundPoint = (point: Point): Point => ({ x: round(point.x), y: round(point.y) });

/**
 * Unit anchor at the region's pole of inaccessibility (searched within its largest ring, with
 * every ring counted for inside-ness so holes such as enclaves are respected), and the label
 * lifted above it. Overrides win; the result is rounded to 0.1 map units.
 */
export function placeTerritory(rings: readonly Ring[], lift: number, override: Partial<Placement> = {}): Placement {
  const ordered = [...rings].sort((left, right) => Math.abs(ringArea(right)) - Math.abs(ringArea(left)));
  const anchor = override.unitAnchor ?? poleOfInaccessibility(ordered, 0.5);
  const label = override.label ?? { x: anchor.x, y: anchor.y - lift };
  return { label: roundPoint(label), unitAnchor: roundPoint(anchor) };
}

/** Whether a point lies inside the territory's rings; used to report labels that need an override. */
export function insideTerritory(rings: readonly Ring[], point: Point): boolean {
  return containsPoint(rings, point);
}

export function hexColor(color: readonly [number, number, number]): string {
  return `#${color.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}
