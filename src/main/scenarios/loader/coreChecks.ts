import type { ScenarioDocument } from "../schema/scenarioSchema";
import { idSet, type Issues } from "./issues";

/** Rules L2-L8, L12 and L23. */
export function checkCore(document: ScenarioDocument, issues: Issues): void {
  issues.unique("cities", document.cities);
  issues.unique("factions", document.factions);
  issues.unique("sources", document.sources);
  issues.unique("territories", document.territories);
  issues.unique("unitTypes", document.unitTypes);
  issues.unique("units", document.units);

  const factions = idSet(document.factions);
  const territories = idSet(document.territories);
  const cities = new Map(document.cities.map((city) => [city.id, city]));
  const unitTypes = idSet(document.unitTypes);
  const sources = idSet(document.sources);

  issues.cited("ai", document.ai, sources);
  for (const id of Object.keys(document.ai.profiles)) issues.ref("ai.profiles", id, factions, "faction");
  document.factions.forEach((faction, index) => {
    faction.objectiveTerritoryIds.forEach((id) => { issues.ref(`factions[${index}].objectiveTerritoryIds`, id, territories, "territory"); });
    if (document.ai.profiles[faction.id] === undefined) issues.add(`ai.profiles: missing a profile for "${faction.id}" (L23)`);
  });
  document.territories.forEach((territory, index) => {
    const control = territory.initialControl;
    if (control.kind === "controlled") {
      issues.ref(`territories[${index}].initialControl.factionId`, control.factionId, factions, "faction");
    } else {
      control.factionIds.forEach((id) => { issues.ref(`territories[${index}].initialControl.factionIds`, id, factions, "faction"); });
      if (new Set(control.factionIds).size !== control.factionIds.length) {
        issues.add(`territories[${index}].initialControl: contested factions must be distinct (L5)`);
      }
    }
  });
  document.cities.forEach((city, index) => {
    issues.ref(`cities[${index}].territoryId`, city.territoryId, territories, "territory");
    if (city.initialController !== undefined) issues.ref(`cities[${index}].initialController`, city.initialController, factions, "faction");
  });
  document.units.forEach((unit, index) => {
    const path = `units[${index}]`;
    issues.ref(`${path}.factionId`, unit.factionId, factions, "faction");
    issues.ref(`${path}.territoryId`, unit.territoryId, territories, "territory");
    issues.ref(`${path}.type`, unit.type, unitTypes, "unit type");
    if (unit.strength > unit.fullStrength) {
      issues.add(`${path}.strength: ${String(unit.strength)} men exceeds fullStrength ${String(unit.fullStrength)} (L12)`);
    }
    unit.sources.forEach((source) => { issues.ref(`${path}.sources`, source.sourceId, sources, "source"); });
    if (unit.cityId !== undefined) {
      const city = cities.get(unit.cityId);
      if (city === undefined) issues.add(`${path}.cityId: unknown city "${unit.cityId}" (L3)`);
      else if (city.territoryId !== unit.territoryId) issues.add(`${path}.cityId: city "${unit.cityId}" is not in territory "${unit.territoryId}" (L4)`);
    }
  });

  checkConnections(document, territories, issues);
  for (const faction of document.factions) {
    const hasUnit = document.units.some((unit) => unit.factionId === faction.id);
    const hasTerritory = document.territories.some(
      (territory) => territory.initialControl.kind === "controlled" && territory.initialControl.factionId === faction.id
    );
    if (!hasUnit && !hasTerritory) issues.add(`factions: "${faction.id}" starts with no units and no territory (L8)`);
  }
}

/** L6, L7: connections are undirected, unique per kind, never loops, and reach every territory not declared isolated. */
function checkConnections(document: ScenarioDocument, territories: ReadonlySet<string>, issues: Issues): void {
  const edges = new Set<string>();
  const degree = new Map<string, number>();
  document.connections.forEach((connection, index) => {
    const [a, b] = connection.between;
    issues.ref(`connections[${index}].between`, a, territories, "territory");
    issues.ref(`connections[${index}].between`, b, territories, "territory");
    if (a === b) issues.add(`connections[${index}]: a territory cannot connect to itself (L6)`);
    // R3: a pair may have one land and one sea connection (Málaga's sea lane beside a land border).
    const key = `${connection.kind}:${[a, b].sort().join("|")}`;
    if (edges.has(key)) issues.add(`connections[${index}]: duplicate ${connection.kind} connection ${a} - ${b} (L6)`);
    edges.add(key);
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  });
  document.territories.forEach((territory, index) => {
    const connected = (degree.get(territory.id) ?? 0) > 0;
    if (!connected && territory.isolated === undefined) {
      issues.add(`territories[${index}]: "${territory.id}" has no connections; add one or declare "isolated" (L7)`);
    }
    if (connected && territory.isolated !== undefined) {
      issues.add(`territories[${index}]: "${territory.id}" is declared isolated but has connections (L7)`);
    }
  });
}
