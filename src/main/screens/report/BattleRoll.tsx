import type { JSX } from "react";
import type { BattleOutcome, Scenario } from "../../engine/types";
import { RollLedger } from "../../components/RollLedger";
import { battleLedger } from "../../presentation/battleLedger";
import { columnLabel } from "../../presentation/battleText";
import { glyphs } from "../../presentation/glyphs";
import { battleBands, gradeEffect } from "../../presentation/grades";
import { WhoFought } from "./WhoFought";

/**
 * D8, D7: a d20 battle's roll. The odds and column, the die, then one ledger of everything that
 * changed it, the total and the outcome; then the column as bands, each with its score range,
 * grade and effect, with the band the outcome hit outlined. Only the battle's own column is shown
 * (Q-D20-3 note). Who fought folds out below.
 */
export function BattleRoll({ battle, scenario }: { readonly battle: BattleOutcome; readonly scenario: Scenario }): JSX.Element {
  const ledger = battleLedger(scenario, battle);
  const bands = battleBands(scenario, battle);
  return (
    <div className="battle-roll battle-roll-d20">
      <p className="battle-odds">
        <span className="battle-odds-label">{battle.oddsLabel}</span>
        {` odds ${glyphs.dot} the ${columnLabel(battle.column)} column of the d20 table`}
      </p>
      <p className="battle-die">
        <span className="visually-hidden">{`Die roll ${String(battle.die)}`}</span>
        <span aria-hidden="true" className="d20-face">{String(battle.die)}</span>
      </p>
      <RollLedger rows={ledger.rows} total={ledger.total} />
      <p className="battle-outcome">
        {"Outcome: "}
        <span className="battle-outcome-score">{String(ledger.outcome)}</span>
        {ledger.clamp === undefined ? null : <span className="battle-outcome-clamp">{` (${ledger.clamp})`}</span>}
      </p>
      <table className="battle-bands">
        <caption className="visually-hidden">{`What each score in the ${columnLabel(battle.column)} column does`}</caption>
        <thead className="visually-hidden">
          <tr><th scope="col">Score</th><th scope="col">Result</th><th scope="col">Effect</th></tr>
        </thead>
        <tbody>
          {bands.map(({ band, grade, hit, range }) => (
            <tr aria-current={hit ? "true" : undefined} className={hit ? "battle-band battle-band-hit" : "battle-band"} data-ground={String(grade.ground)} key={band.from}>
              <td className="battle-band-range">{range}</td>
              <th className="battle-band-grade" scope="row">{grade.name}</th>
              <td className="battle-band-effect">{gradeEffect(grade)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <WhoFought battle={battle} scenario={scenario} />
    </div>
  );
}
