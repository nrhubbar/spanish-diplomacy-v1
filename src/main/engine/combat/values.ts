import { requireUnitDefinition, requireUnitType } from "../lookup";
import type { CombatRole, Scenario, UnitState } from "../types";

/**
 * Army values. Pure and roll-free; battle resolution (`engine/d20/`) counts sides of raised units
 * too. Rule ids refer to the spec (`project/specs/scenario-package.md`).
 */

/** Highest odds column (6:1). */
export const lastColumn = 6;

/**
 * M12 (C4, C5, C6): type value times strength over full strength, times the demoralization
 * factor when demoralized, rounded once to the nearest whole number (halves round up), and
 * never below 1.
 */
export function armyValue(scenario: Scenario, unit: UnitState, role: CombatRole): number {
  const definition = requireUnitDefinition(scenario, unit.id);
  const type = requireUnitType(scenario, definition.type);
  const base = role === "attack" ? type.attack : type.defence;
  const morale = unit.morale.demoralized ? scenario.combat.demoralizationFactor : 1;
  return Math.max(1, Math.round(((base * unit.strength) / definition.fullStrength) * morale));
}
