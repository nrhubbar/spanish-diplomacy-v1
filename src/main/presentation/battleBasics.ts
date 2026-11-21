import { battleOdds } from "../engine/combat";
import { gradedOdds } from "../engine/d20/odds";
import { usesD20 } from "../engine/d20/rules";
import type { CombatModifier, Scenario } from "../engine/types";
import { worksRoll } from "../engine/works";

export interface ExampleCase {
  readonly armies: number;
  readonly attack: number;
  readonly oddsLabel: string;
  readonly takeChance: number;
}

export interface BattleExample {
  readonly cases: readonly ExampleCase[];
  readonly defence: number;
  /** R8: the defender's works in pips after one turn of entrenching. */
  readonly dugIn: number;
  /** What those works add for the defender on the die. */
  readonly dugInRoll: number;
  readonly typeName: string;
}

/**
 * The Briefing's worked example (B2), computed by the engine from the scenario's own data so it
 * can never disagree with a real battle: armies of the scenario's first unit type attack one of
 * the same type that has entrenched for one turn, first two of them and then three.
 */
export function battleExample(scenario: Scenario): BattleExample | undefined {
  const type = scenario.unitTypes[0];
  if (type === undefined) return undefined;
  const { max, perTurn } = scenario.combat.diggingIn;
  const dugIn = Math.min(perTurn, max);
  const dugInRoll = worksRoll(scenario, dugIn);
  const works: readonly CombatModifier[] = dugIn > 0 ? [{ kind: "dug-in", level: dugIn, roll: -dugInRoll }] : [];
  const cases = [2, 3].map((armies): ExampleCase => {
    // D1: on the d20, "take" means a grade that takes the whole territory.
    const odds = scenario.d20 !== undefined && usesD20(scenario)
      ? gradedOdds(scenario.d20, armies * type.attack, type.defence, works)
      : battleOdds(scenario.combat, armies * type.attack, type.defence, works);
    return { armies, attack: odds.attack, oddsLabel: odds.oddsLabel, takeChance: odds.takeChance };
  });
  return { cases, defence: type.defence, dugIn, dugInRoll, typeName: type.name.toLowerCase() };
}

/** M22, R8: works levels (pips) gained per turn of entrenching, their cap, and what one level is worth on the die. */
export function digRates(scenario: Scenario): { readonly max: number; readonly perLevel: number; readonly perTurn: number } {
  return { ...scenario.combat.diggingIn, perLevel: worksRoll(scenario, 1) };
}
