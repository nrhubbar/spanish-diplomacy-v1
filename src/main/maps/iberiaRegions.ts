import type { TerritoryId } from "../engine/types";
import regionData from "./iberiaRegions.json";

export interface MapAnchor {
  readonly x: number;
  readonly y: number;
}

export interface IberiaRegion {
  readonly adjacent: readonly TerritoryId[];
  readonly anchor: MapAnchor;
  readonly country: "gibraltar" | "portugal" | "spain";
  readonly name: string;
  readonly showLabel: boolean;
  readonly territoryId: TerritoryId | null;
}

export const iberiaRegions = regionData as Readonly<Record<string, IberiaRegion>>;

export const playableIberiaRegions = Object.values(iberiaRegions).filter(
  (region): region is IberiaRegion & { readonly territoryId: TerritoryId } =>
    region.territoryId !== null
);

export const territoryAnchors = Object.fromEntries(
  playableIberiaRegions.map((region) => [region.territoryId, region.anchor])
) as Readonly<Record<TerritoryId, MapAnchor>>;

export function regionById(regionId: string): IberiaRegion | undefined {
  return iberiaRegions[regionId];
}

export function regionsForTerritory(territoryId: TerritoryId): readonly IberiaRegion[] {
  return Object.values(iberiaRegions).filter((region) => region.territoryId === territoryId);
}
