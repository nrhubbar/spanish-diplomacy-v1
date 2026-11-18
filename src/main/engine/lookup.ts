import type {
  CityDefinition,
  FactionDefinition,
  FactionId,
  Neighbor,
  Scenario,
  TerritoryDefinition,
  TerritoryId,
  UnitDefinition,
  UnitId
} from "./types";

/**
 * Lookups for ids the loader has already verified. A miss means engine state and scenario
 * disagree, which is a programming error rather than a user error, so these throw.
 */
export function requireFaction(scenario: Scenario, id: FactionId): FactionDefinition {
  return required(scenario.index.factions.get(id), "faction", id);
}

export function requireTerritory(scenario: Scenario, id: TerritoryId): TerritoryDefinition {
  return required(scenario.index.territories.get(id), "territory", id);
}

export function requireUnitDefinition(scenario: Scenario, id: UnitId): UnitDefinition {
  return required(scenario.index.units.get(id), "unit", id);
}

export function neighborsOf(scenario: Scenario, id: TerritoryId): readonly Neighbor[] {
  return scenario.index.neighbors.get(id) ?? [];
}

export function isNeighbor(scenario: Scenario, from: TerritoryId, to: TerritoryId): boolean {
  return neighborsOf(scenario, from).some((neighbor) => neighbor.territoryId === to);
}

export function citiesIn(scenario: Scenario, id: TerritoryId): readonly CityDefinition[] {
  return scenario.index.citiesByTerritory.get(id) ?? [];
}

function required<Value>(value: Value | undefined, kind: string, id: string): Value {
  if (value === undefined) {
    throw new Error(`Invariant violated: unknown ${kind} "${id}".`);
  }
  return value;
}
