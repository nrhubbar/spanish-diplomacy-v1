import { columnBands, type GradeBand } from "../engine/d20/odds";
import type { BattleOutcome, BattleResult, D20BattleOutcome, GradeDefinition, GradeSideEffect, Scenario } from "../engine/types";
import { glyphs } from "./glyphs";
import { outcomeText } from "./outcomeText";

/**
 * Words and keys for d20 battles (D1, D2, D8). Grades come from the scenario's catalogue, so
 * their names are data; the art and the legend reuse the seven d6 result keys, each grade drawn
 * with the result nearest to it (`gradeFamily`).
 */

export function isD20Battle(outcome: { readonly kind: string }): outcome is D20BattleOutcome {
  return outcome.kind === "battle" && "dice" in outcome && outcome.dice === "d20";
}

export function isBattle(outcome: { readonly kind: string }): outcome is BattleOutcome {
  return outcome.kind === "battle";
}

export function gradeOf(scenario: Scenario, battle: D20BattleOutcome): GradeDefinition | undefined {
  return scenario.d20?.grades.find((grade) => grade.id === battle.grade);
}

/**
 * The d6 result a grade is drawn as: whole-territory grades as the defender's results
 * (destroyed, a costly exchange, or driven off), partial ground as driven off, and the rest by
 * who suffered: the attacker alone, or both sides.
 */
export function gradeFamily(grade: GradeDefinition): BattleResult {
  const { attacker, defender, ground } = grade;
  if (ground === "all") {
    if (defender.lossPercent >= 100) return "defender-eliminated";
    return attacker.lossPercent >= defender.lossPercent ? "defender-exchange" : "defender-demoralized";
  }
  if (ground !== 0) return "defender-demoralized";
  if (attacker.lossPercent >= 100) return "attacker-eliminated";
  if (defender.lossPercent > 0 || defender.demoralized !== "none") return "both-demoralized";
  return attacker.demoralized === "none" ? "attacker-attrition" : "attacker-demoralized";
}

/** The result key a battle is drawn with: the d6 result, or its grade's family. */
export function resultKeyOf(scenario: Scenario, battle: BattleOutcome): BattleResult {
  if (battle.dice === "d6") return battle.result;
  const grade = gradeOf(scenario, battle);
  return grade === undefined ? "both-demoralized" : gradeFamily(grade);
}

/** A battle's result as players read it: the d6 result's title, or the grade's name. */
export function battleTitle(scenario: Scenario, battle: BattleOutcome): string {
  if (battle.dice === "d6") return outcomeText[battle.result].title;
  return gradeOf(scenario, battle)?.name ?? battle.grade;
}

/** P4: the ground a grade takes, in words. */
export function groundText(ground: GradeDefinition["ground"]): string {
  if (ground === "all") return "takes all";
  if (ground === 0) return "no ground";
  return `${String(ground)} sub-${ground === 1 ? "territory" : "territories"} change hands`;
}

function sideText(who: string, effect: GradeSideEffect): string | undefined {
  const parts = [
    ...(effect.lossPercent >= 100 ? ["destroyed"] : effect.lossPercent > 0 ? [`${glyphs.minus}${String(effect.lossPercent)}%`] : []),
    ...(effect.demoralized === "none" ? [] : [`${effect.demoralized} demoralized`])
  ];
  return parts.length === 0 ? undefined : `${who} ${parts.join(", ")}`;
}

/** D8: one band's effect, as on the battle card: "takes all, defender -20%, half demoralized". */
export function gradeEffect(grade: GradeDefinition): string {
  return [
    ...(grade.ground === 0 ? [] : [groundText(grade.ground)]),
    ...[sideText("attacker", grade.attacker), sideText("defender", grade.defender)].flatMap((text) => text ?? []),
    ...(grade.defender.weakestDestroyed ? ["weakest defender destroyed"] : [])
  ].join(` ${glyphs.dot} `) || "no effect";
}

/** D8: a battle's column as bands, each with its grade, for the card. */
export interface BandView {
  readonly band: GradeBand;
  readonly grade: GradeDefinition | undefined;
  readonly hit: boolean;
  readonly range: string;
}

export function battleBands(scenario: Scenario, battle: D20BattleOutcome): readonly BandView[] {
  const rules = scenario.d20;
  if (rules === undefined) return [];
  return columnBands(rules, battle.column).map((band) => ({
    band,
    grade: rules.grades.find((grade) => grade.id === band.gradeId),
    hit: battle.score >= band.from && battle.score <= band.to,
    range: band.from === band.to ? String(band.from) : `${String(band.from)}\u2013${String(band.to)}`
  }));
}

/** The score before the 0..20 clamp, so the card can say when the clamp applied. */
export function rawScore(battle: D20BattleOutcome): number {
  return battle.modifiers.reduce((sum, modifier) => sum + modifier.roll, battle.die);
}
