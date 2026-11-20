import type { CombatRole, D20Rules, GameState, GeneralDefinition, RaisedUnitDefinition, Scenario, TerritoryId, UnitDefinition, UnitId, UnitState, UnitTypeDefinition, WeatherId, WeatherState } from "../types";

/**
 * The `d20-graded` dice module's lookups (D1-D8). Rule logic for the d20 lives in this folder;
 * the numbers come from the scenario's `d20` block.
 */

/** The module's name in `rules.dice`. */
export const d20ModuleId = "d20-graded";

/** The d20's faces, 1 to 20, and the highest table score (D1). */
export const d20Faces: readonly number[] = Array.from({ length: 20 }, (_, index) => index + 1);
export const lastScore = 20;

/** Whether a scenario fights on the d20. */
export function usesD20(scenario: Scenario): boolean {
  return scenario.rules.dice === d20ModuleId && scenario.d20 !== undefined;
}

/** The scenario's d20 block; the loader requires it when `d20-graded` is selected (L15). */
export function requireD20(scenario: Scenario): D20Rules {
  if (scenario.d20 === undefined) throw new Error("Invariant violated: the d20 rules need the scenario's d20 block.");
  return scenario.d20;
}

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

export function rosterGeneral(scenario: Scenario, raised: GameState["raised"], id: UnitId): GeneralDefinition | undefined {
  const generalId = definitionOf(scenario, raised, id).generalId;
  return generalId === undefined ? undefined : scenario.generals.find((general) => general.id === generalId);
}

/**
 * M12 on the d20: type value x strength / full strength, x the demoralization factor when
 * demoralized, rounded once. A type with value 0 (trucks, generals; CT-13) counts 0; any other
 * unit counts at least 1.
 */
export function gradedValue(scenario: Scenario, raised: GameState["raised"], unit: UnitState, role: CombatRole): number {
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

/** Plain code-unit comparison, so ordering never depends on the locale (M26). */
export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
