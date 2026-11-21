import type { ModularScenarioDocument } from "../schema/scenarioSchema";
import { idSet, type Issues } from "./issues";
import { checkBuildable, checkLinks } from "./linkChecks";

type SubTerritoryDocument = ModularScenarioDocument["subTerritories"][number];

/** Rules L16, L18, L19, L28 and L29: sub-territories, their data, borders and links, and connection entries. */
export function checkSubTerritories(document: ModularScenarioDocument, issues: Issues): void {
  const subTerritories = new Map(document.subTerritories.map((sub) => [sub.id, sub]));
  const factions = idSet(document.factions);
  const territories = idSet(document.territories);
  const sources = idSet(document.sources);
  const partitioned = subTerritories.size > 0;

  document.subTerritories.forEach((sub, index) => {
    const path = `subTerritories[${index}]`;
    issues.ref(`${path}.territoryId`, sub.territoryId, territories, "territory");
    issues.ref(`${path}.startHolder`, sub.startHolder, factions, "faction");
    sub.sources.forEach((source) => { issues.ref(`${path}.sources`, source.sourceId, sources, "source"); });
    if (sub.sources.length === 0 && sub.note === undefined) issues.add(`${path}: "${sub.id}" needs sources or a note (L18)`);
  });

  const capitals = new Set<string>();
  document.territories.forEach((territory, index) => {
    const path = `territories[${index}]`;
    if (territory.capitalSubTerritoryId === undefined) {
      if (partitioned) issues.add(`${path}: "${territory.id}" needs a capitalSubTerritoryId (L16)`);
      return;
    }
    capitals.add(territory.capitalSubTerritoryId);
    const capital = subTerritories.get(territory.capitalSubTerritoryId);
    if (capital === undefined) issues.ref(`${path}.capitalSubTerritoryId`, territory.capitalSubTerritoryId, subTerritories, "sub-territory");
    else if (capital.territoryId !== territory.id) issues.add(`${path}.capitalSubTerritoryId: "${capital.id}" is not in "${territory.id}" (L16)`);
  });

  const cityHosts = new Map<string, string[]>();
  document.cities.forEach((city, index) => {
    const path = `cities[${index}]`;
    if (city.subTerritoryId === undefined) {
      if (partitioned) issues.add(`${path}: "${city.id}" needs a subTerritoryId (L16)`);
      return;
    }
    const host = subTerritories.get(city.subTerritoryId);
    if (host === undefined) issues.ref(`${path}.subTerritoryId`, city.subTerritoryId, subTerritories, "sub-territory");
    else if (host.territoryId !== city.territoryId) issues.add(`${path}.subTerritoryId: "${host.id}" is not in "${city.territoryId}" (L16)`);
    cityHosts.set(city.subTerritoryId, [...(cityHosts.get(city.subTerritoryId) ?? []), city.id]);
  });

  document.subTerritories.forEach((sub, index) => { checkSiteData(document, sub, `subTerritories[${index}]`, { capital: capitals.has(sub.id), city: cityHosts.has(sub.id) }, issues); });
  checkBorders(document, subTerritories, issues);
  checkLinks(document, issues);
}

/** L18: development, buildings and improvement levels fit the catalogues. */
function checkSiteData(
  document: ModularScenarioDocument,
  sub: SubTerritoryDocument,
  path: string,
  site: { readonly capital: boolean; readonly city: boolean },
  issues: Issues
): void {
  const tracks = new Map(document.development.map((track) => [track.id, track]));
  const buildings = new Map(document.buildings.map((building) => [building.id, building]));
  for (const [id, level] of Object.entries(sub.development)) {
    const track = tracks.get(id);
    if (track === undefined) issues.ref(`${path}.development`, id, tracks, "development track");
    else if (level > track.maxLevel) issues.add(`${path}.development.${id}: level ${String(level)} is above ${String(track.maxLevel)} (L18)`);
    else if (track.cityOnly && level > 0 && !site.city) issues.add(`${path}.development.${id}: "${id}" needs a city in "${sub.id}" (L18)`);
  }
  for (const id of sub.buildings) {
    const building = buildings.get(id);
    if (building === undefined) {
      issues.ref(`${path}.buildings`, id, buildings, "building");
      continue;
    }
    if (building.capitalOnly && !site.capital) issues.add(`${path}.buildings: "${id}" is built only in a capital (L18)`);
    if (building.cityOnly && !site.city) issues.add(`${path}.buildings: "${id}" needs a city (L18)`);
    if (building.upgradeOf !== undefined && !sub.buildings.includes(building.upgradeOf)) {
      issues.add(`${path}.buildings: "${id}" needs "${building.upgradeOf}" first (L18)`);
    }
  }
  if (new Set(sub.buildings).size !== sub.buildings.length) issues.add(`${path}.buildings: a building is listed twice (L18)`);
  checkBuildable(document, sub, path, site, issues);
  const improvements = document.improvements;
  if (improvements !== undefined && sub.port > improvements.port.maxLevel) issues.add(`${path}.port: above ${String(improvements.port.maxLevel)} (L18)`);
}

/** L19: borders join two known sub-territories once; connection entries lie on their own side. */
function checkBorders(document: ModularScenarioDocument, subTerritories: ReadonlyMap<string, SubTerritoryDocument>, issues: Issues): void {
  const seen = new Set<string>();
  document.subTerritoryBorders.forEach(([a, b], index) => {
    const path = `subTerritoryBorders[${index}]`;
    issues.ref(path, a, subTerritories, "sub-territory");
    issues.ref(path, b, subTerritories, "sub-territory");
    const key = [a, b].sort().join("|");
    if (a === b) issues.add(`${path}: a sub-territory cannot border itself (L19)`);
    else if (seen.has(key)) issues.add(`${path}: duplicate border ${a} - ${b} (L19)`);
    seen.add(key);
  });
  document.connections.forEach((connection, index) => {
    const path = `connections[${index}]`;
    if (connection.entry === undefined) {
      if (subTerritories.size > 0) issues.add(`${path}: needs entry sub-territories (L19)`);
      return;
    }
    connection.entry.forEach((id, side) => {
      const sub = subTerritories.get(id);
      if (sub === undefined) issues.ref(`${path}.entry`, id, subTerritories, "sub-territory");
      else if (sub.territoryId !== connection.between[side]) issues.add(`${path}.entry: "${id}" is not in "${connection.between[side] ?? ""}" (L19)`);
    });
  });
}
