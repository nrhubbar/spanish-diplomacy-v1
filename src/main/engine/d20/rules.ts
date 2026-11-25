import { dieFaces } from "../dice";
import type { CombatRole, GameState, RaisedUnitDefinition, Scenario, TerritoryId, UnitDefinition, UnitId, UnitState, UnitTypeDefinition, WeatherId, WeatherState } from "../types";

/**
 * The battle rules' lookups (D1-D8). Rule logic for the d20 lives in this folder;
 * the numbers come from the scenario's `d20` block.
 */

/** The die's faces, 1 up, and the highest table score (D1). */
export const d20Faces: readonly number[] = Array.from({ length: dieFaces }, (_, index) => index + 1);
export const lastScore = dieFaces;

/** A unit's definition, from the scenario or, for a unit raised in play (R6), from the state. */
export function definitionOf(scenario: Scenario, raised: GameState["raised"], id: UnitId): UnitDefinition | RaisedUnitDefinition {
  const definition = scenario.index.units.get(id) ?? raised[id];
  if (definition === undefined) throw new Error(`Invariant violated: unknown unit "${id}".`);
  return definition;
}

export function typeOf(scenario: Scenario, raised: GameState["raised"], id: UnitId): UnitTypeDefinition {
  const type = scenario.index.unitTypes.get(definitionOf(scenario, raised, id).type);
  if (type === undefined) throw new Error(`Invariant violated: unit "${id}" has an unknown type.`);
  return type;
}

/** U5: a general unit stands for a roster general and does not fight for men (D5 rule notes). */
export function isGeneralUnit(scenario: Scenario, raised: GameState["raised"], id: UnitId): boolean {
  return typeOf(scenario, raised, id).kind === "general";
}

/**
 * M12 on the d20: type value x strength / full strength, x the demoralization factor when
 * demoralized, rounded once. A type with value 0 (trucks, generals; CT-13) counts 0; any other
 * unit counts at least 1.
 */
export function fightingValue(scenario: Scenario, raised: GameState["raised"], unit: UnitState, role: CombatRole): number {
  const definition = definitionOf(scenario, raised, unit.id);
  const type = typeOf(scenario, raised, unit.id);
  const base = role === "attack" ? type.attack : type.defence;
  if (base <= 0) return 0;
  const morale = unit.morale.demoralized ? scenario.combat.demoralizationFactor : 1;
  return Math.max(1, Math.round(((base * unit.strength) / definition.fullStrength) * morale));
}

/** D7: the weather in a territory's zone this turn, if the scenario has weather. */
export function weatherIn(scenario: Scenario, weather: WeatherState | undefined, territoryId: TerritoryId | undefined): WeatherId | undefined {
  if (weather === undefined || territoryId === undefined) return undefined;
  const zone = scenario.index.territories.get(territoryId)?.weatherZoneId;
  return zone === undefined ? undefined : weather.outcomes[zone];
}

/** Scenario order for units, tolerant of raised units, which come after, by id. */
export function unitRank(scenario: Scenario): (id: UnitId) => number {
  const order = new Map(scenario.units.map((unit, index) => [unit.id, index]));
  return (id) => order.get(id) ?? scenario.units.length;
}
