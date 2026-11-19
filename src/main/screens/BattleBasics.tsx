import { type JSX, useId } from "react";
import type { Scenario } from "../engine/types";
import { type BattleExample, battleExample } from "../presentation/battleBasics";
import { percent } from "../presentation/odds";

const counted = ["no", "one", "two", "three"];
const count = (n: number): string => counted[n] ?? String(n);

/** The "How battles work" card in the Briefing: the rules in brief, then a worked example. */
export function BattleBasics({ scenario }: { readonly scenario: Scenario }): JSX.Element {
  const headingId = useId();
  const { demoralizationFactor, diggingIn } = scenario.combat;
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
        <li>{`Armies that hold quietly dig in: each turn shifts the die ${String(diggingIn.perTurn)} in the defenders' favour, up to ${String(diggingIn.max)}.`}</li>
        <li>{`A demoralized army fights at ${weakened} and cannot attack until it spends a turn without moving.`}</li>
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
      {`Example: ${count(first.armies)} ${example.typeName} armies attack with ${String(first.attack)} against one with defence ${String(example.defence)}${dug}. `}
      {`That is ${first.oddsLabel} odds: ${percent(first.takeChance)} to take the territory. `}
      {`A ${second.armies === 3 ? "third" : "further"} army makes it ${String(second.attack)} against ${String(example.defence)}, ${second.oddsLabel} odds: ${percent(second.takeChance)}.`}
    </p>
  );
}
