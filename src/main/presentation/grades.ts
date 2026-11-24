import { columnBands, type GradeBand } from "../engine/d20/odds";
import type { BattleOutcome, BattleResult, GradeDefinition, GradeSideEffect, Scenario } from "../engine/types";
import { glyphs } from "./glyphs";

/**
 * Words and keys for battles (D1, D2, D8). Grades come from the scenario's catalogue, so
 * their names are data; the art and the legend use seven result families, each grade drawn
 * as the family nearest to it (`gradeFamily`).
 */

export function isBattle(outcome: { readonly kind: string }): outcome is BattleOutcome {
  return outcome.kind === "battle";
}

export function gradeOf(scenario: Scenario, battle: BattleOutcome): GradeDefinition | undefined {
  return scenario.d20.grades.find((grade) => grade.id === battle.grade);
}

/**
 * The result family a grade is drawn as: whole-territory grades as the defender's results
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

/** The result key a battle is drawn with: its grade's family. */
export function resultKeyOf(scenario: Scenario, battle: BattleOutcome): BattleResult {
  const grade = gradeOf(scenario, battle);
  return grade === undefined ? "both-demoralized" : gradeFamily(grade);
}

/** A battle's result as players read it: its grade's name. */
export function battleTitle(scenario: Scenario, battle: BattleOutcome): string {
  return gradeOf(scenario, battle)?.name ?? battle.grade;
}

/** P4: the ground a grade takes, in words. */
export function groundText(ground: GradeDefinition["ground"]): string {
  if (ground === "all") return "takes all";
  if (ground === 0) return "no ground";
  return ground === 1 ? "1 sub-territory changes hands" : `${String(ground)} sub-territories change hands`;
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

export function battleBands(scenario: Scenario, battle: BattleOutcome): readonly BandView[] {
  const rules = scenario.d20;
  return columnBands(rules, battle.column).map((band) => ({
    band,
    grade: rules.grades.find((grade) => grade.id === band.gradeId),
    hit: battle.score >= band.from && battle.score <= band.to,
    range: band.from === band.to ? String(band.from) : `${String(band.from)}\u2013${String(band.to)}`
  }));
}
