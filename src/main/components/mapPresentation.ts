export interface MapCoordinate {
  readonly x: number;
  readonly y: number;
}

export interface MapViewBox extends MapCoordinate {
  readonly height: number;
  readonly width: number;
}

export interface UnitMarkerPosition {
  readonly leftPercent: number;
  readonly topPercent: number;
}

export interface MapProjection {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

export type MapKeyboardIntent =
  | { readonly kind: "pan"; readonly deltaX: number; readonly deltaY: number }
  | { readonly kind: "reset" }
  | { readonly kind: "select" }
  | { readonly kind: "zoom-in" }
  | { readonly kind: "zoom-out" };

export const mapPresentationConfig = {
  labelCompensationExponent: 0.72,
  panStep: 36,
  unitCompensationExponent: 0.42,
  unitHorizontalStackOffset: 3.9,
  unitVerticalStackOffset: 3.5,
  unitsPerRow: 4
} as const;

// The generated geoBoundaries geometry is pre-registered to the terrain view box. Keep
// every runtime overlay in that single coordinate system.
export const iberiaMapProjection: MapProjection = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0
} as const;

export const iberiaMapProjectionTransform = `matrix(${iberiaMapProjection.a} ${iberiaMapProjection.b} ${iberiaMapProjection.c} ${iberiaMapProjection.d} ${iberiaMapProjection.e} ${iberiaMapProjection.f})`;

export function projectMapCoordinate(coordinate: MapCoordinate): MapCoordinate {
  const projection = iberiaMapProjection;
  return {
    x: projection.a * coordinate.x + projection.c * coordinate.y + projection.e,
    y: projection.b * coordinate.x + projection.d * coordinate.y + projection.f
  };
}

export function mapAssetCompensation(mapScale: number, exponent: number): number {
  return 1 / Math.pow(mapScale, exponent);
}

export function mapKeyboardIntent(key: string): MapKeyboardIntent | undefined {
  const panStep = mapPresentationConfig.panStep;
  switch (key) {
    case "Enter":
    case " ":
      return { kind: "select" };
    case "a":
    case "ArrowLeft":
      return { deltaX: panStep, deltaY: 0, kind: "pan" };
    case "d":
    case "ArrowRight":
      return { deltaX: -panStep, deltaY: 0, kind: "pan" };
    case "s":
    case "ArrowDown":
      return { deltaX: 0, deltaY: -panStep, kind: "pan" };
    case "w":
    case "ArrowUp":
      return { deltaX: 0, deltaY: panStep, kind: "pan" };
    case "+":
    case "=":
      return { kind: "zoom-in" };
    case "-":
    case "_":
      return { kind: "zoom-out" };
    case "0":
    case "Home":
      return { kind: "reset" };
    default:
      return undefined;
  }
}

export function unitMarkerPosition(
  anchor: MapCoordinate,
  stackIndex: number,
  viewBox: MapViewBox
): UnitMarkerPosition {
  const column = stackIndex % mapPresentationConfig.unitsPerRow;
  const row = Math.floor(stackIndex / mapPresentationConfig.unitsPerRow);
  return {
    leftPercent: ((anchor.x - viewBox.x) / viewBox.width) * 100
      + column * mapPresentationConfig.unitHorizontalStackOffset,
    topPercent: ((anchor.y - viewBox.y) / viewBox.height) * 100
      + row * mapPresentationConfig.unitVerticalStackOffset
  };
}

export function compactUnitStrength(strength: number): string {
  if (strength < 1000) return `${strength}`;
  const thousands = strength / 1000;
  return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
}

export function unitDesignation(displayName: string): string {
  const formationNumber = displayName.match(/(?:No\.\s*)?(\d+)\b/)?.[1] ?? "";
  const nameWords = displayName
    .replace(/\b(?:Infantry|Regiment|Battalion|Column|Security|Guard|No)\.?\b/gi, " ")
    .match(/[A-Za-zÀ-ÿ]+/g) ?? [];
  const initials = nameWords.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
  return `${initials}${formationNumber}`.slice(0, 4);
}

