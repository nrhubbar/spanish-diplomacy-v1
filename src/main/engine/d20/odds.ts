import { oddsFor } from "../combat/odds";
import { dieFaces } from "../dice";
import type { CombatModifier, D20Rules, GradeDefinition, GradeId } from "../types";
import { d20Faces, lastScore } from "./rules";

/** D1: one run of scores in a column that all read the same grade, for the battle card's bands (D8). */
export interface GradeBand {
  readonly from: number;
  readonly gradeId: GradeId;
  readonly to: number;
}

/** D1-D3: everything about a d20 battle that is known before the die is rolled. */
export interface BattleOdds {
  readonly attack: number;
  /** The column's bands, lowest score first. */
  readonly bands: readonly GradeBand[];
  /** Probability of each grade the column can roll, in [0, 1]. */
  readonly chances: ReadonlyMap<GradeId, number>;
  readonly column: number;
  readonly defence: number;
  /**
   * Expected shares of each side's value lost to men (losses) and to morale (demoralized), from
   * the grade catalogue (D2). The computer player weighs these (C15).
   */
  readonly expected: {
    readonly attackerDemoralized: number;
    readonly attackerLoss: number;
    readonly defenderDemoralized: number;
    readonly defenderLoss: number;
  };
  /** Chance of any ground: one or more sub-territories, or the whole territory (P4). */
  readonly gainChance: number;
  /** Situational modifiers first, then the odds modifiers. */
  readonly modifiers: readonly CombatModifier[];
  readonly oddsLabel: string;
  readonly rollModifier: number;
  /** Chance the attacker takes the whole territory: a grade with ground "all". */
  readonly takeChance: number;
}

const demoralizedShare = { all: 1, half: 0.5, none: 0 } as const;

/** D3: the odds' own modifiers on the d20: below 1:1 and above 6:1, each step x the d20 penalty. */
function oddsModifiers(rules: D20Rules, attack: number, defence: number): readonly CombatModifier[] {
  const odds = oddsFor(Math.max(1, attack), Math.max(1, defence));
  const step = rules.modifiers.belowOneToOnePenalty;
  const modifiers: CombatModifier[] = [];
  if (odds.overflow > 0) modifiers.push({ kind: "odds-overflow", roll: odds.overflow * step });
  if (odds.halvings > 0) modifiers.push({ halvings: odds.halvings, kind: "odds-halving", roll: -odds.halvings * step });
  return modifiers;
}

/** D1: the score for a die: the die plus every modifier, clamped to 0..20. */
export function scoreFor(die: number, modifier: number): number {
  return Math.min(lastScore, Math.max(0, die + modifier));
}

function requireGrade(rules: D20Rules, id: GradeId): GradeDefinition {
  const grade = rules.grades.find((candidate) => candidate.id === id);
  if (grade === undefined) throw new Error(`Invariant violated: unknown grade "${id}".`);
  return grade;
}

/** D1: the grade in a column and score of the scenario's table. */
export function gradeAt(rules: D20Rules, column: number, score: number): GradeDefinition {
  const id = rules.table[column]?.[score];
  if (id === undefined) throw new Error(`Invariant violated: no d20 table entry at column ${String(column)}, score ${String(score)}.`);
  return requireGrade(rules, id);
}

/** D8: a column as bands of equal grades, lowest score first. */
export function columnBands(rules: D20Rules, column: number): readonly GradeBand[] {
  const bands: GradeBand[] = [];
  for (let score = 0; score <= lastScore; score += 1) {
    const { id } = gradeAt(rules, column, score);
    const last = bands.at(-1);
    if (last !== undefined && last.gradeId === id) bands[bands.length - 1] = { ...last, to: score };
    else bands.push({ from: score, gradeId: id, to: score });
  }
  return bands;
}

/** D1-D3: odds, modifiers and the grade distribution for given side values. */
export function battleOdds(rules: D20Rules, attack: number, defence: number, situational: readonly CombatModifier[]): BattleOdds {
  const odds = oddsFor(Math.max(1, attack), Math.max(1, defence));
  const modifiers = [...situational, ...oddsModifiers(rules, attack, defence)];
  const rollModifier = modifiers.reduce((sum, modifier) => sum + modifier.roll, 0);
  // Faces are counted before dividing, so ten faces of twenty are exactly one half.
  const faces = new Map<GradeId, number>();
  const expected = { attackerDemoralized: 0, attackerLoss: 0, defenderDemoralized: 0, defenderLoss: 0 };
  let takeFaces = 0;
  let gainFaces = 0;
  const share = 1 / dieFaces;
  for (const die of d20Faces) {
    const grade = gradeAt(rules, odds.column, scoreFor(die, rollModifier));
    faces.set(grade.id, (faces.get(grade.id) ?? 0) + 1);
    expected.attackerLoss += share * grade.attacker.lossPercent / 100;
    expected.defenderLoss += share * Math.min(1, grade.defender.lossPercent / 100 + (grade.defender.weakestDestroyed ? 0.15 : 0));
    expected.attackerDemoralized += share * demoralizedShare[grade.attacker.demoralized];
    expected.defenderDemoralized += share * demoralizedShare[grade.defender.demoralized];
    if (grade.ground === "all") takeFaces += 1;
    if (grade.ground !== 0) gainFaces += 1;
  }
  return {
    attack,
    bands: columnBands(rules, odds.column),
    chances: new Map([...faces].map(([id, count]) => [id, count / dieFaces])),
    column: odds.column,
    defence,
    expected,
    gainChance: gainFaces / dieFaces,
    modifiers,
    oddsLabel: odds.label,
    rollModifier,
    takeChance: takeFaces / dieFaces
  };
}
