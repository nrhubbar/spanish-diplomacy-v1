import { isGroundUnit } from "../air/pieces";
import { requireUnitState } from "../lookup";
import type { BattleSide, FactionId, GameState, Scenario, TerritoryId, UnitId } from "../types";
import { estimateGradedBattle, type GradedEstimate, gradedOddsForValues } from "../d20/estimate";
import type { GradedOdds } from "../d20/odds";
import { usesD20 } from "../d20/rules";
import { type BattleContext, type BattleOdds, battleOdds, situationalModifiers } from "./odds";
import { battleSide } from "./values";

/** What a move into a territory would meet, judged from the start-of-turn state. */
export type AttackEstimate =
  /** M11 (C10): the destination is the mover's own; it arrives and joins the defence. */
  | { readonly kind: "reinforcement" }
  /** No army of another faction is there; the move is unopposed unless another faction also enters. */
  | { readonly kind: "unopposed" }
  | (BattleOdds & { readonly attacker: BattleSide; readonly defender: BattleSide; readonly kind: "battle" })
  /** D1-D8: the same on the d20, with grade chances in place of d6 results. */
  | GradedEstimate;

/**
 * C15: the odds and the chance to take a territory if `unitIds` of `factionId` attack it,
 * assuming every army there stays and no other faction joins in. Uses each army's current
 * strength and morale, the territory's works, and the scenario's faction modifiers. It does
 * not judge whether the order is legal (a demoralized army cannot attack, M23); validation does.
 */
export function estimateAttack(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  unitIds: readonly UnitId[],
  targetTerritoryId: TerritoryId
): AttackEstimate {
  const ordered = unitIds.map((id) => requireUnitState(state, id));
  if (ordered.length === 0 || ordered.some((unit) => unit.factionId !== factionId)) {
    throw new Error(`Invariant violated: an attack needs one or more armies of "${factionId}".`);
  }
  // AG-3: only ground units fight; a general with the attack still counts through the hooks.
  const ground = ordered.filter((unit) => isGroundUnit(scenario, state.raised, unit.id));
  const attackers = ground.length === 0 ? ordered : ground;
  const present = Object.values(state.units).filter((unit) => unit.territoryId === targetTerritoryId && isGroundUnit(scenario, state.raised, unit.id));
  const control = state.control[targetTerritoryId];
  const own = control?.kind === "controlled" && control.factionId === factionId;
  if (own || present.some((unit) => unit.factionId === factionId)) {
    return { kind: "reinforcement" };
  }
  if (present.length === 0) {
    return { kind: "unopposed" };
  }
  if (usesD20(scenario)) return estimateGradedBattle(scenario, state, factionId, unitIds, targetTerritoryId);
  const attacker = battleSide(scenario, attackers, "attack");
  const defender = battleSide(scenario, present, "defence");
  const situational = situationalModifiers(scenario, state, {
    attackerFactionId: factionId,
    attackerUnitIds: unitIds,
    defenderFactionIds: [...new Set(present.map((unit) => unit.factionId))],
    diggingIn: true,
    territoryId: targetTerritoryId
  });
  return {
    ...battleOdds(scenario.combat, attacker.value, defender.value, situational),
    attacker,
    defender,
    kind: "battle"
  };
}

/**
 * C15: the odds for bare side values under the scenario's dice, d6 or d20, with the situational
 * modifiers of `context`. The computer player's threat checks use it.
 */
export function oddsForValues(scenario: Scenario, state: GameState, context: BattleContext, attack: number, defence: number): BattleOdds | GradedOdds {
  if (usesD20(scenario)) return gradedOddsForValues(scenario, state, context, attack, defence);
  return battleOdds(scenario.combat, attack, defence, situationalModifiers(scenario, state, context));
}
