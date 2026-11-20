import type { JSX } from "react";
import type { D20BattleOutcome, Scenario } from "../../engine/types";
import { columnLabel } from "../../presentation/battleText";
import { glyphs } from "../../presentation/glyphs";
import { battleBands, gradeEffect, rawScore } from "../../presentation/grades";
import { modifierName, signed } from "../../presentation/odds";

/**
 * D8: a d20 battle's roll. The odds and column, then the die, every modifier by name and the
 * score, in one line; then the column as bands, each with its score range, grade and effect, with
 * the band the score hit outlined. Only the battle's own column is shown (Q-D20-3 note).
 */
export function BattleGradedRoll({ battle, scenario }: { readonly battle: D20BattleOutcome; readonly scenario: Scenario }): JSX.Element {
  const raw = rawScore(battle);
  const bands = battleBands(scenario, battle);
  return (
    <div className="battle-roll battle-roll-d20">
      <p className="battle-odds">
        <span className="battle-odds-label">{battle.oddsLabel}</span>
        {` odds ${glyphs.dot} the ${columnLabel(battle.column)} column of the d20 table`}
      </p>
      <p className="battle-score">
        <span aria-hidden="true" className="d20-face">{String(battle.die)}</span>
        <span className="battle-score-sum">
          {`d20 ${String(battle.die)}`}
          {battle.modifiers.map((modifier, index) => (
            <span className="battle-score-term" key={`${modifier.kind}-${String(index)}`}>{` ${glyphs.dot} ${modifierName(modifier, scenario)} ${signed(modifier.roll)}`}</span>
          ))}
          {" = "}
          <strong>{String(battle.score)}</strong>
          {raw === battle.score ? null : <span className="battle-score-clamp">{` (${String(raw)}, kept within 0 to 20)`}</span>}
        </span>
      </p>
      <table className="battle-bands">
        <caption className="visually-hidden">{`What each score in the ${columnLabel(battle.column)} column does`}</caption>
        <thead className="visually-hidden">
          <tr><th scope="col">Score</th><th scope="col">Result</th><th scope="col">Effect</th></tr>
        </thead>
        <tbody>
          {bands.map(({ band, grade, hit, range }) => (
            <tr aria-current={hit ? "true" : undefined} className={hit ? "battle-band battle-band-hit" : "battle-band"} data-ground={String(grade?.ground ?? 0)} key={band.from}>
              <td className="battle-band-range">{range}</td>
              <th className="battle-band-grade" scope="row">{grade?.name ?? band.gradeId}</th>
              <td className="battle-band-effect">{grade === undefined ? "" : gradeEffect(grade)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
