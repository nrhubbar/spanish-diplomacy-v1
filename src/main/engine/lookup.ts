import { generalUnitDefinition } from "./generals/identity";
import type {
  AiProfile,
  CityDefinition,
  FactionDefinition,
  FactionId,
  GameState,
  Neighbor,
  Scenario,
  TerritoryDefinition,
  TerritoryId,
  UnitDefinition,
  UnitId,
  UnitState,
  UnitTypeDefinition,
  UnitTypeId
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

/** What every unit in play has a definition for: scenario units and units raised in play (R6, D7). */
export type UnitIdentity = Pick<UnitDefinition, "designation" | "factionId" | "fullStrength" | "generalId" | "id" | "name" | "type">;

/** A scenario unit's definition, or a replacement general's, derived from his id (D7, m3r1-air-generals). */
export function requireUnitDefinition(scenario: Scenario, id: UnitId): UnitIdentity {
  return required(scenario.index.units.get(id) ?? generalUnitDefinition(scenario, id), "unit", id);
}

export function requireUnitType(scenario: Scenario, id: UnitTypeId): UnitTypeDefinition {
  return required(scenario.index.unitTypes.get(id), "unit type", id);
}

/** E7: the computer player's weights for a faction; the loader gives every faction one (L23). */
export function requireAiProfile(scenario: Scenario, id: FactionId): AiProfile {
  return required(scenario.ai.profiles[id], "AI profile for faction", id);
}

export function requireUnitState(state: GameState, id: UnitId): UnitState {
  return required(state.units[id], "army in play", id);
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
