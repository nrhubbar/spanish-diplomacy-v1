import { battleOdds } from "../engine/combat";
import type { CombatModifier, Scenario } from "../engine/types";

export interface ExampleCase {
  readonly armies: number;
  readonly attack: number;
  readonly oddsLabel: string;
  readonly takeChance: number;
}

export interface BattleExample {
  readonly cases: readonly ExampleCase[];
  readonly defence: number;
  readonly dugIn: number;
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
  const { diggingIn } = scenario.combat;
  const dugIn = Math.min(diggingIn.perTurn, diggingIn.max);
  const works: readonly CombatModifier[] = dugIn > 0 ? [{ kind: "dug-in", level: dugIn, roll: -dugIn }] : [];
  const cases = [2, 3].map((armies): ExampleCase => {
    const odds = battleOdds(scenario.combat, armies * type.attack, type.defence, works);
    return { armies, attack: odds.attack, oddsLabel: odds.oddsLabel, takeChance: odds.takeChance };
  });
  return { cases, defence: type.defence, dugIn, typeName: type.name.toLowerCase() };
}
