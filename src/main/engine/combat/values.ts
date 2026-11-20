import { requireUnitDefinition, requireUnitType } from "../lookup";
import type { BattleResult, BattleSide, CombatRole, Scenario, UnitState } from "../types";

/**
 * Battle arithmetic for the m2-strength ruleset: army values, odds, modifiers, and the
 * outcome distribution read from the scenario's `combat` block. Pure and roll-free; battle
 * resolution (dice, results, retreats) builds on these. Rule ids refer to the spec
 * (`project/specs/scenario-package.md`).
 */

/** The faces of the battle die. */
export const dieFaces = [1, 2, 3, 4, 5, 6] as const;

/** Highest odds column (6:1) and highest table row (modified roll 6). */
export const lastColumn = 6;
export const lastRow = 6;

/** M16: results in which the attacker succeeds and claims the territory. */
export const successfulResults = [
  "defender-demoralized",
  "defender-exchange",
  "defender-eliminated"
] as const satisfies readonly BattleResult[];

export function isSuccessful(result: BattleResult): boolean {
  return successfulResults.some((candidate) => candidate === result);
}

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

/**
 * M12: one side of a battle. Each army fights from its `territoryId` in the given state, so
 * pass start-of-turn states for armies that moved. The side's value is the sum of its armies'
 * rounded values.
 */
export function battleSide(scenario: Scenario, units: readonly UnitState[], role: CombatRole): BattleSide {
  const armies = units.map((unit) => ({
    factionId: unit.factionId,
    from: unit.territoryId,
    unitId: unit.id,
    value: armyValue(scenario, unit, role)
  }));
  return { armies, value: armies.reduce((sum, army) => sum + army.value, 0) };
}


export function requireSideValue(value: number, side: CombatRole): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invariant violated: the ${side} value must be a positive whole number, not ${String(value)}.`);
  }
}
