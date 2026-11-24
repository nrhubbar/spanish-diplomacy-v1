import type { JSX } from "react";
import type { BattleOutcome, Scenario } from "../../engine/types";
import { whoFought } from "../../presentation/battleLedger";

/** D7: every unit in the battle with the men and morale it fought with and what it counted for, folded away. */
export function WhoFought({ battle, scenario }: { readonly battle: BattleOutcome; readonly scenario: Scenario }): JSX.Element {
  return (
    <details className="who-fought">
      <summary>Who fought</summary>
      <table>
        <caption className="visually-hidden">The units on each side and what each counted for</caption>
        <thead>
          <tr><th scope="col">Unit, men and morale</th><th scope="col">Counted for</th></tr>
        </thead>
        {whoFought(scenario, battle).map(({ fighters, heading }) => (
          <tbody key={heading}>
            <tr className="who-fought-side"><th colSpan={2} scope="rowgroup">{heading}</th></tr>
            {fighters.map((fighter) => (
              <tr key={fighter.id}>
                <th scope="row">
                  {fighter.name}
                  <span className="who-fought-detail">
                    {fighter.detail}
                    {fighter.demoralized === undefined ? null : <strong>{fighter.demoralized}</strong>}
                  </span>
                </th>
                <td>{String(fighter.value)}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </details>
  );
}
