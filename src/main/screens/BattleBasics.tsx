import { type JSX, useId } from "react";
import type { Scenario } from "../engine/types";
import { type BattleExample, battleExample, digRates } from "../presentation/battleBasics";
import { usesD20 } from "../engine/d20/rules";
import { percent } from "../presentation/odds";

const counted = ["no", "one", "two", "three"];
const count = (n: number): string => counted[n] ?? String(n);

/** The "How battles work" card in the Briefing: the rules in brief, then a worked example. */
export function BattleBasics({ scenario }: { readonly scenario: Scenario }): JSX.Element {
  const headingId = useId();
  const { demoralizationFactor } = scenario.combat;
  const diggingIn = digRates(scenario);
  const d20 = scenario.d20 !== undefined && usesD20(scenario) ? scenario.d20 : undefined;
  const example = battleExample(scenario);
  const weakened = demoralizationFactor === 0.5 ? "half its values" : `${percent(demoralizationFactor)} of its values`;
  return (
    <section aria-labelledby={headingId} className="pane-section">
      <h3 id={headingId}>How battles work</h3>
      <ul className="plain-list briefing-list">
        <li>Every army has an attack and a defence value. A weakened army fights in proportion to the men it has left.</li>
        <li>
          Moving into a territory another faction holds starts a battle. Your armies attacking it fight together, even from
          different territories, and the odds of attack against defence, with a roll of the die, decide the result.
        </li>
        {d20 === undefined ? null : (
          <li>
            {`Battles roll a d20. Each result costs each side a share of its men, may demoralize some units, and may take part or all of the territory. Attacking tires a unit: at fatigue ${String(d20.fatigue.fatiguedLevel)} it fights Fatigued (${String(d20.modifiers.fatigued)}), and at ${String(d20.fatigue.demoralizedLevel)} it is demoralized. A quiet turn in uncontested ground rests it.`}
          </li>
        )}
        <li>Every unit has one order each turn: Move, Entrench, or Rest. A unit you do not move entrenches, or rests if it is demoralized.</li>
        <li>
          {`Entrenching units dig the territory in: each turn shifts the die ${String(diggingIn.perTurn)} in the defenders' favour, up to ${String(diggingIn.max)}. `}
          Armies that move do not dig in, and a battle in the territory stops the digging for that turn.
        </li>
        <li>{`A demoralized unit fights at ${weakened} and cannot attack. It cannot entrench either: it rests, and recovers after one turn of rest.`}</li>
        <li>Attrition costs men for good, from the strongest armies first. Demoralization passes with rest and falls on the weakest first.</li>
        <li>Moving into a territory your faction controls is a reinforcement: it always arrives.</li>
      </ul>
      {example === undefined ? null : <ExampleText example={example} />}
    </section>
  );
}

function ExampleText({ example }: { readonly example: BattleExample }): JSX.Element | null {
  const [first, second] = example.cases;
  if (first === undefined || second === undefined) return null;
  const dug = example.dugIn > 0 ? `, dug in +${String(example.dugIn)}` : "";
  return (
    <p className="pane-hint">
      {`Example: ${count(first.armies)} ${example.typeName} units attack with ${String(first.attack)} against one with defence ${String(example.defence)}${dug}. `}
      {`That is ${first.oddsLabel} odds: ${percent(first.takeChance)} to take the territory. `}
      {`A ${second.armies === 3 ? "third" : "further"} unit makes it ${String(second.attack)} against ${String(example.defence)}, ${second.oddsLabel} odds: ${percent(second.takeChance)}.`}
    </p>
  );
}
