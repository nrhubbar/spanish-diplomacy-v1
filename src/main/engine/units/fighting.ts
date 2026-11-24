import { unitTypeIn } from "../air/pieces";
import type { GameState, Scenario, UnitId, UnitTypeDefinition } from "../types";

/** D27.1: whether units of the type can fight, which `canFight` asks of one unit. */
export function typeCanFight(type: Pick<UnitTypeDefinition, "attack" | "kind">): boolean {
  return type.kind === "ground" && type.attack > 0;
}

/** M1: the units one unit of the type carries (`transport` effects); 0 for every other type. */
export function carriesOf(type: Pick<UnitTypeDefinition, "effects"> | undefined): number {
  return (type?.effects ?? []).reduce((sum, effect) => sum + (effect.kind === "transport" ? effect.carries : 0), 0);
}

/**
 * M1: a truck, read from the data: a type that carries units and cannot fight, so it goes with an
 * army instead of marching for itself. A tank carries too, but it fights, so it is not one.
 */
export function isTruckType(type: UnitTypeDefinition): boolean {
  return carriesOf(type) > 0 && !typeCanFight(type);
}

/**
 * D27.1 (beside D17 and D5): only units that can fight take ground or attack. A unit can fight
 * when it is a ground unit whose type has an attack value above 0. Generals, aircraft, trucks and
 * anti-air cannot: a force made only of them cannot occupy or sweep a territory, and cannot
 * attack on its own. Artillery can fight (it has attack), though D5 still forbids it to attack
 * alone (`cannot-attack-alone`, read by the dice module). An unknown unit counts as able, as the
 * Milestone 2 rules treat every unit. This is the one predicate every area shares.
 */
export function canFight(scenario: Scenario, raised: GameState["raised"], unitId: UnitId): boolean {
  const type = unitTypeIn(scenario, raised, unitId);
  return type === undefined || typeCanFight(type);
}

/** D27.1: at least one of the units can fight. */
export function hasFighter(scenario: Scenario, raised: GameState["raised"], unitIds: Iterable<UnitId>): boolean {
  for (const unitId of unitIds) if (canFight(scenario, raised, unitId)) return true;
  return false;
}
