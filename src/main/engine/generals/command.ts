import { generalOf, unitTypeIn } from "../air/pieces";
import { compareIds } from "../board";
import type { CombatModifier, CombatRole, FactionId, GameState, GeneralDefinition, Scenario, UnitId } from "../types";

export interface Commander {
  /** D4: the general's command bonus on the d20, from his type's `command-bonus` effects. */
  readonly bonus: number;
  readonly general: GeneralDefinition;
  /** D5: his trait's `roll-modifier` for the role he was ranked for. */
  readonly traitRoll: number;
  readonly unitId: UnitId;
}

/** D4: what a general's type adds to the d20 of the army he is in. */
export function commandBonus(scenario: Scenario, raised: GameState["raised"], unitId: UnitId): number {
  return (unitTypeIn(scenario, raised, unitId)?.effects ?? []).reduce((sum, effect) => sum + (effect.kind === "command-bonus" ? effect.roll : 0), 0);
}

/** D5: what a general's trait adds to the d20 when his army takes `role`. */
export function traitRollFor(scenario: Scenario, general: Pick<GeneralDefinition, "traitId">, role: CombatRole): number {
  const trait = scenario.generalTraits.find((candidate) => candidate.id === general.traitId);
  return (trait?.effects ?? []).reduce((sum, effect) => sum + (effect.kind === "roll-modifier" && effect.role === role ? effect.roll : 0), 0);
}

function rosterIndex(scenario: Scenario, general: GeneralDefinition): number {
  return scenario.generals.findIndex((candidate) => candidate.id === general.id);
}

/**
 * U6, D5 (M5): of several generals, only the best counts, for the roll and the rally alike: the
 * greatest command bonus plus his trait's roll for the role, then the senior (earlier in the
 * roster), then unit id. A battle ranks a side for its role; the rally
 * ranks an army for the role it fought in this turn (`rallyRole`).
 */
export function bestGeneral(scenario: Scenario, raised: GameState["raised"], unitIds: readonly UnitId[], role: CombatRole): Commander | undefined {
  const commanders = unitIds.flatMap((unitId): Commander[] => {
    const general = generalOf(scenario, raised, unitId);
    return general === undefined ? [] : [{ bonus: commandBonus(scenario, raised, unitId), general, traitRoll: traitRollFor(scenario, general, role), unitId }];
  });
  commanders.sort((a, b) => (b.bonus + b.traitRoll) - (a.bonus + a.traitRoll) || rosterIndex(scenario, a.general) - rosterIndex(scenario, b.general) || compareIds(a.unitId, b.unitId));
  return commanders[0];
}

/** C5, U5: a general rallies when his type rallies and his trait does not forbid it. */
export function canRally(scenario: Scenario, raised: GameState["raised"], unitId: UnitId): boolean {
  const rallies = (unitTypeIn(scenario, raised, unitId)?.effects ?? []).some((effect) => effect.kind === "rally");
  const general = generalOf(scenario, raised, unitId);
  const trait = general === undefined ? undefined : scenario.generalTraits.find((candidate) => candidate.id === general.traitId);
  return rallies && !(trait?.effects.some((effect) => effect.kind === "no-rally") ?? false);
}

/** One side's general and trait modifiers, signed from the attacker's view. */
export function commanderModifiers(commander: Commander | undefined, factionId: FactionId | undefined, role: CombatRole): readonly CombatModifier[] {
  if (commander === undefined || factionId === undefined) return [];
  const sign = role === "attack" ? 1 : -1;
  const modifiers: CombatModifier[] = [];
  if (commander.bonus !== 0) modifiers.push({ factionId, generalId: commander.general.id, kind: "general", role, roll: sign * commander.bonus });
  if (commander.traitRoll !== 0) {
    modifiers.push({ generalId: commander.general.id, kind: "trait", role, roll: sign * commander.traitRoll, traitId: commander.general.traitId });
  }
  return modifiers;
}
