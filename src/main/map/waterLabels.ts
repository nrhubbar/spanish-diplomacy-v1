import type { MapPackage, MapPoint } from "../scenarios/loader";
import type { LabelCurve, MapRiver, WaterLabel, WaterTier } from "../scenarios/water";
import type { SemanticLevel } from "./camera";
import { clearOnScreen, type ScreenRect, type ScreenSize } from "./placement";

/** Type for one kind of water name, in screen pixels. */
export interface WaterType {
  readonly fontSize: number;
  /** Over-estimated average glyph width in ems, so a fit is never optimistic. */
  readonly glyphEm: number;
  readonly halo: number;
  /** Letter spacing; names along a curve spread out up to `widest` to span their water. */
  readonly letterSpacing: number;
  readonly widest: number;
  /** Distance from a curve to the text baseline; positive is above (left of the direction of travel). */
  readonly lift: number;
  readonly uppercase: boolean;
}

/**
 * Open seas are capitals, widely spaced (W5); gulfs and bays are smaller, in upper and lower case.
 * Glyph widths are the widest measured across the serif stack and its fallbacks (Iowan Old Style
 * about 0.68 em for capitals and 0.45 em otherwise; Georgia up to 0.75 and 0.52), rounded up.
 */
export const waterLabelType: Readonly<Record<WaterTier, WaterType>> = {
  overview: { fontSize: 13, glyphEm: 0.78, halo: 3, letterSpacing: 0.5, lift: 0, uppercase: true, widest: 7 },
  operational: { fontSize: 12, glyphEm: 0.56, halo: 3, letterSpacing: 1.4, lift: 0, uppercase: false, widest: 1.4 },
  detail: { fontSize: 10.5, glyphEm: 0.56, halo: 2.6, letterSpacing: 0.8, lift: 0, uppercase: false, widest: 0.8 }
};

/** River names run just above their river, from the operational zoom (R5). */
export const riverLabelType: WaterType = { fontSize: 10.5, glyphEm: 0.56, halo: 2.6, letterSpacing: 0.9, lift: 4, uppercase: false, widest: 0.9 };

const tierOrder: Readonly<Record<WaterTier, number>> = { overview: 0, operational: 1, detail: 2 };

export function waterTierShown(tier: WaterTier, level: SemanticLevel): boolean {
  return tierOrder[tier] <= tierOrder[level];
}

export function displayText(text: string, type: WaterType): string {
  return type.uppercase ? text.toLocaleUpperCase("es") : text;
}

export function textWidth(text: string, type: WaterType, letterSpacing = type.letterSpacing): number {
  return text.length * (type.fontSize * type.glyphEm + letterSpacing);
}

/** Spacing that spreads a name over most of a curve `length` pixels long, between the type's limits. */
export function spreadSpacing(text: string, type: WaterType, length: number): number {
  const spread = (length * 0.8 / text.length) - type.fontSize * type.glyphEm;
  return Math.min(type.widest, Math.max(type.letterSpacing, spread));
}

/** The point and unit direction `distance` along a curve (clamped to its ends). */
export function alongCurve(points: readonly MapPoint[], distance: number): { readonly point: MapPoint; readonly direction: MapPoint } {
  let remaining = Math.max(0, distance);
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    if (a === undefined || b === undefined) continue;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) continue;
    const direction = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    if (remaining <= length || index === points.length - 1) {
      const t = Math.min(remaining, length);
      return { direction, point: { x: a.x + direction.x * t, y: a.y + direction.y * t } };
    }
    remaining -= length;
  }
  return { direction: { x: 1, y: 0 }, point: points[0] ?? { x: 0, y: 0 } };
}

/**
 * Screen rectangles covering text centred on a curve, one per text height along the stretch the
 * text occupies; undefined when the curve is shorter on screen than the text, because text on a
 * path silently drops the glyphs that run past its end.
 */
export function curveFootprint(
  curve: LabelCurve,
  text: string,
  type: WaterType,
  scale: number,
  toScreen: (point: MapPoint) => MapPoint,
  letterSpacing = type.letterSpacing
): ScreenRect[] | undefined {
  const width = textWidth(text, type, letterSpacing);
  if (curve.length * scale < width) return undefined;
  const size = type.fontSize;
  const rise = type.lift + size * 0.35;
  const rects: ScreenRect[] = [];
  for (let offset = -width / 2 + size / 2; offset < width / 2; offset += size) {
    const { direction, point } = alongCurve(curve.points, curve.length / 2 + offset / scale);
    const at = toScreen(point);
    const centre = { x: at.x + direction.y * rise, y: at.y - direction.x * rise };
    rects.push({ height: size, width: size, x: centre.x - size / 2, y: centre.y - size / 2 });
  }
  return rects;
}

/** A straight label centred on its point, baseline at the point. */
export function pointFootprint(at: MapPoint, text: string, type: WaterType): ScreenRect[] {
  const width = textWidth(text, type);
  return [{ height: type.fontSize * 1.2, width, x: at.x - width / 2, y: at.y - type.fontSize }];
}

export interface PlacedWaterLabel {
  /** The curve chosen for a curved name. */
  readonly curve?: LabelCurve;
  readonly label: WaterLabel;
  /** Letter spacing in screen pixels. */
  readonly letterSpacing: number;
}

export interface VisibleWater {
  readonly labels: readonly PlacedWaterLabel[];
  /** Rivers whose name is drawn along their label curve. */
  readonly riverLabels: readonly (MapRiver & { readonly label: LabelCurve })[];
}

export interface WaterView {
  readonly level: SemanticLevel;
  /** What names must not touch: counters, land labels, and map controls. */
  readonly obstacles: readonly ScreenRect[];
  /** Screen pixels per map unit. */
  readonly scale: number;
  readonly toScreen: (point: MapPoint) => MapPoint;
  readonly viewport: ScreenSize;
}

/**
 * The water names to draw: those in their tier that fit wholly in the unobstructed part of the
 * screen and touch no counter, land label, or control, the same rule as the neutral context labels.
 */
export function visibleWater(map: MapPackage, { level, obstacles, scale, toScreen, viewport }: WaterView): VisibleWater {
  const fits = (footprint: readonly ScreenRect[] | undefined): boolean => footprint !== undefined && clearOnScreen(footprint, viewport, obstacles);
  const labels = map.waterLabels.flatMap((label): PlacedWaterLabel[] => {
    if (!waterTierShown(label.tier, level)) return [];
    const type = waterLabelType[label.tier];
    const text = displayText(label.text, type);
    if (label.kind === "point") return fits(pointFootprint(toScreen(label), text, type)) ? [{ label, letterSpacing: type.letterSpacing }] : [];
    for (const curve of label.curves) {
      const letterSpacing = spreadSpacing(text, type, curve.length * scale);
      if (fits(curveFootprint(curve, text, type, scale, toScreen, letterSpacing))) return [{ curve, label, letterSpacing }];
    }
    return [];
  });
  const riverLabels = level === "overview" ? [] : map.rivers.flatMap((river) => {
    const { label } = river;
    return label !== undefined && fits(curveFootprint(label, river.name, riverLabelType, scale, toScreen)) ? [{ ...river, label }] : [];
  });
  return { labels, riverLabels };
}
