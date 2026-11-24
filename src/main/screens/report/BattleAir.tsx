import type { JSX } from "react";
import { RollLedger } from "../../components/RollLedger";
import type { AirBattleOutcome, Scenario } from "../../engine/types";
import { airBattleView } from "../../presentation/battleAir";

interface BattleAirProps {
  readonly air: AirBattleOutcome;
  readonly scenario: Scenario;
}

/**
 * U10, R11: an engagement's air battle on the battle card, above its ground battle and drawn like
 * it: one die, everything that changed it, the score, the table with the row it hit, who got
 * Ground Support, who was driven off and who was lost.
 */
export function BattleAir({ air, scenario }: BattleAirProps): JSX.Element {
  const view = airBattleView(scenario, air);
  return (
    <section aria-label="Air battle" className="battle-air">
      <p className="battle-air-heading">Air battle</p>
      <div className="battle-roll battle-roll-d20">
        <p className="battle-die">
          <span className="visually-hidden">{`Die roll ${String(view.die)}`}</span>
          <span aria-hidden="true" className="d20-face">{String(view.die)}</span>
        </p>
        <RollLedger rows={view.ledger.rows} total={view.ledger.total} />
        <p className="battle-outcome">
          {"Outcome: "}
          <span className="battle-outcome-score">{String(view.score)}</span>
          {view.clamp === undefined ? null : <span className="battle-outcome-clamp">{` (${view.clamp})`}</span>}
        </p>
        <table className="battle-bands">
          <caption className="visually-hidden">What each score in the air gives</caption>
          <thead className="visually-hidden">
            <tr><th scope="col">Score</th><th scope="col">Result</th><th scope="col">Effect</th></tr>
          </thead>
          <tbody>
            {view.bands.map((band) => (
              <tr aria-current={band.hit ? "true" : undefined} className={band.hit ? "battle-band battle-band-hit" : "battle-band"} key={band.range}>
                <td className="battle-band-range">{band.range}</td>
                <th className="battle-band-grade" scope="row">{band.name}</th>
                <td className="battle-band-effect">{band.effect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view.results.map((result) => <p className="battle-air-result" key={result}>{result}</p>)}
    </section>
  );
}
