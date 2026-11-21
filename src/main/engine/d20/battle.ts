import type { BattleReport } from "../battle";
import type { Casualties } from "../battleResults";
import type { Armies, Combatant } from "../board";
import { pick } from "../dice";
import type { TurnScratch } from "../phases/draft";
import type { RandomSource } from "../random";
import type { BattleSide, BattleSite, CombatRole, D20BattleOutcome, FactionId, GameState, GradeDefinition, Scenario, WeatherState } from "../types";
import { applyGradeSide } from "./grades";
import { type GradedContext, gradedModifiers, gradedSide } from "./modifiers";
import { type GradedOdds, gradeAt, gradedOdds, scoreFor } from "./odds";
import { d20Faces, requireD20 } from "./rules";

/** What a d20 battle reads besides its sides: the start of the turn and the turn's weather. */
export interface GradedInput {
  /** The turn's scratch, for the combat hooks (bomber support, m3r1-air-generals). */
  readonly scratch?: TurnScratch;
  readonly start: GameState;
  readonly weather: WeatherState | undefined;
}

/** Who fights one d20 battle, with which values, where. */
export interface GradedEngagement {
  readonly attackerFactionId: FactionId;
  readonly attackers: readonly Combatant[];
  readonly context: GradedContext;
  /** Defence values, except the standing entrant of an entry battle, which uses its attack (M19). */
  readonly defenderRole: CombatRole;
  readonly defenders: readonly Combatant[];
}

/** A d20 battle once its die is rolled: the sides, the odds, the score, the grade, and each side's casualties. */
export interface GradedBattle {
  readonly attacker: BattleSide;
  readonly attackerCasualties: Casualties;
  readonly defender: BattleSide;
  readonly defenderCasualties: Casualties;
  readonly die: number;
  readonly dice: "d20";
  readonly engagement: GradedEngagement;
  readonly grade: GradeDefinition;
  /** P4, P5: the ground the battle actually took, once its site is settled. Starts as the grade's. */
  readonly ground: D20BattleOutcome["ground"];
  readonly index: number;
  readonly odds: GradedOdds;
  readonly score: number;
}

/** D1: a face of the d20. */
export function rollD20(random: RandomSource): number {
  return pick(random, d20Faces.length);
}

/**
 * D1-D7: fights one d20 battle with the die rolled from its own stream (M26), and works out what
 * its grade does to each side from the armies' current states (`armies`). Applying the
 * casualties, and who moves where, is the caller's.
 */
export function fightGraded(scenario: Scenario, input: GradedInput, armies: Armies, engagement: GradedEngagement, index: number, die: number): GradedBattle {
  const rules = requireD20(scenario);
  const { start } = input;
  const attacker = gradedSide(scenario, start, engagement.attackers, "attack");
  const defender = gradedSide(scenario, start, engagement.defenders, engagement.defenderRole);
  const context = { ...engagement.context, battleIndex: index, ...(input.scratch === undefined ? {} : { scratch: input.scratch }) };
  const modifiers = gradedModifiers(scenario, start, input.weather, context,
    { role: "attack", side: attacker, units: engagement.attackers.map((combatant) => combatant.unit) },
    { role: "defence", side: defender, units: engagement.defenders.map((combatant) => combatant.unit) });
  const odds = gradedOdds(rules, attacker.value, defender.value, modifiers);
  const score = scoreFor(die, odds.rollModifier);
  const grade = gradeAt(rules, odds.column, score);
  return {
    attacker,
    attackerCasualties: applyGradeSide(scenario, start, grade.attacker, attacker, armies, rules.breakUpShare),
    defender,
    defenderCasualties: applyGradeSide(scenario, start, grade.defender, defender, armies, rules.breakUpShare),
    die,
    dice: "d20",
    engagement,
    grade,
    ground: grade.ground,
    index,
    odds,
    score
  };
}

/** C14, D8: the full record of one d20 battle. */
export function gradedOutcome(battle: GradedBattle, site: BattleSite, report: BattleReport): D20BattleOutcome {
  return {
    attacker: battle.attacker,
    attackerFactionId: battle.engagement.attackerFactionId,
    column: battle.odds.column,
    defender: battle.defender,
    demoralizedUnitIds: report.demoralizedUnitIds,
    dice: "d20",
    die: battle.die,
    grade: battle.grade.id,
    ground: battle.ground,
    kind: "battle",
    losses: report.losses,
    modifiers: battle.odds.modifiers,
    oddsLabel: battle.odds.oddsLabel,
    retreats: report.retreats,
    score: battle.score,
    site,
    surrenderedUnitIds: report.surrenderedUnitIds
  };
}

export function isGradedBattle(battle: { readonly index: number }): battle is GradedBattle {
  return "dice" in battle && battle.dice === "d20";
}
