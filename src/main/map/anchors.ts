import type { TerritoryId } from "../engine/types";
import type { MapPackage, MapPoint, MapTerritory } from "../scenarios/loader";

/** Map entry for a territory; the loader guarantees one exists for every scenario territory (L10). */
export function mapTerritory(map: MapPackage, id: TerritoryId): MapTerritory {
  const entry = map.territories.get(id);
  if (entry === undefined) throw new Error(`Invariant violated: no map entry for territory "${id}".`);
  return entry;
}

export function territoryAnchor(map: MapPackage, id: TerritoryId): MapPoint {
  return mapTerritory(map, id).unitAnchor;
}
