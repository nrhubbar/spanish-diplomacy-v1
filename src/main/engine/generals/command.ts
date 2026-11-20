import { generalOf, generalsSetAside, unitKindIn, unitTypeIn } from "../air/pieces";
import type { AirScratch } from "../air/scratch";
import { compareIds } from "../board";
import type { CombatHookContext } from "../hooks";
import type { CombatModifier, CombatRole, FactionId, GameState, GeneralDefinition, Scenario, TerritoryId, UnitId } from "../types";

export interface Commander {
  /** D4: the general's command bonus on the d20, from his type's `command-bonus` effect. */
  readonly bonus: number;
  readonly general: GeneralDefinition;
  readonly unitId: UnitId;
}

function commandBonus(scenario: Scenario, raised: GameState["raised"], unitId: UnitId): number {
  return (unitTypeIn(scenario, raised, unitId)?.effects ?? []).reduce((best, effect) => (effect.kind === "command-bonus" ? Math.max(best, effect.roll) : best), 0);
}

function rosterIndex(scenario: Scenario, general: GeneralDefinition): number {
  return scenario.generals.findIndex((candidate) => candidate.id === general.id);
}

/**
 * U6, D5: of several generals, only the best counts: the highest command bonus, then the senior
 * (earlier in the roster), then unit id.
 */
export function bestGeneral(scenario: Scenario, raised: GameState["raised"], unitIds: readonly UnitId[]): Commander | undefined {
  const commanders = unitIds.flatMap((unitId): Commander[] => {
    const general = generalOf(scenario, raised, unitId);
    return general === undefined ? [] : [{ bonus: commandBonus(scenario, raised, unitId), general, unitId }];
  });
  commanders.sort((a, b) => b.bonus - a.bonus || rosterIndex(scenario, a.general) - rosterIndex(scenario, b.general) || compareIds(a.unitId, b.unitId));
  return commanders[0];
}

/** C5, U5: a general rallies when his type rallies and his trait does not forbid it. */
export function canRally(scenario: Scenario, raised: GameState["raised"], unitId: UnitId): boolean {
  const rallies = (unitTypeIn(scenario, raised, unitId)?.effects ?? []).some((effect) => effect.kind === "rally");
  const general = generalOf(scenario, raised, unitId);
  const trait = general === undefined ? undefined : scenario.generalTraits.find((candidate) => candidate.id === general.traitId);
  return rallies && !(trait?.effects.some((effect) => effect.kind === "no-rally") ?? false);
}

/**
 * Where each general of a faction stands for a battle in `territoryId`. During resolution the air
 * scratch knows this turn's moves; for a planning estimate, a general is where he stands, or among
 * the attacking units.
 */
function generalsAt(context: CombatHookContext, factionIds: readonly FactionId[], territoryId: TerritoryId, attacking: boolean): readonly UnitId[] {
  const { scenario, state } = context;
  const scratch: AirScratch | undefined = context.scratch?.air;
  if (scratch !== undefined) {
    return Object.values(scratch.aside)
      .filter((unit) => factionIds.includes(unit.factionId) && unitKindIn(scenario, state.raised, unit.id) === "general")
      .filter((unit) => (scratch.generalMoves[unit.id] ?? unit.territoryId) === territoryId)
      .map((unit) => unit.id);
  }
  const standing = Object.values(state.units)
    .filter((unit) => factionIds.includes(unit.factionId) && unit.territoryId === territoryId && unitKindIn(scenario, state.raised, unit.id) === "general")
    .map((unit) => unit.id);
  const moving = attacking ? (context.attackerUnitIds ?? []).filter((id) => unitKindIn(scenario, state.raised, id) === "general") : [];
  return [...new Set([...standing, ...moving])];
}

/** One side's general and trait modifiers, signed from the attacker's view. */
function sideModifiers(scenario: Scenario, commander: Commander | undefined, factionId: FactionId | undefined, role: CombatRole): readonly CombatModifier[] {
  if (commander === undefined || factionId === undefined) return [];
  const sign = role === "attack" ? 1 : -1;
  const modifiers: CombatModifier[] = [];
  if (commander.bonus !== 0) modifiers.push({ factionId, generalId: commander.general.id, kind: "general", role, roll: sign * commander.bonus });
  const trait = scenario.generalTraits.find((candidate) => candidate.id === commander.general.traitId);
  for (const effect of trait?.effects ?? []) {
    if (effect.kind === "roll-modifier" && effect.role === role && effect.roll !== 0) {
      modifiers.push({ generalId: commander.general.id, kind: "trait", role, roll: sign * effect.roll, traitId: trait?.id ?? commander.general.traitId });
    }
  }
  return modifiers;
}

/**
 * D4, U5, U6 (D5): each side's best general gives his command bonus, and his trait when it
 * matches the side's role. The attacker's side is its faction; the defender's is every
 * defending faction together.
 */
export function generalModifiers(context: CombatHookContext): readonly CombatModifier[] {
  const { scenario, state } = context;
  // DC-16: the d20 module emits the general and his trait itself.
  if (!generalsSetAside(scenario)) return [];
  const attacker = bestGeneral(scenario, state.raised, generalsAt(context, [context.attackerFactionId], context.territoryId, true));
  const defender = bestGeneral(scenario, state.raised, generalsAt(context, context.defenderFactionIds, context.territoryId, false));
  const defenderFaction = defender === undefined ? undefined : generalFaction(state, context, defender.unitId);
  return [
    ...sideModifiers(scenario, attacker, context.attackerFactionId, "attack"),
    ...sideModifiers(scenario, defender, defenderFaction, "defence")
  ];
}

function generalFaction(state: GameState, context: CombatHookContext, unitId: UnitId): FactionId | undefined {
  return state.units[unitId]?.factionId ?? context.scratch?.air?.aside[unitId]?.factionId;
}
