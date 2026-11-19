import type { JSX } from "react";
import type { GameState, Scenario } from "../../engine/types";
import type { BattleGroup } from "../../presentation/battle";
import { ruleNote } from "../../presentation/battleRules";

/**
 * The rule behind an unusual battle, as a disclosure: keyboard and touch friendly, and read in
 * order by screen readers. Plain two-sided battles have none.
 */
export function BattleRule({ finalState, group, scenario }: { readonly finalState: GameState; readonly group: BattleGroup; readonly scenario: Scenario }): JSX.Element | null {
  const note = ruleNote(scenario, finalState, group);
  if (note === undefined) return null;
  return (
    <details className="battle-rule">
      <summary>
        <span aria-hidden="true" className="battle-rule-icon">i</span>
        {note.title}
      </summary>
      <ol>
        {note.steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
    </details>
  );
}
