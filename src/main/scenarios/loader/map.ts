import type { CityId, SubTerritoryId, TerritoryId, UnitTypeId } from "../../engine/types";
import type { MapPackage, MapPoint } from "../loader";
import type { MapDocument } from "../schema/mapSchema";
import type { ScenarioDocument } from "../schema/scenarioSchema";
import { checkWater, indexWater } from "../water";

/** L10, L11: the map package covers the scenario and names only assets that exist. */
export function checkMap(document: ScenarioDocument, map: MapDocument, assetPaths: ReadonlySet<string>): readonly string[] {
  const issues: string[] = [];
  const territories = new Set(document.territories.map((territory) => territory.id));
  const boundTerritories = new Set(Object.values(map.regions).map((region) => region.territoryId));
  const inside = (point: MapPoint): boolean =>
    point.x >= map.viewBox.x && point.x <= map.viewBox.x + map.viewBox.width
    && point.y >= map.viewBox.y && point.y <= map.viewBox.y + map.viewBox.height;

  for (const [regionId, region] of Object.entries(map.regions)) {
    if (!territories.has(region.territoryId)) issues.push(`map.regions.${regionId}: unknown territory "${region.territoryId}" (L10)`);
  }
  for (const territory of document.territories) {
    const entry = map.territories[territory.id];
    if (entry === undefined) {
      issues.push(`map.territories: missing "${territory.id}" (L10)`);
      continue;
    }
    if (!boundTerritories.has(territory.id) && entry.shape === undefined) {
      issues.push(`map.territories.${territory.id}: needs a bound SVG region or a shape (L10)`);
    }
    if (!inside(entry.unitAnchor)) issues.push(`map.territories.${territory.id}.unitAnchor: outside the view box (L10)`);
  }
  for (const id of Object.keys(map.territories)) {
    if (!territories.has(id)) issues.push(`map.territories.${id}: unknown territory (L10)`);
  }
  const cityIds = new Set(document.cities.map((city) => city.id));
  for (const city of document.cities) {
    const position = map.cities[city.id];
    if (position === undefined) issues.push(`map.cities: missing "${city.id}" (L10)`);
    else if (!inside(position)) issues.push(`map.cities.${city.id}: outside the view box (L10)`);
  }
  for (const id of Object.keys(map.cities)) {
    if (!cityIds.has(id)) issues.push(`map.cities.${id}: unknown city (L10)`);
  }
  for (const type of document.unitTypes) {
    if (map.unitSymbols[type.id] === undefined) issues.push(`map.unitSymbols: missing "${type.id}" (L10)`);
  }

  const assets = [
    map.geometry.svg,
    ...Object.values(map.unitSymbols),
    ...(map.terrain?.layers.map((layer) => layer.image) ?? [])
  ];
  for (const asset of assets) {
    if (!assetPaths.has(asset)) issues.push(`map: asset "${asset}" not found (L11)`);
  }
  issues.push(...checkWater(map));
  const entries = (map as { readonly subTerritories?: { readonly entries: MapSubTerritoryEntries } }).subTerritories?.entries;
  if (entries !== undefined) {
    issues.push(...checkSubTerritoryMap(document.ruleset === "m3-modular" ? document.subTerritories : [], entries));
  }
  return issues;
}

export function indexMap(document: MapDocument): MapPackage {
  return {
    attribution: document.attribution.map((entry) => ({ text: entry.text, ...(entry.url === undefined ? {} : { url: entry.url }) })),
    background: document.background,
    cities: new Map(Object.entries(document.cities).map(([id, city]) => [id as CityId, city])),
    contextLabels: document.contextLabels,
    focus: document.focus,
    geometryPath: document.geometry.svg,
    id: document.id,
    regions: new Map(Object.entries(document.regions).map(([regionId, region]) => [regionId, region.territoryId as TerritoryId])),
    stripSelectors: document.geometry.stripSelectors,
    ...(document.subTerritories === undefined
      ? {}
      : {
          subTerritories: {
            entries: new Map(Object.entries(document.subTerritories.entries).map(([id, entry]) => [
              id as SubTerritoryId,
              { capital: entry.capital, label: entry.label, territoryId: entry.territoryId as TerritoryId }
            ])),
            svgPath: document.subTerritories.svg
          }
        }),
    ...(document.terrain === undefined
      ? {}
      : {
          terrain: { layers: document.terrain.layers.map((layer) => ({ bounds: layer.bounds, imagePath: layer.image })) }
        }),
    territories: new Map(Object.entries(document.territories).map(([id, territory]) => [
      id as TerritoryId,
      {
        label: territory.label,
        unitAnchor: territory.unitAnchor,
        ...(territory.shape === undefined ? {} : { shape: territory.shape })
      }
    ])),
    unitSymbolPaths: new Map(Object.entries(document.unitSymbols).map(([id, path]) => [id as UnitTypeId, path])),
    viewBox: document.viewBox,
    ...indexWater(document)
  };
}

/** The map's sub-territory entries (shape owned by `m3r1-map-provinces`), as far as the loader checks them. */
export type MapSubTerritoryEntries = Readonly<Record<string, { readonly territoryId: string }>>;

/**
 * L10: the map's sub-territory entries and the scenario's sub-territories match one to one, in
 * the same territories. TODO(integrator, at the map-provinces merge): read `map.subTerritories`
 * through its schema and require it for partitioned packages.
 */
export function checkSubTerritoryMap(
  subTerritories: readonly { readonly id: string; readonly territoryId: string }[],
  entries: MapSubTerritoryEntries
): readonly string[] {
  const known = new Set(subTerritories.map((sub) => sub.id));
  return [
    ...subTerritories.flatMap((sub) => {
      const entry = entries[sub.id];
      if (entry === undefined) return [`map.subTerritories.entries: missing "${sub.id}" (L10)`];
      return entry.territoryId === sub.territoryId ? [] : [`map.subTerritories.entries.${sub.id}: territory "${entry.territoryId}" is not "${sub.territoryId}" (L10)`];
    }),
    ...Object.keys(entries).filter((id) => !known.has(id)).map((id) => `map.subTerritories.entries.${id}: unknown sub-territory (L10)`)
  ];
}
