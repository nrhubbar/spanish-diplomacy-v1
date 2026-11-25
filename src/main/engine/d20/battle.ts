import { type AirOverBattle, airOverHookedBattle } from "../air/groundSupport";
import type { Armies, Combatant } from "../board";
import { dieFaces, pick } from "../dice";
import type { TurnScratch } from "../phases/draft";
import type { RandomSource } from "../random";
import type { ArmyLoss, BattleOutcome, BattleSide, BattleSite, CombatRole, FactionId, GameState, GradeDefinition, Retreat, Scenario, UnitId, WeatherState } from "../types";
import { applyGradeSide, type Casualties } from "./grades";
import { type ModifierContext, battleModifiers, fightingSide } from "./modifiers";
import { type BattleOdds, gradeAt, battleOdds, scoreFor } from "./odds";

/** What a battle reads besides its sides: the start of the turn and the turn's weather. */
export interface BattleInput {
  /** The turn's scratch, for the combat hooks (bomber support, m3r1-air-generals). */
  readonly scratch?: TurnScratch;
  readonly start: GameState;
  readonly weather: WeatherState | undefined;
}

/** Who fights one battle, with which values, where. */
export interface Engagement {
  readonly attackerFactionId: FactionId;
  readonly attackers: readonly Combatant[];
  readonly context: ModifierContext;
  /** Defence values, except the standing entrant of an entry battle, which uses its attack (M19). */
  readonly defenderRole: CombatRole;
  readonly defenders: readonly Combatant[];
}

/** A battle once its die is rolled: the sides, the odds, the score, the grade, and each side's casualties. */
export interface FoughtBattle {
  /** R11: the air over it, as its roll counted it; absent on the road (D27.5) and with no aircraft over it. */
  readonly air?: AirOverBattle;
  readonly attacker: BattleSide;
  readonly attackerCasualties: Casualties;
  readonly defender: BattleSide;
  readonly defenderCasualties: Casualties;
  readonly die: number;
  readonly engagement: Engagement;
  readonly grade: GradeDefinition;
  /** P4, P5: the ground the battle actually took, once its site is settled. Starts as the grade's. */
  readonly ground: BattleOutcome["ground"];
  readonly index: number;
  readonly odds: BattleOdds;
  readonly score: number;
}

/** What a battle's outcome reports beyond the roll: each effect once, in the battle that caused it. */
export interface BattleReport {
  readonly demoralizedUnitIds: readonly UnitId[];
  readonly losses: readonly ArmyLoss[];
  readonly retreats: readonly Retreat[];
  readonly surrenderedUnitIds: readonly UnitId[];
}

/** A battle fought in a territory, whose retreats and surrenders are settled after every battle of its step (M21). */
export interface PendingBattle {
  readonly battle: FoughtBattle;
  readonly report: BattleReport;
  readonly site: Exclude<BattleSite, { readonly kind: "meeting" }>;
}

/** D1: a face of the d20. */
export function rollD20(random: RandomSource): number {
  return pick(random, dieFaces);
}

/**
 * D1-D7: fights one battle with the die rolled from its own stream (M26), and works out what
 * its grade does to each side from the armies' current states (`armies`). Applying the
 * casualties, and who moves where, is the caller's.
 */
export function fight(scenario: Scenario, input: BattleInput, armies: Armies, engagement: Engagement, index: number, die: number): FoughtBattle {
  const rules = scenario.d20;
  const { start } = input;
  const attacker = fightingSide(scenario, start, engagement.attackers, "attack");
  const defender = fightingSide(scenario, start, engagement.defenders, engagement.defenderRole);
  const context = { ...engagement.context, battleIndex: index, ...(input.scratch === undefined ? {} : { scratch: input.scratch }) };
  const modifiers = battleModifiers(scenario, start, input.weather, context,
    { role: "attack", side: attacker, units: engagement.attackers.map((combatant) => combatant.unit) },
    { role: "defence", side: defender, units: engagement.defenders.map((combatant) => combatant.unit) });
  const odds = battleOdds(rules, attacker.value, defender.value, modifiers);
  const score = scoreFor(die, odds.rollModifier);
  const grade = gradeAt(rules, odds.column, score);
  const air = airOver(scenario, input, engagement, index);
  return {
    ...(air === undefined ? {} : { air }),
    attacker,
    attackerCasualties: applyGradeSide(scenario, start, grade.attacker, attacker, armies, rules.breakUpShare),
    defender,
    defenderCasualties: applyGradeSide(scenario, start, grade.defender, defender, armies, rules.breakUpShare),
    die,
    engagement,
    grade,
    ground: grade.ground,
    index,
    odds,
    score
  };
}

/** R11: the air over a battle, with the same input and die the combat hook gave its roll. */
function airOver(scenario: Scenario, { scratch, start }: BattleInput, { context, defenders }: Engagement, index: number): AirOverBattle | undefined {
  const { territoryId } = context;
  if (scratch?.air === undefined || territoryId === undefined) return undefined;
  const defenderUnitIds = defenders.map((combatant) => combatant.unit.id);
  return airOverHookedBattle({ ...context, battleIndex: index, defenderUnitIds, scenario, state: start, territoryId }, scratch.air);
}

/** C14, D8: the full record of one battle. */
export function battleOutcome(battle: FoughtBattle, site: BattleSite, report: BattleReport): BattleOutcome {
  return {
    attacker: battle.attacker,
    attackerFactionId: battle.engagement.attackerFactionId,
    column: battle.odds.column,
    defender: battle.defender,
    demoralizedUnitIds: report.demoralizedUnitIds,
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
