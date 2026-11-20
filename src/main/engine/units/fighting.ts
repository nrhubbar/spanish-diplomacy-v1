import { unitTypeIn } from "../air/pieces";
import type { GameState, Scenario, UnitId } from "../types";

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
  return type === undefined || (type.kind === "ground" && type.attack > 0);
}

/** D27.1: at least one of the units can fight. */
export function hasFighter(scenario: Scenario, raised: GameState["raised"], unitIds: Iterable<UnitId>): boolean {
  for (const unitId of unitIds) if (canFight(scenario, raised, unitId)) return true;
  return false;
}
