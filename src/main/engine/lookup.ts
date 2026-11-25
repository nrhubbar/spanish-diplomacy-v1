import { generalUnitDefinition } from "./generals/identity";
import { linkBetween, passName } from "./network/links";
import { raisedDefinition } from "./recruitment/rules";
import type {
  AiProfile,
  BuildingDefinition,
  BuildingId,
  CityDefinition,
  DevelopmentDefinition,
  DevelopmentId,
  FactionDefinition,
  FactionId,
  GameState,
  GeneralDefinition,
  GeneralId,
  Neighbor,
  RaisedUnitDefinition,
  ResourceDefinition,
  ResourceId,
  Scenario,
  SubTerritoryDefinition,
  SubTerritoryId,
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

export function requireSubTerritory(scenario: Scenario, id: SubTerritoryId): SubTerritoryDefinition {
  return required(scenario.index.subTerritories.get(id), "sub-territory", id);
}

export function requireBuilding(scenario: Scenario, id: BuildingId): BuildingDefinition {
  return required(scenario.index.buildings.get(id), "building", id);
}

export function requireDevelopment(scenario: Scenario, id: DevelopmentId): DevelopmentDefinition {
  return required(scenario.index.development.get(id), "development", id);
}

export function requireResource(scenario: Scenario, id: ResourceId): ResourceDefinition {
  return required(scenario.resources.find((resource) => resource.id === id), "resource", id);
}

export function requireGeneral(scenario: Scenario, id: GeneralId): GeneralDefinition {
  return required(scenario.index.generals.get(id), "general", id);
}

/** R6: the name of the pass the link between two sub-territories crosses. */
export function requirePassName(scenario: Scenario, a: SubTerritoryId, b: SubTerritoryId): string {
  const link = linkBetween(scenario, a, b);
  return required(link === undefined ? undefined : passName(link), "pass", `${a}|${b}`);
}

/** What every unit in play has a definition for: scenario units and units raised in play (R6, D7). */
export type UnitIdentity = Pick<UnitDefinition, "designation" | "factionId" | "fullStrength" | "generalId" | "id" | "type"> & Pick<RaisedUnitDefinition, "serial">;

/** A scenario unit's definition, a recruited unit's (R6), or a replacement general's (D7), derived from its id. */
export function requireUnitDefinition(scenario: Scenario, id: UnitId): UnitIdentity {
  return required(scenario.index.units.get(id) ?? raisedDefinition(scenario, id) ?? generalUnitDefinition(scenario, id), "unit", id);
}

export function requireUnitType(scenario: Scenario, id: UnitTypeId): UnitTypeDefinition {
  return required(scenario.index.unitTypes.get(id), "unit type", id);
}

/** E7: the computer player's weights for a faction; the loader gives every faction one (L23). */
export function requireAiProfile(scenario: Scenario, id: FactionId): AiProfile {
  return required(scenario.ai.profiles[id], "AI profile", id);
}

export function requireUnitState(state: GameState, id: UnitId): UnitState {
  return required(state.units[id], "army", id);
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
