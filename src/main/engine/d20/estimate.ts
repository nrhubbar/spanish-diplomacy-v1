import type { BattleContext } from "../combat/odds";
import { requireUnitState } from "../lookup";
import type { BattleSide, FactionId, GameState, Scenario, TerritoryId, UnitId } from "../types";
import { cannotAttackAlone } from "./front";
import { gradedModifiers, gradedSide } from "./modifiers";
import { type GradedOdds, gradedOdds } from "./odds";
import { requireD20 } from "./rules";

/** C15 on the d20: what an attack into a defended territory would meet. */
export type GradedEstimate = GradedOdds & {
  readonly attacker: BattleSide;
  /** D5: the attackers are only artillery, so they would turn back without a battle. */
  readonly cannotAttack: boolean;
  readonly defender: BattleSide;
  readonly kind: "battle";
};

/**
 * C15 on the d20: the odds and grade chances if `unitIds` attack `target`, assuming the
 * defenders there stay and nobody else joins. Every modifier the battle would take is counted
 * from the start-of-turn state: works, faction modifiers, barricades, generals, unit bonuses,
 * fatigue and the hooks (weather, amphibious, air support).
 */
export function estimateGradedBattle(scenario: Scenario, state: GameState, factionId: FactionId, unitIds: readonly UnitId[], target: TerritoryId): GradedEstimate {
  const attackers = unitIds.map((id) => requireUnitState(state, id));
  const present = Object.values(state.units).filter((unit) => unit.territoryId === target && unit.factionId !== factionId);
  const attacker = gradedSide(scenario, state, attackers.map((unit) => ({ from: unit.territoryId, unit })), "attack");
  const defender = gradedSide(scenario, state, present.map((unit) => ({ from: target, unit })), "defence");
  const modifiers = gradedModifiers(scenario, state, state.weather, {
    attackerFactionId: factionId,
    defenderFactionIds: [...new Set(present.map((unit) => unit.factionId))],
    diggingIn: true,
    territoryId: target
  }, { role: "attack", side: attacker, units: attackers }, { role: "defence", side: defender, units: present });
  return {
    ...gradedOdds(requireD20(scenario), attacker.value, defender.value, modifiers),
    attacker,
    cannotAttack: cannotAttackAlone(scenario, state, attackers),
    defender,
    kind: "battle"
  };
}

/**
 * The d20 odds for bare side values, for the computer player's quick threat checks: only the
 * situational modifiers (works, faction modifiers, barricades, hooks) count, since no units are named.
 */
export function gradedOddsForValues(scenario: Scenario, state: GameState, context: BattleContext, attack: number, defence: number): GradedOdds {
  const empty = { armies: [], value: 0 };
  const modifiers = gradedModifiers(scenario, state, state.weather, context, { role: "attack", side: empty, units: [] }, { role: "defence", side: empty, units: [] });
  return gradedOdds(requireD20(scenario), attack, defence, modifiers);
}
